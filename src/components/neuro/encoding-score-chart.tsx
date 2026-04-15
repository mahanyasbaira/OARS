'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { ROI_COLORS, ROI_LABELS } from './colormap'

interface Props {
  encodingScores: Record<string, number>
}

export function EncodingScoreChart({ encodingScores }: Props) {
  const entries = Object.entries(encodingScores)
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No encoding scores available.</p>
  }

  const data = entries
    .map(([roi, score]) => ({
      roi,
      label: ROI_LABELS[roi] ?? roi.replace(/_/g, ' '),
      score: parseFloat(score.toFixed(3)),
      color: ROI_COLORS[roi] ?? '#888',
    }))
    .sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Encoding Scores by Region</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pearson r between predicted and held-out BOLD responses.
          Higher = model predicts this region well.
        </p>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 0.6]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={160}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [(value as number).toFixed(3), 'Pearson r']}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="score" radius={[0, 3, 3, 0]}>
            {data.map((entry) => (
              <Cell key={entry.roi} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
