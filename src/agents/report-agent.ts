import { GoogleGenerativeAI } from '@google/generative-ai'
import { ReportPayloadSchema, type ReportPayload } from '@/schemas/report'

const PROMPT_VERSION = 'report-agent-v1'
const MODEL = 'gemini-2.5-flash'

const SYSTEM_PROMPT = `You are a senior research synthesis agent. You receive structured extractions from multiple sources (text, audio, video) and a merged timeline, and you produce a concise, rigorous research report.

You must return ONLY valid JSON matching this exact schema. Do not include markdown, explanation, or any text outside the JSON.

Schema:
{
  "executiveSummary": string,        // 2-4 paragraphs, plain prose, no bullet points
  "keyFindings": [
    {
      "finding": string,             // one concise factual statement
      "confidence": number (0-1),
      "sources": [string]            // source IDs that support this finding
    }
  ],
  "contradictionMatrix": [
    {
      "topic": string,               // what the contradiction is about
      "description": string,         // clear explanation of the conflict
      "sourceA": string,             // source ID
      "sourceB": string              // source ID
    }
  ],
  "methodology": string              // brief note on what sources were analysed and how
}

Rules:
- executiveSummary: synthesise the most important insights across ALL sources — do not just list what each source says
- keyFindings: max 10, ordered by importance, each grounded in at least one source ID
- contradictionMatrix: only include genuine factual conflicts, not differences in emphasis or framing
- methodology: one short paragraph
- source IDs must be exact UUIDs from the input — do not fabricate IDs
- Never fabricate information not present in the source data`

type ExtractionSummary = {
  sourceId: string
  modality: string
  entities: unknown[]
  claims:   unknown[]
  events:   unknown[]
  evidence: unknown[]
  confidence: number
}

type TimelineEventSummary = {
  sourceId: string | null
  description: string
  timestamp: string | null
}

/**
 * Runs the Report Agent (Translation Layer) over all project extractions and timeline.
 * Returns a fully validated ReportPayload or throws on failure.
 */
export async function runReportAgent(
  projectId: string,
  extractions: ExtractionSummary[],
  timelineEvents: TimelineEventSummary[]
): Promise<ReportPayload> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  const input = JSON.stringify({ extractions, timelineEvents }, null, 2)
  const result = await model.generateContent(
    `Generate a research report from the following structured data:\n\n${input}`
  )
  const raw = result.response.text().trim()
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Report Agent returned non-JSON: ${cleaned.slice(0, 200)}`)
  }

  const payload = ReportPayloadSchema.safeParse({
    projectId,
    executiveSummary:    (parsed as Record<string, unknown>).executiveSummary    ?? '',
    keyFindings:         (parsed as Record<string, unknown>).keyFindings         ?? [],
    contradictionMatrix: (parsed as Record<string, unknown>).contradictionMatrix ?? [],
    methodology:         (parsed as Record<string, unknown>).methodology         ?? '',
    promptVersion: PROMPT_VERSION,
    model:         MODEL,
    createdAt:     new Date().toISOString(),
  })

  if (!payload.success) {
    throw new Error(`Report Agent output failed validation: ${payload.error.message}`)
  }

  return payload.data
}
