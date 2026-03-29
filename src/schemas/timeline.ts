import { z } from 'zod'

export const TimelineEventSchema = z.object({
  sourceId:    z.string().uuid().nullable(),
  description: z.string().min(1),
  timestamp:   z.string().nullable(),   // ISO 8601 or null
  approximate: z.boolean(),
  confidence:  z.number().min(0).max(1),
  sourceSpan:  z.string().nullable(),
})

export const ContradictionSchema = z.object({
  eventAIndex:  z.number().int().min(0),  // index into events array
  eventBIndex:  z.number().int().min(0),
  description:  z.string().min(1),
})

export const AggregatorPayloadSchema = z.object({
  projectId:     z.string().uuid(),
  events:        z.array(TimelineEventSchema),
  contradictions: z.array(ContradictionSchema),
  promptVersion: z.string(),
  model:         z.string(),
  createdAt:     z.string(),
})

export type TimelineEvent    = z.infer<typeof TimelineEventSchema>
export type Contradiction    = z.infer<typeof ContradictionSchema>
export type AggregatorPayload = z.infer<typeof AggregatorPayloadSchema>
