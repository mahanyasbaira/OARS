import { auth } from '@clerk/nextjs/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserIdByClerkId } from '@/server/db/users'
import { getProjectById } from '@/server/db/projects'
import { getTimeline } from '@/server/db/timeline'
import { TimelineView } from '@/components/timeline/timeline-view'

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) return null

  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return null

  const project = await getProjectById(projectId, userId)
  if (!project) notFound()

  const { events, contradictions } = await getTimeline(projectId)

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Projects
          </Link>
          <span>/</span>
          <Link href={`/dashboard/projects/${projectId}`} className="hover:text-foreground transition-colors">
            {project.name}
          </Link>
          <span>/</span>
          <span>Timeline</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Timeline</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{events.length} event{events.length !== 1 ? 's' : ''}</span>
            {contradictions.length > 0 && (
              <span className="text-destructive font-medium">
                {contradictions.length} contradiction{contradictions.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <TimelineView events={events} contradictions={contradictions} />
    </div>
  )
}
