import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserIdByClerkId } from '@/server/db/users'
import { getProjectById } from '@/server/db/projects'
import { runExtractionPipeline } from '@/workers/extract-text'
import { createClient } from '@supabase/supabase-js'

const schema = z.object({
  sourceId:  z.string().uuid(),
  projectId: z.string().uuid(),
})

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body: unknown = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { sourceId, projectId } = parsed.data

  // Verify ownership
  const project = await getProjectById(projectId, userId)
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Fetch the upload record to get r2Key and mimeType
  const { data: upload, error } = await adminClient()
    .from('uploads')
    .select('r2_key, mime_type')
    .eq('source_id', sourceId)
    .single()

  if (error || !upload) {
    return NextResponse.json({ error: 'Upload not found for this source' }, { status: 404 })
  }

  const { r2_key: r2Key, mime_type: mimeType } = upload as { r2_key: string; mime_type: string }

  // Only text modalities supported in Milestone 2
  if (!['application/pdf', 'text/plain', 'text/markdown'].includes(mimeType)) {
    return NextResponse.json(
      { error: 'Only text files (PDF, txt, md) are supported in this milestone' },
      { status: 422 }
    )
  }

  // Run pipeline — fires async, returns immediately with 202
  // In Milestone 5 this will be dispatched to a background worker queue
  runExtractionPipeline(sourceId, projectId, r2Key, mimeType).catch((err) => {
    console.error('[/api/extract] Pipeline error:', err)
  })

  return NextResponse.json({ status: 'queued', sourceId }, { status: 202 })
}
