import { runAudioAgent } from '@/agents/audio-agent'
import { runVisionAgent } from '@/agents/vision-agent'
import { saveExtraction, hasExtractionForSource } from '@/server/db/extractions'
import { createJob, updateJobStatus, updateSourceStatus, incrementJobAttempts } from '@/server/db/jobs'
import { getProjectOwnerEmail } from '@/server/db/users'
import { getProjectNameById } from '@/server/db/projects'
import { runTimelineAggregation } from '@/workers/aggregate-timeline'
import { withRetry } from '@/lib/retry'
import { sendExtractionCompleteEmail } from '@/lib/email'

const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

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
 * Retries each agent up to 3 times with exponential backoff.
 * Skips if extraction already exists (deduplication guard).
 */
export async function runMultimodalPipeline(
  sourceId: string,
  projectId: string,
  r2Key: string,
  mimeType: string
): Promise<void> {
  // Deduplication guard
  if (await hasExtractionForSource(sourceId)) {
    console.log(`[extract-multimodal] Source ${sourceId} already has extraction, skipping`)
    return
  }

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
        withRetry(() => runAudioAgent(sourceId, projectId, buffer, mimeType), { label: `audio-agent:${sourceId}` }),
        withRetry(() => runVisionAgent(sourceId, projectId, buffer, mimeType), { label: `vision-agent:${sourceId}` }),
      ])
      await Promise.all([
        saveExtraction(audioExtraction),
        saveExtraction(visionExtraction),
      ])
    } else if (isAudio) {
      const extraction = await withRetry(
        () => runAudioAgent(sourceId, projectId, buffer, mimeType),
        { label: `audio-agent:${sourceId}` }
      )
      await saveExtraction(extraction)
    } else {
      const extraction = await withRetry(
        () => runVisionAgent(sourceId, projectId, buffer, mimeType),
        { label: `vision-agent:${sourceId}` }
      )
      await saveExtraction(extraction)
    }

    await updateSourceStatus(sourceId, 'ready')
    await updateJobStatus(job.id, 'completed')

    runTimelineAggregation(projectId).catch((err) => {
      console.error(`[extract-multimodal] Timeline aggregation failed for project ${projectId}:`, err)
    })

    Promise.all([getProjectOwnerEmail(projectId), getProjectNameById(projectId)])
      .then(([email, name]) => {
        if (email && name) sendExtractionCompleteEmail(email, name, projectId)
      })
      .catch(() => { /* non-critical */ })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[extract-multimodal] Job ${job.id} failed: ${message}`)
    await updateSourceStatus(sourceId, 'failed')
    await updateJobStatus(job.id, 'failed', message)
  }
}
