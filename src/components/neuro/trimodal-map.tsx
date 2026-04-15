'use client'

import { useMemo, useState } from 'react'
import { hotColormap } from './colormap'

interface TrimodalContribution {
  r: number  // text
  g: number  // audio
  b: number  // video
}

interface Props {
  contributions: TrimodalContribution[]
  /** Flat cortical activation frames aligned to contributions */
  frames?: number[][]
  timestepSeconds?: number
}

const MODALITY_INFO = {
  r: { label: 'Text',  color: '#ef4444', channel: 0 as const },
  g: { label: 'Audio', color: '#22c55e', channel: 1 as const },
  b: { label: 'Video', color: '#3b82f6', channel: 2 as const },
}

export function TrimodalMap({ contributions, frames, timestepSeconds = 2 }: Props) {
  const [selectedT, setSelectedT] = useState(0)

  if (!contributions || contributions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Trimodal data requires video + audio + text input.
        </p>
      </div>
    )
  }

  const current = contributions[Math.min(selectedT, contributions.length - 1)]

  // Compute dominant modality per timestep
  const dominance = useMemo(
    () =>
      contributions.map((c) => {
        const entries = [
          { key: 'r' as const, v: c.r },
          { key: 'g' as const, v: c.g },
          { key: 'b' as const, v: c.b },
        ]
        entries.sort((a, b) => b.v - a.v)
        return entries[0].key
      }),
    [contributions]
  )

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Trimodal Contribution Map</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Red = text · Green = audio · Blue = video.
          Shows which modality drives activation at each timestep (paper Figure 7).
        </p>
      </div>

      {/* Timeline strip */}
      <div className="flex gap-0.5 rounded overflow-hidden border" style={{ height: 32 }}>
        {contributions.map((c, t) => {
          const total = c.r + c.g + c.b || 1
          return (
            <button
              key={t}
              onClick={() => setSelectedT(t)}
              className="flex-1 relative"
              title={`t=${t * timestepSeconds}s`}
              style={{
                background: `rgb(${Math.round(c.r/total*255)},${Math.round(c.g/total*255)},${Math.round(c.b/total*255)})`,
                outline: selectedT === t ? '2px solid white' : 'none',
                outlineOffset: '-2px',
              }}
            />
          )
        })}
      </div>
      <p className="text-xs text-center text-muted-foreground -mt-2">
        ← Time →  |  Click a segment to inspect
      </p>

      {/* Selected timestep breakdown */}
      <div className="rounded-lg border p-4 space-y-4">
        <p className="text-sm font-medium">
          t = {selectedT * timestepSeconds}s — Modality breakdown
        </p>
        <div className="grid grid-cols-3 gap-4">
          {(['r', 'g', 'b'] as const).map((ch) => {
            const info = MODALITY_INFO[ch]
            const val = current[ch]
            const total = current.r + current.g + current.b || 1
            const pct = Math.round((val / total) * 100)
            const isDominant = dominance[selectedT] === ch
            return (
              <div key={ch} className={`rounded-lg border p-3 ${isDominant ? 'border-foreground' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: info.color }}>
                    {info.label}
                  </span>
                  {isDominant && (
                    <span className="text-[10px] bg-muted px-1.5 rounded">Dominant</span>
                  )}
                </div>
                <p className="text-2xl font-bold">{pct}%</p>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: info.color }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  raw: {val.toFixed(3)}
                </p>
              </div>
            )
          })}
        </div>

        {/* RGB brain strip — lightweight visualization */}
        {frames && frames[selectedT] && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Spatial activation at this timestep (RGB-weighted)
            </p>
            <RGBBrainStrip
              frame={frames[selectedT]}
              contribution={current}
            />
          </div>
        )}
      </div>

      {/* Modality dominance over time chart */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Dominant modality over time</p>
        <div className="flex gap-0.5 rounded overflow-hidden" style={{ height: 20 }}>
          {dominance.map((dom, t) => (
            <div
              key={t}
              className="flex-1"
              style={{ backgroundColor: MODALITY_INFO[dom].color, opacity: 0.8 }}
              title={`${MODALITY_INFO[dom].label} at ${t * timestepSeconds}s`}
            />
          ))}
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          {(['r', 'g', 'b'] as const).map((ch) => (
            <div key={ch} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MODALITY_INFO[ch].color }} />
              {MODALITY_INFO[ch].label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RGBBrainStrip({
  frame,
  contribution,
}: {
  frame: number[]
  contribution: TrimodalContribution
}) {
  const BINS = 64
  const binSize = Math.ceil(frame.length / BINS)
  const min = Math.min(...frame)
  const max = Math.max(...frame)
  const range = max - min || 1
  const total = contribution.r + contribution.g + contribution.b || 1

  const strips = []
  for (let s = 0; s < BINS; s++) {
    const slice = frame.slice(s * binSize, (s + 1) * binSize)
    const mean = slice.reduce((a, b) => a + b, 0) / (slice.length || 1)
    const t = (mean - min) / range
    const [baseR, baseG, baseB] = hotColormap(t)
    // Tint by modality contribution
    const r = Math.round((baseR * 0.5 + (contribution.r / total) * 0.5) * 255)
    const g = Math.round((baseG * 0.5 + (contribution.g / total) * 0.5) * 255)
    const b = Math.round((baseB * 0.5 + (contribution.b / total) * 0.5) * 255)
    strips.push(
      <div
        key={s}
        className="flex-1 h-full"
        style={{ backgroundColor: `rgb(${r},${g},${b})` }}
      />
    )
  }
  return <div className="w-full h-8 rounded overflow-hidden flex">{strips}</div>
}
