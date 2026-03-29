import { createClient } from '@supabase/supabase-js'
import type { JobStatus } from '@/lib/supabase/types'

export type JobRow = {
  id: string
  project_id: string
  source_id: string | null
  type: string
  status: JobStatus
  error: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  attempts: number
  created_at: string
  updated_at: string
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function createJob(
  projectId: string,
  sourceId: string,
  type: string
): Promise<JobRow> {
  const { data, error } = await adminClient()
    .from('jobs')
    .insert({ project_id: projectId, source_id: sourceId, type, status: 'queued' })
    .select('*')
    .single()

  if (error || !data) throw new Error(`Failed to create job: ${error?.message}`)
  return data as JobRow
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  error?: string
): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (error) patch.error = { message: error }

  const { error: dbError } = await adminClient()
    .from('jobs')
    .update(patch)
    .eq('id', jobId)

  if (dbError) throw new Error(`Failed to update job: ${dbError.message}`)
}

export async function incrementJobAttempts(jobId: string): Promise<void> {
  const { error } = await adminClient()
    .rpc('increment_job_attempts', { job_id: jobId })

  // Fallback if RPC doesn't exist — fetch then update
  if (error) {
    const { data } = await adminClient()
      .from('jobs')
      .select('attempts')
      .eq('id', jobId)
      .single()
    const attempts = ((data as { attempts: number } | null)?.attempts ?? 0) + 1
    await adminClient().from('jobs').update({ attempts }).eq('id', jobId)
  }
}

export async function updateSourceStatus(
  sourceId: string,
  status: 'pending' | 'processing' | 'ready' | 'failed'
): Promise<void> {
  const { error } = await adminClient()
    .from('sources')
    .update({ status })
    .eq('id', sourceId)

  if (error) throw new Error(`Failed to update source status: ${error.message}`)
}
