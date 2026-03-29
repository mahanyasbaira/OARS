import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getUserIdByClerkId } from '@/server/db/users'
import { getProjectById } from '@/server/db/projects'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Returns source status + extraction summary for a single source.
// Used by the UI to poll status while extraction is in progress.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  const { id: projectId, sourceId } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const project = await getProjectById(projectId, userId)
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { data: source, error } = await adminClient()
    .from('sources')
    .select('id, name, modality, status, created_at')
    .eq('id', sourceId)
    .eq('project_id', projectId)
    .single()

  if (error || !source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })

  const { data: extraction } = await adminClient()
    .from('extractions')
    .select('id, confidence, model, prompt_version, created_at')
    .eq('source_id', sourceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    source,
    extraction: extraction ?? null,
  })
}
