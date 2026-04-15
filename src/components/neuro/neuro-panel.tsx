'use client'

import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import type { NeuroAnalysis } from '@/server/db/neuro'
import { ROITimeseries } from './roi-timeseries'
import { EmotionPanel } from './emotion-panel'
import { EncodingScoreChart } from './encoding-score-chart'
import { TemporalFrames } from './temporal-frames'
import { TrimodalMap } from './trimodal-map'

// Lazy-load the Three.js renderer to avoid SSR issues
const BrainSurface = lazy(() =>
  import('./brain-surface').then((m) => ({ default: m.BrainSurface }))
)

interface Props {
  projectId: string
  initialAnalyses: NeuroAnalysis[]
}

const STATUS_LABEL: Record<string, string> = {
  pending:  'Queued',
  running:  'Analyzing…',
  complete: 'Complete',
  failed:   'Failed',
}

const STATUS_COLOR: Record<string, string> = {
  pending:  'text-yellow-600 dark:text-yellow-400',
  running:  'text-blue-600 dark:text-blue-400',
  complete: 'text-green-600 dark:text-green-400',
  failed:   'text-red-600 dark:text-red-400',
}

type Tab = 'brain' | 'timeseries' | 'emotions' | 'temporal' | 'trimodal' | 'encoding'

const TABS: { id: Tab; label: string }[] = [
  { id: 'brain',     label: 'Brain Surface' },
  { id: 'timeseries', label: 'ROI Timeseries' },
  { id: 'emotions',  label: 'Emotions' },
  { id: 'temporal',  label: 'Temporal Frames' },
  { id: 'trimodal',  label: 'Trimodal Map' },
  { id: 'encoding',  label: 'Encoding Scores' },
]

type AnalysisResults = {
  mock?: boolean
  cortical_activations?: number[]
  cortical_frames?: number[][]
  subcortical_activations?: number[]
  roi_timeseries?: Record<string, number[]>
  encoding_scores?: Record<string, number>
  segments?: Array<{ start: number; end: number; label: string }>
  trimodal_contributions?: Array<{ r: number; g: number; b: number }>
  emotions?: Array<{ emotion: string; confidence: number; roi: string; strength: number }>
}

export function NeuroPanel({ projectId, initialAnalyses }: Props) {
  const [analyses, setAnalyses] = useState<NeuroAnalysis[]>(initialAnalyses)
  const [selected, setSelected] = useState<NeuroAnalysis | null>(null)
  const [tab, setTab] = useState<Tab>('brain')
  const [polling, setPolling] = useState(false)

  const hasInFlight = analyses.some(
    (a) => a.status === 'pending' || a.status === 'running'
  )

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/neuro/status`)
      if (!res.ok) return
      const updated = (await res.json()) as NeuroAnalysis[]
      setAnalyses(updated)
      if (selected) {
        const refreshed = updated.find((a) => a.id === selected.id)
        if (refreshed) setSelected(refreshed)
      }
    } catch {
      // ignore transient errors
    }
  }, [projectId, selected])

  useEffect(() => {
    if (!hasInFlight) return
    setPolling(true)
    const id = setInterval(refresh, 3000)
    return () => {
      clearInterval(id)
      setPolling(false)
    }
  }, [hasInFlight, refresh])

  const results = selected?.results as AnalysisResults | undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Neural Analyses</h2>
        {polling && (
          <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">
            Polling…
          </span>
        )}
      </div>

      {analyses.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No neural analyses yet.</p>
          <p className="text-muted-foreground text-xs mt-2">
            Go to the Sources tab, wait for an extraction to finish, then click{' '}
            <span className="font-medium">Analyze</span> to run TRIBE v2 brain encoding.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {analyses.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setSelected(selected?.id === a.id ? null : a)
                setTab('brain')
              }}
              className={`w-full text-left rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50 ${
                selected?.id === a.id ? 'border-foreground bg-muted/30' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Extraction {a.extraction_id.slice(0, 8)}…
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs font-medium ${STATUS_COLOR[a.status] ?? ''}`}>
                  {STATUS_LABEL[a.status] ?? a.status}
                  {a.status === 'running' && (
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                  )}
                </span>
              </div>
              {a.error && (
                <p className="text-xs text-red-500 mt-2 truncate">{a.error}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Results panel — only when an analysis is selected and complete */}
      {selected?.status === 'complete' && results && (
        <div className="rounded-lg border overflow-hidden">
          {/* Mock badge + tab bar */}
          <div className="border-b bg-muted/30">
            <div className="flex items-center gap-2 px-4 pt-3">
              <span className="text-sm font-medium">Results</span>
              {results.mock && (
                <span className="text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 rounded px-1.5 py-0.5">
                  Mock data
                </span>
              )}
            </div>
            <div className="flex gap-0 mt-2 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                    tab === t.id
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {tab === 'brain' && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Brain Surface Activation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cortical surface colored by predicted BOLD amplitude (hot colormap).
                    {results.cortical_frames && results.cortical_frames.length > 1 &&
                      ` Animating ${results.cortical_frames.length} timesteps.`}
                  </p>
                </div>
                <Suspense
                  fallback={
                    <div className="rounded-lg bg-muted/20 flex items-center justify-center text-sm text-muted-foreground animate-pulse h-96">
                      Loading 3D renderer…
                    </div>
                  }
                >
                  <BrainSurface
                    activations={results.cortical_activations ?? []}
                    frames={results.cortical_frames}
                    height={420}
                  />
                </Suspense>
              </div>
            )}

            {tab === 'timeseries' && results.roi_timeseries && (
              <ROITimeseries roiTimeseries={results.roi_timeseries} />
            )}

            {tab === 'emotions' && results.emotions && (
              <EmotionPanel emotions={results.emotions} />
            )}

            {tab === 'temporal' && results.cortical_frames && (
              <TemporalFrames
                frames={results.cortical_frames}
                segments={results.segments}
              />
            )}

            {tab === 'trimodal' && results.trimodal_contributions && (
              <TrimodalMap
                contributions={results.trimodal_contributions}
                frames={results.cortical_frames}
              />
            )}

            {tab === 'encoding' && results.encoding_scores && (
              <EncodingScoreChart encodingScores={results.encoding_scores} />
            )}

            {/* Fallbacks for tabs with no data */}
            {tab === 'timeseries' && !results.roi_timeseries && (
              <p className="text-sm text-muted-foreground">No ROI timeseries in this result.</p>
            )}
            {tab === 'emotions' && !results.emotions && (
              <p className="text-sm text-muted-foreground">No emotion data in this result.</p>
            )}
            {tab === 'temporal' && !results.cortical_frames && (
              <p className="text-sm text-muted-foreground">No temporal frames in this result.</p>
            )}
            {tab === 'trimodal' && !results.trimodal_contributions && (
              <p className="text-sm text-muted-foreground">No trimodal data in this result.</p>
            )}
            {tab === 'encoding' && !results.encoding_scores && (
              <p className="text-sm text-muted-foreground">No encoding scores in this result.</p>
            )}
          </div>
        </div>
      )}

      {/* Running state detail */}
      {selected?.status === 'running' && (
        <div className="rounded-lg border p-6 text-center space-y-2">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-sm font-medium">TRIBE v2 is analyzing your content</p>
          <p className="text-xs text-muted-foreground">
            This may take a few minutes depending on file length and hardware.
          </p>
        </div>
      )}

      {/* Pending state */}
      {selected?.status === 'pending' && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">Analysis queued — waiting for worker…</p>
        </div>
      )}
    </div>
  )
}
