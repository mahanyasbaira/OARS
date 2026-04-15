'use client'

import { useEffect, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SourceModality, SourceStatus } from '@/lib/supabase/types'

type Source = {
  id: string
  name: string
  modality: SourceModality
  status: SourceStatus
  created_at: string
  uploads: Array<{
    id: string
    original_filename: string
    mime_type: string
    file_size: number | null
  }>
}

const MODALITY_LABELS: Record<SourceModality, string> = {
  text: 'Text',
  audio: 'Audio',
  vision: 'Vision',
}

const STATUS_VARIANT: Record<SourceStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending:    'outline',
  processing: 'secondary',
  ready:      'default',
  failed:     'destructive',
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type AnalyzeState = 'idle' | 'submitting' | 'submitted' | 'error'

function SourceRow({
  source,
  projectId,
}: {
  source: Source
  projectId: string
}) {
  const [status, setStatus] = useState<SourceStatus>(source.status)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [extractionId, setExtractionId] = useState<string | null>(null)
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>('idle')

  // Poll status every 3s while processing
  const poll = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/sources/${source.id}`)
    if (!res.ok) return
    const data = await res.json() as {
      source: { status: SourceStatus }
      extraction: { id: string; confidence: number } | null
    }
    setStatus(data.source.status)
    if (data.extraction) {
      setConfidence(data.extraction.confidence)
      setExtractionId(data.extraction.id)
    }
  }, [projectId, source.id])

  useEffect(() => {
    // Fetch once on mount to get extraction_id for ready sources
    poll()
  }, [poll])

  useEffect(() => {
    if (status !== 'processing' && status !== 'pending') return
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [status, poll])

  const handleAnalyze = useCallback(async () => {
    if (!extractionId) return
    setAnalyzeState('submitting')
    try {
      const res = await fetch(`/api/projects/${projectId}/neuro/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: source.id, extraction_id: extractionId }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      setAnalyzeState('submitted')
    } catch {
      setAnalyzeState('error')
    }
  }, [extractionId, projectId, source.id])

  const upload = source.uploads?.[0]

  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{source.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {upload ? formatBytes(upload.file_size) : '—'}
          {' · '}
          {new Date(source.created_at).toLocaleDateString()}
          {confidence !== null && (
            <span className="ml-2 text-xs text-muted-foreground">
              · confidence {Math.round(confidence * 100)}%
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="text-xs">
          {MODALITY_LABELS[source.modality]}
        </Badge>
        <Badge variant={STATUS_VARIANT[status]} className="text-xs capitalize">
          {status === 'processing' && (
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
          )}
          {status}
        </Badge>
        {status === 'ready' && extractionId && analyzeState === 'idle' && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2"
            onClick={handleAnalyze}
          >
            Analyze
          </Button>
        )}
        {analyzeState === 'submitting' && (
          <span className="text-xs text-muted-foreground">Queuing…</span>
        )}
        {analyzeState === 'submitted' && (
          <span className="text-xs text-green-600 dark:text-green-400">Queued</span>
        )}
        {analyzeState === 'error' && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2 text-destructive"
            onClick={handleAnalyze}
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}

export function SourceList({
  sources,
  projectId,
}: {
  sources: Source[]
  projectId: string
}) {
  return (
    <div className="rounded-lg border divide-y">
      {sources.map((source) => (
        <SourceRow key={source.id} source={source} projectId={projectId} />
      ))}
    </div>
  )
}
