import { createClient } from '@supabase/supabase-js'
import type { ReportPayload } from '@/schemas/report'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type ReportRow = {
  id:            string
  project_id:    string
  payload:       Record<string, unknown>
  prompt_version: string
  model:         string
  created_at:    string
}

export async function saveReport(payload: ReportPayload): Promise<{ id: string }> {
  const { data, error } = await adminClient()
    .from('reports')
    .insert({
      project_id:     payload.projectId,
      payload:        payload as unknown as Record<string, unknown>,
      prompt_version: payload.promptVersion,
      model:          payload.model,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Failed to save report: ${error?.message}`)
  return data as { id: string }
}

export async function getLatestReport(projectId: string): Promise<ReportRow | null> {
  const { data, error } = await adminClient()
    .from('reports')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch report: ${error.message}`)
  return data as ReportRow | null
}
