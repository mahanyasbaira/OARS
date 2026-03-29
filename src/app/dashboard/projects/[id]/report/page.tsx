import { auth } from '@clerk/nextjs/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserIdByClerkId } from '@/server/db/users'
import { getProjectById } from '@/server/db/projects'
import { getLatestReport } from '@/server/db/reports'
import { ReportView } from '@/components/report/report-view'
import type { ReportPayload } from '@/schemas/report'

export default async function ReportPage({
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

  const reportRow = await getLatestReport(projectId)
  const report = reportRow ? (reportRow.payload as unknown as ReportPayload) : null

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
          <span>Report</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Research Report</h1>
      </div>

      <ReportView projectId={projectId} initialReport={report} />
    </div>
  )
}
