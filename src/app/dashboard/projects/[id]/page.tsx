import { auth } from '@clerk/nextjs/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserIdByClerkId } from '@/server/db/users'
import { getProjectById } from '@/server/db/projects'
import { getSourcesByProjectId } from '@/server/db/sources'
import { UploadDialog } from '@/components/sources/upload-dialog'
import { SourceList } from '@/components/sources/source-list'

export default async function ProjectPage({
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

  const sources = await getSourcesByProjectId(projectId)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Projects
            </Link>
            <span>/</span>
            <span>{project.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground text-sm mt-1">{project.description}</p>
          )}
        </div>
        <UploadDialog projectId={project.id} />
      </div>

      <div className="flex gap-4 border-b pb-2">
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="text-sm font-medium border-b-2 border-foreground pb-2 -mb-[9px]"
        >
          Sources
        </Link>
        <Link
          href={`/dashboard/projects/${projectId}/timeline`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors pb-2"
        >
          Timeline
        </Link>
        <Link
          href={`/dashboard/projects/${projectId}/report`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors pb-2"
        >
          Report
        </Link>
        <Link
          href={`/dashboard/projects/${projectId}/neuro`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors pb-2"
        >
          Neural
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Sources</h2>
          <span className="text-xs text-muted-foreground">
            {sources.length} file{sources.length !== 1 ? 's' : ''}
          </span>
        </div>

        {sources.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground text-sm">No sources yet.</p>
            <p className="text-muted-foreground text-xs mt-1">
              Upload a PDF, audio file, or video to get started.
            </p>
          </div>
        ) : (
          <SourceList sources={sources} projectId={project.id} />
        )}
      </div>
    </div>
  )
}
