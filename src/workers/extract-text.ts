import { runTextAgent } from '@/agents/text-agent'
import { saveExtraction, hasExtractionForSource } from '@/server/db/extractions'
import { createJob, updateJobStatus, updateSourceStatus, incrementJobAttempts } from '@/server/db/jobs'
import { getProjectOwnerEmail } from '@/server/db/users'
import { getProjectNameById } from '@/server/db/projects'
import { runTimelineAggregation } from '@/workers/aggregate-timeline'
import { withRetry } from '@/lib/retry'
import { sendExtractionCompleteEmail } from '@/lib/email'

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
 * Main extraction pipeline for a single text/PDF source.
 * Sends the file buffer directly to Gemini — no intermediate text parsing step.
 * Retries up to 3 times with exponential backoff on agent failure.
 * Skips if extraction already exists for this source (deduplication guard).
 */
export async function runExtractionPipeline(
  sourceId: string,
  projectId: string,
  r2Key: string,
  mimeType: string
): Promise<void> {
  // Deduplication guard — skip if already processed
  if (await hasExtractionForSource(sourceId)) {
    console.log(`[extract-text] Source ${sourceId} already has extraction, skipping`)
    return
  }

  const job = await createJob(projectId, sourceId, 'text-extraction')

  await updateSourceStatus(sourceId, 'processing')
  await updateJobStatus(job.id, 'running')
  await incrementJobAttempts(job.id)

  try {
    const buffer = await fetchFileFromR2(r2Key)

    const extraction = await withRetry(
      () => runTextAgent(sourceId, projectId, buffer, mimeType),
      { label: `text-agent:${sourceId}` }
    )

    await saveExtraction(extraction)
    await updateSourceStatus(sourceId, 'ready')
    await updateJobStatus(job.id, 'completed')

    runTimelineAggregation(projectId).catch((err) => {
      console.error(`[extract-text] Timeline aggregation failed for project ${projectId}:`, err)
    })

    // Fire-and-forget email notification
    Promise.all([getProjectOwnerEmail(projectId), getProjectNameById(projectId)])
      .then(([email, name]) => {
        if (email && name) sendExtractionCompleteEmail(email, name, projectId)
      })
      .catch(() => { /* non-critical */ })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[extract-text] Job ${job.id} failed: ${message}`)
    await updateSourceStatus(sourceId, 'failed')
    await updateJobStatus(job.id, 'failed', message)
  }
}
