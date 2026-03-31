'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { ReportPayload } from '@/schemas/report'

export function ReportView({
  projectId,
  initialReport,
}: {
  projectId: string
  initialReport: ReportPayload | null
}) {
  const [report, setReport]       = useState<ReportPayload | null>(initialReport)
  const [generating, setGenerating] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/report`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to generate report')
      }
      // Fetch the newly created report
      const latest = await fetch(`/api/projects/${projectId}/report`)
      const data = await latest.json() as { report: { payload: ReportPayload } | null }
      if (data.report) setReport(data.report.payload as ReportPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {report
            ? `Generated ${new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${report.model}`
            : 'No report generated yet.'}
        </p>
        <div className="flex items-center gap-2">
          {report && (
            <a
              href={`/api/projects/${projectId}/report/export`}
              download
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Export Markdown
            </a>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating…' : report ? 'Regenerate' : 'Generate Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {generating && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm animate-pulse">
            Synthesising across all sources…
          </p>
        </div>
      )}

      {report && !generating && (
        <div className="space-y-8">
          {/* Executive Summary */}
          <section className="space-y-3">
            <h2 className="font-semibold text-lg">Executive Summary</h2>
            <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {report.executiveSummary}
            </div>
          </section>

          {/* Key Findings */}
          {report.keyFindings.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold text-lg">Key Findings</h2>
              <div className="space-y-3">
                {report.keyFindings.map((f, i) => (
                  <div key={i} className="flex gap-3 items-start rounded-lg border p-4">
                    <span className="text-xs font-mono text-muted-foreground mt-0.5 shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm">{f.finding}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {Math.round(f.confidence * 100)}% confidence
                        </span>
                        {f.sources.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {f.sources.length} source{f.sources.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Contradiction Matrix */}
          {report.contradictionMatrix.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold text-lg">
                Contradiction Matrix
                <Badge variant="destructive" className="ml-2 text-xs">
                  {report.contradictionMatrix.length}
                </Badge>
              </h2>
              <div className="space-y-3">
                {report.contradictionMatrix.map((c, i) => (
                  <div key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-1">
                    <p className="text-sm font-medium">{c.topic}</p>
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Methodology */}
          {report.methodology && (
            <section className="space-y-2 border-t pt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Methodology</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">{report.methodology}</p>
            </section>
          )}
        </div>
      )}

      {!report && !generating && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No report generated yet.</p>
          <p className="text-muted-foreground text-xs mt-1">
            Process at least one source, then click Generate Report.
          </p>
        </div>
      )}
    </div>
  )
}
