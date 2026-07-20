'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { ROLE_LABELS, STATE_COLORS, stateLabel, TIMELINE_STAGES } from '@/lib/scms-utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Loader2, LogOut, Bell, FileText, Users, Calendar, LayoutDashboard, Upload, MessageSquare,
  ClipboardCheck, ChevronRight, CheckCircle2, XCircle, Clock, AlertCircle, Sparkles,
  Building2, Globe, GraduationCap, ShieldCheck, Download, Plus, Send, Search, FileUp, Award,
  BookOpen, ListChecks, BarChart3, Star, Trash2, Mail, Radio, Video, Briefcase,
} from 'lucide-react'
import dynamic from 'next/dynamic'
const LiveConference = dynamic(() => import('@/components/LiveConference'), { ssr: false, loading: () => <div className="p-8 text-center"><Loader2 className="animate-spin inline" /></div> })

const TOKEN_KEY = 'scms_token'
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null)
const setToken = (t) => { if (typeof window !== 'undefined') { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) } }

const api = async (path, opts = {}) => {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

const apiUpload = async (path, formData) => {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data
}

// ============ MESSAGING TEMPLATES ============
const GRATITUDE_OPENINGS = [
  { label: '— None —', value: '' },
  { label: 'Warm thanks (formal)', value: 'Dear {authorTitle} {authorName},\n\nOn behalf of the editorial team, thank you for your valuable submission to {conferenceName}. We truly appreciate your scholarly contribution and the time you have invested in advancing this important area of research.\n\n' },
  { label: 'Congratulations on submission', value: 'Dear {authorTitle} {authorName},\n\nCongratulations on submitting your abstract to {conferenceName}. Your interest in our conference is greatly appreciated, and we are pleased to consider your work for peer review.\n\n' },
  { label: 'Thanks for revision', value: 'Dear {authorTitle} {authorName},\n\nThank you for your prompt and thoughtful revision of manuscript {submissionCode}. Your responsiveness to reviewer feedback is greatly valued.\n\n' },
  { label: 'Thanks for peer review', value: 'Dear {authorTitle} {authorName},\n\nOn behalf of the editorial board of {conferenceName}, we sincerely thank you for accepting to serve as a peer reviewer. Your expertise strengthens the scientific quality of our conference.\n\n' },
  { label: 'Acknowledgement of receipt', value: 'Dear {authorTitle} {authorName},\n\nThis is to formally acknowledge receipt of your submission {submissionCode}. It has been logged in our system and is now under editorial review.\n\n' },
  { label: 'Straightforward greeting', value: 'Dear {authorTitle} {authorName},\n\n' },
]

const GRATITUDE_CLOSINGS = [
  { label: '— None —', value: '' },
  { label: 'Warm regards (formal)', value: '\n\nWe deeply appreciate your continued engagement with {conferenceName} and look forward to your response.\n\nWith warm regards,\n{editorName}\n{editorTitle}\n{conferenceName} Editorial Office' },
  { label: 'Best wishes', value: '\n\nThank you once again for your dedication to the advancement of science. We wish you the very best.\n\nBest wishes,\n{editorName}\n{conferenceName} Editorial Office' },
  { label: 'Encouraging', value: '\n\nWe encourage you to reach out to the editorial office through this platform should you require any clarification. Your contribution is highly valued.\n\nKind regards,\n{editorName}\nEditorial Office' },
  { label: 'Formal close', value: '\n\nYours sincerely,\n{editorName}\n{conferenceName} Editorial Office' },
  { label: 'Reviewer thanks (short)', value: '\n\nThank you again for your service to the scientific community.\n\nRegards,\n{editorName}' },
  { label: 'Simple sign-off', value: '\n\nRegards,\n{editorName}' },
]

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#84cc16']

// Sample hero background images (used when conference has none)
const DEFAULT_HERO_IMAGES = [
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1920&q=70',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1920&q=70',
  'https://images.pexels.com/photos/276175/pexels-photo-276175.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'https://images.pexels.com/photos/9275222/pexels-photo-9275222.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'https://images.pexels.com/photos/34774347/pexels-photo-34774347.jpeg?auto=compress&cs=tinysrgb&w=1920',
]

const WORD_LIMIT = 300
const TITLE_WORD_LIMIT = 20
const MAX_DOC_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_DOC_EXTS = ['.doc', '.docx']

const countWords = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length

// Rotating hero carousel
function HeroCarousel({ images, height = 'h-[420px]' }) {
  const imgs = (images && images.length) ? images.map(p => p.startsWith('/api/') ? p : p) : DEFAULT_HERO_IMAGES
  const [idx, setIdx] = useState(0)
  useEffect(() => { const i = setInterval(() => setIdx(v => (v + 1) % imgs.length), 5000); return () => clearInterval(i) }, [imgs.length])
  return (
    <div className={`relative w-full ${height} overflow-hidden`}>
      {imgs.map((src, i) => (
        <div key={i} className={`absolute inset-0 transition-opacity duration-1000 ${i === idx ? 'opacity-100' : 'opacity-0'}`}>
          <img src={src} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
        </div>
      ))}
    </div>
  )
}

// Fixed public site chrome (header + nav + footer)
function PublicChrome({ conf, children, onSignIn, onRegister, currentView, setPublicView }) {
  const title = conf?.name || 'Scientific Conference'
  const code = conf?.code || ''
  const themeText = conf?.theme || conf?.subtitle || conf?.description || 'Advancing Science Through Rigorous Peer Review'

  const navItems = [
    { key: 'home', label: 'Home' },
    { key: 'guidelines', label: 'Abstract Submission Guidelines' },
    { key: 'venue', label: 'Venue & Dates' },
    { key: 'themes', label: 'Themes' },
    { key: 'booths', label: 'Virtual Exhibition Booths' },
    { key: 'contact', label: 'Contact' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b shadow-sm">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <button onClick={() => setPublicView && setPublicView('home')} className="flex items-center gap-3 text-left">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-lg">S</div>
            <div>
              <div className="font-bold tracking-tight text-lg leading-tight">{title}</div>
              {code && <div className="text-[11px] text-muted-foreground -mt-0.5">{code} · Scientific Conference Management System</div>}
            </div>
          </button>
          <div className="flex gap-2 items-center">
            {onSignIn && <Button variant="ghost" size="sm" onClick={onSignIn}>Sign in</Button>}
            {onRegister && <Button size="sm" onClick={onRegister} className="bg-indigo-600 hover:bg-indigo-700">Get started</Button>}
          </div>
        </div>
        {/* Nav bar */}
        <nav className="border-t bg-slate-50">
          <div className="container mx-auto px-6 flex flex-wrap gap-1">
            {navItems.map(n => (
              <button key={n.key}
                onClick={() => setPublicView && setPublicView(n.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${currentView === n.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'}`}>
                {n.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      {/* Fixed footer */}
      <footer className="border-t bg-slate-900 text-slate-100 mt-12">
        <div className="container mx-auto px-6 py-8 grid md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold">S</div>
              <div className="font-bold">{code || 'SCMS'}</div>
            </div>
            <div className="text-sm text-slate-300 italic">"{themeText}"</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Quick Links</div>
            <div className="space-y-1 text-sm">
              <button onClick={() => setPublicView && setPublicView('guidelines')} className="block text-slate-300 hover:text-white">Submission Guidelines</button>
              <button onClick={() => setPublicView && setPublicView('venue')} className="block text-slate-300 hover:text-white">Venue & Dates</button>
              <a href="/api/uploads/../../public/abstract-guidelines.txt" onClick={(e) => { e.preventDefault(); downloadGuidelines() }} className="block text-slate-300 hover:text-white">Download Guidelines</a>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Contact</div>
            <div className="text-sm text-slate-300 space-y-1">
              {conf?.contactEmail && <div>📧 {conf.contactEmail}</div>}
              {conf?.contactPhone && <div>📞 {conf.contactPhone}</div>}
              {conf?.venue && <div>📍 {conf.venue}, {conf.city}</div>}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 py-3 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {title} · Powered by SCMS
        </div>
      </footer>
    </div>
  )
}

function downloadGuidelines() {
  const link = document.createElement('a')
  link.href = '/abstract-guidelines.txt'
  link.download = 'Abstract_Submission_Guidelines.txt'
  link.click()
}

// ============ MAIN APP ============
function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('landing') // landing | login | register | forgot | reset | app
  const [route, setRoute] = useState({ name: 'dashboard' })
  const [resetToken, setResetToken] = useState('')
  const [reviewerInvite, setReviewerInvite] = useState(null)
  const [surveyToken, setSurveyToken] = useState('')

  useEffect(() => {
    // Detect URL params (?resetToken=... or ?reviewerInvite=... or ?survey=...)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const rt = params.get('resetToken')
      const ri = params.get('reviewerInvite')
      const sv = params.get('survey')
      if (sv) { setSurveyToken(sv); setView('survey'); setLoading(false); return }
      if (rt) { setResetToken(rt); setView('reset'); setLoading(false); return }
      if (ri) {
        api(`/reviewer-invitations/verify/${ri}`).then(d => {
          setReviewerInvite({ token: ri, ...d.invitation })
          setView('register')
          setLoading(false)
        }).catch(() => { setLoading(false) })
        return
      }
    }
    const t = getToken()
    if (!t) { setLoading(false); return }
    api('/auth/me').then(d => { setUser(d.user); setView('app') }).catch(() => setToken(null)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  if (view === 'survey') return <PublicSurveyPage token={surveyToken} onDone={() => { if (typeof window !== 'undefined') window.history.replaceState({}, '', '/'); setView('landing') }} />
  if (view === 'reset') return <ResetPasswordPage token={resetToken} onDone={() => { setView('login'); if (typeof window !== 'undefined') window.history.replaceState({}, '', '/') }} />
  if (view === 'forgot') return <ForgotPassword onBack={() => setView('login')} />
  if (view === 'landing' && !user) return <Landing onLogin={() => setView('login')} onRegister={() => setView('register')} />
  if (view === 'login') return <AuthPage mode="login" onDone={(u) => { setUser(u); setView('app') }} onSwitch={() => setView('register')} onBack={() => setView('landing')} onForgot={() => setView('forgot')} />
  if (view === 'register') return <AuthPage mode="register" reviewerInvite={reviewerInvite} onDone={(u) => { setUser(u); setView('app'); if (typeof window !== 'undefined') window.history.replaceState({}, '', '/') }} onSwitch={() => setView('login')} onBack={() => setView('landing')} />

  return <AppShell user={user} setUser={setUser} route={route} setRoute={setRoute} onLogout={() => { api('/auth/logout', { method: 'POST' }).catch(() => {}); setToken(null); setUser(null); setView('landing') }} />
}

// ============ LANDING ============
function Landing({ onLogin, onRegister }) {
  const [conferences, setConferences] = useState([])
  const [featured, setFeatured] = useState(null)
  const [view, setView] = useState('home')
  useEffect(() => {
    api('/conferences').then(d => setConferences(d.conferences || [])).catch(() => {})
    api('/public/config').then(d => setFeatured(d.conference)).catch(() => {})
  }, [])

  return (
    <PublicChrome conf={featured} onSignIn={onLogin} onRegister={onRegister} currentView={view} setPublicView={setView}>
      {view === 'home' && <PublicHome featured={featured} conferences={conferences} onRegister={onRegister} onLogin={onLogin} />}
      {view === 'guidelines' && <PublicGuidelines />}
      {view === 'venue' && <PublicVenue conf={featured} />}
      {view === 'themes' && <PublicThemes conf={featured} />}
      {view === 'booths' && <ExhibitionBoothsPublic conf={featured} />}
      {view === 'contact' && <PublicContact conf={featured} />}
    </PublicChrome>
  )
}

function PublicHome({ featured, conferences, onRegister, onLogin }) {
  const heroImages = featured?.heroImages && featured.heroImages.length > 0 ? featured.heroImages : DEFAULT_HERO_IMAGES
  return (
    <div>
      {/* Hero section with rotating background */}
      <section className="relative">
        <HeroCarousel images={heroImages} height="h-[560px]" />
        <div className="absolute inset-0 flex items-center">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl text-white">
              {featured?.code && <Badge className="mb-4 bg-indigo-600 hover:bg-indigo-600 text-white border-0">{featured.code}</Badge>}
              <h1 className="text-4xl lg:text-6xl font-bold tracking-tight leading-tight drop-shadow-lg">
                {featured?.name || 'Scientific Conference Management System'}
              </h1>
              {featured?.subtitle && <p className="mt-3 text-xl lg:text-2xl opacity-95">{featured.subtitle}</p>}
              <p className="mt-4 text-lg opacity-90 max-w-2xl drop-shadow">
                {featured?.description || 'The complete lifecycle for scientific conferences — submission, peer review, revisions, programme scheduling and long-term archive.'}
              </p>
              <div className="mt-8 flex gap-3">
                <Button size="lg" onClick={onRegister} className="bg-indigo-600 hover:bg-indigo-700">
                  Register / Submit abstract <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={onLogin} className="bg-white/10 border-white text-white hover:bg-white/20">Sign in</Button>
              </div>
              {featured?.startDate && (
                <div className="mt-6 flex flex-wrap gap-4 text-sm opacity-95">
                  <span>📅 {new Date(featured.startDate).toLocaleDateString()} – {featured.endDate && new Date(featured.endDate).toLocaleDateString()}</span>
                  <span>📍 {featured.venue}, {featured.city}, {featured.country}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Info strip */}
      {featured && (
        <section className="bg-white border-b">
          <div className="container mx-auto px-6 py-6 grid md:grid-cols-4 gap-4 text-center">
            <div><div className="text-2xl font-bold text-indigo-600">{featured.themes?.length || 0}</div><div className="text-xs uppercase tracking-wider text-muted-foreground">Sub-themes</div></div>
            <div><div className="text-2xl font-bold text-indigo-600">{featured.submissionClose ? new Date(featured.submissionClose).toLocaleDateString() : '—'}</div><div className="text-xs uppercase tracking-wider text-muted-foreground">Submission Deadline</div></div>
            <div><div className="text-2xl font-bold text-indigo-600">{featured.doubleBlind ? 'Yes' : 'Optional'}</div><div className="text-xs uppercase tracking-wider text-muted-foreground">Double-blind Review</div></div>
            <div><div className="text-2xl font-bold text-indigo-600">{stateLabel(featured.status)}</div><div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div></div>
          </div>
        </section>
      )}

      {/* Modules */}
      <section className="container mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-6">Comprehensive conference platform</h2>
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { icon: Globe, label: 'Public website' },
            { icon: ShieldCheck, label: 'Authentication & RBAC' },
            { icon: FileText, label: 'Author portal' },
            { icon: ClipboardCheck, label: 'Editorial office' },
            { icon: Users, label: 'Editor workspace' },
            { icon: Award, label: 'Reviewer workspace' },
            { icon: GraduationCap, label: 'Programme committee' },
            { icon: Upload, label: 'Presentation management' },
            { icon: Building2, label: 'Conference administration' },
            { icon: BarChartIcon, label: 'Reporting' },
            { icon: Sparkles, label: 'Analytics' },
            { icon: FileText, label: 'Document archive' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="p-4 rounded-lg border bg-white hover:shadow-md transition">
              <Icon className="h-5 w-5 text-indigo-600 mb-2" />
              <div className="font-medium text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {conferences.length > 0 && (
        <section className="container mx-auto px-6 pb-16">
          <h2 className="text-2xl font-bold mb-6">All conferences</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {conferences.map(c => (
              <Card key={c.id} className="hover:shadow-lg transition">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">{c.code}</Badge>
                    <Badge variant="outline">{stateLabel(c.status)}</Badge>
                  </div>
                  <CardTitle className="text-lg mt-2">{c.name}</CardTitle>
                  <CardDescription>{c.venue}{c.city && `, ${c.city}`}{c.country && `, ${c.country}`}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <div>{c.startDate && new Date(c.startDate).toLocaleDateString()} – {c.endDate && new Date(c.endDate).toLocaleDateString()}</div>
                  <div>{c._count?.abstracts || 0} submissions · {c.themes?.length || 0} themes</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="text-center text-sm text-muted-foreground py-6 border-t">
        Demo accounts (password: <code className="bg-slate-100 px-1.5 py-0.5 rounded">password123</code>):{' '}
        admin@scms.io · managing@scms.io · section@scms.io · reviewer1@scms.io · author@scms.io
      </div>
    </div>
  )
}

function PublicGuidelines() {
  const [txt, setTxt] = useState('')
  useEffect(() => { fetch('/abstract-guidelines.txt').then(r => r.text()).then(setTxt).catch(() => setTxt('Failed to load')) }, [])

  // Parse the plain-text guidelines into structured sections
  const parseSections = (text) => {
    if (!text) return []
    const lines = text.split('\n')
    const sections = []
    // Find all indices of "====" delimiter lines
    const delims = []
    lines.forEach((l, i) => { if (/^={3,}$/.test(l.trim())) delims.push(i) })
    // Pairs of delims wrap a title. Between odd/even pairs we get title, then body until next pair.
    for (let k = 0; k + 1 < delims.length; k += 2) {
      const titleIdx = delims[k] + 1
      const closeIdx = delims[k + 1]
      const title = (lines[titleIdx] || '').trim()
      // Body runs from closeIdx+1 up to the next opening delim (delims[k+2]) or EOF
      const nextOpen = delims[k + 2] ?? lines.length
      const body = lines.slice(closeIdx + 1, nextOpen)
      if (title) sections.push({ title, body })
    }
    return sections
  }
  const sections = parseSections(txt)

  const icons = ['📝', '🎯', '👥', '📄', '🔬', '📊', '✅', '📚', '📅', '🏆', '💡', '🎓']
  const colors = [
    { bg: 'from-blue-500 to-indigo-500', chip: 'bg-blue-100 text-blue-700' },
    { bg: 'from-indigo-500 to-purple-500', chip: 'bg-indigo-100 text-indigo-700' },
    { bg: 'from-purple-500 to-fuchsia-500', chip: 'bg-purple-100 text-purple-700' },
    { bg: 'from-fuchsia-500 to-pink-500', chip: 'bg-fuchsia-100 text-fuchsia-700' },
    { bg: 'from-teal-500 to-cyan-500', chip: 'bg-teal-100 text-teal-700' },
    { bg: 'from-emerald-500 to-teal-500', chip: 'bg-emerald-100 text-emerald-700' },
    { bg: 'from-amber-500 to-orange-500', chip: 'bg-amber-100 text-amber-700' },
    { bg: 'from-rose-500 to-red-500', chip: 'bg-rose-100 text-rose-700' },
  ]

  const renderBody = (bodyLines) => {
    // Merge continuation lines (indented, no bullet marker) into previous item
    const items = []
    let currentPara = []
    const flushPara = () => { if (currentPara.length) { items.push({ type: 'para', text: currentPara.join(' ') }); currentPara = [] } }
    bodyLines.forEach((raw) => {
      const trimmed = raw.trim()
      if (!trimmed) { flushPara(); return }
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
      const letterMatch = trimmed.match(/^([a-z])\.\s+(.*)/i)
      const romanMatch = trimmed.match(/^\((\d+)\)\s+(.*)/)
      if (numMatch) { flushPara(); items.push({ type: 'numbered', num: numMatch[1], text: numMatch[2] }); return }
      if (letterMatch) { flushPara(); items.push({ type: 'lettered', letter: letterMatch[1], text: letterMatch[2] }); return }
      if (romanMatch) { flushPara(); items.push({ type: 'sub', num: romanMatch[1], text: romanMatch[2] }); return }
      // Continuation line — if last item is a bullet, append to its text
      const last = items[items.length - 1]
      if (currentPara.length === 0 && last && (last.type === 'numbered' || last.type === 'lettered' || last.type === 'sub')) {
        last.text += ' ' + trimmed
      } else {
        currentPara.push(trimmed)
      }
    })
    flushPara()
    return items.map((it, i) => {
      if (it.type === 'numbered') return <div key={i} className="flex gap-3 mt-3 first:mt-0"><div className="shrink-0 h-6 w-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">{it.num}</div><div className="flex-1 text-slate-700 leading-relaxed">{it.text}</div></div>
      if (it.type === 'lettered') return <div key={i} className="flex gap-3 mt-1.5 ml-8"><div className="shrink-0 h-5 w-5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px] flex items-center justify-center uppercase mt-0.5">{it.letter}</div><div className="flex-1 text-sm text-slate-700 leading-relaxed">{it.text}</div></div>
      if (it.type === 'sub') return <div key={i} className="flex gap-3 mt-1 ml-14"><div className="shrink-0 h-4 w-4 rounded bg-indigo-50 text-indigo-600 font-semibold text-[9px] flex items-center justify-center mt-0.5">{it.num}</div><div className="flex-1 text-xs text-slate-600 leading-relaxed">{it.text}</div></div>
      return <p key={i} className="text-slate-700 leading-relaxed mt-2 first:mt-0">{it.text}</p>
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-6 py-10 max-w-5xl">
        <div className="text-center mb-10">
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 mb-3">FOR AUTHORS</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Abstract Submission Guidelines</h1>
          <p className="text-slate-600 mt-3 max-w-2xl mx-auto">Read carefully before submitting your abstract. Following these guidelines ensures a smooth peer-review process.</p>
          <div className="flex justify-center gap-2 mt-6">
            <Button onClick={downloadGuidelines} className="bg-blue-600 hover:bg-blue-700"><Download className="h-4 w-4 mr-1" /> Download PDF/TXT</Button>
          </div>
        </div>

        {sections.length === 0 ? (
          <Card><CardContent className="p-6"><Loader2 className="animate-spin inline" /> Loading guidelines...</CardContent></Card>
        ) : (
          <div className="space-y-5">
            {sections.map((s, i) => {
              const c = colors[i % colors.length]
              const icon = icons[i % icons.length]
              return (
                <Card key={i} className="overflow-hidden shadow-lg border-0 ring-1 ring-slate-200 hover:ring-blue-300 transition">
                  <div className={`bg-gradient-to-r ${c.bg} px-6 py-4 text-white flex items-center gap-3`}>
                    <div className="h-10 w-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl">{icon}</div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-white/80">Section {i + 1}</div>
                      <h2 className="text-xl font-bold">{s.title}</h2>
                    </div>
                  </div>
                  <CardContent className="p-6 bg-white">
                    {renderBody(s.body)}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <div className="mt-10 text-center">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-6">
              <div className="text-sm text-slate-700">Have questions? Reach out to the editorial office or start your submission below.</div>
              <Button onClick={downloadGuidelines} className="mt-3 bg-blue-600 hover:bg-blue-700"><Download className="h-4 w-4 mr-1" /> Download guidelines</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PublicVenue({ conf }) {
  if (!conf) return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white flex items-center justify-center">
      <div className="text-slate-500">No conference registered yet.</div>
    </div>
  )
  const mapEmbed = conf.mapUrl || (conf.mapAddress ? `https://www.google.com/maps?q=${encodeURIComponent(conf.mapAddress)}&output=embed` : (conf.venue ? `https://www.google.com/maps?q=${encodeURIComponent([conf.venue, conf.city, conf.country].filter(Boolean).join(', '))}&output=embed` : null))
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white">
      <div className="container mx-auto px-6 py-10 max-w-6xl">
        <div className="text-center mb-10">
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 mb-3">GET READY</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-blue-900">Venue & Dates</h1>
          <p className="text-slate-600 mt-3 max-w-2xl mx-auto">Everything you need to plan your attendance at {conf.name}</p>
        </div>

        {/* Hotel image + info cards */}
        <div className="grid lg:grid-cols-5 gap-6 mb-8">
          {/* Hotel image */}
          <div className="lg:col-span-3">
            <Card className="overflow-hidden shadow-xl border-0 h-full">
              {conf.hotelImagePath ? (
                <div className="relative h-80 lg:h-full min-h-[320px]">
                  <img src={conf.hotelImagePath} alt="Conference venue" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 via-blue-900/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <Badge className="bg-white/25 backdrop-blur-sm border-white/40 text-white mb-2">CONFERENCE VENUE</Badge>
                    <h2 className="text-3xl font-bold drop-shadow-lg">{conf.venue || 'Venue TBA'}</h2>
                    <p className="text-white/90 mt-1">{[conf.city, conf.country].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 h-80 flex flex-col items-center justify-center text-white p-6">
                  <Building2 className="h-16 w-16 mb-3 opacity-90" />
                  <h2 className="text-3xl font-bold">{conf.venue || 'Venue TBA'}</h2>
                  <p className="opacity-90 mt-1">{[conf.city, conf.country].filter(Boolean).join(', ')}</p>
                </div>
              )}
            </Card>
          </div>

          {/* Location map */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden shadow-xl border-0 h-full">
              {mapEmbed ? (
                <iframe src={mapEmbed} className="w-full h-80 lg:h-full min-h-[320px] border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Venue location" />
              ) : (
                <div className="h-80 bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                  <Globe className="h-12 w-12 mb-2" />
                  <div className="text-sm">Map not yet configured</div>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Horizontal subsections */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-600 to-blue-700 text-white">
            <CardContent className="p-5">
              <Calendar className="h-6 w-6 mb-2 opacity-90" />
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Conference dates</div>
              <div className="text-sm font-semibold mt-2">{fmtDate(conf.startDate)}</div>
              <div className="text-xs opacity-90">to {fmtDate(conf.endDate)}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-white ring-1 ring-blue-100">
            <CardContent className="p-5">
              <FileUp className="h-6 w-6 mb-2 text-blue-600" />
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Abstract submission</div>
              <div className="text-sm font-semibold text-slate-800 mt-2">{fmtDate(conf.submissionOpen)}</div>
              <div className="text-xs text-slate-500">to {fmtDate(conf.submissionClose)}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-white ring-1 ring-blue-100">
            <CardContent className="p-5">
              <Users className="h-6 w-6 mb-2 text-blue-600" />
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Registration</div>
              <div className="text-sm font-semibold text-slate-800 mt-2">{fmtDate(conf.registrationOpen)}</div>
              <div className="text-xs text-slate-500">to {fmtDate(conf.registrationClose)}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-600 to-blue-700 text-white">
            <CardContent className="p-5">
              <ShieldCheck className="h-6 w-6 mb-2 opacity-90" />
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Status</div>
              <div className="text-sm font-semibold mt-2">{stateLabel(conf.status)}</div>
              <div className="text-xs opacity-90 mt-1">{conf.doubleBlind ? 'Double-blind review' : 'Open review'}</div>
            </CardContent>
          </Card>
        </div>

        {/* About + Contact — horizontal split */}
        <div className="grid md:grid-cols-3 gap-6">
          {conf.description && (
            <Card className="md:col-span-2 border-0 shadow-md">
              <CardContent className="p-6">
                <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">About</div>
                <h3 className="text-xl font-bold text-blue-900 mb-2">{conf.name}</h3>
                {conf.subtitle && <div className="text-sm text-slate-500 italic mb-3">{conf.subtitle}</div>}
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{conf.description}</p>
              </CardContent>
            </Card>
          )}
          <Card className="border-0 shadow-md bg-blue-50/50">
            <CardContent className="p-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-3">Contact</div>
              {conf.contactEmail && (
                <a href={`mailto:${conf.contactEmail}`} className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 hover:underline mb-2">
                  <Mail className="h-4 w-4 shrink-0" />{conf.contactEmail}
                </a>
              )}
              {conf.contactPhone && (
                <div className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h1.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.21l-2.26 1.13a11 11 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" /></svg>
                  <span>{conf.contactPhone}</span>
                </div>
              )}
              <div className="flex items-start gap-2 text-sm text-slate-700 mt-3 pt-3 border-t border-blue-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <div>
                  <div className="font-medium">{conf.venue || '—'}</div>
                  <div className="text-xs text-slate-500">{[conf.city, conf.country].filter(Boolean).join(', ')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PublicThemes({ conf }) {
  return (
    <div className="container mx-auto px-6 py-10 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Conference sub-themes</h1>
      {conf?.themes?.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          {conf.themes.map(t => (
            <Card key={t.id}>
              <CardHeader><CardTitle className="text-lg">{t.name}</CardTitle></CardHeader>
              {t.description && <CardContent className="text-sm text-muted-foreground">{t.description}</CardContent>}
            </Card>
          ))}
        </div>
      ) : <div className="text-muted-foreground">No sub-themes defined yet.</div>}
    </div>
  )
}

function PublicContact({ conf }) {
  return (
    <div className="container mx-auto px-6 py-10 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Contact</h1>
      <Card>
        <CardContent className="p-6 space-y-2">
          <div>📧 {conf?.contactEmail || 'contact@conference.org'}</div>
          <div>📞 {conf?.contactPhone || 'Not provided'}</div>
          <div>📍 {conf?.venue}{conf?.city && `, ${conf.city}`}{conf?.country && `, ${conf.country}`}</div>
        </CardContent>
      </Card>
    </div>
  )
}

function BarChartIcon(props) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg> }

// ============ AUTH ============
function AuthPage({ mode, onDone, onSwitch, onBack, onForgot, reviewerInvite }) {
  // Split reviewer's fullName into first/last, stripping common title prefixes
  const parseName = (full) => {
    if (!full) return { first: '', last: '', title: '' }
    const parts = full.trim().split(/\s+/)
    const titleRe = /^(dr|prof|mr|mrs|ms|miss|sir|dame|assoc|assist|professor|doctor)\.?$/i
    let title = ''
    while (parts.length > 1 && titleRe.test(parts[0])) title += (title ? ' ' : '') + parts.shift()
    return { first: parts[0] || '', last: parts.slice(1).join(' '), title }
  }
  const parsed = parseName(reviewerInvite?.fullName)
  const [email, setEmail] = useState(mode === 'login' ? 'managing@scms.io' : (reviewerInvite?.email || ''))
  const [password, setPassword] = useState(mode === 'login' ? 'password123' : '')
  const [firstName, setFirstName] = useState(parsed.first)
  const [lastName, setLastName] = useState(parsed.last)
  const [title, setTitle] = useState(parsed.title)
  const [specialty, setSpecialty] = useState(reviewerInvite?.specialty || '')
  const [affiliation, setAffiliation] = useState('')
  const [role, setRole] = useState(reviewerInvite ? 'EXTERNAL_REVIEWER' : 'AUTHOR')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isReviewerInvite = !!reviewerInvite

  const cleanError = (raw) => {
    if (!raw) return 'Something went wrong. Please try again.'
    const msg = String(raw)
    if (msg.length > 160) {
      if (msg.toLowerCase().includes('unique constraint') || msg.toLowerCase().includes('already')) return 'Email is already registered. Please sign in instead.'
      if (msg.toLowerCase().includes('database') || msg.toLowerCase().includes('reach')) return 'Server temporarily unavailable. Please try again in a moment.'
      if (msg.toLowerCase().includes('password')) return 'Invalid password.'
      return 'Registration failed. Please check your details and try again.'
    }
    return msg
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !email.includes('@')) return setError('Please enter a valid email address.')
    if (!password || password.length < 6) return setError('Password must be at least 6 characters.')
    if (mode === 'register') {
      if (!firstName.trim()) return setError('Please enter your first name.')
      if (!lastName.trim()) return setError('Please enter your last name.')
      if (isReviewerInvite && !specialty.trim()) return setError('Please enter your area of specialty.')
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        const d = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
        setToken(d.token)
        toast.success(`Welcome back, ${d.user.firstName}!`)
        onDone(d.user)
      } else {
        const d = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, firstName, lastName, title, role, specialty, affiliation, inviteToken: reviewerInvite?.token }) })
        setToken(d.token)
        toast.success('Account created')
        onDone(d.user)
      }
    } catch (e) {
      setError(cleanError(e.message))
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white font-bold">S</div>
            <span className="font-bold text-xl">SCMS</span>
          </div>
          <CardTitle>{mode === 'login' ? 'Sign in to your account' : (isReviewerInvite ? 'Accept Reviewer Invitation' : 'Create your account')}</CardTitle>
          <CardDescription>{isReviewerInvite ? 'Register as an External Peer Reviewer' : 'Enterprise scientific conference platform'}</CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-3">
            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-300 text-red-800 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1">{error}</div>
                <button type="button" onClick={() => setError('')} className="text-red-500 hover:text-red-700 text-xs shrink-0">✕</button>
              </div>
            )}
            {mode === 'register' && isReviewerInvite && (
              <div className="p-3 rounded-md bg-indigo-50 border border-indigo-200 text-sm text-indigo-900">
                <div className="flex items-center gap-2 font-semibold mb-1"><Award className="h-4 w-4" /> External Reviewer Invitation</div>
                <div className="text-indigo-800/90 text-xs">You have been invited to join the peer-review committee. Once registered, an editor will assign abstracts to you for double-blind review. You will see abstract titles and content only — author identities remain hidden.</div>
              </div>
            )}
            {mode === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>First name</Label><Input value={firstName} onChange={e => { setFirstName(e.target.value); setError('') }} required /></div>
                  <div><Label>Last name</Label><Input value={lastName} onChange={e => { setLastName(e.target.value); setError('') }} required /></div>
                </div>
                {isReviewerInvite ? (
                  <>
                    <div>
                      <Label>Registering as</Label>
                      <div className="flex items-center gap-2 p-2 rounded-md border border-indigo-200 bg-indigo-50/70">
                        <Award className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-medium text-indigo-800">External Reviewer</span>
                        <Badge variant="outline" className="ml-auto text-[10px] border-indigo-300 text-indigo-600">by invitation</Badge>
                      </div>
                    </div>
                    <div>
                      <Label>Area of specialty <span className="text-red-500">*</span></Label>
                      <Input value={specialty} onChange={e => { setSpecialty(e.target.value); setError('') }} placeholder="e.g. Cardiology, Molecular Biology, Public Health" required />
                    </div>
                    <div><Label>Affiliation (institution)</Label><Input value={affiliation} onChange={e => setAffiliation(e.target.value)} placeholder="e.g. Aga Khan University Hospital" /></div>
                  </>
                ) : (
                  <div>
                    <Label>Role</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTHOR">Author (submit abstracts)</SelectItem>
                        <SelectItem value="ATTENDEE">Conference Attendee</SelectItem>
                        <SelectItem value="INDUSTRY_PARTNER">Sponsor / Industry / Pharma</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      <span className="font-medium">Are you a peer reviewer?</span> External reviewers are added by invitation only. If you have received an email invitation, please use the link in that email.
                    </p>
                  </div>
                )}
              </>
            )}
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }} required readOnly={isReviewerInvite} className={isReviewerInvite ? 'bg-slate-50' : ''} /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={e => { setPassword(e.target.value); setError('') }} required /></div>
          </CardContent>
          <CardFooter className="flex-col gap-2 items-stretch">
            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Sign in' : (isReviewerInvite ? 'Accept & create reviewer account' : 'Create account')}
            </Button>
            {mode === 'login' && onForgot && (
              <button type="button" onClick={onForgot} className="text-sm text-indigo-600 hover:underline text-center">Forgot password?</button>
            )}
            <div className="flex justify-between text-sm">
              <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground">← Back</button>
              {!isReviewerInvite && (
                <button type="button" onClick={onSwitch} className="text-indigo-600 hover:underline">
                  {mode === 'login' ? "Don't have an account? Register" : 'Have an account? Sign in'}
                </button>
              )}
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

// ============ APP SHELL ============
function AppShell({ user, setUser, route, setRoute, onLogout }) {
  const [notifs, setNotifs] = useState([])
  const [featured, setFeatured] = useState(null)
  const roles = user.roles.map(r => r.role)
  const isAdmin = roles.includes('SYSTEM_ADMIN')
  const isEditor = roles.some(r => ['MANAGING_EDITOR', 'SECTION_EDITOR', 'COMMITTEE_MEMBER'].includes(r))
  const isReviewer = roles.some(r => ['EXTERNAL_REVIEWER', 'COMMITTEE_MEMBER'].includes(r))

  const refreshNotifs = () => api('/notifications').then(d => setNotifs(d.notifications || [])).catch(() => {})
  useEffect(() => {
    refreshNotifs()
    api('/public/config').then(d => setFeatured(d.conference)).catch(() => {})
    const i = setInterval(refreshNotifs, 30000)
    return () => clearInterval(i)
  }, [])

  const unread = notifs.filter(n => !n.isRead).length
  const confTitle = featured?.name || 'Scientific Conference Platform'
  const confTheme = featured?.theme || featured?.subtitle || featured?.description || 'Advancing Science Through Rigorous Peer Review'

  const nav = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { key: 'my-abstracts', label: 'My Abstracts', icon: FileText, show: true },
    { key: 'submit', label: 'New Submission', icon: Plus, show: true },
    { key: 'editorial', label: 'Editorial Office', icon: ClipboardCheck, show: isEditor || isAdmin },
    { key: 'workspace', label: 'My Editor Workspace', icon: Briefcase, show: isEditor || isAdmin },
    { key: 'live', label: 'Live Conference', icon: Radio, show: true },
    { key: 'announcements', label: 'Editors\' Chat', icon: MessageSquare, show: isEditor || isAdmin },
    { key: 'invite-reviewers', label: 'Invite Reviewers', icon: Send, show: isEditor || isAdmin },
    { key: 'reviews', label: 'My Reviews', icon: Award, show: isReviewer },
    { key: 'conferences', label: 'Conferences', icon: Calendar, show: true },
    { key: 'templates', label: 'Templates', icon: FileText, show: true },
    { key: 'conference-admin', label: 'Conference Admin', icon: Building2, show: isAdmin },
    { key: 'booth-admin', label: 'Exhibition Booths', icon: Building2, show: isAdmin || isEditor },
    { key: 'programme-admin', label: 'Programme Admin', icon: Calendar, show: isAdmin || isEditor },
    { key: 'book-admin', label: 'Conference Book', icon: BookOpen, show: isAdmin || isEditor },
    { key: 'surveys', label: 'Feedback Surveys', icon: ListChecks, show: isAdmin || isEditor },
    { key: 'programme', label: 'Programme', icon: GraduationCap, show: true },
    { key: 'analytics', label: 'Analytics', icon: BarChartIcon, show: isEditor || isAdmin },
    { key: 'users', label: 'User Management', icon: Users, show: isAdmin },
    { key: 'delegates', label: 'Delegates', icon: Users, show: isAdmin || isEditor },
    { key: 'audit', label: 'Audit Log', icon: ShieldCheck, show: isAdmin },
  ]

  return (
    <div className="min-h-screen flex bg-slate-50 relative">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.35] z-0" style={{
        backgroundImage: `radial-gradient(circle at 20% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(219, 39, 119, 0.06) 0%, transparent 45%), radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 60%)`,
      }} />
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill='%234f46e5' fill-opacity='1'%3E%3Ccircle cx='2' cy='2' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
      }} />
      {/* Sidebar */}
      <aside className="w-64 bg-white/95 backdrop-blur-sm border-r flex flex-col relative z-10">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white font-bold">S</div>
            <div>
              <div className="font-bold">SCMS</div>
              <div className="text-[10px] text-muted-foreground -mt-1">Conference platform</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-auto">
          {nav.filter(n => n.show).map(n => {
            const Icon = n.icon
            const active = route.name === n.key
            return (
              <button key={n.key}
                onClick={() => setRoute({ name: n.key })}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition ${active ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                <Icon className="h-4 w-4" /> {n.label}
              </button>
            )
          })}
        </nav>
        <div className="p-3 border-t">
          <div className="text-xs text-muted-foreground mb-2">Signed in as</div>
          <div className="text-sm font-medium">{user.firstName} {user.lastName}</div>
          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {roles.map(r => <Badge key={r} variant="outline" className="text-[10px]">{ROLE_LABELS[r] || r}</Badge>)}
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-3" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col relative z-10">
        <header className="h-16 border-b bg-white/95 backdrop-blur-sm flex items-center justify-between px-6 shadow-sm">
          <div>
            <div className="text-base font-bold tracking-tight">{confTitle}</div>
            <div className="text-xs text-muted-foreground">{route.name === 'abstract' ? 'Abstract detail' : nav.find(n => n.key === route.name)?.label || 'SCMS'}</div>
          </div>
          <NotificationsBell notifs={notifs} onOpen={(n) => { if (n.link?.startsWith('/abstracts/')) setRoute({ name: 'abstract', id: n.link.split('/')[2] }); api(`/notifications/${n.id}/read`, { method: 'POST' }).then(refreshNotifs) }} onReadAll={() => api('/notifications/read-all', { method: 'POST' }).then(refreshNotifs)} unread={unread} />
        </header>
        <div className="flex-1 overflow-auto">
          <ViewRouter route={route} setRoute={setRoute} user={user} setUser={setUser} isAdmin={isAdmin} isEditor={isEditor} isReviewer={isReviewer} featured={featured} />
        </div>
        {/* App footer with conference theme */}
        <footer className="border-t bg-slate-900 text-slate-200 px-6 py-3 text-center text-sm italic">
          "{confTheme}" · {featured?.code || 'SCMS'}
        </footer>
      </main>
    </div>
  )
}

function NotificationsBell({ notifs, onOpen, onReadAll, unread }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="relative">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unread}</span>}
      </Button>
      {open && (
        <div className="absolute right-0 top-11 w-96 bg-white border rounded-lg shadow-xl z-50">
          <div className="p-3 border-b flex justify-between items-center">
            <div className="font-semibold text-sm">Notifications</div>
            {unread > 0 && <Button variant="ghost" size="sm" onClick={onReadAll}>Mark all read</Button>}
          </div>
          <ScrollArea className="max-h-96">
            {notifs.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
              : notifs.map(n => (
                <button key={n.id} onClick={() => { onOpen(n); setOpen(false) }}
                  className={`w-full text-left p-3 border-b hover:bg-slate-50 ${!n.isRead ? 'bg-indigo-50/40' : ''}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-medium text-sm">{n.title}</div>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                </button>
              ))}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

// ============ VIEW ROUTER ============
function ViewRouter({ route, setRoute, user, isAdmin, isEditor, isReviewer }) {
  if (route.name === 'dashboard') return <Dashboard setRoute={setRoute} isAdmin={isAdmin} isEditor={isEditor} />
  if (route.name === 'my-abstracts') return <MyAbstracts setRoute={setRoute} />
  if (route.name === 'submit') return <SubmitAbstract setRoute={setRoute} user={user} />
  if (route.name === 'editorial') return <EditorialOffice setRoute={setRoute} />
  if (route.name === 'workspace') return <EditorWorkspace setRoute={setRoute} user={user} />
  if (route.name === 'live') return <LiveConferencePage user={user} />
  if (route.name === 'reviews') return <ReviewerWorkspace setRoute={setRoute} />
  if (route.name === 'conferences') return <Conferences />
  if (route.name === 'conference-admin') return <ConferenceAdmin />
  if (route.name === 'booth-admin') return <BoothAdmin />
  if (route.name === 'programme-admin') return <ProgrammeAdmin />
  if (route.name === 'book-admin') return <ConferenceBookAdmin />
  if (route.name === 'surveys') return <SurveyAdmin />
  if (route.name === 'programme') return <Programme />
  if (route.name === 'templates') return <TemplatesPage user={user} isAdmin={isAdmin} isEditor={isEditor} />
  if (route.name === 'announcements') return <AnnouncementsBoard user={user} />
  if (route.name === 'invite-reviewers') return <InviteReviewers />
  if (route.name === 'analytics') return <Analytics />
  if (route.name === 'users') return <UserManagement />
  if (route.name === 'delegates') return <DelegatesPage />
  if (route.name === 'audit') return <AuditView />
  if (route.name === 'abstract') return <AbstractDetail id={route.id} user={user} isEditor={isEditor} isAdmin={isAdmin} setRoute={setRoute} />
  return <div className="p-6">Not found</div>
}

// ============ DASHBOARD ============
function Dashboard({ setRoute, isAdmin, isEditor }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  useEffect(() => {
    if (isAdmin || isEditor) api('/analytics/dashboard').then(d => setStats(d)).catch(() => {})
    api('/abstracts?scope=mine').then(d => setRecent((d.abstracts || []).slice(0, 5))).catch(() => {})
  }, [])
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">Overview of your conference platform activity</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total users" value={stats.totalUsers} color="text-indigo-600" />
          <StatCard icon={FileText} label="Total abstracts" value={stats.totalAbstracts} color="text-fuchsia-600" />
          <StatCard icon={ClipboardCheck} label="Reviews completed" value={`${stats.reviews.completed}/${stats.reviews.total}`} color="text-emerald-600" />
          <StatCard icon={Calendar} label="Registrations" value={stats.totalRegs} color="text-amber-600" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex-row justify-between items-center">
            <CardTitle>My recent submissions</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setRoute({ name: 'my-abstracts' })}>View all →</Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <div className="text-sm text-muted-foreground mb-3">No submissions yet</div>
                <Button size="sm" onClick={() => setRoute({ name: 'submit' })}>Create submission</Button>
              </div>
            ) : recent.map(a => (
              <button key={a.id} onClick={() => setRoute({ name: 'abstract', id: a.id })}
                className="w-full text-left p-3 rounded-md hover:bg-slate-50 border mb-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-xs font-mono text-muted-foreground">{a.submissionCode}</div>
                    <div className="font-medium text-sm">{a.title}</div>
                  </div>
                  <Badge className={`text-[10px] border ${STATE_COLORS[a.currentState]}`}>{stateLabel(a.currentState)}</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {stats && (
          <Card>
            <CardHeader><CardTitle>Abstracts by state</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.abstractsByState.map(s => ({ name: stateLabel(s.state), count: s.count }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-3xl font-bold mt-1">{value}</div>
          </div>
          <Icon className={`h-8 w-8 ${color} opacity-50`} />
        </div>
      </CardContent>
    </Card>
  )
}

// ============ MY ABSTRACTS ============
function MyAbstracts({ setRoute }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api('/abstracts?scope=mine').then(d => { setList(d.abstracts || []); setLoading(false) }) }, [])
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My submissions</h1>
          <p className="text-muted-foreground">Track every abstract you have submitted</p>
        </div>
        <Button onClick={() => setRoute({ name: 'submit' })} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="h-4 w-4 mr-1" /> New submission</Button>
      </div>
      {loading ? <Loader2 className="animate-spin" /> :
        list.length === 0 ? <EmptyState label="No submissions yet" onAction={() => setRoute({ name: 'submit' })} actionLabel="Create your first submission" />
        : (
          <div className="grid gap-3">
            {list.map(a => <AbstractCard key={a.id} a={a} onOpen={() => setRoute({ name: 'abstract', id: a.id })} />)}
          </div>
        )}
    </div>
  )
}

function AbstractCard({ a, onOpen }) {
  return (
    <button onClick={onOpen} className="w-full text-left">
      <Card className="hover:shadow-md transition">
        <CardContent className="p-5">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">{a.submissionCode}</span>
                {a.theme && <Badge variant="outline" className="text-[10px]">{a.theme.name}</Badge>}
                <Badge className={`text-[10px] border ${STATE_COLORS[a.currentState]}`}>{stateLabel(a.currentState)}</Badge>
              </div>
              <div className="font-semibold text-base">{a.title}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {a.authors?.map(au => au.fullName).join(', ')} · {a.conference?.code} · v{a.versions?.[0]?.versionNumber || 1}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

function EmptyState({ label, onAction, actionLabel }) {
  return (
    <div className="text-center py-16">
      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
      <div className="text-muted-foreground mb-4">{label}</div>
      {onAction && <Button onClick={onAction} className="bg-indigo-600 hover:bg-indigo-700">{actionLabel}</Button>}
    </div>
  )
}

// ============ SUBMIT ABSTRACT (enhanced per guidelines) ============
function SubmitAbstract({ setRoute, user }) {
  const [conferences, setConferences] = useState([])
  const [conferenceId, setConferenceId] = useState('')
  const [themeId, setThemeId] = useState('')
  const [reportType, setReportType] = useState('ORIGINAL_RESEARCH')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [keywords, setKeywords] = useState('')
  const [disclosureStatement, setDisclosureStatement] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [authors, setAuthors] = useState([
    { fullName: `${user.firstName} ${user.lastName}`, email: user.email, phone: '', department: '', affiliation: user.affiliation || '', isCorresponding: true, orderIndex: 0 },
  ])
  const [loading, setLoading] = useState(false)
  const [docFile, setDocFile] = useState(null)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => { api('/conferences').then(d => {
    setConferences(d.conferences || [])
    if (d.conferences?.[0]) setConferenceId(d.conferences[0].id)
  }) }, [])

  const themes = conferences.find(c => c.id === conferenceId)?.themes || []
  const titleWordCount = countWords(title)
  const bodyWordCount = countWords(body)
  const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean)

  const titleValid = titleWordCount <= TITLE_WORD_LIMIT
  const bodyValid = bodyWordCount <= WORD_LIMIT

  const addAuthor = () => setAuthors([...authors, { fullName: '', email: '', phone: '', department: '', affiliation: '', isCorresponding: false, orderIndex: authors.length }])
  const updateAuthor = (i, patch) => setAuthors(authors.map((a, idx) => idx === i ? { ...a, ...patch } : a))
  const removeAuthor = (i) => setAuthors(authors.filter((_, idx) => idx !== i))
  const setCorresponding = (i) => setAuthors(authors.map((a, idx) => ({ ...a, isCorresponding: idx === i })))

  const validateDocFile = (file) => {
    if (!file) return null
    const ext = ('.' + (file.name.split('.').pop() || '').toLowerCase())
    if (!ALLOWED_DOC_EXTS.includes(ext)) return `Only ${ALLOWED_DOC_EXTS.join(', ')} files are accepted (got ${ext})`
    if (file.size > MAX_DOC_SIZE_BYTES) return `File too large: ${(file.size / 1024 / 1024).toFixed(2)} MB exceeds 2 MB limit`
    return null
  }

  const onDocChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const err = validateDocFile(f)
    if (err) { toast.error(err); e.target.value = ''; setDocFile(null); return }
    setDocFile(f)
    toast.success(`Selected: ${f.name} (${(f.size / 1024).toFixed(1)} KB)`)
  }

  const submit = async (asDraft) => {
    setSubmitError('')
    // Comprehensive validation - collect ALL issues at once
    const issues = []
    if (!conferenceId) issues.push('Choose a conference.')
    if (!title.trim()) issues.push('Enter a title.')
    else if (titleWordCount > TITLE_WORD_LIMIT) issues.push(`Title exceeds ${TITLE_WORD_LIMIT} words (currently ${titleWordCount}).`)
    if (!body && !docFile) issues.push('Enter abstract body or upload a Word document.')
    if (body && bodyWordCount > WORD_LIMIT) issues.push(`Abstract body exceeds ${WORD_LIMIT} words (currently ${bodyWordCount}). Remove ${bodyWordCount - WORD_LIMIT} word(s).`)
    if (!authors.some(a => a.isCorresponding)) issues.push('Mark one author as the corresponding author (radio button).')
    authors.forEach((a, i) => {
      if (!a.fullName?.trim()) issues.push(`Author #${i + 1}: full name is required.`)
      if (!a.email?.trim()) issues.push(`Author #${i + 1}: email is required.`)
      else if (!a.email.includes('@')) issues.push(`Author #${i + 1}: email is not valid.`)
      if (a.isCorresponding && !a.phone?.trim()) issues.push(`Author #${i + 1} (corresponding): phone number is required.`)
      if (a.isCorresponding && !a.affiliation?.trim()) issues.push(`Author #${i + 1} (corresponding): affiliated institution is required.`)
    })
    if (keywordList.length > 5) issues.push(`Too many keywords (${keywordList.length}). Maximum is 5.`)
    if (docFile) {
      const err = validateDocFile(docFile)
      if (err) issues.push(err)
    }
    if (issues.length > 0) {
      setSubmitError(issues.length === 1 ? issues[0] : `Please correct the following:\n• ${issues.join('\n• ')}`)
      // Scroll to error
      setTimeout(() => document.querySelector('[role="alert"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
      return
    }

    setLoading(true)
    try {
      const d = await api('/abstracts', {
        method: 'POST',
        body: JSON.stringify({
          conferenceId, themeId: themeId || null, title,
          reportType, body, keywords: keywordList, coverLetter,
          disclosureStatement, authors,
        }),
      })
      // Upload the doc file if provided
      if (docFile) {
        const fd = new FormData()
        fd.append('file', docFile)
        fd.append('category', 'ABSTRACT')
        await apiUpload(`/abstracts/${d.abstract.id}/documents`, fd)
      }
      if (!asDraft) {
        await api(`/abstracts/${d.abstract.id}/submit`, { method: 'POST' })
        toast.success(`Submitted as ${d.abstract.submissionCode}`)
      } else {
        toast.success(`Draft saved as ${d.abstract.submissionCode}`)
      }
      setRoute({ name: 'abstract', id: d.abstract.id })
    } catch (e) {
      const raw = String(e.message || '')
      let clean = raw
      if (raw.includes('exceeds')) clean = raw  // keep word-count errors
      else if (raw.toLowerCase().includes('database') || raw.toLowerCase().includes('reach')) clean = 'Server is temporarily unavailable. Please try again in a moment.'
      else if (raw.toLowerCase().includes('schema mismatch')) clean = 'Server needs an update. Please contact the administrator. (Details: ' + raw + ')'
      else if (raw.toLowerCase().includes('conferenceid') || raw.toLowerCase().includes('required')) clean = raw
      else if (raw.length > 200) clean = 'Submission failed on the server. Original error: ' + raw.slice(0, 200) + '…'
      else if (!raw.trim()) clean = 'Unknown server error. Please contact support.'
      setSubmitError(clean)
      setTimeout(() => document.querySelector('[role="alert"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    } finally { setLoading(false) }
  }

  const SECTION_HINTS_ORIG = [
    ['Background', 'Crucial background to enable readers to understand your research from the onset.'],
    ['Objective', 'Aligned with the research problem/gap; must be SMART.'],
    ['Methods', 'Study design, population, sampling, data collection, analysis.'],
    ['Results', 'Summary of major findings with p-values where appropriate.'],
    ['Conclusion', 'Brief interpretation; key take-home message.'],
    ['Recommendation', 'Broader implications, future research.'],
  ]
  const SECTION_HINTS_CASE = [
    ['Background', 'Concise rationale — what is known/unknown, what makes it notable.'],
    ['Objective', 'Aim of the case report/series.'],
    ['Case Presentation', 'Logical/chronological description. Summarise each case.'],
    ['Case Discussion', 'Interpretation, comparison with literature, novelty.'],
    ['Conclusion', 'Main clinical message/takeaway.'],
    ['Recommendation', 'Practical suggestions — research, clinical practice, policy.'],
  ]
  const sectionHints = reportType === 'CASE_REPORT' || reportType === 'CASE_SERIES' ? SECTION_HINTS_CASE : SECTION_HINTS_ORIG

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New abstract submission</h1>
          <p className="text-muted-foreground">Submit an abstract for peer review</p>
        </div>
        <Button variant="outline" onClick={downloadGuidelines}><Download className="h-4 w-4 mr-1" /> Guidelines</Button>
      </div>

      {/* Recommendations alert */}
      <Card className="mb-4 border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex gap-2 items-start">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-amber-900 mb-1">Please read before submitting</div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                <li>Title: max <b>{TITLE_WORD_LIMIT} words</b> (capitalize each word), Times New Roman size 12.</li>
                <li>Abstract body: max <b>{WORD_LIMIT} words</b>, no citations.</li>
                <li>Uploaded Word document: <b>.doc / .docx only</b>, max <b>2 MB</b>. Must NOT include author names (double-blind).</li>
                <li>Provide 5 keywords, disclosure statement (or "no conflict of interest to declare"), and one corresponding author (*).</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-5">
          {/* Conference + sub-theme + report type */}
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Conference *</Label>
              <Select value={conferenceId} onValueChange={setConferenceId}>
                <SelectTrigger><SelectValue placeholder="Choose conference" /></SelectTrigger>
                <SelectContent>{conferences.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sub-theme *</Label>
              <Select value={themeId} onValueChange={setThemeId}>
                <SelectTrigger><SelectValue placeholder="Choose sub-theme" /></SelectTrigger>
                <SelectContent>{themes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Report type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORIGINAL_RESEARCH">Original research</SelectItem>
                  <SelectItem value="CASE_REPORT">Case report</SelectItem>
                  <SelectItem value="CASE_SERIES">Case series</SelectItem>
                  <SelectItem value="REVIEW">Review</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="flex justify-between items-center">
              <Label>Title * (max {TITLE_WORD_LIMIT} words, Capitalize Each Word)</Label>
              <span className={`text-xs ${titleValid ? 'text-muted-foreground' : 'text-red-600 font-semibold'}`}>{titleWordCount}/{TITLE_WORD_LIMIT} words</span>
            </div>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Concise Statement Of The Main Topic" className={!titleValid ? 'border-red-400' : ''} />
          </div>

          {/* Authors */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Author(s) * — mark one corresponding author with *</Label>
              <Button size="sm" variant="outline" onClick={addAuthor}><Plus className="h-4 w-4 mr-1" /> Add author</Button>
            </div>
            <div className="space-y-2">
              {authors.map((a, i) => (
                <div key={i} className="border rounded-md p-3 bg-slate-50/50">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 bg-slate-200 rounded">#{i + 1}{i === 0 ? ' (principal)' : ''}</span>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="radio" name="corr" checked={a.isCorresponding} onChange={() => setCorresponding(i)} />
                        Corresponding *
                      </label>
                    </div>
                    {authors.length > 1 && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeAuthor(i)}>Remove</Button>}
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <Input placeholder="Full name (e.g. Dr. Jane Doe)" value={a.fullName} onChange={e => updateAuthor(i, { fullName: e.target.value })} />
                    <Input placeholder="Email *" type="email" value={a.email} onChange={e => updateAuthor(i, { email: e.target.value })} />
                    <Input placeholder={a.isCorresponding ? 'Phone (required for corresponding)' : 'Phone (optional)'} value={a.phone} onChange={e => updateAuthor(i, { phone: e.target.value })} />
                    <Input placeholder="Department (e.g. Cardiology)" value={a.department} onChange={e => updateAuthor(i, { department: e.target.value })} />
                    <Input className="md:col-span-2" placeholder="Affiliated institution (Hospital / University)" value={a.affiliation} onChange={e => updateAuthor(i, { affiliation: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Abstract body input + doc upload */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Abstract body — max {WORD_LIMIT} words, no citations</Label>
              <span className={`text-xs ${bodyValid ? 'text-muted-foreground' : 'text-red-600 font-semibold'}`}>{bodyWordCount}/{WORD_LIMIT} words</span>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Textarea rows={12} value={body} onChange={e => setBody(e.target.value)}
                  className={!bodyValid ? 'border-red-400' : ''}
                  placeholder={`Structure your abstract with:\n\n${sectionHints.map(([h, hint]) => `${h}: ${hint}`).join('\n\n')}`} />
              </div>
              <div className="border rounded-md p-3 bg-indigo-50/50 border-indigo-200">
                <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><FileUp className="h-4 w-4 text-indigo-600" /> Or upload Word document</div>
                <div className="text-xs text-muted-foreground mb-2">
                  <b>.doc / .docx</b> only<br />
                  Max size: <b>2 MB</b><br />
                  Must NOT contain author names (double-blind).
                </div>
                <input type="file" accept=".doc,.docx" onChange={onDocChange} className="text-xs w-full" />
                {docFile && (
                  <div className="mt-2 p-2 bg-white rounded border text-xs">
                    <div className="font-medium">{docFile.name}</div>
                    <div className="text-muted-foreground">{(docFile.size / 1024).toFixed(1)} KB</div>
                    <button className="text-red-600 mt-1" onClick={() => setDocFile(null)}>Remove</button>
                  </div>
                )}
              </div>
            </div>
            {/* Section hints */}
            <div className="mt-2 flex flex-wrap gap-1">
              {sectionHints.map(([h]) => <Badge key={h} variant="outline" className="text-[10px]">{h}</Badge>)}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <Label>Key words (5, comma separated)</Label>
            <Input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. diabetes, prevalence, primary care, adherence, kenya" />
            <div className="text-xs text-muted-foreground mt-1">{keywordList.length}/5 keywords</div>
          </div>

          {/* Disclosure */}
          <div>
            <Label>Disclosure statement (funding sources / conflicts of interest)</Label>
            <Textarea rows={3} value={disclosureStatement} onChange={e => setDisclosureStatement(e.target.value)}
              placeholder='If none, state: "No conflict of interest to declare."' />
          </div>

          <div>
            <Label>Cover letter (optional)</Label>
            <Textarea rows={3} value={coverLetter} onChange={e => setCoverLetter(e.target.value)} placeholder="Optional message to the editors" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => submit(true)} disabled={loading}>Save as draft</Button>
            <Button onClick={() => submit(false)} disabled={loading || !titleValid || !bodyValid} className="bg-indigo-600 hover:bg-indigo-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit for review
            </Button>
          </div>
          {submitError && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-300 text-red-800 text-sm whitespace-pre-line">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1"><b>Cannot submit: </b>{submitError}</div>
              <button type="button" onClick={() => setSubmitError('')} className="text-red-500 hover:text-red-700 text-xs shrink-0">✕</button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============ ABSTRACT DETAIL ============
function AbstractDetail({ id, user, isEditor, isAdmin, setRoute }) {
  const [abs, setAbs] = useState(null)
  const [tab, setTab] = useState('overview')
  const refresh = () => api(`/abstracts/${id}`).then(d => setAbs(d.abstract)).catch(e => toast.error(e.message))
  useEffect(() => { refresh() }, [id])
  if (!abs) return <div className="p-6"><Loader2 className="animate-spin" /></div>

  const isOwner = abs.submittedById === user.id
  const currentStateIndex = TIMELINE_STAGES.findIndex(s => s.key === abs.currentState || s.altKeys?.includes(abs.currentState))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button className="text-sm text-muted-foreground hover:text-foreground mb-3" onClick={() => setRoute({ name: 'my-abstracts' })}>← Back</button>
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-muted-foreground">{abs.submissionCode}</span>
            {abs.theme && <Badge variant="outline">{abs.theme.name}</Badge>}
            <Badge className={`border ${STATE_COLORS[abs.currentState]}`}>{stateLabel(abs.currentState)}</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{abs.title}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            {abs.conference?.name} · v{abs.versions?.[0]?.versionNumber || 1}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="text-sm font-semibold mb-4">Submission timeline</div>
          <div className="flex flex-wrap gap-1">
            {TIMELINE_STAGES.map((s, i) => {
              const passed = abs.stateHistory?.some(h => h.newState === s.key || s.altKeys?.includes(h.newState))
              const current = abs.currentState === s.key || s.altKeys?.includes(abs.currentState)
              return (
                <div key={s.key} className="flex items-center">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${current ? 'bg-indigo-600 text-white' : passed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    {passed && !current && <CheckCircle2 className="h-3 w-3" />}
                    {current && <Clock className="h-3 w-3" />}
                    {s.label}
                  </div>
                  {i < TIMELINE_STAGES.length - 1 && <div className="h-px w-3 bg-slate-300" />}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Abstract</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Body</div>
                <p className="text-sm whitespace-pre-wrap">{abs.versions?.[0]?.body}</p>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Keywords</div>
                <div className="flex flex-wrap gap-1">{abs.versions?.[0]?.keywords?.map(k => <Badge key={k} variant="secondary">{k}</Badge>)}</div>
              </div>
              {abs.authors?.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Authors</div>
                  <div className="text-sm">{abs.authors.map(a => `${a.fullName}${a.isCorresponding ? '*' : ''} (${a.affiliation || 'n/a'})`).join('; ')}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {(isEditor || isAdmin) && <TechnicalScoringPanel abstractId={id} user={user} />}
          {(isEditor || isAdmin) && <EditorialPanel abs={abs} onRefresh={refresh} />}
          {isOwner && ['MAJOR_REVISION', 'MINOR_REVISION', 'RETURNED_FOR_FORMATTING'].includes(abs.currentState) && (
            <RevisionUpload abs={abs} onDone={refresh} />
          )}
          {abs.decisions?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Editorial decisions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {abs.decisions.map(d => (
                  <div key={d.id} className="border rounded-md p-3">
                    <div className="flex justify-between items-center mb-1">
                      <Badge className={`border ${d.decision === 'ACCEPT' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : d.decision === 'REJECT' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}>
                        {d.decision.replace('_', ' ')}
                      </Badge>
                      <div className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{d.decisionLetter}</p>
                    <div className="text-xs text-muted-foreground mt-1">— {d.decidedBy?.firstName} {d.decidedBy?.lastName}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="versions">
          <Card>
            <CardHeader><CardTitle>Version history</CardTitle><CardDescription>Every revision is preserved</CardDescription></CardHeader>
            <CardContent>
              {abs.versions?.map(v => (
                <div key={v.id} className="border rounded-md p-4 mb-2">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold">Version {v.versionNumber}</div>
                    <div className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="text-sm font-medium">{v.title}</div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{v.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab abstractId={id} documents={abs.documents} onRefresh={refresh} />
        </TabsContent>

        <TabsContent value="reviews">
          <ReviewsTab abs={abs} isEditor={isEditor} isAdmin={isAdmin} onRefresh={refresh} />
        </TabsContent>

        <TabsContent value="messages">
          <MessagesTab abstractId={id} user={user} />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>Complete workflow history</CardTitle><CardDescription>Immutable audit trail</CardDescription></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {abs.stateHistory?.map(h => (
                  <div key={h.id} className="flex items-start gap-3 border-l-2 border-indigo-200 pl-4 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {h.previousState && <><Badge variant="outline" className="text-[10px]">{stateLabel(h.previousState)}</Badge> →</>}
                        <Badge className={`text-[10px] border ${STATE_COLORS[h.newState]}`}>{stateLabel(h.newState)}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(h.createdAt).toLocaleString()}
                        {h.actor && ` · ${h.actor.firstName} ${h.actor.lastName}`}
                      </div>
                      {h.comment && <div className="text-sm mt-1">{h.comment}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============ EDITORIAL PANEL (editors/admins) ============
function EditorialPanel({ abs, onRefresh }) {
  const [reviewers, setReviewers] = useState([])
  const [editors, setEditors] = useState([])
  useEffect(() => {
    api('/users?role=EXTERNAL_REVIEWER').then(d => setReviewers(prev => [...(d.users || [])]))
    api('/users?role=COMMITTEE_MEMBER').then(d => setReviewers(prev => [...prev, ...(d.users || [])]))
    api('/users?role=SECTION_EDITOR').then(d => setEditors(d.users || []))
  }, [])

  const [transitionTarget, setTransitionTarget] = useState('')
  const [transitionComment, setTransitionComment] = useState('')

  const doTransition = async () => {
    if (!transitionTarget) return
    await api(`/abstracts/${abs.id}/transition`, { method: 'POST', body: JSON.stringify({ newState: transitionTarget, comment: transitionComment }) })
    toast.success('State updated')
    setTransitionTarget(''); setTransitionComment(''); onRefresh()
  }

  const [decision, setDecision] = useState('')
  const [decisionLetter, setDecisionLetter] = useState('')
  const [presType, setPresType] = useState('')

  const doDecision = async () => {
    if (!decision) return
    await api(`/abstracts/${abs.id}/decision`, { method: 'POST', body: JSON.stringify({ decision, decisionLetter, presentationType: presType || null }) })
    toast.success('Decision recorded')
    setDecision(''); setDecisionLetter(''); onRefresh()
  }

  const assignEditor = async (editorId) => {
    await api(`/abstracts/${abs.id}/assign-editor`, { method: 'POST', body: JSON.stringify({ editorId, role: 'SECTION_EDITOR' }) })
    toast.success('Editor assigned'); onRefresh()
  }
  const assignReviewer = async (reviewerId, reviewType) => {
    await api(`/abstracts/${abs.id}/assign-reviewer`, { method: 'POST', body: JSON.stringify({ reviewerId, reviewType }) })
    toast.success('Reviewer invited'); onRefresh()
  }

  const STATES = ['TECHNICAL_CHECK', 'RETURNED_FOR_FORMATTING', 'EDITORIAL_ASSIGNMENT', 'COMMITTEE_REVIEW', 'EXTERNAL_PEER_REVIEW', 'REVIEWS_COMPLETED', 'EDITORIAL_DECISION', 'MAJOR_REVISION', 'MINOR_REVISION', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'ORAL', 'POSTER', 'PROGRAMME_SCHEDULING', 'PUBLISHED', 'ARCHIVED']

  return (
    <Card className="border-indigo-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-indigo-600" /> Editorial actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm font-semibold mb-2">Assign editor</div>
          <div className="flex flex-wrap gap-2">
            {editors.map(e => (
              <Button key={e.id} variant="outline" size="sm" onClick={() => assignEditor(e.id)}>
                {e.firstName} {e.lastName}
              </Button>
            ))}
            {editors.length === 0 && <span className="text-xs text-muted-foreground">No section editors</span>}
          </div>
          {abs.editorAssignments?.length > 0 && (
            <div className="text-xs text-muted-foreground mt-2">Assigned: {abs.editorAssignments.map(e => `${e.editor.firstName} ${e.editor.lastName}`).join(', ')}</div>
          )}
        </div>

        <Separator />

        <div>
          <div className="text-sm font-semibold mb-2">Invite reviewer</div>
          <div className="space-y-1 max-h-40 overflow-auto">
            {reviewers.map(r => (
              <div key={r.id} className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-slate-50">
                <div className="text-sm">
                  <span className="font-medium">{r.firstName} {r.lastName}</span>
                  <span className="text-xs text-muted-foreground ml-2">{r.institution?.name || r.affiliation}</span>
                  {r.specialties?.length > 0 && <span className="text-xs text-muted-foreground ml-2">· {r.specialties.slice(0, 2).join(', ')}</span>}
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => assignReviewer(r.id, 'EXTERNAL_REVIEWER')}>External</Button>
                  <Button variant="outline" size="sm" onClick={() => assignReviewer(r.id, 'COMMITTEE_MEMBER')}>Committee</Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <div className="text-sm font-semibold mb-2">Transition state</div>
          <div className="flex gap-2">
            <Select value={transitionTarget} onValueChange={setTransitionTarget}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Choose new state" /></SelectTrigger>
              <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{stateLabel(s)}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Comment (optional)" value={transitionComment} onChange={e => setTransitionComment(e.target.value)} />
            <Button onClick={doTransition} disabled={!transitionTarget}>Apply</Button>
          </div>
        </div>

        <Separator />

        <div>
          <div className="text-sm font-semibold mb-2">Record editorial decision</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger><SelectValue placeholder="Decision" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACCEPT">Accept</SelectItem>
                <SelectItem value="MINOR_REVISION">Minor revision</SelectItem>
                <SelectItem value="MAJOR_REVISION">Major revision</SelectItem>
                <SelectItem value="REJECT">Reject</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
                <SelectItem value="WITHDRAW">Withdraw</SelectItem>
              </SelectContent>
            </Select>
            {decision === 'ACCEPT' && (
              <Select value={presType} onValueChange={setPresType}>
                <SelectTrigger><SelectValue placeholder="Presentation type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORAL">Oral</SelectItem>
                  <SelectItem value="POSTER">Poster</SelectItem>
                  <SelectItem value="KEYNOTE">Keynote</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <Textarea placeholder="Decision letter to author" value={decisionLetter} onChange={e => setDecisionLetter(e.target.value)} rows={4} />
          <Button className="mt-2" onClick={doDecision} disabled={!decision}>Send decision</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ REVISION UPLOAD ============
function RevisionUpload({ abs, onDone }) {
  const [title, setTitle] = useState(abs.title)
  const [body, setBody] = useState('')
  const submit = async () => {
    if (!body) return toast.error('Enter the revised text')
    await api(`/abstracts/${abs.id}/versions`, { method: 'POST', body: JSON.stringify({ title, body }) })
    toast.success('Revision submitted'); setBody(''); onDone()
  }
  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-600" /> Revision requested</CardTitle><CardDescription>Upload a new version of your abstract</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Revised title" />
        <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Revised abstract body" />
        <Button onClick={submit}>Submit revision</Button>
      </CardContent>
    </Card>
  )
}

// ============ DOCUMENTS TAB ============
function DocumentsTab({ abstractId, documents, onRefresh }) {
  const [uploading, setUploading] = useState(false)
  const [category, setCategory] = useState('SUPPLEMENTARY')
  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('category', category)
      await apiUpload(`/abstracts/${abstractId}/documents`, fd)
      toast.success('Uploaded'); onRefresh()
    } catch (e) { toast.error(e.message) } finally { setUploading(false); e.target.value = '' }
  }
  return (
    <Card>
      <CardHeader className="flex-row justify-between items-center">
        <div>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Abstract, ethics, revisions, presentations & more</CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['ABSTRACT','COVER_LETTER','ETHICS_APPROVAL','SUPPLEMENTARY','REVIEWER_ANNOTATION','REVISION','ACCEPTANCE_LETTER','ORAL_PRESENTATION','POSTER','BIOGRAPHY','PHOTOGRAPH','OTHER']
                .map(c => <SelectItem key={c} value={c}>{c.replace(/_/g,' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <label>
            <input type="file" className="hidden" onChange={upload} />
            <Button asChild disabled={uploading}>
              <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4 mr-1" />} Upload</span>
            </Button>
          </label>
        </div>
      </CardHeader>
      <CardContent>
        {documents?.length === 0 ? <div className="text-sm text-muted-foreground text-center py-6">No documents uploaded</div>
        : documents?.map(d => (
          <div key={d.id} className="flex justify-between items-center py-2 border-b last:border-0">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{d.fileName}</span>
                <Badge variant="outline" className="text-[10px]">{d.category.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {(d.sizeBytes / 1024).toFixed(1)} KB · Uploaded by {d.uploadedBy?.firstName} {d.uploadedBy?.lastName} · {new Date(d.createdAt).toLocaleDateString()}
              </div>
            </div>
            <a href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ============ REVIEWS TAB ============
function ReviewsTab({ abs, isEditor, isAdmin }) {
  const assignments = abs.reviewAssignments || []
  return (
    <Card>
      <CardHeader><CardTitle>Peer reviews</CardTitle><CardDescription>Reviews submitted by assigned reviewers</CardDescription></CardHeader>
      <CardContent>
        {assignments.length === 0 ? <div className="text-sm text-muted-foreground py-4">No reviewers assigned yet</div>
        : assignments.map(a => (
          <div key={a.id} className="border rounded-md p-4 mb-3">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-medium">{a.reviewer.firstName} {a.reviewer.lastName}</div>
                <div className="text-xs text-muted-foreground">{a.reviewType.replace('_',' ')} · Invited {new Date(a.assignedAt).toLocaleDateString()}</div>
              </div>
              <Badge variant="outline">{a.invitationStatus}{a.report ? ' · Completed' : ''}</Badge>
            </div>
            {a.report ? (
              <div className="mt-2 space-y-2 text-sm">
                <div className="grid grid-cols-5 gap-2 text-center">
                  {['originalityScore','significanceScore','methodologyScore','clarityScore','overallScore'].map(k => (
                    <div key={k} className="p-2 rounded bg-slate-50">
                      <div className="text-[10px] text-muted-foreground">{k.replace('Score','').replace(/^./, c => c.toUpperCase())}</div>
                      <div className="font-bold">{a.report[k] ?? '—'}/10</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-semibold mb-1">Recommendation:</div>
                  <Badge>{a.report.recommendation.replace('_', ' ')}</Badge>
                </div>
                <div>
                  <div className="text-xs font-semibold mb-1">Comments to author:</div>
                  <p className="text-sm whitespace-pre-wrap">{a.report.commentsToAuthor}</p>
                </div>
                {(isEditor || isAdmin) && a.report.commentsToEditor && (
                  <div>
                    <div className="text-xs font-semibold mb-1 text-indigo-600">Confidential comments to editor:</div>
                    <p className="text-sm whitespace-pre-wrap bg-indigo-50 p-2 rounded">{a.report.commentsToEditor}</p>
                  </div>
                )}
              </div>
            ) : <div className="text-xs text-muted-foreground">Review not yet submitted.</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ============ MESSAGES TAB ============
function MessagesTab({ abstractId, user }) {
  const [messages, setMessages] = useState([])
  const [users, setUsers] = useState([])
  const [documents, setDocuments] = useState([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [recipient, setRecipient] = useState('')
  const [channel, setChannel] = useState('EDITOR_AUTHOR')
  const [openingKey, setOpeningKey] = useState('')
  const [closingKey, setClosingKey] = useState('')
  const [selectedDocs, setSelectedDocs] = useState([])
  const [sending, setSending] = useState(false)

  const refresh = () => {
    api(`/abstracts/${abstractId}/messages`).then(d => setMessages(d.messages || []))
    api(`/abstracts/${abstractId}`).then(d => setDocuments(d.abstract?.documents || []))
  }
  useEffect(() => { refresh(); api('/users').then(d => setUsers(d.users || [])) }, [])

  const recipientUser = users.find(u => u.id === recipient)
  const conferenceName = messages[0]?.abstract?.conference?.name || 'the Conference'

  const buildFullBody = () => {
    const opening = GRATITUDE_OPENINGS.find(o => o.label === openingKey)?.value || ''
    const closing = GRATITUDE_CLOSINGS.find(c => c.label === closingKey)?.value || ''
    const ctx = {
      authorTitle: recipientUser?.title || '',
      authorName: recipientUser ? `${recipientUser.firstName} ${recipientUser.lastName}` : 'Colleague',
      conferenceName,
      submissionCode: '',
      editorName: `${user.firstName} ${user.lastName}`,
      editorTitle: user.title || '',
    }
    const fill = (t) => t.replace(/\{(\w+)\}/g, (_, k) => ctx[k] || '')
    return fill(opening) + body + fill(closing)
  }

  const send = async () => {
    if (!subject || !body) return toast.error('Subject and body required')
    if (!recipient) return toast.error('Choose a recipient')
    setSending(true)
    try {
      await api(`/abstracts/${abstractId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          subject, body: buildFullBody(), channel,
          recipientIds: [recipient],
          attachmentIds: selectedDocs,
        }),
      })
      setSubject(''); setBody(''); setSelectedDocs([]); setOpeningKey(''); setClosingKey('')
      refresh(); toast.success('Message sent — email delivered to recipient')
    } catch (e) { toast.error(e.message) } finally { setSending(false) }
  }

  const toggleDoc = (id) => setSelectedDocs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Internal messaging (with email delivery)</CardTitle>
        <CardDescription>All communication is scoped to this abstract, audited, and mirrored to the recipient's email inbox.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-h-96 overflow-auto">
          {messages.length === 0 ? <div className="text-sm text-muted-foreground text-center py-4">No messages yet</div>
          : messages.map(m => (
            <div key={m.id} className={`p-3 rounded-md border ${m.senderId === user.id ? 'bg-indigo-50 border-indigo-200 ml-8' : 'bg-slate-50 mr-8'}`}>
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs font-semibold">{m.sender.firstName} {m.sender.lastName}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</div>
              </div>
              <div className="text-sm font-medium">{m.subject}</div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{m.body}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{m.channel.replace('_', ' ↔ ')}</Badge>
                {m.attachmentIds?.length > 0 && documents.filter(d => m.attachmentIds.includes(d.id)).map(d => (
                  <a key={d.id} href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200">
                    <Download className="h-3 w-3" /> {d.fileName}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2"><Send className="h-4 w-4 text-indigo-600" /> Compose new message</div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EDITOR_AUTHOR">Editor → Author</SelectItem>
                <SelectItem value="EDITOR_REVIEWER">Editor → Reviewer</SelectItem>
                <SelectItem value="EDITOR_EDITOR">Editor ↔ Editor</SelectItem>
                <SelectItem value="REVIEWER_EDITOR">Reviewer → Editor</SelectItem>
              </SelectContent>
            </Select>
            <Select value={recipient} onValueChange={setRecipient}>
              <SelectTrigger><SelectValue placeholder="Recipient" /></SelectTrigger>
              <SelectContent>{users.filter(u => u.id !== user.id).map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Gratitude template selectors */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Gratitude opening (auto-prefixed)</Label>
              <Select value={openingKey} onValueChange={setOpeningKey}>
                <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                <SelectContent>{GRATITUDE_OPENINGS.map(o => <SelectItem key={o.label} value={o.label}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Gratitude closing (auto-appended)</Label>
              <Select value={closingKey} onValueChange={setClosingKey}>
                <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                <SelectContent>{GRATITUDE_CLOSINGS.map(c => <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
          <Textarea placeholder="Your message (opening and closing will be added automatically if selected above)" value={body} onChange={e => setBody(e.target.value)} rows={6} />

          {/* Attachment picker */}
          {documents.length > 0 && (
            <div>
              <Label className="text-xs">Attach documents (e.g. reviewer-annotated abstract, decision letter)</Label>
              <div className="mt-1 border rounded-md p-2 max-h-32 overflow-auto bg-slate-50">
                {documents.map(d => (
                  <label key={d.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-white cursor-pointer text-sm">
                    <input type="checkbox" checked={selectedDocs.includes(d.id)} onChange={() => toggleDoc(d.id)} />
                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                    <span className="flex-1">{d.fileName}</span>
                    <Badge variant="outline" className="text-[10px]">{d.category.replace('_', ' ')}</Badge>
                  </label>
                ))}
              </div>
              {selectedDocs.length > 0 && <div className="text-[11px] text-emerald-700 mt-1">{selectedDocs.length} file(s) will be attached to the email.</div>}
            </div>
          )}

          {/* Preview of full message */}
          {(openingKey || closingKey) && body && (
            <div className="border-l-4 border-indigo-300 pl-3 bg-indigo-50/40 p-2 rounded">
              <div className="text-[11px] font-semibold text-indigo-800 mb-1">Preview (as recipient will see):</div>
              <pre className="text-xs whitespace-pre-wrap font-sans">{buildFullBody()}</pre>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={send} disabled={sending} className="bg-indigo-600 hover:bg-indigo-700">
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-1" />}
              Send message + email
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ EDITORIAL OFFICE ============
function EditorialOffice({ setRoute }) {
  const [all, setAll] = useState([])
  const [filter, setFilter] = useState('')
  useEffect(() => { api('/abstracts').then(d => setAll(d.abstracts || [])) }, [])
  const visible = filter ? all.filter(a => a.currentState === filter) : all

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editorial office</h1>
          <p className="text-muted-foreground">All submissions across the platform</p>
        </div>
        <Select value={filter || 'ALL'} onValueChange={(v) => setFilter(v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filter by state" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All states</SelectItem>
            {['SUBMITTED','TECHNICAL_CHECK','EDITORIAL_ASSIGNMENT','COMMITTEE_REVIEW','EXTERNAL_PEER_REVIEW','REVIEWS_COMPLETED','EDITORIAL_DECISION','ACCEPTED','REJECTED']
              .map(s => <SelectItem key={s} value={s}>{stateLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3">
        {visible.length === 0 ? <EmptyState label="No abstracts match filter" />
        : visible.map(a => <AbstractCard key={a.id} a={a} onOpen={() => setRoute({ name: 'abstract', id: a.id })} />)}
      </div>
    </div>
  )
}

// ============ REVIEWER WORKSPACE ============
function ReviewerWorkspace({ setRoute }) {
  const [assignments, setAssignments] = useState([])
  const [active, setActive] = useState(null)
  const refresh = () => api('/reviewer/assignments').then(d => setAssignments(d.assignments || []))
  useEffect(() => { refresh() }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Reviewer workspace</h1>
        <p className="text-muted-foreground">Your review assignments</p>
      </div>
      {assignments.length === 0 ? <EmptyState label="No review assignments yet" /> : (
        <div className="grid gap-3">
          {assignments.map(a => (
            <Card key={a.id}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{a.abstract.submissionCode}</span>
                      <Badge variant="outline" className="text-[10px]">{a.reviewType.replace('_',' ')}</Badge>
                      <Badge className={`text-[10px] border ${STATE_COLORS[a.abstract.currentState]}`}>{stateLabel(a.abstract.currentState)}</Badge>
                      <Badge variant={a.invitationStatus === 'ACCEPTED' ? 'default' : 'outline'} className="text-[10px]">{a.invitationStatus}</Badge>
                    </div>
                    <div className="font-semibold">{a.abstract.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Invited {new Date(a.assignedAt).toLocaleDateString()}
                      {a.dueDate && ` · Due ${new Date(a.dueDate).toLocaleDateString()}`}
                      {a.completedAt && ` · Completed`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {a.invitationStatus === 'PENDING' && (
                      <>
                        <Button size="sm" variant="outline" onClick={async () => { await api(`/reviewer/assignments/${a.id}/respond`, { method: 'POST', body: JSON.stringify({ status: 'DECLINED' }) }); refresh() }}>Decline</Button>
                        <Button size="sm" onClick={async () => { await api(`/reviewer/assignments/${a.id}/respond`, { method: 'POST', body: JSON.stringify({ status: 'ACCEPTED' }) }); refresh() }}>Accept</Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setRoute({ name: 'abstract', id: a.abstract.id })}>View</Button>
                    {a.invitationStatus === 'ACCEPTED' && !a.report && (
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setActive(a)}>Submit review</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {active && <ReviewForm assignment={active} onClose={() => setActive(null)} onDone={() => { setActive(null); refresh() }} />}
    </div>
  )
}

function ReviewForm({ assignment, onClose, onDone }) {
  const [scores, setScores] = useState({ originalityScore: 7, significanceScore: 7, methodologyScore: 7, clarityScore: 7, overallScore: 7 })
  const [recommendation, setRecommendation] = useState('MINOR_REVISION')
  const [reviewComments, setReviewComments] = useState('')
  const [confidentialNotes, setConfidentialNotes] = useState('')
  const [files, setFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const addFiles = (e) => {
    const list = Array.from(e.target.files || [])
    const oversized = list.find(f => f.size > 25 * 1024 * 1024)
    if (oversized) { toast.error(`File "${oversized.name}" is over 25MB`); return }
    setFiles([...files, ...list])
    e.target.value = ''
  }
  const removeFile = (i) => setFiles(files.filter((_, j) => j !== i))

  const submit = async () => {
    if (!reviewComments.trim()) return toast.error('Review comments are required')
    setSubmitting(true)
    try {
      // 1) Upload any attached files first (as REVIEWER_ANNOTATION docs)
      for (const f of files) {
        const fd = new FormData()
        fd.append('file', f)
        fd.append('category', 'REVIEWER_ANNOTATION')
        await apiUpload(`/abstracts/${assignment.abstract.id}/documents`, fd)
      }
      // 2) Submit the review report
      await api(`/reviewer/assignments/${assignment.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          ...scores,
          recommendation,
          commentsToAuthor: reviewComments,          // Kept for schema compatibility — this goes to editor first
          commentsToEditor: confidentialNotes || null,
        }),
      })
      toast.success('Review submitted to editor')
      onDone()
    } catch (e) { toast.error(e.message || 'Failed to submit review') }
    finally { setSubmitting(false) }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Submit review</DialogTitle>
          <DialogDescription>{assignment.abstract.submissionCode} — {assignment.abstract.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-2 rounded-md bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Double-blind: author identities are hidden. Your review will be delivered to the editor only. You do not communicate with the author directly.</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {['originalityScore','significanceScore','methodologyScore','clarityScore','overallScore'].map(k => (
              <div key={k}>
                <Label className="text-[10px]">{k.replace('Score','').replace(/^./, c => c.toUpperCase())}</Label>
                <Input type="number" min={1} max={10} value={scores[k]} onChange={e => setScores({ ...scores, [k]: parseInt(e.target.value) || 0 })} />
              </div>
            ))}
          </div>
          <div>
            <Label>Recommendation</Label>
            <Select value={recommendation} onValueChange={setRecommendation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACCEPT">Accept</SelectItem>
                <SelectItem value="MINOR_REVISION">Minor revision</SelectItem>
                <SelectItem value="MAJOR_REVISION">Major revision</SelectItem>
                <SelectItem value="REJECT">Reject</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Review comments <span className="text-red-500">*</span></Label>
            <p className="text-[11px] text-muted-foreground mb-1">Detailed critique of the abstract. Submitted to the editor; the editor may share (anonymised) with the author.</p>
            <Textarea rows={7} value={reviewComments} onChange={e => setReviewComments(e.target.value)} placeholder="Strengths, weaknesses, suggestions for improvement..." />
          </div>
          <div>
            <Label>Confidential notes to editor (optional)</Label>
            <p className="text-[11px] text-muted-foreground mb-1">Only visible to the editorial team, never to the author.</p>
            <Textarea rows={3} value={confidentialNotes} onChange={e => setConfidentialNotes(e.target.value)} />
          </div>
          <div>
            <Label>Supporting files / annotated abstract (optional)</Label>
            <p className="text-[11px] text-muted-foreground mb-1">Upload the annotated abstract or any supplementary materials. Files go to the editor.</p>
            <input type="file" multiple onChange={addFiles} className="text-xs" />
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-slate-50 border">
                    <FileText className="h-3 w-3 text-indigo-600 shrink-0" />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-muted-foreground">{Math.round(f.size / 1024)} KB</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-red-500 hover:text-red-700">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Submit review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ CONFERENCES (public/attendee page with registration dialog) ============
function Conferences() {
  const [list, setList] = useState([])
  const [regFor, setRegFor] = useState(null)
  useEffect(() => { api('/conferences').then(d => setList(d.conferences || [])) }, [])
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Conferences</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {list.map(c => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex justify-between items-center"><Badge>{c.code}</Badge><Badge variant="outline">{stateLabel(c.status)}</Badge></div>
              <CardTitle className="mt-2">{c.name}</CardTitle>
              <CardDescription>{c.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div>📍 {c.venue}, {c.city}, {c.country}</div>
              <div>📅 {c.startDate && new Date(c.startDate).toLocaleDateString()} – {c.endDate && new Date(c.endDate).toLocaleDateString()}</div>
              <div>📝 Submissions until {c.submissionClose && new Date(c.submissionClose).toLocaleDateString()}</div>
              <div className="flex flex-wrap gap-1 mt-2">{c.themes?.map(t => <Badge key={t.id} variant="outline" className="text-[10px]">{t.name}</Badge>)}</div>
              <div className="pt-3 flex gap-2">
                <Button size="sm" onClick={() => setRegFor({ conf: c, type: 'ATTENDEE' })}>Register as Attendee</Button>
                <Button size="sm" variant="outline" onClick={() => setRegFor({ conf: c, type: 'AUTHOR' })}>Register as Author</Button>
                <Button size="sm" variant="outline" onClick={() => setRegFor({ conf: c, type: 'SPONSOR' })}>Sponsor / Pharma</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {regFor && <RegistrationDialog conf={regFor.conf} initialType={regFor.type} onClose={() => setRegFor(null)} onDone={() => { setRegFor(null); toast.success('Registration complete') }} />}
    </div>
  )
}

function RegistrationDialog({ conf, initialType, onClose, onDone }) {
  const [type, setType] = useState(initialType)
  const [form, setForm] = useState({
    mode: 'PHYSICAL', prefix: 'Dr.', fullName: '', rank: '', unit: '', affiliation: '',
    companyName: '', companyAddress: '', industry: '', sponsorTier: 'BRONZE',
    virtualBoothRequested: false, physicalBoothRequested: false, sponsorMessage: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const SPONSOR_TIERS = [
    { key: 'BRONZE', label: 'Bronze', price: '$1,000', benefits: ['Logo on website', 'Virtual booth', 'Company profile'] },
    { key: 'SILVER', label: 'Silver', price: '$2,500', benefits: ['All Bronze benefits', 'Physical booth (small)', '2 delegate passes'] },
    { key: 'GOLD', label: 'Gold', price: '$5,000', benefits: ['All Silver benefits', 'Physical booth (large)', '4 delegate passes', 'Sponsored session'] },
    { key: 'PLATINUM', label: 'Platinum', price: '$10,000', benefits: ['All Gold benefits', 'Keynote slot', '8 delegate passes', 'Front-page banner'] },
    { key: 'DIAMOND', label: 'Diamond', price: '$25,000', benefits: ['Named partner', 'Unlimited passes', 'Exclusive branding'] },
  ]

  const submit = async () => {
    setError('')
    if (type === 'ATTENDEE') {
      if (!form.fullName || !form.rank || !form.unit || !form.affiliation) return setError('Full name, rank, unit and affiliation are required (used on certificate & name tag).')
    }
    if (type === 'SPONSOR') {
      if (!form.companyName || !form.industry || !form.companyAddress) return setError('Company name, industry and address are required.')
    }
    setSaving(true)
    try {
      await api(`/conferences/${conf.id}/register`, { method: 'POST', body: JSON.stringify({ type, ...form }) })
      onDone()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Register for {conf.name}</DialogTitle>
          <DialogDescription>Choose your registration category</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            {['ATTENDEE', 'AUTHOR', 'SPONSOR'].map(t => (
              <Button key={t} variant={type === t ? 'default' : 'outline'} size="sm" onClick={() => setType(t)} className={type === t ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>
                {t === 'ATTENDEE' ? 'Attendee' : t === 'AUTHOR' ? 'Author' : 'Sponsor / Pharma'}
              </Button>
            ))}
          </div>

          {error && <div className="p-3 rounded bg-red-50 border border-red-300 text-red-800 text-sm">{error}</div>}

          {type === 'ATTENDEE' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Attendance mode *</Label>
                  <Select value={form.mode} onValueChange={v => setForm({ ...form, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PHYSICAL">Physical (in-person)</SelectItem>
                      <SelectItem value="VIRTUAL">Virtual (online)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prefix *</Label>
                  <Select value={form.prefix} onValueChange={v => setForm({ ...form, prefix: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Prof.','Dr.','Mr.','Mrs.','Ms.','Rev.','Hon.'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Full name (as it should appear on certificate & name tag) *</Label><Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Jane W. Doe" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Rank / Position *</Label><Input value={form.rank} onChange={e => setForm({ ...form, rank: e.target.value })} placeholder="e.g. Consultant, Senior Registrar" /></div>
                <div><Label>Unit / Department *</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="e.g. Cardiology" /></div>
              </div>
              <div><Label>Affiliation (Hospital / Institution) *</Label><Input value={form.affiliation} onChange={e => setForm({ ...form, affiliation: e.target.value })} placeholder="e.g. Nairobi Hospital" /></div>
              <p className="text-xs text-muted-foreground">{form.mode === 'PHYSICAL' ? 'These details will appear on your printed name tag and attendance certificate.' : 'These details will appear on your digital attendance certificate.'}</p>
            </>
          )}

          {type === 'AUTHOR' && (
            <>
              <div className="p-3 rounded bg-indigo-50 border border-indigo-200 text-sm">
                Authors submit abstracts through the platform. Registration is open until abstract submission closes ({conf.submissionClose && new Date(conf.submissionClose).toLocaleDateString()}).
                After submission you'll receive updates via email and can track your submission from the "My Abstracts" page.
              </div>
              <div><Label>Full name</Label><Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></div>
              <div><Label>Affiliation</Label><Input value={form.affiliation} onChange={e => setForm({ ...form, affiliation: e.target.value })} /></div>
            </>
          )}

          {type === 'SPONSOR' && (
            <>
              <div><Label>Company / Institution *</Label><Input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Industry *</Label><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="e.g. Pharmaceutical, Medical Devices" /></div>
                <div><Label>Address *</Label><Input value={form.companyAddress} onChange={e => setForm({ ...form, companyAddress: e.target.value })} placeholder="Company address" /></div>
              </div>
              <div>
                <Label>Sponsorship tier</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                  {SPONSOR_TIERS.map(t => (
                    <button key={t.key} type="button" onClick={() => setForm({ ...form, sponsorTier: t.key })}
                      className={`text-left p-2 rounded-md border ${form.sponsorTier === t.key ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex justify-between items-center">
                        <div className="font-semibold text-sm">{t.label}</div>
                        <Badge variant="outline">{t.price}</Badge>
                      </div>
                      <ul className="text-[11px] text-muted-foreground mt-1 list-disc list-inside">
                        {t.benefits.map(b => <li key={b}>{b}</li>)}
                      </ul>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 border rounded-md p-2 cursor-pointer">
                  <input type="checkbox" checked={form.virtualBoothRequested} onChange={e => setForm({ ...form, virtualBoothRequested: e.target.checked })} />
                  <span className="text-sm">Request virtual exhibition booth</span>
                </label>
                <label className="flex items-center gap-2 border rounded-md p-2 cursor-pointer">
                  <input type="checkbox" checked={form.physicalBoothRequested} onChange={e => setForm({ ...form, physicalBoothRequested: e.target.checked })} />
                  <span className="text-sm">Request physical exhibition booth</span>
                </label>
              </div>
              <div><Label>Message to organisers (optional)</Label><Textarea rows={3} value={form.sponsorMessage} onChange={e => setForm({ ...form, sponsorMessage: e.target.value })} /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Complete registration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Programme() {
  const [confs, setConfs] = useState([])
  const [confId, setConfId] = useState('')
  const [sessions, setSessions] = useState([])
  const [downloadingType, setDownloadingType] = useState(null)
  useEffect(() => { api('/conferences').then(d => { setConfs(d.conferences || []); if (d.conferences?.[0]) setConfId(d.conferences[0].id) }) }, [])
  useEffect(() => { if (confId) api(`/programme/${confId}`).then(d => setSessions(d.sessions || [])) }, [confId])

  const download = async (type) => {
    setDownloadingType(type)
    try {
      const token = getToken()
      const resp = await fetch(`/api/programme/${confId}.${type}`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (!resp.ok) throw new Error(await resp.text() || 'Failed')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const conf = confs.find(c => c.id === confId)
      const a = document.createElement('a'); a.href = url; a.download = `${conf?.code || 'conference'}-programme.${type}`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { toast.error(e.message || 'Download failed') } finally { setDownloadingType(null) }
  }

  // Group sessions by day
  const dayGroups = {}
  sessions.forEach(s => {
    const key = new Date(s.startTime).toISOString().slice(0, 10)
    if (!dayGroups[key]) dayGroups[key] = { date: new Date(s.startTime), items: [] }
    dayGroups[key].items.push(s)
  })
  const days = Object.entries(dayGroups).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Calendar className="h-7 w-7 text-indigo-600" /> Conference programme</h1>
          <p className="text-muted-foreground">Full schedule of sessions and presentations. Download as PDF booklet or CSV for planning.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={confId} onValueChange={setConfId}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{confs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => download('pdf')} disabled={!confId || downloadingType === 'pdf'}>
            {downloadingType === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />} PDF
          </Button>
          <Button variant="outline" onClick={() => download('csv')} disabled={!confId || downloadingType === 'csv'}>
            {downloadingType === 'csv' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />} CSV
          </Button>
        </div>
      </div>
      {sessions.length === 0 ? <EmptyState label="No sessions scheduled yet" /> : (
        <div className="space-y-8">
          {days.map(([key, g]) => (
            <div key={key}>
              <div className="mb-3 pb-2 border-b-2 border-indigo-200 flex items-baseline gap-3">
                <h2 className="text-xl font-bold text-indigo-700">{g.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
                <span className="text-xs text-muted-foreground">{g.items.length} sessions</span>
              </div>
              <div className="grid gap-3">
                {g.items.map(s => (
                  <Card key={s.id} className="overflow-hidden">
                    <div className="flex">
                      <div className="w-40 bg-gradient-to-br from-indigo-600 to-fuchsia-600 p-4 flex flex-col justify-center text-white">
                        <div className="text-lg font-bold">{new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="text-xs opacity-90">to {new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        {s.room && <div className="text-[11px] mt-2 opacity-90">{s.room}</div>}
                      </div>
                      <div className="flex-1 p-4">
                        <div className="font-bold text-lg">{s.title}</div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {s.chair && `Chair: ${s.chair}`}{s.chair && s.theme?.name && ' · '}{s.theme?.name && `Theme: ${s.theme.name}`}
                        </div>
                        {(s.items || []).length > 0 && (
                          <div className="space-y-1 mt-2 border-t pt-2">
                            {s.items.map(i => (
                              <div key={i.id} className="text-sm flex gap-3">
                                <span className="text-xs text-muted-foreground shrink-0 w-14">{i.durationMin || 15} min</span>
                                <div className="flex-1">
                                  <div className="text-sm">{i.abstract.title} <span className="text-xs text-muted-foreground">({i.abstract.submissionCode})</span></div>
                                  <div className="text-xs text-muted-foreground">{(i.abstract.authors || []).map(a => a.fullName).join(', ')}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============ ANALYTICS ============
function Analytics() {
  const [stats, setStats] = useState(null)
  useEffect(() => { api('/analytics/dashboard').then(setStats) }, [])
  if (!stats) return <div className="p-6"><Loader2 className="animate-spin" /></div>
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Analytics & reporting</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Users" value={stats.totalUsers} color="text-indigo-600" />
        <StatCard icon={FileText} label="Abstracts" value={stats.totalAbstracts} color="text-fuchsia-600" />
        <StatCard icon={ClipboardCheck} label="Reviews" value={`${stats.reviews.completed}/${stats.reviews.total}`} color="text-emerald-600" />
        <StatCard icon={Calendar} label="Registrations" value={stats.totalRegs} color="text-amber-600" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Abstracts by state</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.abstractsByState.map(s => ({ name: stateLabel(s.state), count: s.count }))}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 10 }} /><Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Users by role</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.usersByRole.map(u => ({ name: ROLE_LABELS[u.role] || u.role, value: u.count }))} dataKey="value" nameKey="name" outerRadius={90} label>
                  {stats.usersByRole.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Abstracts by theme</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.abstractsByTheme}>
                <XAxis dataKey="theme" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} /><Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Editorial decisions</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.decisions.map(d => ({ name: d.decision.replace('_', ' '), value: d.count }))} dataKey="value" nameKey="name" outerRadius={90} label>
                  {stats.decisions.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============ USER MANAGEMENT ============
function UserManagement() {
  const [users, setUsers] = useState([])
  const [open, setOpen] = useState(false)
  const refresh = () => api('/users').then(d => setUsers(d.users || []))
  useEffect(() => { refresh() }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-3xl font-bold">User management</h1><p className="text-muted-foreground">Manage accounts, roles and permissions</p></div>
        <Button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="h-4 w-4 mr-1" /> Create user</Button>
      </div>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr className="border-b">
            <th className="text-left p-3">Name</th><th className="text-left p-3">Email</th><th className="text-left p-3">Roles</th><th className="text-left p-3">Institution</th><th className="text-left p-3">Country</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b hover:bg-slate-50">
                <td className="p-3 font-medium">{u.firstName} {u.lastName}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{u.roles.map(r => <Badge key={r.id} variant="outline" className="text-[10px]">{ROLE_LABELS[r.role]}</Badge>)}</div></td>
                <td className="p-3">{u.institution?.name || u.affiliation || '—'}</td>
                <td className="p-3">{u.country || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
      {open && <CreateUserDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); refresh() }} />}
    </div>
  )
}

function CreateUserDialog({ onClose, onDone }) {
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'AUTHOR', password: 'password123', affiliation: '', country: '' })
  const submit = async () => {
    try { await api('/users', { method: 'POST', body: JSON.stringify(form) }); toast.success('User created'); onDone() } catch (e) { toast.error(e.message) }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create new user</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>First name</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><Label>Last name</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
          </div>
          <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Password</Label><Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
          <div><Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(ROLE_LABELS).map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Affiliation</Label><Input value={form.affiliation} onChange={e => setForm({ ...form, affiliation: e.target.value })} /></div>
            <div><Label>Country</Label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ DELEGATES PAGE ============
function DelegatesPage() {
  const [confs, setConfs] = useState([])
  const [confId, setConfId] = useState('')
  const [physical, setPhysical] = useState([])
  const [virtual, setVirtual] = useState([])
  const [sponsors, setSponsors] = useState([])

  useEffect(() => { api('/conferences').then(d => { setConfs(d.conferences || []); if (d.conferences?.[0]) setConfId(d.conferences[0].id) }) }, [])

  useEffect(() => {
    if (!confId) return
    // For now, we use CSV endpoint. In-page tables via a separate JSON endpoint could be added later.
  }, [confId])

  const downloadCsv = (mode) => {
    const link = document.createElement('a')
    link.href = `/api/conferences/${confId}/delegates.csv?mode=${mode || ''}`
    const token = getToken()
    // Use fetch to include the Bearer token then download
    fetch(link.href, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' })
      .then(r => r.blob()).then(b => {
        const url = URL.createObjectURL(b)
        const a = document.createElement('a')
        a.href = url; a.download = `delegates_${mode || 'all'}.csv`; a.click()
        URL.revokeObjectURL(url)
      })
      .catch(e => toast.error(e.message))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Registered delegates</h1>
        <p className="text-muted-foreground">Download registered attendees for name tag printing and reporting.</p>
      </div>
      <Card className="mb-4">
        <CardContent className="p-4">
          <Label>Conference</Label>
          <Select value={confId} onValueChange={setConfId}>
            <SelectTrigger className="w-full mt-1"><SelectValue placeholder="Choose conference" /></SelectTrigger>
            <SelectContent>{confs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-emerald-600" /> Physical delegates</CardTitle>
            <CardDescription>In-person attendees, editors and admin. Use for name-tag printing.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => downloadCsv('PHYSICAL')} className="w-full bg-emerald-600 hover:bg-emerald-700"><Download className="h-4 w-4 mr-1" /> Download CSV</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Globe className="h-5 w-5 text-indigo-600" /> Virtual delegates</CardTitle>
            <CardDescription>Online attendees only.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => downloadCsv('VIRTUAL')} className="w-full bg-indigo-600 hover:bg-indigo-700"><Download className="h-4 w-4 mr-1" /> Download CSV</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-fuchsia-600" /> All delegates</CardTitle>
            <CardDescription>Complete registration list (all types).</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => downloadCsv('')} className="w-full bg-fuchsia-600 hover:bg-fuchsia-700"><Download className="h-4 w-4 mr-1" /> Download CSV</Button>
          </CardContent>
        </Card>
      </div>

      {/* Name tags + certificates */}
      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🏷 Print name tags</CardTitle>
            <CardDescription>PDF with 8 name tags per page — physical attendees + editors + admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-slate-800 hover:bg-slate-900" onClick={async () => {
              const token = getToken()
              const r = await fetch(`/api/conferences/${confId}/name-tags.pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' })
              if (!r.ok) return toast.error('Failed to generate')
              const b = await r.blob(); const url = URL.createObjectURL(b)
              const a = document.createElement('a'); a.href = url; a.download = `name-tags.pdf`; a.click(); URL.revokeObjectURL(url)
            }}><Download className="h-4 w-4 mr-1" /> Generate name tags PDF</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">✉ Attendance certificates</CardTitle>
            <CardDescription>Email PDF certificate to every registered attendee (marks virtual for virtual delegates).</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={async () => {
              if (!confirm('Send attendance certificates to every registered attendee?')) return
              try {
                const d = await api(`/conferences/${confId}/send-attendance-certificates`, { method: 'POST' })
                toast.success(`Sent ${d.sent} certificate(s)`)
              } catch (e) { toast.error(e.message) }
            }}><Send className="h-4 w-4 mr-1" /> Send attendance certificates</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🏆 Presentation certificates</CardTitle>
            <CardDescription>Email certificate to authors of accepted (oral/poster) abstracts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-fuchsia-600 hover:bg-fuchsia-700" onClick={async () => {
              if (!confirm('Send presentation certificates to all presenters?')) return
              try {
                const d = await api(`/conferences/${confId}/send-presentation-certificates`, { method: 'POST' })
                toast.success(`Sent ${d.sent} certificate(s)`)
              } catch (e) { toast.error(e.message) }
            }}><Send className="h-4 w-4 mr-1" /> Send presentation certificates</Button>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground mt-4">CSV columns: Prefix, First Name, Last Name, Email, Type, Mode, Rank, Unit, Affiliation, Company, Registered. Physical file also contains editors and admin. Name tags are 8 per A4 page (2 columns × 4 rows) — cut along the borders.</p>
    </div>
  )
}
function ConferenceAdmin() {
  const [list, setList] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [themeConfId, setThemeConfId] = useState(null)
  const [heroConfId, setHeroConfId] = useState(null)
  const refresh = () => api('/conferences').then(d => setList(d.conferences || []))
  useEffect(() => { refresh() }, [])

  const remove = async (c) => {
    if (!confirm(`Delete conference "${c.name}"? This removes all abstracts, reviews and data for it.`)) return
    try { await api(`/conferences/${c.id}`, { method: 'DELETE' }); toast.success('Conference deleted'); refresh() } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conference administration</h1>
          <p className="text-muted-foreground">Register, edit and manage conferences and their themes</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true) }} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-1" /> Register new conference
        </Button>
      </div>

      {list.length === 0 ? <EmptyState label="No conferences yet. Register the first one." onAction={() => { setEditing(null); setOpen(true) }} actionLabel="Register conference" /> : (
        <div className="grid gap-3">
          {list.map(c => (
            <Card key={c.id}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge>{c.code}</Badge>
                      <Badge variant="outline">{stateLabel(c.status)}</Badge>
                      {c.doubleBlind && <Badge variant="outline">Double-blind</Badge>}
                    </div>
                    <div className="font-semibold text-lg">{c.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">{c.description}</div>
                    <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      <span>📍 {c.venue}, {c.city}, {c.country}</span>
                      <span>📅 {c.startDate && new Date(c.startDate).toLocaleDateString()} – {c.endDate && new Date(c.endDate).toLocaleDateString()}</span>
                      <span>📝 {c._count?.abstracts || 0} submissions</span>
                      <span>👥 {c._count?.registrations || 0} registrations</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.themes?.map(t => <Badge key={t.id} variant="secondary" className="text-[10px]">{t.name}</Badge>)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(c); setOpen(true) }}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => setThemeConfId(c.id)}>+ Theme</Button>
                    <Button size="sm" variant="outline" onClick={() => setHeroConfId(c.id)}>Hero images</Button>
                    <Button size="sm" variant={c.isFeatured ? 'default' : 'outline'} className={c.isFeatured ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      onClick={async () => {
                        try {
                          // Unfeature others, feature this one
                          const others = list.filter(x => x.id !== c.id && x.isFeatured)
                          for (const o of others) await api(`/conferences/${o.id}`, { method: 'PUT', body: JSON.stringify({ isFeatured: false }) })
                          await api(`/conferences/${c.id}`, { method: 'PUT', body: JSON.stringify({ isFeatured: !c.isFeatured }) })
                          toast.success(c.isFeatured ? 'Unfeatured' : 'Set as featured (public site)')
                          refresh()
                        } catch (e) { toast.error(e.message) }
                      }}>
                      {c.isFeatured ? '★ Featured' : 'Set featured'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(c)}>Delete</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {open && <ConferenceDialog editing={editing} onClose={() => setOpen(false)} onDone={() => { setOpen(false); refresh() }} />}
      {themeConfId && <ThemeDialog conferenceId={themeConfId} onClose={() => setThemeConfId(null)} onDone={() => { setThemeConfId(null); refresh() }} />}
      {heroConfId && <HeroImagesDialog conference={list.find(x => x.id === heroConfId)} onClose={() => setHeroConfId(null)} onDone={() => { setHeroConfId(null); refresh() }} />}
    </div>
  )
}

function HeroImagesDialog({ conference, onClose, onDone }) {
  const [images, setImages] = useState(conference?.heroImages || [])
  const [uploading, setUploading] = useState(false)

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Only image files allowed')
    if (file.size > 5 * 1024 * 1024) return toast.error('Image exceeds 5 MB limit')
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const d = await apiUpload(`/conferences/${conference.id}/hero-images`, fd)
      setImages(d.conference.heroImages)
      toast.success('Image added')
    } catch (e) { toast.error(e.message) } finally { setUploading(false); e.target.value = '' }
  }

  const removeImg = async (imagePath) => {
    try {
      const res = await fetch(`/api/conferences/${conference.id}/hero-images`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
        body: JSON.stringify({ imagePath }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setImages(d.conference.heroImages)
      toast.success('Image removed')
    } catch (e) { toast.error(e.message) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Hero background images</DialogTitle>
          <DialogDescription>Images shown on the public conference site header carousel. If none uploaded, defaults are used.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="border-2 border-dashed rounded-lg p-4 text-center bg-slate-50">
            <FileUp className="h-8 w-8 mx-auto text-indigo-600 mb-2" />
            <div className="text-sm mb-2">Upload conference image (JPG/PNG, max 5MB)</div>
            <input type="file" accept="image/*" onChange={upload} disabled={uploading} className="text-sm" />
          </div>
          {images.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">No custom images. Default carousel is shown.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((src, i) => (
                <div key={i} className="relative border rounded-md overflow-hidden group">
                  <img src={src} alt="" className="w-full h-32 object-cover" />
                  <button onClick={() => removeImg(src)} className="absolute top-1 right-1 bg-red-600 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConferenceDialog({ editing, onClose, onDone }) {
  const [form, setForm] = useState({
    code: editing?.code || `CONF${new Date().getFullYear() + 1}`,
    name: editing?.name || '',
    subtitle: editing?.subtitle || '',
    theme: editing?.theme || '',
    description: editing?.description || '',
    venue: editing?.venue || '',
    city: editing?.city || '',
    country: editing?.country || '',
    contactEmail: editing?.contactEmail || '',
    contactPhone: editing?.contactPhone || '',
    startDate: editing?.startDate?.slice(0, 10) || '',
    endDate: editing?.endDate?.slice(0, 10) || '',
    submissionOpen: editing?.submissionOpen?.slice(0, 10) || '',
    submissionClose: editing?.submissionClose?.slice(0, 10) || '',
    registrationOpen: editing?.registrationOpen?.slice(0, 10) || '',
    registrationClose: editing?.registrationClose?.slice(0, 10) || '',
    doubleBlind: editing?.doubleBlind ?? true,
    status: editing?.status || 'OPEN_FOR_SUBMISSION',
    mapAddress: editing?.mapAddress || '',
    mapUrl: editing?.mapUrl || '',
    hotelImagePath: editing?.hotelImagePath || '',
  })
  const [uploadingHotel, setUploadingHotel] = useState(false)

  const uploadHotel = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Only image files allowed')
    if (file.size > 8 * 1024 * 1024) return toast.error('Image exceeds 8 MB limit')
    if (!editing?.id) return toast.error('Save the conference first, then upload the hotel image')
    setUploadingHotel(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const d = await apiUpload(`/conferences/${editing.id}/hotel-image`, fd)
      setForm({ ...form, hotelImagePath: d.imagePath })
      toast.success('Hotel image uploaded')
    } catch (e) { toast.error(e.message) } finally { setUploadingHotel(false); e.target.value = '' }
  }

  const submit = async () => {
    if (!form.code || !form.name) return toast.error('Code and name required')
    try {
      const payload = { ...form }
      // Convert date strings to ISO
      for (const k of ['startDate','endDate','submissionOpen','submissionClose','registrationOpen','registrationClose']) {
        payload[k] = payload[k] ? new Date(payload[k]).toISOString() : null
      }
      if (editing) {
        await api(`/conferences/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success('Conference updated')
      } else {
        await api('/conferences', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Conference registered')
      }
      onDone()
    } catch (e) { toast.error(e.message) }
  }

  const STATUSES = ['DRAFT','ANNOUNCED','OPEN_FOR_SUBMISSION','UNDER_REVIEW','DECISIONS_ISSUED','PROGRAMME_PUBLISHED','IN_PROGRESS','COMPLETED','ARCHIVED']

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit conference' : 'Register new conference'}</DialogTitle>
          <DialogDescription>Fill in the conference details. Themes can be added after saving.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Code *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="CONF2027" /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{stateLabel(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="International Conference on ..." /></div>
          <div><Label>Subtitle / tagline</Label><Input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} placeholder="Shown under title on the public site" /></div>
          <div><Label>Conference theme (shown in footer)</Label><Input value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })} placeholder="e.g. Advancing Health Through Innovation" /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Venue</Label><Input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} /></div>
            <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Country</Label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
          </div>

          {/* Hotel image + Google Map */}
          <div className="border rounded-lg p-3 bg-blue-50/40 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-700">Hotel / venue location</div>
            <div><Label>Google Maps address <span className="text-[10px] text-muted-foreground">(auto-generates map, e.g. "Sarova Whitesands Beach Resort Mombasa")</span></Label>
              <Input value={form.mapAddress} onChange={e => setForm({ ...form, mapAddress: e.target.value })} placeholder="Sarova Whitesands Beach Resort, Mombasa, Kenya" />
            </div>
            <div><Label>Custom map embed URL <span className="text-[10px] text-muted-foreground">(optional, overrides address)</span></Label>
              <Input value={form.mapUrl} onChange={e => setForm({ ...form, mapUrl: e.target.value })} placeholder="https://www.google.com/maps/embed?pb=..." />
            </div>
            <div>
              <Label>Hotel exterior image</Label>
              {form.hotelImagePath && (
                <div className="my-2 relative">
                  <img src={form.hotelImagePath} className="w-full h-40 object-cover rounded border" alt="Hotel" />
                  <button type="button" onClick={() => setForm({ ...form, hotelImagePath: '' })} className="absolute top-1 right-1 bg-red-600 text-white rounded p-1 opacity-90 hover:opacity-100">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              )}
              <input type="file" accept="image/*" onChange={uploadHotel} disabled={uploadingHotel || !editing?.id} className="text-xs" />
              {!editing?.id && <div className="text-[10px] text-muted-foreground mt-1">Save the conference first to enable image upload.</div>}
              {uploadingHotel && <div className="text-xs text-indigo-600 mt-1"><Loader2 className="h-3 w-3 animate-spin inline" /> Uploading…</div>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Contact email</Label><Input type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div><Label>Contact phone</Label><Input value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Start date</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><Label>End date</Label><Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Submissions open</Label><Input type="date" value={form.submissionOpen} onChange={e => setForm({ ...form, submissionOpen: e.target.value })} /></div>
            <div><Label>Submissions close</Label><Input type="date" value={form.submissionClose} onChange={e => setForm({ ...form, submissionClose: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Registration open</Label><Input type="date" value={form.registrationOpen} onChange={e => setForm({ ...form, registrationOpen: e.target.value })} /></div>
            <div><Label>Registration close</Label><Input type="date" value={form.registrationClose} onChange={e => setForm({ ...form, registrationClose: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2">
            <input id="db" type="checkbox" checked={form.doubleBlind} onChange={e => setForm({ ...form, doubleBlind: e.target.checked })} />
            <Label htmlFor="db">Double-blind peer review (hide author identity from reviewers)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} className="bg-indigo-600 hover:bg-indigo-700">{editing ? 'Save changes' : 'Register conference'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ThemeDialog({ conferenceId, onClose, onDone }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [keywords, setKeywords] = useState('')
  const submit = async () => {
    if (!name) return toast.error('Theme name required')
    try {
      await api(`/conferences/${conferenceId}/themes`, {
        method: 'POST',
        body: JSON.stringify({ name, description, keywords: keywords.split(',').map(k => k.trim()).filter(Boolean) }),
      })
      toast.success('Theme added'); onDone()
    } catch (e) { toast.error(e.message) }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add scientific theme</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Computer Vision" /></div>
          <div><Label>Description</Label><Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div><Label>Keywords (comma separated)</Label><Input value={keywords} onChange={e => setKeywords(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Add theme</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ AUDIT ============
function AuditView() {
  const [logs, setLogs] = useState([])
  useEffect(() => { api('/audit').then(d => setLogs(d.logs || [])) }, [])
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Audit log</h1>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr className="border-b"><th className="text-left p-3">Time</th><th className="text-left p-3">Actor</th><th className="text-left p-3">Action</th><th className="text-left p-3">Entity</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-b hover:bg-slate-50">
                <td className="p-3 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="p-3">{l.actor?.firstName} {l.actor?.lastName || '—'}</td>
                <td className="p-3"><Badge variant="outline">{l.action}</Badge></td>
                <td className="p-3 text-xs text-muted-foreground">{l.entityType} {l.entityId?.slice(0,8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  )
}

// ============ TEMPLATES PAGE ============
function TemplatesPage({ user, isAdmin, isEditor }) {
  const [confs, setConfs] = useState([])
  const [confId, setConfId] = useState('')
  const [templates, setTemplates] = useState([])
  const [type, setType] = useState('POWERPOINT')
  const [uploading, setUploading] = useState(false)
  const canUpload = isAdmin || isEditor

  useEffect(() => { api('/conferences').then(d => { setConfs(d.conferences || []); if (d.conferences?.[0]) setConfId(d.conferences[0].id) }) }, [])
  useEffect(() => { if (confId) api(`/conferences/${confId}/templates`).then(d => setTemplates(d.templates || [])) }, [confId])

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('type', type)
      await apiUpload(`/conferences/${confId}/templates`, fd)
      toast.success('Template uploaded')
      const d = await api(`/conferences/${confId}/templates`); setTemplates(d.templates || [])
    } catch (e) { toast.error(e.message) } finally { setUploading(false); e.target.value = '' }
  }

  const remove = async (id) => {
    if (!confirm('Delete this template?')) return
    await api(`/templates/${id}`, { method: 'DELETE' })
    const d = await api(`/conferences/${confId}/templates`); setTemplates(d.templates || [])
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Presentation templates</h1>
        <p className="text-muted-foreground">PowerPoint and poster templates for accepted authors.</p>
      </div>

      <div className="flex gap-3 mb-4">
        <Select value={confId} onValueChange={setConfId}>
          <SelectTrigger className="w-96"><SelectValue placeholder="Choose conference" /></SelectTrigger>
          <SelectContent>{confs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {canUpload && confId && (
        <Card className="mb-4 border-indigo-200 bg-indigo-50/40">
          <CardContent className="p-4 flex items-center gap-3">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="POWERPOINT">PowerPoint (.pptx)</SelectItem>
                <SelectItem value="POSTER">Poster template</SelectItem>
                <SelectItem value="PAPER">Paper template</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
            <input type="file" onChange={upload} disabled={uploading} className="text-sm" />
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-2">
        {templates.length === 0 ? <EmptyState label="No templates uploaded for this conference." />
        : templates.map(t => (
          <Card key={t.id}>
            <CardContent className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-indigo-600" />
                <div>
                  <div className="font-medium">{t.fileName}</div>
                  <div className="text-xs text-muted-foreground">{t.type} · {(t.sizeBytes / 1024).toFixed(1)} KB · Uploaded {new Date(t.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`/api/templates/${t.id}/download`} target="_blank" rel="noreferrer">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700"><Download className="h-4 w-4 mr-1" /> Download</Button>
                </a>
                {canUpload && <Button size="sm" variant="destructive" onClick={() => remove(t.id)}>Delete</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-4">Note: Templates can only be downloaded by authors whose abstracts have been accepted, or by editors/admins.</p>
    </div>
  )
}

// ============ ANNOUNCEMENTS BOARD ============
function AnnouncementsBoard({ user }) {
  const [list, setList] = useState([])
  const [text, setText] = useState('')
  const refresh = () => api('/announcements').then(d => setList(d.announcements || [])).catch(() => {})
  useEffect(() => { refresh(); const i = setInterval(refresh, 15000); return () => clearInterval(i) }, [])
  const post = async () => {
    if (!text.trim()) return
    try { await api('/announcements', { method: 'POST', body: JSON.stringify({ body: text }) }); setText(''); refresh() } catch (e) { toast.error(e.message) }
  }
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Editors' Chat & Announcements</h1>
        <p className="text-muted-foreground">Common board for editorial office announcements and discussions. Visible to all editors.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[540px] overflow-auto p-4 space-y-2 bg-slate-50">
            {list.length === 0 ? <div className="text-center text-sm text-muted-foreground py-8">No messages yet. Start the conversation.</div>
            : list.map(a => (
              <div key={a.id} className={`p-3 rounded-md ${a.authorId === user.id ? 'bg-indigo-100 ml-16' : 'bg-white border mr-16'}`}>
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs font-semibold">{a.author?.firstName} {a.author?.lastName}
                    <span className="ml-2 font-normal text-muted-foreground">{ROLE_LABELS[a.author?.roles?.[0]?.role] || ''}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{a.body}</p>
              </div>
            ))}
          </div>
          <div className="p-3 border-t bg-white flex gap-2">
            <Input placeholder="Type an announcement or message..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post() } }} />
            <Button onClick={post} className="bg-indigo-600 hover:bg-indigo-700"><Send className="h-4 w-4 mr-1" /> Post</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============ INVITE REVIEWERS ============
function InviteReviewers() {
  const [invites, setInvites] = useState([])
  const [reviewers, setReviewers] = useState([])
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const refresh = () => {
    api('/reviewer-invitations').then(d => setInvites(d.invitations || [])).catch(() => {})
    api('/users?role=EXTERNAL_REVIEWER').then(d => setReviewers(d.users || [])).catch(() => {})
  }
  useEffect(() => { refresh() }, [])

  const send = async () => {
    if (!email || !email.includes('@')) return toast.error('Valid email required')
    setSending(true)
    try {
      await api('/reviewer-invitations', { method: 'POST', body: JSON.stringify({ email, fullName, specialty, message }) })
      toast.success('Invitation email sent')
      setEmail(''); setFullName(''); setSpecialty(''); setMessage('')
      refresh()
    } catch (e) { toast.error(e.message) } finally { setSending(false) }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invite peer reviewers</h1>
        <p className="text-muted-foreground">Send polite email invitations. Recipients register via the link and appear in the reviewer database.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>New invitation</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="grid md:grid-cols-3 gap-2">
            <Input placeholder="Full name (optional)" value={fullName} onChange={e => setFullName(e.target.value)} />
            <Input placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} />
            <Input placeholder="Specialty (e.g. Cardiology)" value={specialty} onChange={e => setSpecialty(e.target.value)} />
          </div>
          <Textarea placeholder="Optional personal message (added to the email)" rows={3} value={message} onChange={e => setMessage(e.target.value)} />
          <div className="flex justify-end">
            <Button onClick={send} disabled={sending} className="bg-indigo-600 hover:bg-indigo-700">
              {sending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Send invitation
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Registered reviewers ({reviewers.length})</CardTitle><CardDescription>Available for assignment</CardDescription></CardHeader>
          <CardContent className="max-h-96 overflow-auto">
            {reviewers.length === 0 ? <div className="text-sm text-muted-foreground">No reviewers yet</div>
            : reviewers.map(r => (
              <div key={r.id} className="py-2 border-b last:border-0">
                <div className="font-medium text-sm">{r.title || ''} {r.firstName} {r.lastName}</div>
                <div className="text-xs text-muted-foreground">{r.email}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.specialties?.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pending / sent invitations ({invites.length})</CardTitle></CardHeader>
          <CardContent className="max-h-96 overflow-auto">
            {invites.length === 0 ? <div className="text-sm text-muted-foreground">None sent yet</div>
            : invites.map(i => (
              <div key={i.id} className="py-2 border-b last:border-0">
                <div className="flex justify-between items-center">
                  <div className="text-sm font-medium">{i.fullName || i.email}</div>
                  <Badge variant={i.registeredUserId ? 'default' : 'outline'} className="text-[10px]">{i.registeredUserId ? 'Registered' : 'Pending'}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{i.email} · {i.specialty} · Invited {new Date(i.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============ TECHNICAL SCORING PANEL ============
function TechnicalScoringPanel({ abstractId, user }) {
  const [scores, setScores] = useState([])
  const [avg, setAvg] = useState(null)
  const [overall, setOverall] = useState(null)
  const [form, setForm] = useState({ originality: 7, methodology: 7, relevance: 7, language: 7, themeAlignment: 7, comments: '' })
  const refresh = () => api(`/abstracts/${abstractId}/scores`).then(d => { setScores(d.scores || []); setAvg(d.average); setOverall(d.overall) }).catch(() => {})
  useEffect(() => { refresh() }, [abstractId])

  const mine = scores.find(s => s.scorerId === user.id)
  useEffect(() => { if (mine) setForm({ originality: mine.originality, methodology: mine.methodology, relevance: mine.relevance, language: mine.language, themeAlignment: mine.themeAlignment, comments: mine.comments || '' }) }, [mine?.id])

  const save = async () => {
    try {
      await api(`/abstracts/${abstractId}/scores`, { method: 'POST', body: JSON.stringify(form) })
      toast.success('Technical score saved')
      refresh()
    } catch (e) { toast.error(e.message) }
  }

  const fields = [
    ['originality', 'Originality'],
    ['methodology', 'Methodology'],
    ['relevance', 'Relevance'],
    ['language', 'Language'],
    ['themeAlignment', 'Theme alignment'],
  ]

  return (
    <Card className="border-indigo-200">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-indigo-600" /> Technical review score</CardTitle>
            <CardDescription>Committee scoring on 5 dimensions (1–10 each). Shown after the first technical review to help prioritize.</CardDescription>
          </div>
          {overall !== null && (
            <div className="text-right">
              <div className="text-3xl font-bold text-indigo-600">{overall.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Overall average ({scores.length} scorer{scores.length !== 1 ? 's' : ''})</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {avg && (
          <div className="grid grid-cols-5 gap-2">
            {fields.map(([k, label]) => (
              <div key={k} className="p-2 rounded bg-slate-50 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                <div className="text-lg font-bold">{avg[k].toFixed(1)}/10</div>
              </div>
            ))}
          </div>
        )}

        <div className="border rounded-md p-3 bg-white">
          <div className="text-sm font-semibold mb-2">{mine ? 'Update your technical score' : 'Submit technical score'}</div>
          <div className="grid grid-cols-5 gap-2 mb-2">
            {fields.map(([k, label]) => (
              <div key={k}>
                <Label className="text-[10px]">{label} (1-10)</Label>
                <Input type="number" min={1} max={10} value={form[k]} onChange={e => setForm({ ...form, [k]: parseInt(e.target.value) || 1 })} />
              </div>
            ))}
          </div>
          <Textarea placeholder="Optional comments" rows={2} value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} />
          <Button className="mt-2 bg-indigo-600 hover:bg-indigo-700" size="sm" onClick={save}>Save score</Button>
        </div>

        {scores.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground">All scores</div>
            {scores.map(s => (
              <div key={s.id} className="text-xs border rounded p-2 flex justify-between">
                <span>{s.scorer?.firstName} {s.scorer?.lastName}</span>
                <span className="font-mono">O:{s.originality} M:{s.methodology} R:{s.relevance} L:{s.language} T:{s.themeAlignment}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============ FORGOT PASSWORD ============
function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try { await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); setSent(true) }
    catch (err) { toast.error(err.message) } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Enter your account email and we'll send a reset link.</CardDescription>
        </CardHeader>
        {sent ? (
          <CardContent className="space-y-3">
            <div className="p-3 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm">
              If <b>{email}</b> is registered, a password reset link has been sent. Check your inbox (and spam folder).
            </div>
            <Button onClick={onBack} className="w-full">Back to sign in</Button>
          </CardContent>
        ) : (
          <form onSubmit={submit}>
            <CardContent className="space-y-3">
              <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            </CardContent>
            <CardFooter className="flex-col gap-2 items-stretch">
              <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send reset link</Button>
              <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Back</button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}

function ResetPasswordPage({ token, onDone }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    setLoading(true)
    try { await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword: password }) }); toast.success('Password reset. Please sign in.'); onDone() }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader><CardTitle>Set a new password</CardTitle></CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-3">
            {error && <div className="p-3 rounded bg-red-50 border border-red-300 text-red-800 text-sm">{error}</div>}
            <div><Label>New password (min 6 chars)</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          </CardContent>
          <CardFooter><Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reset password</Button></CardFooter>
        </form>
      </Card>
    </div>
  )
}

// ============ EXHIBITION BOOTHS ============
function ExhibitionBoothsPublic({ conf }) {
  const [booths, setBooths] = useState([])
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => { if (conf?.id) fetch(`/api/conferences/${conf.id}/booths`).then(r => r.json()).then(d => setBooths(d.booths || [])) }, [conf?.id])
  useEffect(() => {
    if (booths.length < 2 || paused) return
    const t = setInterval(() => setIdx(v => (v + 1) % booths.length), 15000)
    return () => clearInterval(t)
  }, [booths.length, paused])

  if (booths.length === 0) return (
    <div className="container mx-auto px-6 py-16 text-center">
      <Building2 className="h-16 w-16 mx-auto text-slate-300 mb-3" />
      <div className="text-lg font-semibold text-slate-500">No exhibition booths yet</div>
      <div className="text-sm text-muted-foreground">Check back closer to the conference date to explore our sponsors and industry partners.</div>
    </div>
  )
  const b = booths[idx]

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50 min-h-screen">
      <div className="container mx-auto px-6 py-10 max-w-6xl">
        <div className="text-center mb-8">
          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 mb-2">SPONSORS & EXHIBITORS</Badge>
          <h1 className="text-4xl font-bold tracking-tight">Virtual Exhibition Hall</h1>
          <p className="text-muted-foreground mt-2">Meet the industry partners powering {conf?.name || 'this conference'}</p>
        </div>

        {/* Main rotating card */}
        <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <Card className="overflow-hidden shadow-2xl border-0 ring-1 ring-slate-200">
            <div className="relative">
              {b.bannerPath ? (
                <div className="w-full h-80 bg-slate-100 relative overflow-hidden">
                  <img src={b.bannerPath} alt={b.sponsorName} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                    <div className="flex items-end gap-4">
                      {b.logoPath && (
                        <div className="h-20 w-20 bg-white rounded-lg p-2 shadow-lg shrink-0">
                          <img src={b.logoPath} alt="" className="h-full w-full object-contain" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Badge className="bg-white/25 border-white/40 text-white backdrop-blur-sm mb-2">{b.companyType || 'Sponsor'}</Badge>
                        <h2 className="text-4xl font-bold drop-shadow-lg">{b.sponsorName}</h2>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-indigo-600 to-fuchsia-600 p-10 text-white">
                  <h2 className="text-4xl font-bold">{b.sponsorName}</h2>
                  {b.companyType && <div className="text-lg opacity-90 mt-1">{b.companyType}</div>}
                </div>
              )}
            </div>

            <CardContent className="p-8">
              <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-5">
                  {b.message && (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">About</div>
                      <p className="text-base leading-relaxed text-slate-700 whitespace-pre-wrap">{b.message}</p>
                    </div>
                  )}
                  {b.products && (
                    <div className="border-t pt-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">Products & Services</div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{b.products}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-50 border">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Get in touch</div>
                    <div className="space-y-2 text-sm">
                      {b.websiteUrl && (
                        <a href={b.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 hover:underline">
                          <Globe className="h-4 w-4 shrink-0" />
                          <span className="truncate">{b.websiteUrl.replace(/^https?:\/\//, '')}</span>
                        </a>
                      )}
                      {b.contactEmail && (
                        <a href={`mailto:${b.contactEmail}`} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 hover:underline">
                          <Mail className="h-4 w-4 shrink-0" />
                          <span className="truncate">{b.contactEmail}</span>
                        </a>
                      )}
                      {b.contactPhone && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h1.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.21l-2.26 1.13a11 11 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" /></svg>
                          <span>{b.contactPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {b.otherLinks && b.otherLinks.length > 0 && (
                    <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100">
                      <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3">Explore more</div>
                      <div className="space-y-1.5">
                        {b.otherLinks.map((l, i) => (
                          <a key={i} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-indigo-700 hover:text-indigo-900 hover:underline">
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            <span className="truncate">{l.label}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Nav arrows */}
          {booths.length > 1 && (
            <>
              <button onClick={() => setIdx((idx - 1 + booths.length) % booths.length)} className="absolute -left-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-50 border">
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>
              <button onClick={() => setIdx((idx + 1) % booths.length)} className="absolute -right-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-50 border">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Progress + thumbs */}
        <div className="mt-8">
          <div className="text-center text-xs text-muted-foreground mb-3">
            Booth {idx + 1} of {booths.length} · {paused ? 'Paused (hovering)' : 'Auto-rotates every 15 seconds'}
          </div>
          <div className="flex justify-center gap-2 flex-wrap">
            {booths.map((booth, i) => (
              <button key={i} onClick={() => setIdx(i)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${i === idx ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`}>
                <div className={`h-1.5 w-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-slate-400'}`} />
                <span className="font-medium">{booth.sponsorName}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function BoothAdmin() {
  const [confs, setConfs] = useState([])
  const [confId, setConfId] = useState('')
  const [booths, setBooths] = useState([])
  const [editing, setEditing] = useState(null)
  const refresh = () => confId && fetch(`/api/conferences/${confId}/booths`).then(r => r.json()).then(d => setBooths(d.booths || []))
  useEffect(() => { api('/conferences').then(d => { setConfs(d.conferences || []); if (d.conferences?.[0]) setConfId(d.conferences[0].id) }) }, [])
  useEffect(() => { refresh() }, [confId])

  const create = async () => {
    const name = prompt('Sponsor name?')
    if (!name) return
    try { await api(`/conferences/${confId}/booths`, { method: 'POST', body: JSON.stringify({ sponsorName: name }) }); refresh() } catch (e) { toast.error(e.message) }
  }
  const remove = async (id) => {
    if (!confirm('Delete this booth?')) return
    await api(`/booths/${id}`, { method: 'DELETE' }); refresh()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Exhibition Booths</h1>
          <p className="text-muted-foreground">Manage sponsor booths displayed publicly (rotating every 15 seconds).</p>
        </div>
        <Button onClick={create} disabled={!confId} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="h-4 w-4 mr-1" /> Add sponsor</Button>
      </div>
      <div className="mb-4">
        <Select value={confId} onValueChange={setConfId}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{confs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-3">
        {booths.length === 0 ? <EmptyState label="No booths yet" onAction={create} actionLabel="Add first booth" />
        : booths.map(b => (
          <Card key={b.id}>
            <CardContent className="p-4 flex gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-bold text-lg">{b.sponsorName}</div>
                  {b.companyType && <Badge variant="outline" className="text-[10px]">{b.companyType}</Badge>}
                </div>
                {b.message && <p className="text-sm text-muted-foreground line-clamp-2">{b.message}</p>}
                <div className="text-xs text-muted-foreground mt-1">
                  {b.bannerPath ? '🖼 Banner ✓' : '⚠ No banner'} · {b.logoPath ? 'Logo ✓' : 'No logo'} · Order: {b.displayOrder}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(b)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => remove(b.id)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {editing && <BoothEditDialog booth={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refresh() }} />}
    </div>
  )
}

function BoothEditDialog({ booth, onClose, onDone }) {
  const [form, setForm] = useState({
    sponsorName: booth.sponsorName || '', companyType: booth.companyType || '',
    products: booth.products || '', message: booth.message || '',
    websiteUrl: booth.websiteUrl || '', contactEmail: booth.contactEmail || '',
    contactPhone: booth.contactPhone || '', displayOrder: booth.displayOrder || 0,
  })
  const [uploading, setUploading] = useState(false)

  const save = async () => {
    try { await api(`/booths/${booth.id}`, { method: 'PUT', body: JSON.stringify(form) }); toast.success('Saved'); onDone() } catch (e) { toast.error(e.message) }
  }
  const uploadImage = async (kind, e) => {
    const f = e.target.files?.[0]; if (!f) return
    setUploading(true)
    try { const fd = new FormData(); fd.append('file', f); await apiUpload(`/booths/${booth.id}/${kind}`, fd); toast.success(`${kind} uploaded`); onDone() } catch (e) { toast.error(e.message) } finally { setUploading(false); e.target.value = '' }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Edit booth: {booth.sponsorName}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Sponsor name</Label><Input value={form.sponsorName} onChange={e => setForm({ ...form, sponsorName: e.target.value })} /></div>
            <div><Label>Company type</Label><Input value={form.companyType} onChange={e => setForm({ ...form, companyType: e.target.value })} placeholder="e.g. Pharmaceutical" /></div>
          </div>
          <div><Label>Message</Label><Textarea rows={3} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></div>
          <div><Label>Products / Services</Label><Textarea rows={3} value={form.products} onChange={e => setForm({ ...form, products: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Website</Label><Input value={form.websiteUrl} onChange={e => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://..." /></div>
            <div><Label>Email</Label><Input value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} /></div>
          </div>
          <div><Label>Display order</Label><Input type="number" value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Banner (5MB, wide)</Label>
              {booth.bannerPath && <img src={booth.bannerPath} className="w-full h-16 object-cover rounded border mb-1" />}
              <input type="file" accept="image/*" onChange={e => uploadImage('banner', e)} disabled={uploading} className="text-xs" />
            </div>
            <div>
              <Label>Logo (5MB, square)</Label>
              {booth.logoPath && <img src={booth.logoPath} className="w-16 h-16 object-contain rounded border mb-1" />}
              <input type="file" accept="image/*" onChange={e => uploadImage('logo', e)} disabled={uploading} className="text-xs" />
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} className="bg-indigo-600 hover:bg-indigo-700">Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ CONFERENCE BOOK ADMIN ============
function ConferenceBookAdmin() {
  const [confs, setConfs] = useState([])
  const [confId, setConfId] = useState('')
  const [book, setBook] = useState(null)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => { api('/conferences').then(d => { setConfs(d.conferences || []); if (d.conferences?.[0]) setConfId(d.conferences[0].id) }) }, [])
  useEffect(() => {
    if (!confId) return
    api(`/conferences/${confId}/book-config`).then(d => setBook(d.book)).catch(e => toast.error(e.message))
  }, [confId])

  if (!book) return <div className="p-8 text-center text-muted-foreground">Loading…</div>

  const update = (k, v) => setBook({ ...book, [k]: v })
  const toggleSection = (key) => {
    const sections = (book.sections || []).map(s => s.key === key ? { ...s, enabled: !s.enabled } : s)
    setBook({ ...book, sections })
  }
  const moveSection = (idx, dir) => {
    const sections = [...(book.sections || [])]
    const to = idx + dir
    if (to < 0 || to >= sections.length) return
    ;[sections[idx], sections[to]] = [sections[to], sections[idx]]
    setBook({ ...book, sections })
  }

  const save = async () => {
    setSaving(true)
    try {
      const patch = {
        coverTitle: book.coverTitle, coverSubtitle: book.coverSubtitle,
        chiefGuestName: book.chiefGuestName, chiefGuestTitle: book.chiefGuestTitle, chiefGuestMessage: book.chiefGuestMessage,
        chairName: book.chairName, chairTitle: book.chairTitle, chairMessage: book.chairMessage,
        foreword: book.foreword, acknowledgements: book.acknowledgements, sections: book.sections,
      }
      const d = await api(`/conferences/${confId}/book-config`, { method: 'PUT', body: JSON.stringify(patch) })
      setBook(d.book)
      toast.success('Saved')
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const generate = async () => {
    setDownloading(true)
    try {
      const token = getToken()
      const resp = await fetch(`/api/conferences/${confId}/book.pdf`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (!resp.ok) throw new Error(await resp.text() || 'Failed to generate PDF')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const conf = confs.find(c => c.id === confId)
      const a = document.createElement('a'); a.href = url; a.download = `${conf?.code || 'conference'}-book.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Conference book downloaded')
    } catch (e) { toast.error(e.message || 'Failed') } finally { setDownloading(false) }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><BookOpen className="h-7 w-7 text-indigo-600" /> Conference Book</h1>
          <p className="text-muted-foreground">Configure sections and generate the official conference book PDF (cover, messages, programme, abstracts, sponsors).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
          <Button onClick={generate} disabled={downloading} className="bg-indigo-600 hover:bg-indigo-700">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />} Generate PDF
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Label>Conference</Label>
        <Select value={confId} onValueChange={setConfId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{confs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Section order */}
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-base">Sections</CardTitle><CardDescription>Enable, disable and reorder</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {(book.sections || []).map((s, i) => (
              <div key={s.key} className="flex items-center gap-2 p-2 border rounded">
                <div className="flex flex-col">
                  <button onClick={() => moveSection(i, -1)} className="text-xs text-slate-400 hover:text-slate-700" disabled={i === 0}>▲</button>
                  <button onClick={() => moveSection(i, 1)} className="text-xs text-slate-400 hover:text-slate-700" disabled={i === book.sections.length - 1}>▼</button>
                </div>
                <div className="flex-1 text-sm">{s.label}</div>
                <input type="checkbox" checked={!!s.enabled} onChange={() => toggleSection(s.key)} className="h-4 w-4" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Content */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Cover</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div><Label>Cover title</Label><Input value={book.coverTitle || ''} onChange={e => update('coverTitle', e.target.value)} placeholder="Overrides conference name on the cover" /></div>
              <div><Label>Cover subtitle</Label><Input value={book.coverSubtitle || ''} onChange={e => update('coverSubtitle', e.target.value)} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Chief Guest</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Name</Label><Input value={book.chiefGuestName || ''} onChange={e => update('chiefGuestName', e.target.value)} placeholder="e.g. Prof. Jane Doe" /></div>
                <div><Label>Title / Designation</Label><Input value={book.chiefGuestTitle || ''} onChange={e => update('chiefGuestTitle', e.target.value)} placeholder="e.g. President, World Medical Society" /></div>
              </div>
              <div><Label>Message</Label><Textarea rows={5} value={book.chiefGuestMessage || ''} onChange={e => update('chiefGuestMessage', e.target.value)} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Conference Chair</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Name</Label><Input value={book.chairName || ''} onChange={e => update('chairName', e.target.value)} /></div>
                <div><Label>Title</Label><Input value={book.chairTitle || ''} onChange={e => update('chairTitle', e.target.value)} /></div>
              </div>
              <div><Label>Message</Label><Textarea rows={5} value={book.chairMessage || ''} onChange={e => update('chairMessage', e.target.value)} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Foreword & Acknowledgements</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div><Label>Foreword</Label><Textarea rows={4} value={book.foreword || ''} onChange={e => update('foreword', e.target.value)} /></div>
              <div><Label>Acknowledgements</Label><Textarea rows={4} value={book.acknowledgements || ''} onChange={e => update('acknowledgements', e.target.value)} /></div>
            </CardContent>
          </Card>
          <Card className="bg-indigo-50/50">
            <CardContent className="p-4 text-sm">
              <div className="font-semibold mb-1">Auto-populated sections</div>
              <div className="text-muted-foreground">The following sections are compiled automatically when you generate the PDF:</div>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
                <li><b>Conference Programme</b> — from scheduled sessions and items</li>
                <li><b>Accepted Abstracts</b> — all abstracts in ACCEPTED / ORAL / POSTER / FINAL_ACCEPTANCE / PUBLISHED states</li>
                <li><b>Sponsors & Exhibitors</b> — from Exhibition Booths (active booths only)</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ============ SURVEY ADMIN ============
function SurveyAdmin() {
  const [confs, setConfs] = useState([])
  const [confId, setConfId] = useState('')
  const [surveys, setSurveys] = useState([])
  const [editing, setEditing] = useState(null)
  const [viewingAnalytics, setViewingAnalytics] = useState(null)
  const [sendingId, setSendingId] = useState(null)
  const [sendResult, setSendResult] = useState(null)

  const refresh = () => confId && api(`/conferences/${confId}/surveys`).then(d => setSurveys(d.surveys || []))
  useEffect(() => { api('/conferences').then(d => { setConfs(d.conferences || []); if (d.conferences?.[0]) setConfId(d.conferences[0].id) }) }, [])
  useEffect(() => { refresh() }, [confId])

  const create = () => setEditing({ isNew: true, title: '', description: '', dayNumber: null, questions: [] })
  const remove = async (id) => {
    if (!confirm('Delete this survey? All responses will be lost.')) return
    try { await api(`/surveys/${id}`, { method: 'DELETE' }); refresh(); toast.success('Deleted') } catch (e) { toast.error(e.message) }
  }
  const send = async (survey) => {
    if (!confirm(`Send "${survey.title}" to all registered delegates?`)) return
    setSendingId(survey.id)
    setSendResult(null)
    try {
      const d = await api(`/surveys/${survey.id}/send`, { method: 'POST' })
      setSendResult({ survey, ...d })
      refresh()
    } catch (e) { toast.error(e.message || 'Send failed') } finally { setSendingId(null) }
  }
  const sendTest = async (survey) => {
    setSendingId(survey.id + ':test')
    try {
      const d = await api(`/surveys/${survey.id}/send-test`, { method: 'POST' })
      toast.success(`Test email sent to ${d.email}. Preview link: ${d.previewLink ? 'included' : 'included'}`)
    } catch (e) { toast.error(e.message || 'Test send failed') } finally { setSendingId(null) }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><ListChecks className="h-7 w-7 text-indigo-600" /> Feedback Surveys</h1>
          <p className="text-muted-foreground">Create daily feedback surveys (up to 10 questions) and email them to delegates.</p>
        </div>
        <Button onClick={create} disabled={!confId} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="h-4 w-4 mr-1" /> New survey</Button>
      </div>

      <div className="mb-4">
        <Select value={confId} onValueChange={setConfId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{confs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {surveys.length === 0 ? <EmptyState label="No surveys yet" onAction={create} actionLabel="Create first survey" />
        : surveys.map(s => (
          <Card key={s.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-bold text-lg">{s.title}</div>
                  {s.dayNumber ? <Badge variant="outline">Day {s.dayNumber}</Badge> : null}
                  {s.isPublished ? <Badge className="bg-green-600">Published</Badge> : <Badge variant="secondary">Draft</Badge>}
                </div>
                {s.description && <p className="text-sm text-muted-foreground line-clamp-1">{s.description}</p>}
                <div className="text-xs text-muted-foreground mt-1">
                  {s.questions?.length || 0} questions · {s.submittedCount || 0} responses received{s.sentAt ? ` · Last sent ${new Date(s.sentAt).toLocaleDateString()}` : ''}
                </div>
              </div>
              <div className="flex flex-col gap-1 w-40">
                <Button size="sm" variant="outline" onClick={() => setEditing(s)}>Edit</Button>
                <Button size="sm" variant="outline" onClick={() => setViewingAnalytics(s)}><BarChart3 className="h-3 w-3 mr-1" />Results</Button>
                <Button size="sm" variant="outline" onClick={() => sendTest(s)} disabled={sendingId === s.id + ':test'}>
                  {sendingId === s.id + ':test' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Mail className="h-3 w-3 mr-1" />}Send test
                </Button>
                <Button size="sm" onClick={() => send(s)} disabled={sendingId === s.id} className="bg-indigo-600 hover:bg-indigo-700">
                  {sendingId === s.id ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Sending…</> : <><Send className="h-3 w-3 mr-1" />Send to all</>}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => remove(s.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && <SurveyEditDialog conferenceId={confId} survey={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refresh() }} />}
      {viewingAnalytics && <SurveyAnalyticsDialog survey={viewingAnalytics} onClose={() => setViewingAnalytics(null)} />}
      {sendResult && (
        <Dialog open onOpenChange={() => setSendResult(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Survey dispatch complete</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-slate-600">Survey: <b>{sendResult.survey.title}</b></div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-3 bg-slate-50 rounded"><div className="text-2xl font-bold">{sendResult.total}</div><div className="text-[10px] text-muted-foreground">Delegates</div></div>
                <div className="p-3 bg-indigo-50 rounded"><div className="text-2xl font-bold text-indigo-600">{sendResult.created}</div><div className="text-[10px] text-muted-foreground">New tokens</div></div>
                <div className="p-3 bg-green-50 rounded"><div className="text-2xl font-bold text-green-600">{sendResult.sent}</div><div className="text-[10px] text-muted-foreground">Sent</div></div>
                <div className="p-3 bg-red-50 rounded"><div className="text-2xl font-bold text-red-600">{sendResult.failed}</div><div className="text-[10px] text-muted-foreground">Failed</div></div>
              </div>
              {sendResult.total === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  No delegates are registered for this conference yet. Please invite users to register before sending the survey.
                </div>
              )}
              {sendResult.failed > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                  <b>{sendResult.failed}</b> email(s) failed to deliver. Common causes: invalid email address, recipient's mailbox full, or Resend API restrictions. Check server logs.
                </div>
              )}
            </div>
            <DialogFooter><Button onClick={() => setSendResult(null)}>Done</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function SurveyEditDialog({ conferenceId, survey, onClose, onDone }) {
  const [form, setForm] = useState({
    title: survey.title || '',
    description: survey.description || '',
    dayNumber: survey.dayNumber || '',
    questions: survey.questions || [],
  })
  const [saving, setSaving] = useState(false)

  const addQ = (type) => {
    if (form.questions.length >= 10) { toast.error('Maximum 10 questions'); return }
    const id = `q${Date.now()}${Math.floor(Math.random() * 1000)}`
    const base = { id, type, label: '' }
    const q = type === 'MCQ' ? { ...base, options: ['Option 1', 'Option 2'] } : type === 'RATING' ? { ...base, scale: 5 } : base
    setForm({ ...form, questions: [...form.questions, q] })
  }
  const updateQ = (i, patch) => {
    const q = [...form.questions]; q[i] = { ...q[i], ...patch }; setForm({ ...form, questions: q })
  }
  const removeQ = (i) => { const q = form.questions.filter((_, j) => j !== i); setForm({ ...form, questions: q }) }
  const moveQ = (i, dir) => {
    const q = [...form.questions]; const to = i + dir; if (to < 0 || to >= q.length) return
    ;[q[i], q[to]] = [q[to], q[i]]; setForm({ ...form, questions: q })
  }

  const save = async () => {
    if (!form.title) { toast.error('Title required'); return }
    if (form.questions.length === 0) { toast.error('At least one question required'); return }
    if (form.questions.some(q => !q.label)) { toast.error('Every question needs a label'); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title, description: form.description || null,
        dayNumber: form.dayNumber ? parseInt(form.dayNumber) : null,
        questions: form.questions,
      }
      if (survey.isNew) await api(`/conferences/${conferenceId}/surveys`, { method: 'POST', body: JSON.stringify(payload) })
      else await api(`/surveys/${survey.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      toast.success('Saved'); onDone()
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>{survey.isNew ? 'New Survey' : 'Edit Survey'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Day 1 Feedback" /></div>
            <div><Label>Day number (optional)</Label><Input type="number" min="1" value={form.dayNumber} onChange={e => setForm({ ...form, dayNumber: e.target.value })} /></div>
          </div>
          <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional intro shown in the email and on the survey page" /></div>

          <div className="border-t pt-3">
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold">Questions <span className="text-xs text-muted-foreground">({form.questions.length}/10)</span></div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => addQ('RATING')} disabled={form.questions.length >= 10}>+ Rating</Button>
                <Button size="sm" variant="outline" onClick={() => addQ('MCQ')} disabled={form.questions.length >= 10}>+ Multiple choice</Button>
                <Button size="sm" variant="outline" onClick={() => addQ('YESNO')} disabled={form.questions.length >= 10}>+ Yes/No</Button>
                <Button size="sm" variant="outline" onClick={() => addQ('TEXT')} disabled={form.questions.length >= 10}>+ Text</Button>
              </div>
            </div>
            {form.questions.length === 0 && <div className="text-sm text-muted-foreground p-4 text-center border-dashed border rounded">Add up to 10 questions.</div>}
            <div className="space-y-2">
              {form.questions.map((q, i) => (
                <div key={q.id} className="border rounded p-3 space-y-2 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-slate-500 w-6">{i + 1}.</div>
                    <Badge variant="outline" className="text-[10px]">{q.type}</Badge>
                    <Input className="flex-1" value={q.label} onChange={e => updateQ(i, { label: e.target.value })} placeholder="Question text" />
                    <button onClick={() => moveQ(i, -1)} className="text-slate-400 hover:text-slate-700 px-1" disabled={i === 0}>▲</button>
                    <button onClick={() => moveQ(i, 1)} className="text-slate-400 hover:text-slate-700 px-1" disabled={i === form.questions.length - 1}>▼</button>
                    <Button size="sm" variant="ghost" onClick={() => removeQ(i)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                  {q.type === 'RATING' && (
                    <div className="pl-8"><Label className="text-xs">Scale</Label>
                      <Select value={String(q.scale || 5)} onValueChange={v => updateQ(i, { scale: parseInt(v) })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">1 – 5</SelectItem>
                          <SelectItem value="10">1 – 10</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {q.type === 'MCQ' && (
                    <div className="pl-8 space-y-1">
                      <Label className="text-xs">Options (one per line)</Label>
                      <Textarea rows={3} value={(q.options || []).join('\n')} onChange={e => updateQ(i, { options: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SurveyAnalyticsDialog({ survey, onClose }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    api(`/surveys/${survey.id}/analytics`).then(setData).catch(e => toast.error(e.message))
  }, [survey.id])

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Results — {survey.title}</DialogTitle></DialogHeader>
        {!data ? <div className="p-6 text-center"><Loader2 className="animate-spin inline" /></div> : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Invited</div><div className="text-2xl font-bold">{data.totals.invited}</div></CardContent></Card>
              <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Submitted</div><div className="text-2xl font-bold">{data.totals.submitted}</div></CardContent></Card>
              <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Response rate</div><div className="text-2xl font-bold">{Math.round(data.totals.responseRate * 100)}%</div></CardContent></Card>
            </div>
            {data.perQuestion.map((q, i) => (
              <Card key={q.questionId}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Q{i + 1} · {q.type} · {q.count} answers</div>
                      <div className="font-semibold">{q.label}</div>
                    </div>
                    {q.type === 'RATING' && <Badge className="bg-indigo-600"><Star className="h-3 w-3 mr-1" />{q.average.toFixed(2)}</Badge>}
                  </div>
                  {q.type === 'RATING' || q.type === 'MCQ' || q.type === 'YESNO' ? (
                    <div className="space-y-1">
                      {Object.entries(q.distribution || {}).map(([k, v]) => {
                        const pct = q.count > 0 ? (v / q.count * 100) : 0
                        return (
                          <div key={k} className="flex items-center gap-2">
                            <div className="w-24 text-xs text-slate-600 truncate">{k}</div>
                            <div className="flex-1 bg-slate-100 rounded h-4 relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-indigo-500" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="w-16 text-xs text-slate-600 text-right">{v} ({Math.round(pct)}%)</div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-auto">
                      {(q.textResponses || []).length === 0 && <div className="text-xs text-muted-foreground italic">No text responses</div>}
                      {(q.textResponses || []).map((t, j) => <div key={j} className="text-sm bg-slate-50 p-2 rounded border-l-2 border-indigo-400">{t}</div>)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ PUBLIC SURVEY PAGE ============
function PublicSurveyPage({ token, onDone }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/public/survey-response/${token}`).then(r => r.json()).then(d => {
      if (d.error) setError(d.error)
      else {
        setData(d)
        if (d.response.submittedAt) { setDone(true); setAnswers(d.response.answers || {}) }
      }
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [token])

  const submit = async () => {
    if (!data) return
    // Validate required
    const missing = data.survey.questions.find(q => (answers[q.id] === undefined || answers[q.id] === ''))
    if (missing) { toast.error(`Please answer: "${missing.label}"`); return }
    setSubmitting(true)
    try {
      const resp = await fetch(`/api/public/survey-response/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const j = await resp.json()
      if (!resp.ok) throw new Error(j.error || 'Failed')
      setDone(true)
      toast.success('Thank you for your feedback!')
    } catch (e) { toast.error(e.message) } finally { setSubmitting(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>
  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="max-w-md"><CardContent className="p-8 text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <div className="text-xl font-bold mb-2">Invalid link</div>
        <div className="text-muted-foreground">{error}</div>
        <Button className="mt-4" onClick={onDone}>Go home</Button>
      </CardContent></Card>
    </div>
  )
  const { survey } = data

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white rounded-t-lg">
            <div className="text-xs opacity-90">{survey.conference?.name} · {survey.conference?.code}</div>
            <CardTitle className="text-2xl">{survey.title}</CardTitle>
            {survey.dayNumber ? <Badge className="bg-white/20 border-white/30 text-white w-fit">Day {survey.dayNumber}</Badge> : null}
            {survey.description && <CardDescription className="text-white/90 mt-2">{survey.description}</CardDescription>}
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {done ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
                <div className="text-2xl font-bold mb-1">Thank you!</div>
                <div className="text-muted-foreground">Your feedback has been recorded.</div>
                <Button className="mt-4" onClick={onDone}>Return to home</Button>
              </div>
            ) : (
              <>
                {survey.questions.map((q, i) => (
                  <div key={q.id} className="space-y-2">
                    <Label className="text-base"><span className="font-bold text-indigo-600">Q{i + 1}.</span> {q.label}</Label>
                    {q.type === 'RATING' && (
                      <div className="flex gap-1">
                        {[...Array(q.scale || 5).keys()].map(n => (
                          <button key={n} type="button" onClick={() => setAnswers({ ...answers, [q.id]: n + 1 })}
                            className={`w-10 h-10 rounded-lg border font-bold transition ${answers[q.id] === n + 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-indigo-50 border-slate-200'}`}>
                            {n + 1}
                          </button>
                        ))}
                      </div>
                    )}
                    {q.type === 'MCQ' && (
                      <div className="space-y-1">
                        {(q.options || []).map(o => (
                          <label key={o} className="flex items-center gap-2 p-2 border rounded hover:bg-slate-50 cursor-pointer">
                            <input type="radio" name={q.id} checked={answers[q.id] === o} onChange={() => setAnswers({ ...answers, [q.id]: o })} />
                            <span>{o}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {q.type === 'YESNO' && (
                      <div className="flex gap-2">
                        {['Yes', 'No'].map(v => (
                          <button key={v} type="button" onClick={() => setAnswers({ ...answers, [q.id]: v })}
                            className={`flex-1 py-2 rounded border font-medium ${answers[q.id] === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-indigo-50 border-slate-200'}`}>
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                    {q.type === 'TEXT' && (
                      <Textarea rows={3} value={answers[q.id] || ''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder="Your answer..." />
                    )}
                  </div>
                ))}
                <Button onClick={submit} disabled={submitting} className="w-full bg-indigo-600 hover:bg-indigo-700">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Submit feedback
                </Button>
                <div className="text-xs text-center text-muted-foreground">Your responses are anonymous and used only for internal analysis.</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============ PROGRAMME ADMIN ============
function ProgrammeAdmin() {
  const [confs, setConfs] = useState([])
  const [confId, setConfId] = useState('')
  const [sessions, setSessions] = useState([])
  const [acceptedAbstracts, setAcceptedAbstracts] = useState([])
  const [editing, setEditing] = useState(null)
  const [addingToSession, setAddingToSession] = useState(null)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    if (!confId) return
    setLoading(true)
    try {
      const d = await api(`/programme/${confId}`)
      setSessions(d.sessions || [])
      // Load abstracts eligible for scheduling
      const ab = await api(`/abstracts?state=ACCEPTED,PROGRAMME_SCHEDULING,ORAL,POSTER,FINAL_ACCEPTANCE,PUBLISHED`)
      setAcceptedAbstracts((ab.abstracts || []).filter(a => a.conferenceId === confId))
    } finally { setLoading(false) }
  }
  useEffect(() => { api('/conferences').then(d => { setConfs(d.conferences || []); if (d.conferences?.[0]) setConfId(d.conferences[0].id) }) }, [])
  useEffect(() => { refresh() }, [confId])

  const createSession = () => setEditing({ isNew: true, title: '', room: '', chair: '', startTime: '', endTime: '' })

  const deleteSession = async (id) => {
    if (!confirm('Delete this session and all its items?')) return
    try { await api(`/sessions/${id}`, { method: 'DELETE' }); refresh(); toast.success('Session deleted') } catch (e) { toast.error(e.message) }
  }
  const removeItem = async (id) => {
    try { await api(`/programme-items/${id}`, { method: 'DELETE' }); refresh() } catch (e) { toast.error(e.message) }
  }

  // Scheduled abstract ids
  const scheduledIds = new Set()
  sessions.forEach(s => (s.items || []).forEach(i => scheduledIds.add(i.abstract.id)))
  const unscheduled = acceptedAbstracts.filter(a => !scheduledIds.has(a.id))

  // Group by day
  const dayGroups = {}
  sessions.forEach(s => {
    const key = new Date(s.startTime).toISOString().slice(0, 10)
    if (!dayGroups[key]) dayGroups[key] = { date: new Date(s.startTime), items: [] }
    dayGroups[key].items.push(s)
  })
  const days = Object.entries(dayGroups).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Calendar className="h-7 w-7 text-indigo-600" /> Programme Admin</h1>
          <p className="text-muted-foreground">Design the conference schedule. Create sessions and add abstracts to build the daily programme.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={confId} onValueChange={setConfId}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{confs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={createSession} disabled={!confId} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="h-4 w-4 mr-1" /> New session</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-6">
          {loading && <div className="text-center py-6"><Loader2 className="animate-spin inline" /></div>}
          {!loading && sessions.length === 0 && <EmptyState label="No sessions scheduled yet" onAction={createSession} actionLabel="Create first session" />}
          {days.map(([key, g]) => (
            <div key={key}>
              <div className="mb-2 pb-1 border-b border-indigo-200 flex items-baseline gap-3">
                <h2 className="text-lg font-bold text-indigo-700">{g.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                <span className="text-xs text-muted-foreground">{g.items.length} sessions</span>
              </div>
              <div className="space-y-3">
                {g.items.map(s => (
                  <Card key={s.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-bold">{s.title}</div>
                            <Badge variant="outline" className="text-[10px]">{s.items?.length || 0} items</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {s.room && ` · ${s.room}`}{s.chair && ` · Chair: ${s.chair}`}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setEditing(s)}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => setAddingToSession(s)}><Plus className="h-3 w-3" /></Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteSession(s.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      {(s.items || []).length > 0 && (
                        <div className="space-y-1 mt-2 border-t pt-2">
                          {s.items.map((i, idx) => (
                            <div key={i.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-slate-50 group">
                              <span className="text-xs text-slate-400 w-6">{idx + 1}.</span>
                              <span className="text-xs text-muted-foreground w-14">{i.durationMin || 15}m</span>
                              <div className="flex-1">
                                <div className="text-sm">{i.abstract.title} <span className="text-xs text-muted-foreground">({i.abstract.submissionCode})</span></div>
                                <div className="text-[10px] text-muted-foreground">{(i.abstract.authors || []).map(a => a.fullName).join(', ')}</div>
                              </div>
                              <button onClick={() => removeItem(i.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader><CardTitle className="text-base">Unscheduled abstracts</CardTitle><CardDescription>{unscheduled.length} accepted, not yet in programme</CardDescription></CardHeader>
            <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
              {unscheduled.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">All accepted abstracts scheduled</div>}
              {unscheduled.map(a => (
                <div key={a.id} className="border rounded p-2 hover:bg-slate-50">
                  <div className="text-xs font-medium">{a.submissionCode}</div>
                  <div className="text-sm line-clamp-2">{a.title}</div>
                  <Badge variant="outline" className="text-[10px] mt-1">{a.currentState}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {editing && <SessionEditDialog conferenceId={confId} session={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refresh() }} />}
      {addingToSession && <AddItemDialog session={addingToSession} abstracts={unscheduled} onClose={() => setAddingToSession(null)} onDone={() => { setAddingToSession(null); refresh() }} />}
    </div>
  )
}

function SessionEditDialog({ conferenceId, session, onClose, onDone }) {
  const toLocal = (d) => d ? new Date(d).toISOString().slice(0, 16) : ''
  const [form, setForm] = useState({
    title: session.title || '', room: session.room || '', chair: session.chair || '',
    startTime: toLocal(session.startTime), endTime: toLocal(session.endTime),
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.title) { toast.error('Title required'); return }
    if (!form.startTime || !form.endTime) { toast.error('Start and end time required'); return }
    if (new Date(form.endTime) <= new Date(form.startTime)) { toast.error('End must be after start'); return }
    setSaving(true)
    try {
      if (session.isNew) {
        await api('/sessions', { method: 'POST', body: JSON.stringify({ conferenceId, ...form }) })
      } else {
        await api(`/sessions/${session.id}`, { method: 'PUT', body: JSON.stringify(form) })
      }
      toast.success('Saved'); onDone()
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{session.isNew ? 'New session' : 'Edit session'}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div><Label>Title <span className="text-red-500">*</span></Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Opening Ceremony, Session 1A: Cardiology" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Start <span className="text-red-500">*</span></Label><Input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><Label>End <span className="text-red-500">*</span></Label><Input type="datetime-local" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Room / Hall</Label><Input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="Hall A" /></div>
            <div><Label>Chair</Label><Input value={form.chair} onChange={e => setForm({ ...form, chair: e.target.value })} placeholder="Prof. Doe" /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddItemDialog({ session, abstracts, onClose, onDone }) {
  const [selected, setSelected] = useState([])
  const [duration, setDuration] = useState(15)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = abstracts.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.submissionCode.toLowerCase().includes(search.toLowerCase())
  )
  const toggle = (id) => setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  const save = async () => {
    if (selected.length === 0) { toast.error('Select at least one abstract'); return }
    setSaving(true)
    try {
      for (const abstractId of selected) {
        await api(`/sessions/${session.id}/items`, { method: 'POST', body: JSON.stringify({ abstractId, durationMin: parseInt(duration) || 15 }) })
      }
      toast.success(`Added ${selected.length} to programme`); onDone()
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Add to "{session.title}"</DialogTitle><DialogDescription>Select accepted abstracts to schedule in this session</DialogDescription></DialogHeader>
        <div className="flex-1 overflow-hidden flex flex-col space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Search by title or code..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
            <div className="flex items-center gap-1"><Label className="text-xs whitespace-nowrap">Duration</Label><Input type="number" min="5" value={duration} onChange={e => setDuration(e.target.value)} className="w-20" /><span className="text-xs">min</span></div>
          </div>
          <div className="flex-1 overflow-y-auto border rounded space-y-1 p-2 min-h-[200px]">
            {filtered.length === 0 && <div className="text-center text-xs text-muted-foreground py-4">No unscheduled abstracts match</div>}
            {filtered.map(a => (
              <label key={a.id} className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${selected.includes(a.id) ? 'bg-indigo-50 border-indigo-300' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="mt-1" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-indigo-600">{a.submissionCode} <Badge variant="outline" className="text-[9px] ml-1">{a.currentState}</Badge></div>
                  <div className="text-sm">{a.title}</div>
                  <div className="text-[10px] text-muted-foreground">{(a.authors || []).map(au => au.fullName).slice(0, 3).join(', ')}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">{selected.length} selected</div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving || selected.length === 0} className="bg-indigo-600 hover:bg-indigo-700">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Add {selected.length} to programme</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ EDITOR WORKSPACE ============
function EditorWorkspace({ setRoute, user }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  useEffect(() => {
    api('/abstracts?scope=assigned').then(d => setList(d.abstracts || [])).catch(e => toast.error(e.message)).finally(() => setLoading(false))
  }, [])

  const activeStates = ['UNDER_REVIEW', 'PEER_REVIEW', 'EDITORIAL_DECISION', 'AWAITING_DECISION', 'ASSIGNED', 'REVIEW_IN_PROGRESS', 'MINOR_REVISION', 'MAJOR_REVISION', 'AWAITING_REVISION', 'RESUBMITTED', 'PROGRAMME_SCHEDULING']
  const doneStates = ['ACCEPTED', 'FINAL_ACCEPTANCE', 'ORAL', 'POSTER', 'REJECTED', 'PUBLISHED', 'WITHDRAWN']
  const visible = list.filter(a => filter === 'all' || (filter === 'active' && activeStates.includes(a.currentState)) || (filter === 'done' && doneStates.includes(a.currentState)))
  const counts = { active: list.filter(a => activeStates.includes(a.currentState)).length, done: list.filter(a => doneStates.includes(a.currentState)).length, all: list.length }

  const groups = { }
  visible.forEach(a => { const s = a.currentState; if (!groups[s]) groups[s] = []; groups[s].push(a) })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Briefcase className="h-7 w-7 text-indigo-600" /> My Editor Workspace</h1>
        <p className="text-muted-foreground">All abstracts assigned to you — {list.length} paper{list.length !== 1 ? 's' : ''} total. Click any card to open the per-abstract workspace with review, reviewer, correspondence and document tabs.</p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Button variant={filter === 'active' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('active')} className={filter === 'active' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>
          Active <Badge variant="secondary" className="ml-1">{counts.active}</Badge>
        </Button>
        <Button variant={filter === 'done' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('done')} className={filter === 'done' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>
          Decided <Badge variant="secondary" className="ml-1">{counts.done}</Badge>
        </Button>
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')} className={filter === 'all' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>
          All <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
        </Button>
      </div>

      {loading ? <div className="p-8 text-center"><Loader2 className="animate-spin inline" /></div> : (
        list.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">
              <Briefcase className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <div className="text-lg font-semibold text-slate-500">No abstracts assigned yet</div>
              <div className="text-sm text-muted-foreground mt-1">The Managing Editor will assign abstracts to your queue. Once assigned, they appear here for full editorial handling.</div>
              <Button className="mt-4" variant="outline" onClick={() => setRoute({ name: 'editorial' })}>View Editorial Office</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).map(([state, abs]) => (
              <div key={state}>
                <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-200">
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">{stateLabel(state)}</Badge>
                  <span className="text-xs text-muted-foreground">{abs.length} paper{abs.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid gap-3">
                  {abs.map(a => (
                    <Card key={a.id} className="hover:shadow-md hover:border-indigo-300 transition cursor-pointer" onClick={() => setRoute({ name: 'abstract', id: a.id })}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {a.submissionCode?.split('-').pop() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-indigo-600">{a.submissionCode}</div>
                          <div className="font-semibold truncate">{a.title}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                            {a.theme?.name && <Badge variant="outline" className="text-[10px]">{a.theme.name}</Badge>}
                            {a.reportType && <Badge variant="outline" className="text-[10px]">{a.reportType.replace(/_/g, ' ')}</Badge>}
                            <span>Reviewers: {a.reviewAssignments?.length || 0}</span>
                            <span>·</span>
                            <span>Submitted {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : 'draft'}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ============ LIVE CONFERENCE PAGE ============
function LiveConferencePage({ user }) {
  const [confs, setConfs] = useState([])
  const [confId, setConfId] = useState('')
  useEffect(() => { api('/conferences').then(d => { const list = d.conferences || []; setConfs(list); const featured = list.find(c => c.isFeatured) || list[0]; if (featured) setConfId(featured.id) }) }, [])
  const conf = confs.find(c => c.id === confId)
  const isAdmin = user?.roles?.some(r => ['SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR'].includes(r))

  if (!conf) return <div className="p-8 text-center text-muted-foreground">Loading…</div>

  return (
    <div>
      <div className="border-b bg-white/95 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
        <Radio className="h-5 w-5 text-red-600" />
        <div className="font-semibold">Live Conference Portal</div>
        <Select value={confId} onValueChange={setConfId}>
          <SelectTrigger className="w-64 ml-auto"><SelectValue /></SelectTrigger>
          <SelectContent>{confs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <LiveConference conf={conf} isAdmin={isAdmin} fallback={<ExhibitionBoothsPublic conf={conf} />} />
    </div>
  )
}

export default App

