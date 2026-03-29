'use client'

import { Badge } from '@/components/ui/badge'
import type { TimelineEventRow, ContradictionRow } from '@/server/db/timeline'

function formatTimestamp(ts: string | null, approximate: boolean): string {
  if (!ts) return 'Unknown date'
  const d = new Date(ts)
  const formatted = d.getFullYear() > 0
    ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : ts
  return approximate ? `~${formatted}` : formatted
}

function conflictingEventIds(contradictions: ContradictionRow[]): Set<string> {
  const ids = new Set<string>()
  for (const c of contradictions) {
    ids.add(c.event_a_id)
    ids.add(c.event_b_id)
  }
  return ids
}

export function TimelineView({
  events,
  contradictions,
}: {
  events: TimelineEventRow[]
  contradictions: ContradictionRow[]
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground text-sm">No timeline events yet.</p>
        <p className="text-muted-foreground text-xs mt-1">
          Upload and process text documents to generate a timeline.
        </p>
      </div>
    )
  }

  const conflicted = conflictingEventIds(contradictions)

  return (
    <div className="space-y-6">
      {contradictions.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
          <p className="text-sm font-semibold text-destructive">
            {contradictions.length} contradiction{contradictions.length !== 1 ? 's' : ''} detected
          </p>
          {contradictions.map((c) => (
            <p key={c.id} className="text-xs text-muted-foreground">
              {c.description}
            </p>
          ))}
        </div>
      )}

      <div className="relative border-l-2 border-border ml-3 space-y-0">
        {events.map((event) => (
          <div key={event.id} className="relative pl-6 pb-6">
            {/* Timeline dot */}
            <span
              className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-background ${
                conflicted.has(event.id)
                  ? 'bg-destructive'
                  : 'bg-primary'
              }`}
            />

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">
                  {formatTimestamp(event.timestamp, event.approximate)}
                </span>
                {conflicted.has(event.id) && (
                  <Badge variant="destructive" className="text-xs">conflict</Badge>
                )}
                {event.approximate && (
                  <Badge variant="outline" className="text-xs">approximate</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {Math.round(event.confidence * 100)}% confidence
                </span>
              </div>

              <p className="text-sm">{event.description}</p>

              {event.source_span && (
                <blockquote className="text-xs text-muted-foreground border-l-2 border-border pl-3 italic mt-1">
                  &ldquo;{event.source_span}&rdquo;
                </blockquote>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
