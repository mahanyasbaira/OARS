'use client'

import { useMemo, useState } from 'react'
import { hotColormap } from './colormap'

interface Segment {
  start: number
  end: number
  label: string
}

interface Props {
  /** cortical_frames: array of per-vertex activation arrays */
  frames: number[][]
  segments?: Segment[]
  timestepSeconds?: number
  /** Max frames to display in the grid */
  maxDisplay?: number
}

/**
 * Renders a grid of miniature "activation thumbnails" for each timestep.
 * Each thumbnail is a 1D strip that color-maps mean activation per spatial chunk.
 * This is a lightweight stand-in until a full WebGL brain render-to-texture pipeline
 * is implemented in Phase 3b.
 */
export function TemporalFrames({ frames, segments, timestepSeconds = 2, maxDisplay = 16 }: Props) {
  const [selected, setSelected] = useState<number | null>(null)

  const displayed = frames.slice(0, maxDisplay)

  const thumbnails = useMemo(() => {
    const STRIPS = 32  // spatial bins per thumbnail
    return displayed.map((frame) => {
      const binSize = Math.ceil(frame.length / STRIPS)
      const min = Math.min(...frame)
      const max = Math.max(...frame)
      const range = max - min || 1
      const strips: string[] = []
      for (let s = 0; s < STRIPS; s++) {
        const slice = frame.slice(s * binSize, (s + 1) * binSize)
        const mean = slice.reduce((a, b) => a + b, 0) / (slice.length || 1)
        const t = (mean - min) / range
        const [r, g, b] = hotColormap(t)
        strips.push(
          `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
        )
      }
      return strips
    })
  }, [displayed])

  const selectedFrame = selected !== null ? frames[selected] : null
  const selectedMin = selectedFrame ? Math.min(...selectedFrame) : 0
  const selectedMax = selectedFrame ? Math.max(...selectedFrame) : 1

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Temporal Activation Frames</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Each tile shows spatial activation at that timestep. Click to inspect.
          {frames.length > maxDisplay && (
            <span className="ml-1">Showing first {maxDisplay} of {frames.length} frames.</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {thumbnails.map((strips, idx) => {
          const seg = segments?.[idx]
          const timeLabel = seg
            ? `${seg.start}s–${seg.end}s`
            : `${idx * timestepSeconds}s`
          return (
            <button
              key={idx}
              onClick={() => setSelected(selected === idx ? null : idx)}
              className={`group flex flex-col items-center gap-1 rounded border p-1 transition-colors hover:bg-muted/50 ${
                selected === idx ? 'border-foreground ring-1 ring-foreground' : ''
              }`}
            >
              {/* Activation strip thumbnail */}
              <div className="w-full h-12 rounded overflow-hidden flex">
                {strips.map((color, s) => (
                  <div key={s} className="flex-1 h-full" style={{ backgroundColor: color }} />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">{timeLabel}</span>
            </button>
          )
        })}
      </div>

      {/* Selected frame detail */}
      {selected !== null && selectedFrame && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">
            Frame {selected + 1} · t = {selected * timestepSeconds}s
            {segments?.[selected] && ` · ${segments[selected].label}`}
          </p>
          <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Min</p>
              <p>{selectedMin.toFixed(4)}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Max</p>
              <p>{selectedMax.toFixed(4)}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Mean</p>
              <p>{(selectedFrame.reduce((a, b) => a + b, 0) / selectedFrame.length).toFixed(4)}</p>
            </div>
          </div>
          {/* Full resolution activation strip */}
          <div className="w-full h-6 rounded overflow-hidden flex">
            {useMiniStrip(selectedFrame, 64)}
          </div>
        </div>
      )}
    </div>
  )
}

function useMiniStrip(frame: number[], bins: number): React.ReactNode {
  const min = Math.min(...frame)
  const max = Math.max(...frame)
  const range = max - min || 1
  const binSize = Math.ceil(frame.length / bins)
  const strips = []
  for (let s = 0; s < bins; s++) {
    const slice = frame.slice(s * binSize, (s + 1) * binSize)
    const mean = slice.reduce((a, b) => a + b, 0) / (slice.length || 1)
    const t = (mean - min) / range
    const [r, g, b] = hotColormap(t)
    strips.push(
      <div
        key={s}
        className="flex-1 h-full"
        style={{ backgroundColor: `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})` }}
      />
    )
  }
  return strips
}
