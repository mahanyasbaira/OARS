import { z } from 'zod'

export const KeyFindingSchema = z.object({
  finding:    z.string(),
  confidence: z.number().min(0).max(1),
  sources:    z.array(z.string()),   // source IDs that support this finding
})

export const ContradictionEntrySchema = z.object({
  topic:       z.string(),
  description: z.string(),
  sourceA:     z.string(),           // source ID
  sourceB:     z.string(),           // source ID
})

export const ReportPayloadSchema = z.object({
  projectId:          z.string().uuid(),
  executiveSummary:   z.string(),
  keyFindings:        z.array(KeyFindingSchema),
  contradictionMatrix: z.array(ContradictionEntrySchema),
  methodology:        z.string(),
  promptVersion:      z.string(),
  model:              z.string(),
  createdAt:          z.string(),
})

export type KeyFinding          = z.infer<typeof KeyFindingSchema>
export type ContradictionEntry  = z.infer<typeof ContradictionEntrySchema>
export type ReportPayload       = z.infer<typeof ReportPayloadSchema>
