import { auth } from '@clerk/nextjs/server'
import { getProjectById } from '@/server/db/projects'
import { getUserIdByClerkId } from '@/server/db/users'
import { getLatestReport } from '@/server/db/reports'
import type { ReportPayload } from '@/schemas/report'

function reportToMarkdown(report: ReportPayload, projectName: string): string {
  const lines: string[] = []

  lines.push(`# ${projectName} — Research Report`)
  lines.push(``)
  lines.push(`*Generated ${new Date(report.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · ${report.model}*`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  lines.push(`## Executive Summary`)
  lines.push(``)
  lines.push(report.executiveSummary)
  lines.push(``)

  if (report.keyFindings.length > 0) {
    lines.push(`## Key Findings`)
    lines.push(``)
    report.keyFindings.forEach((f, i) => {
      lines.push(`### ${i + 1}. ${f.finding}`)
      lines.push(``)
      lines.push(`**Confidence:** ${Math.round(f.confidence * 100)}%`)
      if (f.sources.length > 0) {
        lines.push(`**Sources:** ${f.sources.join(', ')}`)
      }
      lines.push(``)
    })
  }

  if (report.contradictionMatrix.length > 0) {
    lines.push(`## Contradiction Matrix`)
    lines.push(``)
    report.contradictionMatrix.forEach((c) => {
      lines.push(`### ${c.topic}`)
      lines.push(``)
      lines.push(c.description)
      lines.push(``)
      lines.push(`| Source A | Source B |`)
      lines.push(`|----------|----------|`)
      lines.push(`| \`${c.sourceA}\` | \`${c.sourceB}\` |`)
      lines.push(``)
    })
  }

  if (report.methodology) {
    lines.push(`---`)
    lines.push(``)
    lines.push(`## Methodology`)
    lines.push(``)
    lines.push(report.methodology)
    lines.push(``)
  }

  return lines.join('\n')
}

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

  const reportRow = await getLatestReport(projectId)
  if (!reportRow) return Response.json({ error: 'No report found' }, { status: 404 })

  const report = reportRow.payload as unknown as ReportPayload
  const markdown = reportToMarkdown(report, project.name)
  const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-report.md`

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
