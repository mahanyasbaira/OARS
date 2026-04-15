'use client'

interface Emotion {
  emotion: string
  confidence: number
  roi: string
  strength: number
}

interface Props {
  emotions: Emotion[]
}

const EMOTION_ICONS: Record<string, string> = {
  'Fear / Emotional Arousal':    '⚡',
  'Reward / Pleasure':            '✦',
  'Empathy / Social Cognition':  '◎',
  'Memory Formation':             '◈',
  'Language Engagement':          '▲',
  'Face / Scene Recognition':    '◉',
  'Auditory Attention':           '◐',
  'Motivated Engagement':         '▶',
  'Motion Alertness':             '◆',
}

function confidenceColor(c: number): string {
  if (c >= 0.75) return 'bg-red-500'
  if (c >= 0.5)  return 'bg-orange-400'
  if (c >= 0.3)  return 'bg-yellow-400'
  return 'bg-blue-400'
}

function confidenceLabel(c: number): string {
  if (c >= 0.75) return 'Strong'
  if (c >= 0.5)  return 'Moderate'
  if (c >= 0.3)  return 'Weak'
  return 'Trace'
}

export function EmotionPanel({ emotions }: Props) {
  if (!emotions || emotions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">No significant emotional activations detected.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium">Inferred Emotional States</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Derived from regional BOLD activation patterns — not a direct TRIBE v2 output.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{emotions.length} states</span>
      </div>

      <div className="grid gap-2">
        {emotions.map((e) => (
          <div
            key={e.roi}
            className="flex items-center gap-3 rounded-md border px-3 py-2.5"
          >
            <span className="text-base w-6 text-center shrink-0" aria-hidden>
              {EMOTION_ICONS[e.emotion] ?? '●'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium truncate">{e.emotion}</p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {confidenceLabel(e.confidence)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${confidenceColor(e.confidence)}`}
                    style={{ width: `${Math.round(e.confidence * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                  {Math.round(e.confidence * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Region: {e.roi.replace(/_/g, ' ')} · strength {e.strength.toFixed(3)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground border-t pt-2">
        Emotion interpretation uses the TRIBE v2 region→emotion mapping table.
        High confidence reflects strong mean BOLD in the corresponding anatomical ROI.
      </p>
    </div>
  )
}
