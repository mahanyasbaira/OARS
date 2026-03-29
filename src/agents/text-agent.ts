import { GoogleGenerativeAI } from '@google/generative-ai'
import { ExtractionPayloadSchema, type ExtractionPayload } from '@/schemas/extraction'

// Prompt version — increment when prompt behaviour changes and document in changelog
const PROMPT_VERSION = 'text-agent-v1'
const MODEL = 'gemini-1.5-flash'

const SYSTEM_PROMPT = `You are a precise research extraction agent. Your task is to extract structured information from the provided document text.

You must return ONLY valid JSON matching this exact schema. Do not include markdown, explanation, or any text outside the JSON.

Schema:
{
  "entities": [{ "name": string, "type": "person|org|location|date|concept", "mentions": number }],
  "claims": [{ "text": string, "confidence": number (0-1), "sourceSpan": string }],
  "events": [{ "description": string, "timestamp": string|null, "approximate": boolean, "sourceSpan": string }],
  "evidence": [{ "text": string, "relevance": number (0-1) }],
  "timeRange": { "from": string|null, "to": string|null },
  "confidence": number (0-1)
}

Rules:
- entities: extract all named people, organisations, locations, dates, and key concepts
- claims: factual statements made in the document — include a direct quote in sourceSpan
- events: anything with a temporal dimension — use ISO 8601 for timestamps when possible, null if unknown
- evidence: the most relevant verbatim passages (max 10, each under 300 chars)
- confidence: your overall confidence in the extraction quality (0-1)
- Never fabricate information not present in the source
- Express uncertainty in the confidence score rather than inventing details`

/**
 * Runs the Text Agent against extracted document text.
 * Uses Gemini 1.5 Flash (free tier: 15 req/min).
 *
 * Returns a fully validated ExtractionPayload or throws on failure.
 */
export async function runTextAgent(
  sourceId: string,
  projectId: string,
  text: string
): Promise<ExtractionPayload> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  // Truncate to ~30k chars to stay within free tier context limits
  const truncated = text.length > 30000 ? text.slice(0, 30000) + '\n\n[Document truncated]' : text

  const result = await model.generateContent(truncated)
  const raw = result.response.text().trim()

  // Strip markdown code fences if the model wraps the JSON
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Text Agent returned non-JSON response: ${cleaned.slice(0, 200)}`)
  }

  const payload = ExtractionPayloadSchema.safeParse({
    sourceId,
    projectId,
    modality: 'text',
    entities:      (parsed as Record<string, unknown>).entities      ?? [],
    claims:        (parsed as Record<string, unknown>).claims        ?? [],
    events:        (parsed as Record<string, unknown>).events        ?? [],
    evidence:      (parsed as Record<string, unknown>).evidence      ?? [],
    timeRange:     (parsed as Record<string, unknown>).timeRange     ?? { from: null, to: null },
    confidence:    (parsed as Record<string, unknown>).confidence    ?? 0,
    promptVersion: PROMPT_VERSION,
    model:         MODEL,
    createdAt:     new Date().toISOString(),
  })

  if (!payload.success) {
    throw new Error(`Text Agent output failed schema validation: ${payload.error.message}`)
  }

  return payload.data
}
