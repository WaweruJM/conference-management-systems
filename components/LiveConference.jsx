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
import { Loader2, Radio, Video, Maximize2, Send, Users, MessageSquare, Building2 } from 'lucide-react'
import { toast } from 'sonner'

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
  const authed = !!getToken()

  useEffect(() => {
    if (!conf?.id) return
    let alive = true
    const check = () => fetch(`/api/conferences/${conf.id}/live-status`).then(r => r.json()).then(d => { if (alive) setStatus({ isLive: !!d.isLive, checked: true }) }).catch(() => alive && setStatus({ isLive: false, checked: true }))
    check()
    const t = setInterval(check, 15000)
    return () => { alive = false; clearInterval(t) }
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
    <LiveKitConnected tokenData={tokenData} conf={conf} isAdmin={isAdmin}
      onLeave={() => setTokenData(null)}
      onEnd={isAdmin ? () => { toggleLive(false); setTokenData(null) } : null}
    />
  )
}

function LiveKitConnected({ tokenData, conf, isAdmin, onLeave, onEnd }) {
  const wrapRef = useRef(null)

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
          <div className="flex-1 flex flex-col bg-black relative">
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
