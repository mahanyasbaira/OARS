import { z } from 'zod'

// Shared schema for all agent outputs — every agent must produce this shape.
// Validated at the boundary before anything is written to the DB.

export const EntitySchema = z.object({
  name: z.string(),
  type: z.string(),                        // person, org, location, date, concept
  mentions: z.number().int().optional(),
})

export const ClaimSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
  sourceSpan: z.string().optional(),       // quote or reference from source
})

export const TimelineEventSchema = z.object({
  description: z.string(),
  timestamp: z.string().nullable(),        // ISO string or null if unknown
  approximate: z.boolean().default(false),
  sourceSpan: z.string().optional(),
})

export const EvidenceSchema = z.object({
  text: z.string(),
  relevance: z.number().min(0).max(1),
})

export const ExtractionPayloadSchema = z.object({
  sourceId:      z.string().uuid(),
  projectId:     z.string().uuid(),
  modality:      z.enum(['text', 'audio', 'vision']),
  contentSpan:   z.object({ start: z.number(), end: z.number() }).optional(),
  timeRange:     z.object({ from: z.string().nullable(), to: z.string().nullable() }).optional(),
  entities:      z.array(EntitySchema),
  claims:        z.array(ClaimSchema),
  events:        z.array(TimelineEventSchema),
  evidence:      z.array(EvidenceSchema),
  confidence:    z.number().min(0).max(1),
  promptVersion: z.string(),
  model:         z.string(),
  createdAt:     z.string(),
})

export type ExtractionPayload = z.infer<typeof ExtractionPayloadSchema>
export type Entity            = z.infer<typeof EntitySchema>
export type Claim             = z.infer<typeof ClaimSchema>
export type TimelineEvent     = z.infer<typeof TimelineEventSchema>
export type Evidence          = z.infer<typeof EvidenceSchema>
