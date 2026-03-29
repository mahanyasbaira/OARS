import { createClient } from '@supabase/supabase-js'
import type { SourceModality, SourceStatus } from '@/lib/supabase/types'

export type SourceRow = {
  id: string
  name: string
  modality: SourceModality
  status: SourceStatus
  created_at: string
  uploads: Array<{
    id: string
    original_filename: string
    mime_type: string
    file_size: number | null
  }>
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getSourcesByProjectId(projectId: string): Promise<SourceRow[]> {
  const { data, error } = await adminClient()
    .from('sources')
    .select('id, name, modality, status, created_at, uploads(id, original_filename, mime_type, file_size)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch sources: ${error.message}`)
  return (data ?? []) as unknown as SourceRow[]
}

export async function createSource(
  projectId: string,
  name: string,
  modality: SourceModality
): Promise<{ id: string; name: string; modality: SourceModality; status: SourceStatus; created_at: string }> {
  const { data, error } = await adminClient()
    .from('sources')
    .insert({ project_id: projectId, name, modality, status: 'pending' })
    .select('id, name, modality, status, created_at')
    .single()

  if (error || !data) throw new Error(`Failed to create source: ${error?.message}`)
  return data as { id: string; name: string; modality: SourceModality; status: SourceStatus; created_at: string }
}

export async function createUpload(
  sourceId: string,
  r2Key: string,
  originalFilename: string,
  mimeType: string,
  fileSize: number
): Promise<{ id: string }> {
  const { data, error } = await adminClient()
    .from('uploads')
    .insert({
      source_id: sourceId,
      r2_key: r2Key,
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size: Math.round(fileSize),
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Failed to create upload record: ${error?.message}`)
  return data as { id: string }
}
