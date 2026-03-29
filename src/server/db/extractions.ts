import { createClient } from '@supabase/supabase-js'
import type { ExtractionPayload } from '@/schemas/extraction'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function saveExtraction(payload: ExtractionPayload): Promise<{ id: string }> {
  const { data, error } = await adminClient()
    .from('extractions')
    .insert({
      source_id:      payload.sourceId,
      project_id:     payload.projectId,
      modality:       payload.modality,
      payload:        payload as unknown as Record<string, unknown>,
      confidence:     payload.confidence,
      prompt_version: payload.promptVersion,
      model:          payload.model,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Failed to save extraction: ${error?.message}`)
  return data as { id: string }
}

export async function getExtractionsByProjectId(projectId: string) {
  const { data, error } = await adminClient()
    .from('extractions')
    .select('id, source_id, modality, confidence, prompt_version, model, created_at, payload')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch extractions: ${error.message}`)
  return (data ?? []) as Array<{
    id: string
    source_id: string
    modality: string
    confidence: number
    prompt_version: string
    model: string
    created_at: string
    payload: Record<string, unknown>
  }>
}
