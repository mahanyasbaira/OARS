import pdfParse from 'pdf-parse'
import { openai } from '@/lib/openai'
import { ExtractionPayloadSchema, type ExtractionPayload } from '@/schemas/extraction'

// Prompt version — increment when prompt behaviour changes and document in changelog
const PROMPT_VERSION = 'text-agent-v2'
const MODEL = 'gpt-4o'

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
 * Runs the Text Agent against a document buffer.
 * PDFs are parsed via pdf-parse; all other text is read as UTF-8.
 * Uses gpt-4o (OpenAI).
 *
 * Returns a fully validated ExtractionPayload or throws on failure.
 */
export async function runTextAgent(
  sourceId: string,
  projectId: string,
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionPayload> {
  // Extract text content from the buffer
  let textContent: string
  if (mimeType === 'application/pdf') {
    const data = await pdfParse(buffer)
    textContent = data.text
  } else {
    textContent = buffer.toString('utf-8')
  }

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extract structured research data from this document according to the schema in your instructions.\n\nDocument content:\n${textContent}`,
      },
    ],
  })

  const raw = (response.choices[0].message.content ?? '{}').trim()
  // Strip markdown code fences if present
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
