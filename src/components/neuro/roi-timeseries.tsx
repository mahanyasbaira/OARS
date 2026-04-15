'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ROI_COLORS, ROI_LABELS } from './colormap'

interface Props {
  roiTimeseries: Record<string, number[]>
  timestepSeconds?: number
  /** Subset of ROIs to show; defaults to cortical + key subcortical */
  visibleRois?: string[]
}

const DEFAULT_ROIS = [
  'visual_early', 'visual_ventral', 'multisensory_tpj',
  'auditory_early', 'inferior_frontal',
  'amygdala', 'hippocampus', 'nucleus_accumbens',
]

export function ROITimeseries({ roiTimeseries, timestepSeconds = 2, visibleRois }: Props) {
  const rois = visibleRois ?? DEFAULT_ROIS
  const activeRois = rois.filter((r) => r in roiTimeseries)

  if (activeRois.length === 0) {
    return <p className="text-sm text-muted-foreground">No ROI timeseries data.</p>
  }

  const nTimesteps = roiTimeseries[activeRois[0]]?.length ?? 0

  // Build recharts data array: [{time: 0, amygdala: 0.3, ...}, ...]
  const data = Array.from({ length: nTimesteps }, (_, t) => {
    const row: Record<string, number> = { time: t * timestepSeconds }
    for (const roi of activeRois) {
      row[roi] = parseFloat((roiTimeseries[roi]?.[t] ?? 0).toFixed(4))
    }
    return row
  })

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">BOLD Timeseries by ROI</p>
      <p className="text-xs text-muted-foreground">
        Mean predicted BOLD amplitude per cortical/subcortical region over time.
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="time"
            tickFormatter={(v: number) => `${v}s`}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              (value as number).toFixed(4),
              ROI_LABELS[name as string] ?? (name as string),
            ]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(label: any) => `t = ${label as number}s`}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend
            formatter={(value: string) => (
              <span style={{ fontSize: 11 }}>{ROI_LABELS[value] ?? value}</span>
            )}
          />
          {activeRois.map((roi) => (
            <Line
              key={roi}
              type="monotone"
              dataKey={roi}
              stroke={ROI_COLORS[roi] ?? '#888'}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
