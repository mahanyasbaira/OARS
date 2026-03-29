import { auth } from '@clerk/nextjs/server'
import { getProjectById } from '@/server/db/projects'
import { getUserIdByClerkId } from '@/server/db/users'
import { getLatestReport } from '@/server/db/reports'
import { generateReport } from '@/workers/generate-report'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return Response.json({ error: 'User not found' }, { status: 404 })

  const project = await getProjectById(projectId, userId)
  if (!project) return Response.json({ error: 'Not found' }, { status: 404 })

  const report = await getLatestReport(projectId)
  return Response.json({ report })
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return Response.json({ error: 'User not found' }, { status: 404 })

  const project = await getProjectById(projectId, userId)
  if (!project) return Response.json({ error: 'Not found' }, { status: 404 })

  try {
    const { id } = await generateReport(projectId)
    return Response.json({ reportId: id }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 422 })
  }
}
