import { createClient } from '@supabase/supabase-js'
import type { AggregatorPayload } from '@/schemas/timeline'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type TimelineEventRow = {
  id:          string
  project_id:  string
  source_id:   string | null
  description: string
  timestamp:   string | null
  approximate: boolean
  confidence:  number
  source_span: string | null
  created_at:  string
}

export type ContradictionRow = {
  id:           string
  project_id:   string
  event_a_id:   string
  event_b_id:   string
  description:  string
  created_at:   string
}

/**
 * Replaces all timeline events and contradictions for a project with the
 * latest aggregator output. Called after every successful extraction.
 */
export async function saveTimeline(payload: AggregatorPayload): Promise<void> {
  const db = adminClient()

  // Delete existing timeline for this project
  await db.from('contradictions').delete().eq('project_id', payload.projectId)
  await db.from('timeline_events').delete().eq('project_id', payload.projectId)

  if (payload.events.length === 0) return

  // Insert events and collect their IDs in order
  const eventInserts = payload.events.map((e) => ({
    project_id:  payload.projectId,
    source_id:   e.sourceId,
    description: e.description,
    timestamp:   e.timestamp,
    approximate: e.approximate,
    confidence:  e.confidence,
    source_span: e.sourceSpan,
  }))

  const { data: insertedEvents, error: eventsError } = await db
    .from('timeline_events')
    .insert(eventInserts)
    .select('id')

  if (eventsError || !insertedEvents) {
    throw new Error(`Failed to save timeline events: ${eventsError?.message}`)
  }

  if (payload.contradictions.length === 0) return

  const contradictionInserts = payload.contradictions
    .filter((c) => insertedEvents[c.eventAIndex] && insertedEvents[c.eventBIndex])
    .map((c) => ({
      project_id:  payload.projectId,
      event_a_id:  insertedEvents[c.eventAIndex].id,
      event_b_id:  insertedEvents[c.eventBIndex].id,
      description: c.description,
    }))

  if (contradictionInserts.length > 0) {
    const { error: contError } = await db.from('contradictions').insert(contradictionInserts)
    if (contError) throw new Error(`Failed to save contradictions: ${contError.message}`)
  }
}

export async function getTimeline(projectId: string): Promise<{
  events: TimelineEventRow[]
  contradictions: ContradictionRow[]
}> {
  const db = adminClient()

  const [eventsResult, contradictionsResult] = await Promise.all([
    db
      .from('timeline_events')
      .select('*')
      .eq('project_id', projectId)
      .order('timestamp', { ascending: true, nullsFirst: false }),
    db
      .from('contradictions')
      .select('*')
      .eq('project_id', projectId),
  ])

  if (eventsResult.error) throw new Error(`Failed to fetch timeline: ${eventsResult.error.message}`)
  if (contradictionsResult.error) throw new Error(`Failed to fetch contradictions: ${contradictionsResult.error.message}`)

  return {
    events:        (eventsResult.data ?? []) as TimelineEventRow[],
    contradictions: (contradictionsResult.data ?? []) as ContradictionRow[],
  }
}
