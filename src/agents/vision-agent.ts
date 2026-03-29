import { GoogleGenerativeAI } from '@google/generative-ai'
import { ExtractionPayloadSchema, type ExtractionPayload } from '@/schemas/extraction'

const PROMPT_VERSION = 'vision-agent-v1'
const MODEL = 'gemini-2.5-flash'

const SYSTEM_PROMPT = `You are a precise visual research extraction agent. Your task is to extract structured information from the provided image or video file by analysing its visual content — frames, on-screen text, charts, slides, and any visible information.

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
- entities: extract all named people, organisations, locations, dates, and key concepts visible in the content
- claims: factual statements shown on screen (slides, captions, overlays) — describe the visual context in sourceSpan
- events: anything with a temporal dimension visible in the content — ISO 8601 timestamps when possible, null if unknown
- evidence: the most relevant on-screen text or visual descriptions (max 10, each under 300 chars)
- confidence: your overall confidence in the extraction quality (0-1), lower if video is unclear or fast-moving
- Never fabricate information not visible in the content
- Express uncertainty in the confidence score rather than inventing details`

/**
 * Runs the Vision Agent against an image or video buffer.
 * Sends the file directly to Gemini as inline base64 data.
 * Gemini 2.5 Flash natively processes image frames and video content.
 */
export async function runVisionAgent(
  sourceId: string,
  projectId: string,
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionPayload> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: buffer.toString('base64'),
      },
    },
    'Extract structured research data from the visual content in this file according to the schema in your instructions.',
  ])
  const raw = result.response.text().trim()
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Vision Agent returned non-JSON response: ${cleaned.slice(0, 200)}`)
  }

  const payload = ExtractionPayloadSchema.safeParse({
    sourceId,
    projectId,
    modality: 'vision',
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
    throw new Error(`Vision Agent output failed schema validation: ${payload.error.message}`)
  }

  return payload.data
}
