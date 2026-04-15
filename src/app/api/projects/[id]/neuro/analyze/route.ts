import { auth } from '@clerk/nextjs/server'
import { getUserIdByClerkId } from '@/server/db/users'
import { getProjectById } from '@/server/db/projects'
import { createNeuroAnalysis } from '@/server/db/neuro'
import { withRetry } from '@/lib/retry'
import { getSignedDownloadUrl } from '@/lib/r2/upload'
import { createClient } from '@supabase/supabase-js'

const BRAIN_SERVICE_URL = process.env.BRAIN_SERVICE_URL ?? 'http://localhost:8000'
const BRAIN_SERVICE_SECRET = process.env.BRAIN_SERVICE_SECRET ?? 'dev-secret'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return Response.json({ error: 'User not found' }, { status: 404 })

  const project = await getProjectById(projectId, userId)
  if (!project) return Response.json({ error: 'Not found' }, { status: 404 })

  let body: { source_id: string; extraction_id: string; duration_hint?: number }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { source_id, extraction_id, duration_hint = 30 } = body
  if (!source_id || !extraction_id) {
    return Response.json({ error: 'Missing required fields: source_id, extraction_id' }, { status: 400 })
  }

  // Fetch r2_key and mime_type from uploads table
  const { data: upload, error: uploadErr } = await adminClient()
    .from('uploads')
    .select('r2_key, mime_type')
    .eq('source_id', source_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (uploadErr || !upload) {
    return Response.json({ error: 'No upload found for this source' }, { status: 404 })
  }

  // Generate a signed download URL for the brain service to fetch from R2
  let fileUrl: string
  try {
    fileUrl = await getSignedDownloadUrl(upload.r2_key)
  } catch (err) {
    return Response.json({ error: `Failed to generate download URL: ${String(err)}` }, { status: 500 })
  }

  const fileType = upload.mime_type

  // Submit job to brain-service
  let brainJobId: string
  try {
    const res = await withRetry(() =>
      fetch(`${BRAIN_SERVICE_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brain-Secret': BRAIN_SERVICE_SECRET,
        },
        body: JSON.stringify({
          file_url: fileUrl,
          file_type: fileType,
          project_id: projectId,
          extraction_id,
          duration_hint,
        }),
      })
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Brain service error ${res.status}: ${text}`)
    }
    const json = await res.json() as { job_id: string }
    brainJobId = json.job_id
  } catch (err) {
    return Response.json({ error: `Brain service unavailable: ${String(err)}` }, { status: 502 })
  }

  // Persist to Supabase
  const analysis = await createNeuroAnalysis(projectId, extraction_id, userId, brainJobId)

  return Response.json({ analysis_id: analysis.id, job_id: brainJobId, status: 'pending' }, { status: 202 })
}
