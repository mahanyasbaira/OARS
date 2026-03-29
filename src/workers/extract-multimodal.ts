import { runAudioAgent } from '@/agents/audio-agent'
import { runVisionAgent } from '@/agents/vision-agent'
import { saveExtraction } from '@/server/db/extractions'
import { createJob, updateJobStatus, updateSourceStatus, incrementJobAttempts } from '@/server/db/jobs'
import { runTimelineAggregation } from '@/workers/aggregate-timeline'

const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

/**
 * Fetches a file from R2 and returns its buffer.
 */
async function fetchFileFromR2(r2Key: string): Promise<Buffer> {
  const url = `${process.env.R2_PUBLIC_URL}/${r2Key}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch file from R2: ${res.status} ${r2Key}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Multimodal extraction pipeline — TRIBE v2 cross-modal processing.
 *
 * - Audio files:  Audio Agent only
 * - Image files:  Vision Agent only
 * - Video files:  BOTH Audio Agent + Vision Agent run on the same file (cross-modal)
 *
 * Both extractions are saved independently so the Temporal Aggregator
 * receives cross-modal input when merging the project timeline.
 */
export async function runMultimodalPipeline(
  sourceId: string,
  projectId: string,
  r2Key: string,
  mimeType: string
): Promise<void> {
  const job = await createJob(projectId, sourceId, 'multimodal-extraction')

  await updateSourceStatus(sourceId, 'processing')
  await updateJobStatus(job.id, 'running')
  await incrementJobAttempts(job.id)

  try {
    const buffer = await fetchFileFromR2(r2Key)

    const isAudio = AUDIO_MIME_TYPES.includes(mimeType)
    const isVideo = VIDEO_MIME_TYPES.includes(mimeType)

    if (isVideo) {
      // Cross-modal: run Audio + Vision agents on the same video file in parallel
      const [audioExtraction, visionExtraction] = await Promise.all([
        runAudioAgent(sourceId, projectId, buffer, mimeType),
        runVisionAgent(sourceId, projectId, buffer, mimeType),
      ])
      await Promise.all([
        saveExtraction(audioExtraction),
        saveExtraction(visionExtraction),
      ])
    } else if (isAudio) {
      const extraction = await runAudioAgent(sourceId, projectId, buffer, mimeType)
      await saveExtraction(extraction)
    } else {
      // Image (jpg, png, webp)
      const extraction = await runVisionAgent(sourceId, projectId, buffer, mimeType)
      await saveExtraction(extraction)
    }

    await updateSourceStatus(sourceId, 'ready')
    await updateJobStatus(job.id, 'completed')

    // Re-aggregate timeline with the new multimodal extraction(s)
    runTimelineAggregation(projectId).catch((err) => {
      console.error(`[extract-multimodal] Timeline aggregation failed for project ${projectId}:`, err)
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[extract-multimodal] Job ${job.id} failed: ${message}`)
    await updateSourceStatus(sourceId, 'failed')
    await updateJobStatus(job.id, 'failed', message)
  }
}
