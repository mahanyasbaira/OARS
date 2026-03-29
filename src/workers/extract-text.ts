import { createClient } from '@supabase/supabase-js'
// pdf-parse is CJS — kept as serverExternalPackage in next.config.ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
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
 * Extracts plain text from a PDF buffer.
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer)
  return data.text
}

/**
 * Main extraction pipeline for a single source.
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

    // Step 2: extract text based on mime type
    let text: string
    if (mimeType === 'application/pdf') {
      text = await extractTextFromPdf(buffer)
    } else {
      // Plain text files — decode buffer directly
      text = buffer.toString('utf-8')
    }

    if (!text.trim()) {
      throw new Error('No extractable text found in document')
    }

    // Step 3: run Text Agent
    const extraction = await runTextAgent(sourceId, projectId, text)

    // Step 4: save extraction to DB
    await saveExtraction(extraction)

    // Step 5: mark done
    await updateSourceStatus(sourceId, 'ready')
    await updateJobStatus(job.id, 'completed')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[extract-text] Job ${job.id} failed: ${message}`)
    await updateSourceStatus(sourceId, 'failed')
    await updateJobStatus(job.id, 'failed', message)
  }
}
