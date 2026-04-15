import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { openai } from '@/lib/openai'
import { ExtractionPayloadSchema, type ExtractionPayload } from '@/schemas/extraction'

const PROMPT_VERSION = 'vision-agent-v2'
const MODEL = 'gpt-4o'

const SYSTEM_PROMPT = `You are a precise visual research extraction agent. Your task is to extract structured information from the provided image or video frames by analysing visual content — frames, on-screen text, charts, slides, and any visible information.

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
 * Extracts up to 8 evenly-spaced frames from a video buffer using ffmpeg.
 * Returns an array of base64 JPEG strings.
 * Returns empty array if ffmpeg is not available on the system.
 */
function extractVideoFrames(buffer: Buffer, ext: string): string[] {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oars-frames-'))
  try {
    const inputPath = path.join(tmpDir, `input.${ext}`)
    fs.writeFileSync(inputPath, buffer)

    const outputPattern = path.join(tmpDir, 'frame%03d.jpg')
    const result = spawnSync(
      'ffmpeg',
      ['-i', inputPath, '-vf', 'fps=0.5', '-vframes', '8', '-q:v', '3', outputPattern, '-y'],
      { timeout: 60_000 }
    )

    if (result.status !== 0) return []

    return fs
      .readdirSync(tmpDir)
      .filter(f => f.startsWith('frame') && f.endsWith('.jpg'))
      .sort()
      .slice(0, 8)
      .map(f => fs.readFileSync(path.join(tmpDir, f)).toString('base64'))
  } catch {
    return []
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/**
 * Runs the Vision Agent against an image or video buffer.
 * Images: sent directly as base64 to gpt-4o vision.
 * Videos: up to 8 frames extracted via ffmpeg, then sent as images.
 *
 * Returns a fully validated ExtractionPayload or throws on failure.
 */
export async function runVisionAgent(
  sourceId: string,
  projectId: string,
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionPayload> {
  const isVideo = mimeType.startsWith('video/')
  const ext = mimeType.split('/')[1] ?? (isVideo ? 'mp4' : 'jpg')

  // Build image content parts
  type ImagePart = { type: 'image_url'; image_url: { url: string; detail: 'high' } }
  const imageParts: ImagePart[] = []

  if (isVideo) {
    const frames = extractVideoFrames(buffer, ext)
    for (const frame of frames) {
      imageParts.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${frame}`, detail: 'high' },
      })
    }
  } else {
    imageParts.push({
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${buffer.toString('base64')}`, detail: 'high' },
    })
  }

  const userContent: Array<{ type: 'text'; text: string } | ImagePart> = [
    {
      type: 'text',
      text:
        imageParts.length > 0
          ? 'Extract structured research data from the visual content in this file according to the schema in your instructions.'
          : 'No visual frames could be extracted from this video file. Return an empty extraction with confidence 0.',
    },
    ...imageParts,
  ]

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  })

  const raw = (response.choices[0].message.content ?? '{}').trim()
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
