import { openai } from '@/lib/openai'
import { AggregatorPayloadSchema, type AggregatorPayload } from '@/schemas/timeline'

const PROMPT_VERSION = 'aggregator-agent-v2'
const MODEL = 'gpt-4o'

const SYSTEM_PROMPT = `You are a temporal aggregation agent. You receive a list of structured extractions from multiple documents and must produce a unified, chronological timeline.

You must return ONLY valid JSON matching this exact schema. Do not include markdown, explanation, or any text outside the JSON.

Schema:
{
  "events": [
    {
      "sourceId": string | null,
      "description": string,
      "timestamp": string | null,   // ISO 8601 if known, null if unknown
      "approximate": boolean,
      "confidence": number (0-1),
      "sourceSpan": string | null   // verbatim quote from source, if available
    }
  ],
  "contradictions": [
    {
      "eventAIndex": number,   // index into events array
      "eventBIndex": number,
      "description": string    // concise explanation of the conflict
    }
  ]
}

Rules:
- Merge duplicate or near-duplicate events into a single entry (keep the most confident source)
- Sort events chronologically; place null-timestamp events at the end
- Contradictions: flag when two sources describe the same event with conflicting dates, outcomes, or facts
- Set approximate=true when the timestamp is inferred or uncertain (e.g. "early 2020", "circa 1990")
- confidence reflects how certain you are about this event's details (0-1)
- sourceId must be the exact UUID from the input — do not fabricate IDs
- Never invent events not present in the source extractions`

type ExtractionInput = {
  sourceId: string
  events: Array<{
    description: string
    timestamp: string | null
    approximate: boolean
    sourceSpan: string
  }>
}

/**
 * Runs the Temporal Aggregator agent over all extractions for a project.
 * Returns a merged, contradiction-annotated timeline.
 */
export async function runAggregatorAgent(
  projectId: string,
  extractions: ExtractionInput[]
): Promise<AggregatorPayload> {
  if (extractions.length === 0) {
    return {
      projectId,
      events: [],
      contradictions: [],
      promptVersion: PROMPT_VERSION,
      model: MODEL,
      createdAt: new Date().toISOString(),
    }
  }

  const input = JSON.stringify(extractions, null, 2)
  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Aggregate the following extractions into a unified timeline:\n\n${input}`,
      },
    ],
  })

  const raw = (response.choices[0].message.content ?? '{}').trim()
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Aggregator Agent returned non-JSON: ${cleaned.slice(0, 200)}`)
  }

  const payload = AggregatorPayloadSchema.safeParse({
    projectId,
    events:        (parsed as Record<string, unknown>).events        ?? [],
    contradictions: (parsed as Record<string, unknown>).contradictions ?? [],
    promptVersion: PROMPT_VERSION,
    model:         MODEL,
    createdAt:     new Date().toISOString(),
  })

  if (!payload.success) {
    throw new Error(`Aggregator output failed validation: ${payload.error.message}`)
  }

  return payload.data
}
