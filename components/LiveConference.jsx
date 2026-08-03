'use client'

import { useEffect, useState, useRef } from 'react'
import '@livekit/components-styles'
import {
  LiveKitRoom,
  VideoConference,
  useDataChannel,
  useLocalParticipant,
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader2, Radio, Video, Maximize2, Send, Users, MessageSquare, Building2, Presentation, X, Clock, Pause, Play, RotateCcw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'

const MergedPresentationViewer = dynamic(() => import('@/components/MergedPresentationViewer'), { ssr: false })

const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('scmsToken') : null)

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  const t = getToken()
  if (t) headers['Authorization'] = `Bearer ${t}`
  const r = await fetch('/api' + path, { ...opts, headers })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error || 'Request failed')
  return d
}

export default function LiveConference({ conf, isAdmin, fallback, onNeedsSignIn }) {
  const [status, setStatus] = useState({ isLive: false, checked: false })
  const [tokenData, setTokenData] = useState(null)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [merged, setMerged] = useState(null) // { url, slideIndex, generatedAt, totalPages }
  const authed = !!getToken()

  useEffect(() => {
    if (!conf?.id) return
    let alive = true
    const check = () => fetch(`/api/conferences/${conf.id}/live-status`).then(r => r.json()).then(d => { if (alive) setStatus({ isLive: !!d.isLive, checked: true }) }).catch(() => alive && setStatus({ isLive: false, checked: true }))
    check()
    const t = setInterval(check, 15000)
    return () => { alive = false; clearInterval(t) }
  }, [conf?.id])

  useEffect(() => {
    if (!conf?.id) return
    // Merged presentation metadata is public-ish (served from /api/uploads),
    // but the metadata endpoint doesn't require auth for reading. Ignore errors.
    fetch(`/api/conferences/${conf.id}/merged-presentation`).then(r => r.ok ? r.json() : null).then(d => setMerged(d?.presentation || null)).catch(() => {})
  }, [conf?.id])

  const join = async () => {
    if (!authed) {
      if (onNeedsSignIn) onNeedsSignIn()
      else toast.error('Please sign in to join the live stream')
      return
    }
    setConnecting(true); setError('')
    try {
      const d = await api('/livekit/token', { method: 'POST', body: JSON.stringify({ conferenceId: conf.id }) })
      setTokenData(d)
    } catch (e) {
      if (String(e.message || '').toLowerCase().includes('unauth')) {
        setError('Your session has expired. Please sign in again to join.')
        if (onNeedsSignIn) setTimeout(onNeedsSignIn, 1200)
      } else setError(e.message)
    } finally { setConnecting(false) }
  }

  const toggleLive = async (goLive) => {
    if (!authed) { if (onNeedsSignIn) onNeedsSignIn(); return }
    try {
      const d = await api(`/conferences/${conf.id}/live`, { method: 'POST', body: JSON.stringify({ isLive: goLive }) })
      setStatus({ isLive: !!d.conference.isLive, checked: true })
      toast.success(goLive ? 'Conference is now LIVE' : 'Conference ended')
    } catch (e) { toast.error(e.message) }
  }

  // One-click for admin: mark conference live AND immediately join as host with camera.
  const startBroadcast = async () => {
    if (!authed) { if (onNeedsSignIn) onNeedsSignIn(); return }
    setConnecting(true); setError('')
    try {
      // Flip live flag
      const d = await api(`/conferences/${conf.id}/live`, { method: 'POST', body: JSON.stringify({ isLive: true }) })
      setStatus({ isLive: !!d.conference.isLive, checked: true })
      // Immediately fetch a host token and open the LiveKit room (camera enabled)
      const t = await api('/livekit/token', { method: 'POST', body: JSON.stringify({ conferenceId: conf.id }) })
      setTokenData(t)
      toast.success('Broadcast started — camera & mic are live')
    } catch (e) {
      if (String(e.message || '').toLowerCase().includes('unauth')) {
        setError('Your session has expired. Please sign in again.')
        if (onNeedsSignIn) setTimeout(onNeedsSignIn, 1200)
      } else setError(e.message)
    } finally { setConnecting(false) }
  }

  if (!status.checked) return <div className="p-8 text-center"><Loader2 className="animate-spin inline mr-2" /> Checking conference status…</div>

  // Offline fallback for viewers — show exhibition booths
  if (!status.isLive && !isAdmin) {
    return (
      <div>
        <div className="bg-gradient-to-r from-slate-700 to-slate-900 text-white py-6 px-6 mb-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <Badge className="bg-slate-500 text-white mb-2">CONFERENCE OFFLINE</Badge>
              <h2 className="text-2xl font-bold">{conf.name}</h2>
              <p className="text-sm opacity-90 mt-1">The live stream will begin when the host starts the conference. Meanwhile, explore our sponsors below.</p>
            </div>
            <Radio className="h-16 w-16 opacity-40" />
          </div>
        </div>
        {fallback}
      </div>
    )
  }

  // Show virtual booths + admin controls when not yet connected
  if (!tokenData) {
    return (
      <div>
        <div className={`bg-gradient-to-r ${status.isLive ? 'from-red-600 to-rose-700' : 'from-slate-700 to-slate-900'} text-white py-6 px-6 mb-4`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <Badge className={`${status.isLive ? 'bg-white text-red-700' : 'bg-slate-500 text-white'} mb-2`}>
                {status.isLive ? <><Radio className="h-3 w-3 mr-1 inline animate-pulse" /> LIVE NOW</> : 'CONFERENCE OFFLINE'}
              </Badge>
              <h2 className="text-2xl font-bold">{conf.name}</h2>
              <p className="text-sm opacity-90 mt-1">
                {status.isLive
                  ? 'The conference is broadcasting live. Join now to watch and participate in Q&A.'
                  : (isAdmin ? 'You have host access. Start the broadcast when ready — the stream is currently offline.' : 'Explore our virtual exhibition below while awaiting the live stream.')}
              </p>
              {error && <div className="text-white bg-red-900/40 border border-red-400/50 rounded px-3 py-1.5 mt-2 text-sm">{error}</div>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {isAdmin && !status.isLive && (
                <Button onClick={startBroadcast} disabled={connecting} className="bg-white text-red-700 hover:bg-slate-100 shadow-lg font-semibold">
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Radio className="h-4 w-4 mr-1" />}
                  Start live broadcast (open camera)
                </Button>
              )}
              {isAdmin && status.isLive && (
                <Button onClick={() => toggleLive(false)} variant="outline" className="bg-white/10 border-white/40 text-white hover:bg-white/20">End broadcast</Button>
              )}
              {status.isLive && authed && (
                <Button onClick={join} disabled={connecting} className="bg-white text-red-700 hover:bg-slate-100 shadow-lg font-semibold">
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Video className="h-4 w-4 mr-1" />}
                  Join {isAdmin ? 'as host' : 'live stream'}
                </Button>
              )}
              {status.isLive && !authed && (
                <Button onClick={() => onNeedsSignIn && onNeedsSignIn()} className="bg-white text-red-700 hover:bg-slate-100 shadow-lg font-semibold">
                  Sign in to join
                </Button>
              )}
            </div>
          </div>
        </div>
        {/* Always show virtual booths carousel below */}
        {fallback}
      </div>
    )
  }

  return (
    <LiveKitConnected tokenData={tokenData} conf={conf} isAdmin={isAdmin} merged={merged}
      onLeave={() => setTokenData(null)}
      onEnd={isAdmin ? () => { toggleLive(false); setTokenData(null) } : null}
    />
  )
}

function LiveKitConnected({ tokenData, conf, isAdmin, merged, onLeave, onEnd }) {
  const wrapRef = useRef(null)
  const [showSlides, setShowSlides] = useState(!!merged?.url)

  useEffect(() => { setShowSlides(!!merged?.url) }, [merged?.url])

  const goFullscreen = () => {
    if (!wrapRef.current) return
    if (document.fullscreenElement) document.exitFullscreen()
    else wrapRef.current.requestFullscreen?.()
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-900">
      <div className="h-12 bg-slate-800 text-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Badge className="bg-red-600 text-white animate-pulse"><Radio className="h-3 w-3 mr-1" /> LIVE</Badge>
          <span className="text-sm font-semibold">{conf.name}</span>
          {tokenData.role === 'host' && <Badge variant="outline" className="border-white/30 text-white text-[10px]">HOST</Badge>}
        </div>
        <div className="flex gap-2">
          {merged?.url && (
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setShowSlides(v => !v)} title={showSlides ? 'Hide slides' : 'Show slides'}>
              <Presentation className="h-4 w-4 mr-1" /> {showSlides ? 'Hide slides' : 'Show slides'}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={goFullscreen}><Maximize2 className="h-4 w-4" /></Button>
          {isAdmin && onEnd && <Button size="sm" variant="destructive" onClick={onEnd}>End broadcast</Button>}
          <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10" onClick={onLeave}>Leave</Button>
        </div>
      </div>
      <div ref={wrapRef} className="flex-1 flex overflow-hidden">
        <LiveKitRoom
          token={tokenData.token}
          serverUrl={tokenData.url}
          data-lk-theme="default"
          connect={true}
          audio={tokenData.role === 'host'}
          video={tokenData.role === 'host'}
          onDisconnected={onLeave}
          className="flex-1 flex overflow-hidden"
        >
          <RoomAudioRenderer />
          {showSlides && merged?.url && (
            <SlidesPanel merged={merged} isHost={tokenData.role === 'host'} onClose={() => setShowSlides(false)} />
          )}
          <div className="flex-1 flex flex-col bg-black relative min-w-0">
            <div className="flex-1 relative overflow-hidden">
              <VideoStage />
            </div>
            <div className="shrink-0 bg-slate-900/95 backdrop-blur-sm">
              <ControlBar controls={{ microphone: tokenData.role === 'host', camera: tokenData.role === 'host', screenShare: tokenData.role === 'host', leave: false, chat: false }} />
            </div>
          </div>
          <QnASidebar displayName={tokenData.displayName} isHost={tokenData.role === 'host'} />
        </LiveKitRoom>
      </div>
    </div>
  )
}

// SlidesPanel: renders the merged presentation and syncs the current page across
// all connected participants using the LiveKit data channel topic "slides".
// Only the host can advance slides; every viewer follows the host's page.
function SlidesPanel({ merged, isHost, onClose }) {
  const [page, setPage] = useState(1)
  const { send, message } = useDataChannel('slides')

  // When we receive a page update from anyone (host), follow it.
  useEffect(() => {
    if (!message) return
    try {
      const raw = new TextDecoder().decode(message.payload)
      const data = JSON.parse(raw)
      if (data && typeof data.page === 'number' && data.page > 0) {
        setPage(data.page)
      }
    } catch {}
  }, [message])

  const changePage = async (n) => {
    setPage(n)
    if (!isHost) return
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ page: n, ts: Date.now() }))
      await send(payload, { reliable: true, topic: 'slides' })
    } catch {}
  }

  // On host mount, broadcast the initial page so late-joining viewers can catch up.
  useEffect(() => {
    if (!isHost) return
    const t = setTimeout(() => {
      const payload = new TextEncoder().encode(JSON.stringify({ page, ts: Date.now() }))
      send(payload, { reliable: true, topic: 'slides' }).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost])

  return (
    <div className="w-[42%] min-w-[380px] max-w-[720px] border-r border-white/10 bg-slate-950 flex flex-col relative">
      <div className="h-9 bg-slate-800 text-white text-xs flex items-center px-3 gap-2 shrink-0">
        <Presentation className="h-3.5 w-3.5" />
        <span className="font-semibold">Slides</span>
        {isHost && <Badge className="bg-indigo-600 text-[9px] px-1 py-0">CONTROLLING</Badge>}
        <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 h-6 w-6 p-0 ml-auto" onClick={onClose}><X className="h-3 w-3" /></Button>
      </div>
      {isHost && <PresenterTimer slideIndex={merged.slideIndex || []} currentPage={page} />}
      <div className="flex-1 overflow-hidden">
        <MergedPresentationViewer
          url={merged.url}
          slideIndex={merged.slideIndex || []}
          isPresenter={isHost}
          currentPage={page}
          onPageChange={changePage}
          height="100%"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PresenterTimer
//
// Live countdown visible ONLY to the presenter (host). Design decisions the
// user asked us to lock in:
//   • Show timer to presenter only — viewers see nothing so they aren't
//     distracted or pressured.
//   • When the presenter navigates backwards to a previous talk, the timer
//     keeps counting from where it left off (does NOT reset) — mirrors real
//     wall-clock stage timing.
//   • Audible chimes at T-2:00, T-0:30 and T-0:00 for the presenter only.
//     Overrun mode counts up in red.
//
// State per talk (keyed by slideIndex.itemId) is stored in a ref so state
// survives slide navigation and even Live-Conference layout re-renders.
// ─────────────────────────────────────────────────────────────────────────────
function PresenterTimer({ slideIndex, currentPage }) {
  const stateRef = useRef({})       // { [itemId]: { remainingMs, running, alerts: {t120,t30,t0} } }
  const lastTickAtRef = useRef(null)
  const lastItemIdRef = useRef(null)
  const [, forceRender] = useState(0)

  const currentItem = slideIndex.find(t => currentPage >= t.coverPage && currentPage <= t.endPage)

  // Ensure state exists for the active item; auto-start on first entry.
  useEffect(() => {
    if (!currentItem) return
    const id = currentItem.itemId
    if (!stateRef.current[id]) {
      const durMs = new Date(currentItem.endTime) - new Date(currentItem.startTime)
      stateRef.current[id] = {
        remainingMs: durMs > 0 ? durMs : 15 * 60_000,
        running: true,
        alerts: {},
      }
    }
    // Reset tick anchor when switching items so a partial second isn't
    // charged against the new item.
    if (lastItemIdRef.current !== id) {
      lastTickAtRef.current = Date.now()
      lastItemIdRef.current = id
    }
  }, [currentItem?.itemId, currentItem?.endTime, currentItem?.startTime])

  // 500-ms ticker that decrements the currently-active item.
  useEffect(() => {
    const iv = setInterval(() => {
      const item = slideIndex.find(t => currentPage >= t.coverPage && currentPage <= t.endPage)
      if (!item) return
      const s = stateRef.current[item.itemId]
      if (!s || !s.running) { lastTickAtRef.current = Date.now(); return }
      const now = Date.now()
      const delta = now - (lastTickAtRef.current || now)
      lastTickAtRef.current = now
      s.remainingMs -= delta
      // Chimes (T-120, T-30, T-0), presenter only. Play once per threshold.
      if (s.remainingMs <= 120_000 && !s.alerts.t120) { s.alerts.t120 = true; chime(660, 250) }
      if (s.remainingMs <= 30_000 && !s.alerts.t30) { s.alerts.t30 = true; chime(880, 250) }
      if (s.remainingMs <= 0 && !s.alerts.t0) { s.alerts.t0 = true; chime(440, 700) }
      forceRender(v => v + 1)
    }, 500)
    return () => clearInterval(iv)
  }, [slideIndex, currentPage])

  const item = currentItem
  const s = item ? stateRef.current[item.itemId] : null
  if (!item || !s) return (
    <div className="bg-slate-800 text-white text-xs px-3 py-2 flex items-center gap-2 border-b border-slate-700">
      <Clock className="h-3.5 w-3.5 opacity-50" />
      <span className="opacity-60">Timer will start when you open a talk slide</span>
    </div>
  )

  const overrun = s.remainingMs < 0
  const abs = Math.max(0, Math.abs(s.remainingMs))
  const mm = Math.floor(abs / 60_000)
  const ss = String(Math.floor((abs % 60_000) / 1000)).padStart(2, '0')

  const toggle = () => { s.running = !s.running; lastTickAtRef.current = Date.now(); forceRender(v => v + 1) }
  const reset = () => {
    const durMs = new Date(item.endTime) - new Date(item.startTime)
    s.remainingMs = durMs > 0 ? durMs : 15 * 60_000
    s.alerts = {}; s.running = true
    lastTickAtRef.current = Date.now(); forceRender(v => v + 1)
  }

  const bg = overrun ? 'bg-red-600 animate-pulse' : s.remainingMs < 120_000 ? 'bg-amber-500' : 'bg-emerald-600'

  return (
    <div className={`text-white text-xs px-3 py-2 flex items-center gap-2 border-b border-slate-700 shrink-0 ${bg}`}>
      {overrun ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      <span className="font-mono text-lg font-bold tracking-tight tabular-nums leading-none">
        {overrun ? '+' : ''}{mm}:{ss}
      </span>
      <span className="text-[9px] uppercase font-semibold opacity-90 leading-none">
        {overrun ? 'Over' : 'Remaining'}
      </span>
      <span className="ml-2 text-[10px] opacity-80 truncate max-w-[160px]" title={item.title}>
        {item.type === 'break' ? '☕ ' + item.title : item.type === 'sponsor' ? '💼 ' + item.title : item.title}
      </span>
      <div className="ml-auto flex gap-1">
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-white hover:bg-white/10" onClick={toggle} title={s.running ? 'Pause timer' : 'Resume timer'}>
          {s.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-white hover:bg-white/10" onClick={reset} title="Reset timer for this item">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// Web Audio API "beep" — small, dependency-free chime for the presenter.
function chime(freq = 660, durationMs = 200) {
  if (typeof window === 'undefined') return
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(gain); gain.connect(ctx.destination)
    const t0 = ctx.currentTime
    const t1 = t0 + durationMs / 1000
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t1)
    osc.start(t0); osc.stop(t1 + 0.02)
    setTimeout(() => ctx.close().catch(() => {}), durationMs + 250)
  } catch { /* audio blocked or unsupported — silently ignore */ }
}

function VideoStage() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ], { onlySubscribed: false })
  if (tracks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-white/70 flex-col gap-3">
        <Video className="h-16 w-16 opacity-40" />
        <div className="text-lg">Waiting for host to start streaming…</div>
      </div>
    )
  }
  return <GridLayout tracks={tracks} className="h-full"><ParticipantTile /></GridLayout>
}

function QnASidebar({ displayName, isHost }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const scrollRef = useRef(null)
  const { send, message } = useDataChannel('qna')

  useEffect(() => {
    if (!message) return
    try {
      const raw = new TextDecoder().decode(message.payload)
      const data = JSON.parse(raw)
      setMessages(prev => [...prev, data])
    } catch {}
  }, [message])

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages])

  const submit = async () => {
    const t = text.trim()
    if (!t) return
    const outgoing = {
      id: (globalThis.crypto?.randomUUID?.() || String(Date.now())),
      name: displayName,
      isHost,
      text: t,
      ts: Date.now(),
    }
    try {
      const encoded = new TextEncoder().encode(JSON.stringify(outgoing))
      await send(encoded, { reliable: true, topic: 'qna' })
      setMessages(prev => [...prev, outgoing])
      setText('')
    } catch (e) { toast.error('Failed to send question') }
  }

  return (
    <div className="w-96 bg-white flex flex-col border-l">
      <div className="h-12 border-b bg-slate-50 flex items-center gap-2 px-4">
        <MessageSquare className="h-4 w-4 text-indigo-600" />
        <span className="font-semibold text-sm">Live Q&amp;A</span>
        <Badge variant="outline" className="ml-auto text-[10px]">{messages.length}</Badge>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-10">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
            No questions yet. Be the first to ask!
          </div>
        ) : messages.map(m => (
          <div key={m.id} className={`rounded-lg p-2 border-l-2 ${m.isHost ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-slate-300'}`}>
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-xs font-bold text-slate-800">{m.name || 'Anonymous'}</span>
              {m.isHost && <Badge className="bg-indigo-600 text-[9px] px-1 py-0">HOST</Badge>}
              <span className="text-[10px] text-slate-400 ml-auto">{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="border-t p-2 flex gap-1">
        <Input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Ask a question…" className="text-sm" />
        <Button size="sm" onClick={submit} className="bg-indigo-600 hover:bg-indigo-700"><Send className="h-3 w-3" /></Button>
      </div>
    </div>
  )
}
