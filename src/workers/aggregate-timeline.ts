import { getExtractionsByProjectId } from '@/server/db/extractions'
import { saveTimeline } from '@/server/db/timeline'
import { runAggregatorAgent } from '@/agents/aggregator-agent'
import { withRetry } from '@/lib/retry'

/**
 * Runs the Temporal Aggregator for a project after a new extraction lands.
 * Fetches all extractions, runs the agent with retry, and persists the merged timeline.
 */
export async function runTimelineAggregation(projectId: string): Promise<void> {
  const extractions = await getExtractionsByProjectId(projectId)
  const textExtractions = extractions.filter((e) => e.modality === 'text')

  const inputs = textExtractions.map((e) => ({
    sourceId: e.source_id,
    events:   (e.payload.events as Array<{
      description: string
      timestamp: string | null
      approximate: boolean
      sourceSpan: string
    }>) ?? [],
  }))

  const aggregated = await withRetry(
    () => runAggregatorAgent(projectId, inputs),
    { label: `aggregator:${projectId}` }
  )
  await saveTimeline(aggregated)

  console.log(
    `[aggregate-timeline] Project ${projectId}: ${aggregated.events.length} events, ` +
    `${aggregated.contradictions.length} contradictions`
  )
}
