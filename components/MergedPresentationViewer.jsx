'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, FileText, Presentation } from 'lucide-react'

/**
 * MergedPresentationViewer
 *   Uses the browser's native PDF viewer inside an <iframe> and controls the
 *   displayed page by mutating the `#page=N` URL fragment. This is far more
 *   robust than shipping pdfjs to the client and handles PDFs of any size.
 *
 *   Props:
 *     - url: PDF URL
 *     - slideIndex: [{coverPage, endPage, submissionCode, title, sessionTitle, ...}]
 *     - isPresenter: whether the user controls page changes for everyone
 *     - currentPage / onPageChange: external control (integrates with LiveKit sync)
 *     - height: CSS height (default fills container)
 */
export default function MergedPresentationViewer({
  url,
  slideIndex = [],
  isPresenter = false,
  currentPage,
  onPageChange,
  height,
}) {
  const [internalPage, setInternalPage] = useState(1)
  const iframeRef = useRef(null)

  const page = currentPage ?? internalPage
  // total pages: derived from slideIndex last endPage if available
  const totalPages = slideIndex.length ? Math.max(...slideIndex.map(t => t.endPage || 0)) : 0

  const setPage = useCallback((n) => {
    const safe = Math.max(1, totalPages ? Math.min(totalPages, n) : n)
    if (onPageChange) onPageChange(safe)
    else setInternalPage(safe)
  }, [totalPages, onPageChange])

  // Presenter-only keyboard shortcuts
  useEffect(() => {
    if (!isPresenter) return
    const onKey = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); setPage(page + 1) }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); setPage(page - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPresenter, page, setPage])

  const currentTalk = slideIndex.find(t => page >= t.coverPage && page <= t.endPage)

  if (!url) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-lg bg-slate-50">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-40" />
        <div className="font-medium">No merged presentation yet</div>
        <div className="text-xs mt-1">Ask the Chief Editor to generate the merged deck from the Delegates page.</div>
      </div>
    )
  }

  // Build the iframe src with PDF viewer parameters. `toolbar=0` hides the
  // browser toolbar and `navpanes=0` hides the side panel so viewers see only
  // the slide. Chrome, Edge & Firefox all honour these.
  const src = `${url}#page=${page}&toolbar=0&navpanes=0&scrollbar=0&view=FitH`

  return (
    <div className="flex flex-col bg-slate-900 rounded-lg overflow-hidden" style={height ? { height } : undefined}>
      {/* Top strip with current talk info */}
      <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-4 py-2 flex items-center gap-3 shrink-0">
        <Presentation className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          {currentTalk ? (
            <>
              <div className="text-xs opacity-80 truncate">{currentTalk.sessionTitle}{currentTalk.submissionCode ? ` · ${currentTalk.submissionCode}` : ''}</div>
              <div className="text-sm font-semibold truncate">{currentTalk.title}</div>
            </>
          ) : (
            <div className="text-sm font-semibold truncate">Conference Presentation</div>
          )}
        </div>
        <Badge className="bg-white/20 border-white/30 text-white text-[10px] whitespace-nowrap">
          Page {page}{totalPages ? ` / ${totalPages}` : ''}
        </Badge>
      </div>

      {/* PDF iframe */}
      <div className="flex-1 bg-slate-800 relative">
        <iframe
          ref={iframeRef}
          src={src}
          title="Merged conference presentation"
          className="absolute inset-0 w-full h-full border-0 bg-white"
        />
      </div>

      {/* Controls */}
      <div className="bg-slate-950 text-white px-3 py-2 flex items-center gap-2 shrink-0">
        {isPresenter ? (
          <>
            <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10 h-8" onClick={() => setPage(page - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10 h-8" onClick={() => setPage(page + 1)} disabled={totalPages > 0 && page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="text-xs opacity-70 ml-2 hidden sm:block">← → arrow keys work too</div>
            {slideIndex.length > 0 && (
              <select
                className="ml-auto bg-slate-800 border border-white/20 rounded text-xs px-2 py-1 max-w-[280px]"
                value={currentTalk?.abstractId || ''}
                onChange={(e) => {
                  const talk = slideIndex.find(t => t.abstractId === e.target.value)
                  if (talk) setPage(talk.coverPage)
                }}
              >
                <option value="">Jump to talk…</option>
                {slideIndex.map(t => <option key={t.abstractId} value={t.abstractId}>{t.submissionCode} — {String(t.title).slice(0, 50)}</option>)}
              </select>
            )}
          </>
        ) : (
          <div className="text-xs opacity-70 mx-auto">The presenter is controlling the slides — you will follow automatically.</div>
        )}
      </div>
    </div>
  )
}
