import { toFile } from 'openai'
import { openai } from '@/lib/openai'
import { ExtractionPayloadSchema, type ExtractionPayload } from '@/schemas/extraction'

const PROMPT_VERSION = 'audio-agent-v2'
const MODEL = 'gpt-4o'
const TRANSCRIPTION_MODEL = 'whisper-1'

const SYSTEM_PROMPT = `You are a precise audio research extraction agent. Your task is to extract structured information from the provided audio transcript.

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
- entities: extract all named people, organisations, locations, dates, and key concepts mentioned in speech
- claims: factual statements made by speakers — use a direct quote in sourceSpan
- events: anything with a temporal dimension mentioned in speech — ISO 8601 timestamps when possible, null if unknown
- evidence: the most relevant verbatim spoken passages (max 10, each under 300 chars)
- confidence: your overall confidence in the extraction quality (0-1), lower if audio is unclear
- Never fabricate information not present in the audio
- Express uncertainty in the confidence score rather than inventing details`

/**
 * Runs the Audio Agent against an audio buffer.
 * Step 1: Transcribes with Whisper (whisper-1).
 * Step 2: Extracts structured data from the transcript via gpt-4o.
 *
 * Returns a fully validated ExtractionPayload or throws on failure.
 */
export async function runAudioAgent(
  sourceId: string,
  projectId: string,
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionPayload> {
  // Derive a sensible filename extension from the MIME type
  const ext = mimeType.split('/')[1]?.replace('mpeg', 'mp3') ?? 'mp3'
  const audioFile = await toFile(buffer, `audio.${ext}`, { type: mimeType })

  // Step 1 — transcribe with Whisper
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: TRANSCRIPTION_MODEL,
    response_format: 'text',
  })

  const transcript = typeof transcription === 'string' ? transcription : (transcription as { text: string }).text

  // Step 2 — extract structured research data from the transcript
  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extract structured research data from the spoken content in this audio transcript according to the schema in your instructions.\n\nTranscript:\n${transcript}`,
      },
    ],
  })

  const raw = (response.choices[0].message.content ?? '{}').trim()
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Audio Agent returned non-JSON response: ${cleaned.slice(0, 200)}`)
  }

  const payload = ExtractionPayloadSchema.safeParse({
    sourceId,
    projectId,
    modality: 'audio',
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
    throw new Error(`Audio Agent output failed schema validation: ${payload.error.message}`)
  }

  return payload.data
}
