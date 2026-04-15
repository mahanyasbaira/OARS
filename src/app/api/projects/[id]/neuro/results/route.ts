import { auth } from '@clerk/nextjs/server'
import { getUserIdByClerkId } from '@/server/db/users'
import { getProjectById } from '@/server/db/projects'
import { getNeuroAnalysis } from '@/server/db/neuro'

export async function GET(
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

  const url = new URL(req.url)
  const analysisId = url.searchParams.get('analysis_id')
  if (!analysisId) return Response.json({ error: 'Missing analysis_id query param' }, { status: 400 })

  const analysis = await getNeuroAnalysis(analysisId, userId)
  if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 })
  if (analysis.project_id !== projectId) return Response.json({ error: 'Not found' }, { status: 404 })

  if (analysis.status !== 'complete') {
    return Response.json({ status: analysis.status, results: null }, { status: 202 })
  }

  return Response.json({ status: 'complete', results: analysis.results })
}
