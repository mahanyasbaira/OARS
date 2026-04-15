import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface NeuroAnalysis {
  id: string
  project_id: string
  extraction_id: string
  user_id: string
  status: 'pending' | 'running' | 'complete' | 'failed'
  job_id: string | null
  error: string | null
  results: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
}

export async function createNeuroAnalysis(
  projectId: string,
  extractionId: string,
  userId: string,
  jobId: string
): Promise<NeuroAnalysis> {
  const { data, error } = await adminClient()
    .from('neuro_analyses')
    .insert({ project_id: projectId, extraction_id: extractionId, user_id: userId, job_id: jobId, status: 'pending' })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to create neuro analysis: ${error?.message}`)
  return data as NeuroAnalysis
}

export async function updateNeuroAnalysis(
  id: string,
  patch: Partial<Pick<NeuroAnalysis, 'status' | 'error' | 'results' | 'completed_at' | 'job_id'>>
): Promise<void> {
  const { error } = await adminClient()
    .from('neuro_analyses')
    .update(patch)
    .eq('id', id)

  if (error) throw new Error(`Failed to update neuro analysis: ${error.message}`)
}

export async function getNeuroAnalysesByProject(
  projectId: string,
  userId: string
): Promise<NeuroAnalysis[]> {
  const { data, error } = await adminClient()
    .from('neuro_analyses')
    .select()
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch neuro analyses: ${error.message}`)
  return (data ?? []) as NeuroAnalysis[]
}

export async function getNeuroAnalysis(
  id: string,
  userId: string
): Promise<NeuroAnalysis | null> {
  const { data, error } = await adminClient()
    .from('neuro_analyses')
    .select()
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) return null
  return data as NeuroAnalysis
}
