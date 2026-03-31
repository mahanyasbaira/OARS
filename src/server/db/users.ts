import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Upserts a user record synced from Clerk.
 * Called on first sign-in — safe to call on every authenticated request.
 */
export async function upsertUser(clerkId: string, email: string): Promise<void> {
  const { error } = await adminClient()
    .from('users')
    .upsert({ clerk_id: clerkId, email }, { onConflict: 'clerk_id' })

  if (error) throw new Error(`Failed to upsert user: ${error.message}`)
}

/**
 * Returns the email for a project owner, or null if not found.
 */
export async function getProjectOwnerEmail(projectId: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from('projects')
    .select('users(email)')
    .eq('id', projectId)
    .single()

  if (error || !data) return null
  const users = (data as { users: { email: string } | null }).users
  return users?.email ?? null
}

/**
 * Returns the internal UUID for a Clerk user, or null if not found.
 */
export async function getUserIdByClerkId(clerkId: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId)
    .single()

  if (error || !data) return null
  return (data as { id: string }).id
}
