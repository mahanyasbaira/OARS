import { auth } from '@clerk/nextjs/server'
import { getUserIdByClerkId } from '@/server/db/users'
import { getProjectById } from '@/server/db/projects'
import { getNeuroAnalysesByProject, updateNeuroAnalysis } from '@/server/db/neuro'

const BRAIN_SERVICE_URL = process.env.BRAIN_SERVICE_URL ?? 'http://localhost:8000'
const BRAIN_SERVICE_SECRET = process.env.BRAIN_SERVICE_SECRET ?? 'dev-secret'

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

  const analyses = await getNeuroAnalysesByProject(projectId, userId)

  // For any in-flight jobs, sync status from brain-service
  const synced = await Promise.all(
    analyses.map(async (a) => {
      if ((a.status !== 'pending' && a.status !== 'running') || !a.job_id) return a

      try {
        const res = await fetch(`${BRAIN_SERVICE_URL}/status/${a.job_id}`, {
          headers: { 'X-Brain-Secret': BRAIN_SERVICE_SECRET },
        })
        if (!res.ok) return a

        const remote = await res.json() as {
          status: string
          error: string | null
          result: Record<string, unknown> | null
          completed_at: string | null
        }

        if (remote.status !== a.status) {
          const patch: Parameters<typeof updateNeuroAnalysis>[1] = {
            status: remote.status as typeof a.status,
          }
          if (remote.error) patch.error = remote.error
          if (remote.result) patch.results = remote.result
          if (remote.completed_at) patch.completed_at = remote.completed_at
          await updateNeuroAnalysis(a.id, patch)
          return { ...a, ...patch }
        }
      } catch {
        // Brain service unreachable — return stale status
      }
      return a
    })
  )

  return Response.json(synced)
}
