import { createClient } from '@supabase/supabase-js'
import type { CreateProjectInput } from '@/schemas/project'

export type ProjectRow = {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

// Service-role client — bypasses RLS, scoping is enforced by user_id filters
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getProjectsByUserId(userId: string): Promise<ProjectRow[]> {
  const { data, error } = await adminClient()
    .from('projects')
    .select('id, name, description, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch projects: ${error.message}`)
  return (data ?? []) as ProjectRow[]
}

export async function getProjectById(projectId: string, userId: string): Promise<ProjectRow | null> {
  const { data, error } = await adminClient()
    .from('projects')
    .select('id, name, description, created_at, updated_at')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data as ProjectRow
}

/** Server-side lookup by ID only — for use in workers where userId is unavailable. */
export async function getProjectNameById(projectId: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .single()

  if (error || !data) return null
  return (data as { name: string }).name
}

export async function createProject(userId: string, input: CreateProjectInput): Promise<ProjectRow> {
  const { data, error } = await adminClient()
    .from('projects')
    .insert({ user_id: userId, name: input.name, description: input.description ?? null })
    .select('id, name, description, created_at, updated_at')
    .single()

  if (error || !data) throw new Error(`Failed to create project: ${error?.message}`)
  return data as ProjectRow
}

export async function deleteProject(projectId: string, userId: string): Promise<void> {
  const { error } = await adminClient()
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to delete project: ${error.message}`)
}
