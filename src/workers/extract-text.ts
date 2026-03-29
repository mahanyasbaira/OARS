import { runTextAgent } from '@/agents/text-agent'
import { saveExtraction } from '@/server/db/extractions'
import { createJob, updateJobStatus, updateSourceStatus, incrementJobAttempts } from '@/server/db/jobs'

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
 * Main extraction pipeline for a single source.
 * Sends the file buffer directly to Gemini — no intermediate text parsing step.
 * Called from the API route handler — runs inline for now (Milestone 2).
 * In Milestone 5 this moves to a persistent Railway worker with retry logic.
 */
export async function runExtractionPipeline(
  sourceId: string,
  projectId: string,
  r2Key: string,
  mimeType: string
): Promise<void> {
  // Create job record
  const job = await createJob(projectId, sourceId, 'text-extraction')

  await updateSourceStatus(sourceId, 'processing')
  await updateJobStatus(job.id, 'running')
  await incrementJobAttempts(job.id)

  try {
    // Step 1: fetch file from R2
    const buffer = await fetchFileFromR2(r2Key)

    // Step 2: run Text Agent — Gemini reads the file directly as base64
    const extraction = await runTextAgent(sourceId, projectId, buffer, mimeType)

    // Step 3: save extraction to DB
    await saveExtraction(extraction)

    // Step 4: mark done
    await updateSourceStatus(sourceId, 'ready')
    await updateJobStatus(job.id, 'completed')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[extract-text] Job ${job.id} failed: ${message}`)
    await updateSourceStatus(sourceId, 'failed')
    await updateJobStatus(job.id, 'failed', message)
  }
}
