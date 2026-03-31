import { getExtractionsByProjectId } from '@/server/db/extractions'
import { getTimeline } from '@/server/db/timeline'
import { saveReport } from '@/server/db/reports'
import { runReportAgent } from '@/agents/report-agent'
import { getProjectOwnerEmail } from '@/server/db/users'
import { getProjectNameById } from '@/server/db/projects'
import { sendReportReadyEmail } from '@/lib/email'

/**
 * Generates a research report for a project by running the Report Agent
 * over all extractions and the current timeline.
 * User-triggered (not automatic) due to large context size.
 */
export async function generateReport(projectId: string): Promise<{ id: string }> {
  const [extractions, { events }] = await Promise.all([
    getExtractionsByProjectId(projectId),
    getTimeline(projectId),
  ])

  if (extractions.length === 0) {
    throw new Error('No extractions found — upload and process at least one source first')
  }

  const extractionSummaries = extractions.map((e) => ({
    sourceId:   e.source_id,
    modality:   e.modality,
    entities:   (e.payload.entities as unknown[]) ?? [],
    claims:     (e.payload.claims   as unknown[]) ?? [],
    events:     (e.payload.events   as unknown[]) ?? [],
    evidence:   (e.payload.evidence as unknown[]) ?? [],
    confidence: e.confidence,
  }))

  const timelineSummary = events.map((ev) => ({
    sourceId:    ev.source_id,
    description: ev.description,
    timestamp:   ev.timestamp,
  }))

  const report = await runReportAgent(projectId, extractionSummaries, timelineSummary)
  const saved = await saveReport(report)

  // Fire-and-forget email
  Promise.all([getProjectOwnerEmail(projectId), getProjectNameById(projectId)])
    .then(([email, name]) => {
      if (email && name) sendReportReadyEmail(email, name, projectId)
    })
    .catch(() => { /* non-critical */ })

  return saved
}
