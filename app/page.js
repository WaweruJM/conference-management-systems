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
import { ROLE_LABELS, STATE_COLORS, stateLabel, TIMELINE_STAGES, formatDate, formatDateRange } from '@/lib/scms-utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Loader2, LogOut, Bell, FileText, Users, Calendar, LayoutDashboard, Upload, MessageSquare,
  ClipboardCheck, ChevronRight, CheckCircle2, XCircle, Clock, AlertCircle, Sparkles,
  Building2, Globe, GraduationCap, ShieldCheck, Download, Plus, Send, Search, FileUp, Award,
  BookOpen, ListChecks, BarChart3, Star, Trash2, Mail, Radio, Video, Briefcase, Presentation, RefreshCw, X,
} from 'lucide-react'
import dynamic from 'next/dynamic'
const LiveConference = dynamic(() => import('@/components/LiveConference'), { ssr: false, loading: () => <div className="p-8 text-center"><Loader2 className="animate-spin inline" /></div> })
const MergedPresentationViewer = dynamic(() => import('@/components/MergedPresentationViewer'), { ssr: false, loading: () => <div className="p-8 text-center"><Loader2 className="animate-spin inline" /></div> })

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
// High resolution (>=1920 wide), professionally lit medical/scientific conference photos.
const DEFAULT_HERO_IMAGES = [
  'https://images.unsplash.com/photo-1778876088510-15c5099de4d2?fm=jpg&q=75&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?fm=jpg&q=75&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1606761568499-6d2451b23c66?fm=jpg&q=75&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1594122230689-45899d9e6f69?fm=jpg&q=75&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?fm=jpg&q=75&w=1920&auto=format&fit=crop',
]

const WORD_LIMIT = 300
const TITLE_WORD_LIMIT = 20
const MAX_DOC_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_DOC_EXTS = ['.doc', '.docx']

const countWords = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length

// Rotating hero carousel — uses object-cover with a slight upward bias (center 35%)
// so faces / subjects sit comfortably below the fixed header. High-quality images
// should be at least 1920x1000 for best results.
function HeroCarousel({ images, height = 'h-[420px]' }) {
  const imgs = (images && images.length) ? images.map(p => p.startsWith('/api/') ? p : p) : DEFAULT_HERO_IMAGES
  const [idx, setIdx] = useState(0)
  useEffect(() => { const i = setInterval(() => setIdx(v => (v + 1) % imgs.length), 5000); return () => clearInterval(i) }, [imgs.length])
  return (
    <div className={`relative w-full ${height} overflow-hidden bg-slate-900`}>
      {imgs.map((src, i) => (
        <div key={i} className={`absolute inset-0 transition-opacity duration-1000 ${i === idx ? 'opacity-100' : 'opacity-0'}`}>
          <img
            src={src}
            alt=""
            loading="eager"
            decoding="async"
            style={{ objectPosition: 'center 35%', imageRendering: 'auto' }}
            className="w-full h-full object-cover"
          />
          {/* Slightly darker at top so the fixed header contrasts nicely; lighter middle for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/55" />
        </div>
      ))}
    </div>
  )
}

// Fixed public site chrome (header + nav + footer)
function PublicChrome({ conf, children, onSignIn, onRegister, currentView, setPublicView }) {
  const title = conf?.name || 'Scientific Conference'
  // Header logos: Kenyan flag is the default on the left; right side is optional (institutional emblem)
  const leftLogo = conf?.headerLogoLeft || '/kenya-flag.svg'
  const rightLogo = conf?.headerLogoRight || null
  const headerBg = conf?.headerBackground || null

  const navItems = [
    { key: 'home', label: 'Home' },
    { key: 'guidelines', label: 'Access submission guidelines' },
    { key: 'themes', label: 'Conference themes' },
    { key: 'venue', label: 'Venue & Dates' },
    { key: 'booths', label: 'Virtual Exhibition Booths' },
    { key: 'live', label: 'Virtual Conference' },
    { key: 'contact', label: 'Contact' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed header — full-width bright blue with optional background image behind for texture */}
      <header className="sticky top-0 z-50 border-b border-blue-900/40 shadow-md relative bg-[#1e5df0]">
        {/* Optional background image with dark blue tint overlay to keep title readable */}
        {headerBg && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${headerBg})` }}
              aria-hidden="true"
            />
            {/* Overlay: darker on the sides so title stays legible even on busy imagery */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a3fbf]/85 via-[#1e5df0]/70 to-[#0a3fbf]/85" aria-hidden="true" />
          </>
        )}

        <div className="relative w-full px-3 md:px-6 py-1.5">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 w-full">
            {/* LEFT: flag icon (Kenyan flag by default) */}
            <div className="flex items-center shrink-0">
              {leftLogo && (
                <img
                  src={leftLogo}
                  alt="National / left header emblem"
                  className="h-9 w-14 object-contain rounded-sm shadow-[0_2px_4px_rgba(0,0,0,0.3)] border border-white/30 bg-white/95"
                />
              )}
            </div>

            {/* CENTER: conference title, white on bright blue, centered — fills available width */}
            <button
              onClick={() => setPublicView && setPublicView('home')}
              className="text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded w-full py-0.5"
              aria-label="Go to home"
            >
              <div
                className="font-serif font-bold tracking-tight text-white text-sm md:text-base lg:text-lg leading-tight uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
              >
                {title}
              </div>
            </button>

            {/* RIGHT: optional emblem (no auth buttons — those live in the interactive window) */}
            <div className="flex items-center justify-end shrink-0">
              {rightLogo ? (
                <img
                  src={rightLogo}
                  alt="Institution / right header emblem"
                  className="h-9 w-14 object-contain rounded-sm shadow-[0_2px_4px_rgba(0,0,0,0.3)] border border-white/30 bg-white/95"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="h-9 w-14 rounded-sm border border-dashed border-white/40 bg-white/10 hidden md:block"
                  title="Right header emblem placeholder — upload from Conference Admin"
                />
              )}
            </div>
          </div>
        </div>
        {/* Nav bar */}
        <nav className="relative border-t border-white/10 bg-[#0a3fbf]">
          <div className="w-full px-3 md:px-6 flex flex-wrap gap-0.5 justify-center">
            {navItems.map(n => (
              <button key={n.key}
                onClick={() => setPublicView && setPublicView(n.key)}
                className={`px-3 py-1.5 text-xs md:text-[13px] font-medium border-b-2 transition ${currentView === n.key ? 'border-white text-white' : 'border-transparent text-white/75 hover:text-white hover:border-white/50'}`}>
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
              <div className="font-bold">{conf?.name || 'Scientific Conference'}</div>
            </div>
            <div className="text-sm text-slate-300 italic">"{conf?.theme || conf?.subtitle || 'Advancing Science Through Rigorous Peer Review'}"</div>
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

  // Compute default route from a fresh user object
  const defaultRouteForUser = (u) => {
    const roles = (u?.roles || []).map(r => r.role || r)
    const isAdm = roles.includes('SYSTEM_ADMIN')
    const isEd = roles.some(r => ['MANAGING_EDITOR', 'COMMITTEE_MEMBER', 'CHIEF_EDITOR', 'COMMITTEE_EDITOR'].includes(r))
    const isRev = roles.some(r => ['EXTERNAL_REVIEWER', 'COMMITTEE_MEMBER'].includes(r))
    const isLog = roles.some(r => ['CHIEF_LOGISTICS', 'COMMITTEE_LOGISTICS'].includes(r))
    const isSp = roles.includes('INDUSTRY_PARTNER')
    if (isLog && !isAdm && !isEd && !isRev) return { name: 'logistics' }
    if (isSp && !isAdm && !isEd && !isRev && !isLog) return { name: 'sponsors' }
    return { name: 'dashboard' }
  }

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
    api('/auth/me').then(d => {
      setUser(d.user); setView('app'); setRoute(defaultRouteForUser(d.user))
    }).catch(() => setToken(null)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  if (view === 'survey') return <PublicSurveyPage token={surveyToken} onDone={() => { if (typeof window !== 'undefined') window.history.replaceState({}, '', '/'); setView('landing') }} />
  if (view === 'reset') return <ResetPasswordPage token={resetToken} onDone={() => { setView('login'); if (typeof window !== 'undefined') window.history.replaceState({}, '', '/') }} />
  if (view === 'forgot') return <ForgotPassword onBack={() => setView('login')} />
  if (view === 'landing' && !user) return <Landing onLogin={() => setView('login')} onRegister={() => setView('register')} />
  if (view === 'login') return <AuthPage mode="login" onDone={(u) => { setUser(u); setView('app'); setRoute(defaultRouteForUser(u)) }} onSwitch={() => setView('register')} onBack={() => setView('landing')} onForgot={() => setView('forgot')} />
  if (view === 'register') return <AuthPage mode="register" reviewerInvite={reviewerInvite} onDone={(u) => { setUser(u); setView('app'); setRoute(defaultRouteForUser(u)); if (typeof window !== 'undefined') window.history.replaceState({}, '', '/') }} onSwitch={() => setView('login')} onBack={() => setView('landing')} />

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
      {view === 'live' && <PublicVirtualConference conf={featured} onSignIn={onLogin} />}
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
        <HeroCarousel images={heroImages} height="h-[440px]" />
        {/* items-start + pt keeps the title higher in view, closer to the header,
            while still leaving breathing room below for buttons and date/venue meta. */}
        <div className="absolute inset-0 flex items-start pt-12 md:pt-14">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl text-white mx-auto text-center">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight drop-shadow-lg py-2">
                {featured?.name || 'Scientific Conference Management System'}
              </h1>
              {featured?.mainTheme && (
                <p className="mt-6 text-lg md:text-2xl font-semibold opacity-95 drop-shadow max-w-3xl mx-auto py-2">
                  {featured.mainTheme}
                </p>
              )}
              <div className="mt-8 flex flex-wrap gap-4 justify-center">
                <Button size="lg" onClick={onRegister} className="bg-indigo-600 hover:bg-indigo-700 px-6 py-6 text-base font-semibold shadow-lg">
                  Register / Submit abstract <ChevronRight className="ml-1 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" onClick={onLogin} className="bg-white/10 border-white text-white hover:bg-white/25 px-6 py-6 text-base font-semibold shadow-lg">
                  Sign in
                </Button>
              </div>
              {featured?.startDate && (
                <div className="mt-8 flex flex-wrap gap-6 text-sm md:text-base opacity-95 justify-center bg-black/25 backdrop-blur-sm rounded-full px-6 py-3 max-w-2xl mx-auto">
                  <span className="whitespace-nowrap">📅 {formatDateRange(featured.startDate, featured.endDate)}</span>
                  <span className="whitespace-nowrap">📍 {featured.venue}, {featured.city}, {featured.country}</span>
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
            <div><div className="text-2xl font-bold text-indigo-600">{featured.submissionClose ? formatDate(featured.submissionClose) : '—'}</div><div className="text-xs uppercase tracking-wider text-muted-foreground">Submission Deadline</div></div>
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
                  <div>{formatDateRange(c.startDate, c.endDate)}</div>
                  <div>{c._count?.abstracts || 0} submissions · {c.themes?.length || 0} themes</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="text-center text-sm text-muted-foreground py-6 border-t">
        Demo accounts (password: <code className="bg-slate-100 px-1.5 py-0.5 rounded">password123</code>):{' '}
        admin@scms.io · chief@scms.io · committee@scms.io · reviewer1@scms.io · author@scms.io · chief.logistics@scms.io · sponsor@scms.io
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
  const fmtDate = (d) => formatDate(d, '—')

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white">
      <div className="container mx-auto px-6 py-6 max-w-6xl">
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
  const subthemes = conf?.themes || []
  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      {/* Main theme card — first thing on the page */}
      <Card className="border-0 shadow-lg overflow-hidden mb-10">
        <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-fuchsia-600 text-white p-8 md:p-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-5 py-2 text-base md:text-lg uppercase tracking-widest font-bold mb-5">
            <Award className="h-5 w-5" /> Main theme
          </div>
          {conf?.mainTheme ? (
            <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-4xl mx-auto">{conf.mainTheme}</h2>
          ) : (
            <h2 className="text-xl md:text-2xl font-medium text-white/80 max-w-3xl mx-auto italic">
              The main theme will be published shortly by the editorial committee.
            </h2>
          )}
        </div>
      </Card>

      {/* Sub-themes — single column, numbered, centered */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Sub-themes</h2>
        <div className="text-sm text-muted-foreground mt-1">{subthemes.length} area{subthemes.length !== 1 ? 's' : ''} of focus</div>
      </div>

      {subthemes.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-10 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <div className="font-medium">Sub-themes are being finalised</div>
            <p className="text-sm mt-1">Please check back — the editorial committee is preparing the full programme.</p>
          </CardContent>
        </Card>
      ) : (
        <ol className="max-w-3xl mx-auto space-y-3">
          {subthemes.map((t, idx) => {
            const gradients = [
              'from-indigo-500 to-blue-500',
              'from-fuchsia-500 to-pink-500',
              'from-emerald-500 to-teal-500',
              'from-amber-500 to-orange-500',
              'from-purple-500 to-violet-500',
              'from-rose-500 to-red-500',
            ]
            const g = gradients[idx % gradients.length]
            return (
              <li key={t.id}>
                <Card className="hover:shadow-lg transition overflow-hidden border-0 shadow-sm">
                  <div className={`h-1.5 bg-gradient-to-r ${g}`} />
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`h-11 w-11 rounded-lg bg-gradient-to-br ${g} text-white flex items-center justify-center font-bold text-lg shrink-0`}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg md:text-xl font-bold leading-tight">{t.name}</h3>
                        {t.description && <p className="text-sm text-muted-foreground leading-relaxed mt-1">{t.description}</p>}
                        {t.keywords?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {t.keywords.map(k => (
                              <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{k}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ol>
      )}

      {/* Footer note */}
      <div className="mt-10 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 text-center text-sm text-slate-600 max-w-3xl mx-auto">
        Authors are asked to align their abstract with one of the sub-themes above during submission.
      </div>
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
  const [featuredConf, setFeaturedConf] = useState(null)

  useEffect(() => {
    if (mode === 'register' && !reviewerInvite) {
      api('/public/config').then(d => setFeaturedConf(d.conference)).catch(() => {})
    }
  }, [mode, reviewerInvite])

  const attendeeGateClosed = mode === 'register' && role === 'ATTENDEE' && featuredConf && !featuredConf.attendeeRegistrationOpen

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
      if (attendeeGateClosed) return setError('Attendee registration is not yet open. Please choose Author or Sponsor / Industry / Pharma instead, or check back closer to the conference date.')
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
        toast.success(d.welcome || `Welcome, ${d.user.firstName}! Registration successful.`, { duration: 6000 })
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
          <CardDescription>{isReviewerInvite ? 'Register as an External Peer Reviewer' : 'Scientific Conference Management System'}</CardDescription>
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
                    {attendeeGateClosed && (
                      <div role="alert" className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-700" />
                        <div>
                          <div className="font-semibold">Attendee registration is not yet open</div>
                          <div className="text-xs mt-0.5">
                            {featuredConf?.name ? `${featuredConf.name} organisers` : 'The organisers'} have not opened attendee registration yet. It typically opens approximately one month before the conference. Please choose <span className="font-medium">Author</span> or <span className="font-medium">Sponsor / Industry / Pharma</span>, or check back closer to the event.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }} required readOnly={isReviewerInvite} className={isReviewerInvite ? 'bg-slate-50' : ''} /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={e => { setPassword(e.target.value); setError('') }} required /></div>
          </CardContent>
          <CardFooter className="flex-col gap-2 items-stretch">
            <Button type="submit" disabled={loading || attendeeGateClosed} className="bg-indigo-600 hover:bg-indigo-700">
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
  const isEditor = roles.some(r => ['MANAGING_EDITOR', 'COMMITTEE_MEMBER', 'CHIEF_EDITOR', 'COMMITTEE_EDITOR'].includes(r))
  const isChiefEditor = roles.includes('CHIEF_EDITOR')
  const isManagingEditor = roles.includes('MANAGING_EDITOR')
  // A "committee editor only" user has ONLY COMMITTEE_EDITOR / COMMITTEE_MEMBER roles
  // (with optional AUTHOR / reviewer) — NO chief-editor, managing-editor or system-admin escalation.
  // Both COMMITTEE_EDITOR and COMMITTEE_MEMBER surface as "Committee Editor" in the UI (ROLE_LABELS).
  const hasCommitteeRole = roles.includes('COMMITTEE_EDITOR') || roles.includes('COMMITTEE_MEMBER')
  const isCommitteeEditorOnly = hasCommitteeRole && !isChiefEditor && !isManagingEditor && !roles.includes('SYSTEM_ADMIN')
  const isLogistics = roles.some(r => ['CHIEF_LOGISTICS', 'COMMITTEE_LOGISTICS'].includes(r))
  const isChiefLogistics = roles.includes('CHIEF_LOGISTICS')
  const isSponsor = roles.includes('INDUSTRY_PARTNER')
  const isReviewer = roles.some(r => ['EXTERNAL_REVIEWER', 'COMMITTEE_MEMBER'].includes(r))
  // A "pure" role means the user has NO privileged sidebar (no admin, no editor, no reviewer, no author-with-abstracts overview needs)
  const isLogisticsOnly = isLogistics && !isAdmin && !isEditor && !isReviewer
  const isSponsorOnly = isSponsor && !isAdmin && !isEditor && !isLogistics && !isReviewer

  const refreshNotifs = () => api('/notifications').then(d => setNotifs(d.notifications || [])).catch(() => {})
  useEffect(() => {
    refreshNotifs()
    api('/public/config').then(d => setFeatured(d.conference)).catch(() => {})
    const i = setInterval(refreshNotifs, 30000)
    return () => clearInterval(i)
  }, [])

  const unread = notifs.filter(n => !n.isRead).length

  // Editors' Chat unread indicator — track last-seen timestamp locally
  const [chatUnread, setChatUnread] = useState(0)
  const [logisticsUnread, setLogisticsUnread] = useState(0)
  const refreshChat = async () => {
    if (isEditor || isAdmin) {
      try {
        const d = await api('/announcements?channel=EDITORIAL')
        const list = d.announcements || []
        const lastSeen = parseInt(localStorage.getItem('scmsChatLastSeen') || '0', 10)
        const newer = list.filter(a => new Date(a.createdAt).getTime() > lastSeen && a.authorId !== user.id).length
        setChatUnread(newer)
      } catch {}
    }
    if (isLogistics || isAdmin) {
      try {
        const d = await api('/announcements?channel=LOGISTICS')
        const list = d.announcements || []
        const lastSeen = parseInt(localStorage.getItem('scmsLogChatLastSeen') || '0', 10)
        const newer = list.filter(a => new Date(a.createdAt).getTime() > lastSeen && a.authorId !== user.id).length
        setLogisticsUnread(newer)
      } catch {}
    }
  }
  useEffect(() => {
    refreshChat()
    const i = setInterval(refreshChat, 15000)
    return () => clearInterval(i)
  }, [isEditor, isAdmin, isLogistics, user.id])
  // Clear when respective chat opens
  useEffect(() => {
    if (route.name === 'announcements') {
      localStorage.setItem('scmsChatLastSeen', String(Date.now()))
      setChatUnread(0)
    }
    if (route.name === 'logistics') {
      localStorage.setItem('scmsLogChatLastSeen', String(Date.now()))
      setLogisticsUnread(0)
    }
  }, [route.name])
  const confTitle = featured?.name || 'Scientific Conference Platform'
  const confTheme = featured?.theme || featured?.subtitle || featured?.description || 'Advancing Science Through Rigorous Peer Review'

  const nav = [
    // Dashboard is hidden for pure logistics or pure sponsor users — they have their
    // own landing hub (Logistics Boardroom / Sponsor Dashboard).
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: !isLogisticsOnly && !isSponsorOnly, group: 'core' },
    // Editor-focused
    { key: 'editorial', label: 'Editorial Office', icon: ClipboardCheck, show: isEditor || isAdmin, group: 'editorial' },
    { key: 'announcements', label: 'Editors\' Chat', icon: MessageSquare, show: isEditor || isAdmin, badge: chatUnread, group: 'editorial' },
    { key: 'workspace', label: 'My Editor Workspace', icon: Briefcase, show: isEditor || isAdmin, group: 'editorial' },
    // Reviewer-focused — placed AFTER My Editor Workspace per editor sidebar preference
    { key: 'reviews', label: 'My Review workspace', icon: Award, show: isReviewer, group: 'reviewer' },
    // Logistics-focused
    { key: 'logistics', label: 'Logistics Boardroom', icon: Building2, show: isLogistics || isAdmin, badge: logisticsUnread, group: 'logistics' },
    // Sponsor Dashboard (sponsors + admin + chief logistics)
    { key: 'sponsors', label: 'Sponsor Dashboard', icon: Award, show: isSponsor || isAdmin || isChiefLogistics, group: 'general' },
    // Virtual Exhibition Hall — sits right below Sponsor Dashboard for sponsors, chief logistics, and admin
    { key: 'booths', label: 'Virtual Exhibition Hall', icon: Building2, show: isSponsor || isAdmin || isChiefLogistics, group: 'general' },
    // Sponsorship Tiers admin — appears right after Sponsor Dashboard for admin + chief logistics
    { key: 'sponsorship-tiers', label: 'Sponsorship Tiers', icon: Award, show: isAdmin || isChiefLogistics, group: 'general' },
    // Author-focused — logistics committee members carry the AUTHOR role and can submit
    { key: 'my-abstracts', label: 'My Abstracts', icon: FileText, show: !isSponsorOnly, group: 'author' },
    { key: 'submit', label: 'Submit new abstract', icon: Plus, show: !isSponsorOnly, group: 'author' },
    // General
    { key: 'live', label: 'Live Conference', icon: Radio, show: true, group: 'general' },
    { key: 'programme', label: 'Programme', icon: GraduationCap, show: !isSponsorOnly, group: 'general' },
    { key: 'templates', label: 'Templates', icon: FileText, show: !isLogisticsOnly && !isSponsorOnly, group: 'general' },
    // Admin
    { key: 'conferences', label: 'Conferences', icon: Calendar, show: isAdmin, group: 'admin' },
    { key: 'conference-admin', label: 'Conference Admin', icon: Building2, show: isAdmin, group: 'admin' },
    { key: 'booth-admin', label: 'Exhibition Booths', icon: Building2, show: isAdmin || isEditor || isChiefLogistics, group: 'admin' },
    { key: 'programme-admin', label: 'Programme Admin', icon: Calendar, show: isAdmin || isEditor, group: 'admin' },
    { key: 'book-admin', label: 'Conference Book', icon: BookOpen, show: isAdmin || isEditor, group: 'admin' },
    { key: 'surveys', label: 'Feedback Surveys', icon: ListChecks, show: isAdmin || isEditor, group: 'admin' },
    { key: 'analytics', label: 'Analytics', icon: BarChartIcon, show: isEditor || isAdmin, group: 'admin' },
    { key: 'users', label: 'User Management', icon: Users, show: isAdmin, group: 'admin' },
    // Delegates: System Admin + Chief Editor only (hidden from Managing/Committee Editors per role policy)
    { key: 'delegates', label: 'Delegates', icon: Users, show: isAdmin || isChiefEditor, group: 'admin' },
    { key: 'audit', label: 'Audit Log', icon: ShieldCheck, show: isAdmin, group: 'admin' },
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
                <Icon className="h-4 w-4" />
                <span className="flex-1 truncate">{n.label}</span>
                {n.badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${active ? 'bg-white text-indigo-700' : 'bg-red-500 text-white animate-pulse'}`}>
                    {n.badge > 99 ? '99+' : n.badge}
                  </span>
                )}
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
        <header className="h-16 border-b border-indigo-800/40 bg-gradient-to-r from-indigo-900 via-indigo-800 to-fuchsia-900 shadow-md flex items-center px-6 relative">
          {/* Notifications bell — floats to the right */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
            <NotificationsBell
              notifs={notifs}
              onOpen={(n) => { if (n.link?.startsWith('/abstracts/')) setRoute({ name: 'abstract', id: n.link.split('/')[2] }); api(`/notifications/${n.id}/read`, { method: 'POST' }).then(refreshNotifs) }}
              onReadAll={() => api('/notifications/read-all', { method: 'POST' }).then(refreshNotifs)}
              unread={unread}
            />
          </div>
          {/* Centred title block */}
          <div className="flex-1 text-center text-white">
            <div className="text-lg md:text-xl font-bold tracking-tight drop-shadow-sm truncate">{confTitle}</div>
            <div className="text-[11px] uppercase tracking-widest text-white/75 mt-0.5">{route.name === 'abstract' ? 'Abstract detail' : nav.find(n => n.key === route.name)?.label || 'SCMS'}</div>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <ViewRouter route={route} setRoute={setRoute} user={user} setUser={setUser} isAdmin={isAdmin} isEditor={isEditor} isReviewer={isReviewer} isCommitteeEditorOnly={isCommitteeEditorOnly} featured={featured} />
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
function ViewRouter({ route, setRoute, user, setUser, isAdmin, isEditor, isReviewer, isCommitteeEditorOnly, featured }) {
  if (route.name === 'dashboard') return <Dashboard setRoute={setRoute} isAdmin={isAdmin} isEditor={isEditor} isReviewer={isReviewer} user={user} featured={featured} />
  if (route.name === 'my-abstracts') return <MyAbstracts setRoute={setRoute} />
  if (route.name === 'submit') return <SubmitAbstract setRoute={setRoute} user={user} draftId={route.draftId} />
  if (route.name === 'editorial') return <EditorialOffice setRoute={setRoute} />
  if (route.name === 'workspace') return <EditorWorkspace setRoute={setRoute} user={user} />
  if (route.name === 'live') return <LiveConferencePage user={user} />
  if (route.name === 'reviews') return <ReviewerWorkspace setRoute={setRoute} />
  if (route.name === 'conferences') return <Conferences />
  if (route.name === 'conference-admin') return <ConferenceAdmin />
  if (route.name === 'booth-admin') return <BoothAdmin />
  if (route.name === 'programme-admin') return <ProgrammeAdmin readOnly={isCommitteeEditorOnly} />
  if (route.name === 'book-admin') return <ConferenceBookAdmin readOnly={isCommitteeEditorOnly} />
  if (route.name === 'surveys') return <SurveyAdmin readOnly={isCommitteeEditorOnly} />
  if (route.name === 'programme') return <Programme />
  if (route.name === 'templates') return <TemplatesPage user={user} isAdmin={isAdmin} isEditor={isEditor} />
  if (route.name === 'announcements') return <AnnouncementsBoard user={user} channel="EDITORIAL" />
  if (route.name === 'logistics') return <LogisticsBoardroom user={user} />
  if (route.name === 'sponsors') return <SponsorsPage user={user} featured={featured} setRoute={setRoute} />
  if (route.name === 'booths') return <ExhibitionBoothsPublic conf={featured} />
  if (route.name === 'sponsorship-tiers') return <SponsorshipTiersAdmin />
  if (route.name === 'invite-reviewers') return <InviteReviewers />
  if (route.name === 'analytics') return <Analytics />
  if (route.name === 'users') return <UserManagement />
  if (route.name === 'delegates') return <DelegatesPage />
  if (route.name === 'audit') return <AuditView />
  if (route.name === 'abstract') return <AbstractDetail id={route.id} route={route} user={user} isEditor={isEditor} isAdmin={isAdmin} isReviewer={isReviewer} setRoute={setRoute} />
  return <div className="p-6">Not found</div>
}

// ============ DASHBOARD ============
function Dashboard({ setRoute, isAdmin, isEditor, isReviewer, user, featured }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [assignments, setAssignments] = useState([])
  const [board, setBoard] = useState([])
  const [boardLoading, setBoardLoading] = useState(true)
  useEffect(() => {
    if (isAdmin || isEditor) api('/analytics/dashboard').then(d => setStats(d)).catch(() => {})
    api('/abstracts?scope=mine').then(d => setRecent((d.abstracts || []).slice(0, 5))).catch(() => {})
    if (isReviewer) api('/reviewer/assignments').then(d => setAssignments(d.assignments || [])).catch(() => {})
    // Load editorial board members for editors / admin views (Chief Editor, Managing Editor, Committee Editors, Section Editors)
    if (isEditor || isAdmin) {
      setBoardLoading(true)
      Promise.all([
        api('/users?role=CHIEF_EDITOR').catch(() => ({ users: [] })),
        api('/users?role=MANAGING_EDITOR').catch(() => ({ users: [] })),
        api('/users?role=COMMITTEE_EDITOR').catch(() => ({ users: [] })),
        api('/users?role=COMMITTEE_MEMBER').catch(() => ({ users: [] })),
      ]).then(results => {
        const map = {}
        const labels = ['CHIEF_EDITOR', 'MANAGING_EDITOR', 'COMMITTEE_EDITOR', 'COMMITTEE_MEMBER']
        results.forEach((d, i) => {
          for (const u of (d.users || [])) {
            // Exclude system admins from the public editorial board list
            const uRoles = (u.roles || []).map(r => r.role || r)
            if (uRoles.includes('SYSTEM_ADMIN')) continue
            if (!map[u.id]) map[u.id] = { ...u, boardRoles: new Set() }
            map[u.id].boardRoles.add(labels[i])
          }
        })
        // Order: chief first, then managing, then committee editors, then committee members, then section editors
        const priority = { CHIEF_EDITOR: 0, MANAGING_EDITOR: 1, COMMITTEE_EDITOR: 2, COMMITTEE_MEMBER: 3 }
        const ordered = Object.values(map).map(u => {
          const rs = Array.from(u.boardRoles)
          const primary = rs.slice().sort((a, b) => priority[a] - priority[b])[0]
          return { ...u, primaryRole: primary, roles: rs }
        }).sort((a, b) => (priority[a.primaryRole] ?? 99) - (priority[b.primaryRole] ?? 99))
        setBoard(ordered)
        setBoardLoading(false)
      })
    }
  }, [])
  const isAuthorOnly = !isAdmin && !isEditor && !isReviewer
  const isReviewerOnly = isReviewer && !isAdmin && !isEditor
  const isEditorView = (isEditor || isAdmin) && !isReviewerOnly && !isAuthorOnly
  const confTitle = featured?.name || 'the conference'

  // Reviewer stats
  const pendingInv = assignments.filter(a => a.invitationStatus === 'PENDING').length
  const inProgress = assignments.filter(a => a.invitationStatus === 'ACCEPTED' && !a.report).length
  const submitted = assignments.filter(a => a.report).length
  const dueSoon = assignments.filter(a => a.invitationStatus === 'ACCEPTED' && !a.report && a.dueDate && new Date(a.dueDate) - new Date() < 7 * 86400000).length

  // Nicely readable label for a board role
  const roleLabel = (r) => ({
    CHIEF_EDITOR: 'Chief Editor',
    MANAGING_EDITOR: 'Managing Editor',
    COMMITTEE_EDITOR: 'Committee Editor',
    COMMITTEE_MEMBER: 'Committee Editor',
  })[r] || r

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {isReviewerOnly ? (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 px-6 py-4 text-white">
            {/* Row 1 — welcome inline, action button on the far right */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold leading-tight flex items-center gap-2">
                <Award className="h-5 w-5 opacity-90" /> Welcome{user?.firstName ? ', ' + user.firstName : ''}
              </h1>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => setRoute({ name: 'reviews' })} className="bg-white text-purple-700 hover:bg-slate-100 shadow"><Award className="h-4 w-4 mr-1" />Open review workspace</Button>
              </div>
            </div>
            {/* Row 2 & 3 — paragraphs span the full width */}
            <p className="text-white/90 text-sm mt-3 leading-snug w-full">Your peer-review queue — assess assigned abstracts and submit blind reviews for {confTitle}.</p>
            <p className="text-white/90 text-sm mt-1 leading-snug w-full">Author identities remain hidden throughout the process.</p>
          </div>
        </Card>
      ) : isAuthorOnly ? (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-rose-500 px-6 py-4 text-white">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold leading-tight flex items-center gap-2">
                <FileText className="h-5 w-5 opacity-90" /> Welcome{user?.firstName ? ', ' + user.firstName : ''}
              </h1>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => setRoute({ name: 'my-abstracts' })} className="bg-white text-indigo-700 hover:bg-slate-100 shadow"><FileText className="h-4 w-4 mr-1" />Track my abstracts</Button>
                <Button size="sm" onClick={() => setRoute({ name: 'submit' })} className="bg-white text-fuchsia-700 hover:bg-slate-100 shadow"><Plus className="h-4 w-4 mr-1" />Submit new abstract</Button>
              </div>
            </div>
            <p className="text-white/90 text-sm mt-3 leading-snug w-full">Thank you for your consideration to submit to "{confTitle}". Track each abstract's editorial process from this dashboard.</p>
            <p className="text-white/90 text-sm mt-1 leading-snug w-full">Submit a new abstract or message the editor at any time.</p>
          </div>
        </Card>
      ) : (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-fuchsia-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold leading-tight flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 opacity-90" /> Welcome back{user?.firstName ? ', ' + user.firstName : ''}
              </h1>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => setRoute({ name: 'editorial' })} className="bg-white text-indigo-700 hover:bg-slate-100 shadow"><ClipboardCheck className="h-4 w-4 mr-1" />Open Editorial Office</Button>
                <Button size="sm" onClick={() => setRoute({ name: 'workspace' })} className="bg-white/10 border border-white/40 text-white hover:bg-white/20"><Briefcase className="h-4 w-4 mr-1" />My workspace</Button>
              </div>
            </div>
            <p className="text-white/90 text-sm mt-3 leading-snug w-full">Editorial oversight for {confTitle}.</p>
            <p className="text-white/90 text-sm mt-1 leading-snug w-full">Handle assignments, monitor peer review and steward the editorial board.</p>
          </div>
        </Card>
      )}

      {/* Editorial Board — visible on editor dashboard (excludes System Admin). Moved to
          appear IMMEDIATELY after the welcome header per editorial layout preference. */}
      {isEditorView && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50 to-white flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              <div>
                <CardTitle className="text-lg">Editorial Board</CardTitle>
                <CardDescription>Chief Editor, Committee Editors and other editorial roles</CardDescription>
              </div>
            </div>
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">{board.length} member{board.length !== 1 ? 's' : ''}</Badge>
          </CardHeader>
          <CardContent className="pt-4">
            {boardLoading ? (
              <div className="py-6 text-center"><Loader2 className="h-6 w-6 mx-auto animate-spin text-indigo-500" /><div className="text-xs text-muted-foreground mt-1">Loading editorial board…</div></div>
            ) : board.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Editorial board is being populated.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-2">
                {board.map(m => {
                  const rColor = m.primaryRole === 'CHIEF_EDITOR' ? 'bg-fuchsia-600'
                    : m.primaryRole === 'MANAGING_EDITOR' ? 'bg-indigo-600'
                    : m.primaryRole === 'COMMITTEE_EDITOR' || m.primaryRole === 'COMMITTEE_MEMBER' ? 'bg-teal-600'
                    : 'bg-slate-600'
                  return (
                    <div key={m.id} className="flex items-center gap-3 border rounded-lg p-3 bg-white hover:shadow-sm transition">
                      <div className={`h-10 w-10 rounded-full ${rColor} text-white flex items-center justify-center font-semibold shrink-0`}>
                        {(m.firstName?.[0] || '').toUpperCase()}{(m.lastName?.[0] || '').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {m.title ? m.title + ' ' : ''}{m.firstName} {m.lastName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{m.institution?.name || m.affiliation || m.email}</div>
                      </div>
                      <Badge className={`${rColor} text-white text-[10px] shrink-0`}>{roleLabel(m.primaryRole)}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reviewer summary + assigned abstracts — only for PURE reviewers (not editors).
          Editors have their assignments on "My Editor Workspace" instead. */}
      {isReviewer && !isEditorView && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBadge label="Pending invitations" value={pendingInv} color="from-amber-500 to-orange-600" icon={AlertCircle} attention />
            <StatBadge label="In progress" value={inProgress} color="from-indigo-500 to-purple-600" icon={Clock} />
            <StatBadge label="Due within 7 days" value={dueSoon} color="from-rose-500 to-red-600" icon={AlertCircle} attention />
            <StatBadge label="Submitted" value={submitted} color="from-emerald-500 to-teal-600" icon={CheckCircle2} />
          </div>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 bg-gradient-to-r from-purple-50 to-white flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-purple-600" />
                <div>
                  <CardTitle className="text-lg">Assigned abstracts</CardTitle>
                  <CardDescription>Your current review assignments — click any to open</CardDescription>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setRoute({ name: 'reviews' })}>View all →</Button>
            </CardHeader>
            <CardContent className="pt-4">
              {assignments.length === 0 ? (
                <div className="text-center py-8">
                  <Award className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <div className="text-sm font-medium text-slate-500">No review assignments yet</div>
                  <div className="text-xs text-muted-foreground mt-1">Editors will invite you when a suitable abstract is submitted.</div>
                </div>
              ) : (
                <div className="grid gap-2">
                  {assignments.slice(0, 5).map(a => {
                    const isPending = a.invitationStatus === 'PENDING'
                    const isDeclined = a.invitationStatus === 'DECLINED'
                    const done = !!a.report
                    // Only navigate to the abstract detail once the reviewer has ACCEPTED
                    const canOpen = !isPending && !isDeclined
                    return (
                      <div
                        key={a.id}
                        className={`border rounded-lg p-3 flex items-center gap-3 transition ${canOpen ? 'hover:shadow-sm cursor-pointer' : 'cursor-default opacity-90'} ${isPending ? 'bg-amber-50/60 border-amber-200' : isDeclined ? 'bg-rose-50/50 border-rose-200' : done ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200'}`}
                        onClick={() => { if (canOpen) setRoute({ name: 'abstract', id: a.abstract.id, from: 'reviews' }) }}
                      >
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isPending ? 'bg-amber-500' : isDeclined ? 'bg-rose-500' : done ? 'bg-emerald-600' : 'bg-purple-600'} text-white`}>
                          <Award className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-mono font-semibold text-slate-500">{a.abstract.submissionCode}</span>
                            <Badge variant="outline" className="text-[10px]">{a.reviewType?.replace('_', ' ')}</Badge>
                            {isPending ? <Badge className="bg-amber-500 text-white text-[10px]">INVITATION PENDING</Badge>
                              : isDeclined ? <Badge className="bg-rose-500 text-white text-[10px]">YOU DECLINED</Badge>
                              : done ? <Badge className="bg-emerald-600 text-[10px]">SUBMITTED</Badge>
                              : <Badge className="bg-purple-600 text-[10px]">ACCEPTED — REVIEW DUE</Badge>}
                          </div>
                          <div className="font-medium truncate">{a.abstract.title}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Invited {formatDate(a.assignedAt)}
                            {a.dueDate && ` · Due ${formatDate(a.dueDate)}`}
                            {a.completedAt && ` · Completed ${formatDate(a.completedAt)}`}
                          </div>
                          {isPending && (
                            <div className="text-[10px] text-amber-800 mt-1">Respond in "My Review workspace" to view the abstract.</div>
                          )}
                          {isDeclined && (
                            <div className="text-[10px] text-rose-800 mt-1">You declined this invitation — editors have been notified.</div>
                          )}
                        </div>
                        {canOpen && <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Editor summary stat cards (mirrors Editorial Office header) */}
      {isEditorView && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBadge label="Total abstracts" value={stats.totalAbstracts} color="from-fuchsia-500 to-rose-500" icon={FileText} />
          <StatBadge label="Completed reviews" value={`${stats.reviews.completed}/${stats.reviews.total}`} color="from-emerald-500 to-teal-600" icon={ClipboardCheck} />
          <StatBadge label="Attendees registrations" value={stats.totalRegs} color="from-amber-500 to-orange-600" icon={Calendar} />
          <StatBadge label="Total users" value={stats.totalUsers} color="from-indigo-500 to-fuchsia-500" icon={Users} />
        </div>
      )}

      {/* Non-editor stat cards (kept as-is for admins) */}
      {!isEditorView && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FileText} label="Total abstracts" value={stats.totalAbstracts} color="text-fuchsia-600" />
          <StatCard icon={ClipboardCheck} label="Completed reviews" value={`${stats.reviews.completed}/${stats.reviews.total}`} color="text-emerald-600" />
          <StatCard icon={Calendar} label="Attendees registrations" value={stats.totalRegs} color="text-amber-600" />
          <StatCard icon={Users} label="Total users" value={stats.totalUsers} color="text-indigo-600" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* My recent submissions — hidden for editor view (author metrics live in "My Abstracts")
           and hidden for reviewer-only users (they aren't primarily authors). */}
        {!isEditorView && !isReviewerOnly && (
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
        )}

        {stats && (
          <Card className={isEditorView ? 'lg:col-span-2' : ''}>
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
  const openAbstract = (a) => {
    // Drafts must go BACK to the submission form for completion — they are not yet
    // formally submitted so the read-only abstract detail page is not appropriate.
    if (a.currentState === 'DRAFT') {
      setRoute({ name: 'submit', draftId: a.id })
    } else {
      setRoute({ name: 'abstract', id: a.id, from: 'my-abstracts' })
    }
  }
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
            {list.map(a => <AbstractCard key={a.id} a={a} onOpen={() => openAbstract(a)} />)}
          </div>
        )}
    </div>
  )
}

function AbstractCard({ a, onOpen }) {
  const isDraft = a.currentState === 'DRAFT'
  if (isDraft) {
    // Dedicated Draft card — no interactive state badge, a single "Resume editing" CTA.
    return (
      <Card className="border-2 border-dashed border-amber-300 bg-amber-50/40 hover:shadow-md transition">
        <CardContent className="p-5">
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge className="bg-amber-500 text-white text-[10px] font-bold uppercase tracking-widest">Draft</Badge>
                <span className="text-xs font-mono text-muted-foreground">{a.submissionCode}</span>
                {a.theme && <Badge variant="outline" className="text-[10px]">{a.theme.name}</Badge>}
              </div>
              <div className="font-semibold text-base">{a.title || <span className="italic text-muted-foreground">(untitled draft)</span>}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {a.authors?.map(au => au.fullName).join(', ')} · {a.conference?.code}
                <span className="ml-1 text-amber-700 font-medium">· Not yet submitted</span>
              </div>
            </div>
            <Button onClick={onOpen} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
              Resume editing <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }
  return (
    <button onClick={onOpen} className="w-full text-left">
      <Card className="hover:shadow-md transition">
        <CardContent className="p-5">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
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
function SubmitAbstract({ setRoute, user, draftId }) {
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
  const [draftLoading, setDraftLoading] = useState(!!draftId)
  const [existingSubmissionCode, setExistingSubmissionCode] = useState(null)

  useEffect(() => { api('/conferences').then(d => {
    setConferences(d.conferences || [])
    if (d.conferences?.[0] && !draftId) setConferenceId(d.conferences[0].id)
  }) }, [draftId])

  // Load existing draft if we're resuming one
  useEffect(() => {
    if (!draftId) return
    (async () => {
      try {
        const d = await api(`/abstracts/${draftId}`)
        const a = d.abstract
        if (a.currentState !== 'DRAFT') {
          toast.error('This abstract has already been submitted and can no longer be edited from this form.')
          setRoute({ name: 'abstract', id: draftId })
          return
        }
        setConferenceId(a.conferenceId)
        setThemeId(a.themeId || '')
        setReportType(a.reportType || 'ORIGINAL_RESEARCH')
        setTitle(a.title || '')
        // body + coverLetter live on the latest AbstractVersion (versions are ordered
        // versionNumber DESC by the API, so versions[0] is the most recent revision).
        const latestVer = (a.versions && a.versions[0]) || null
        setBody((latestVer?.body) || '')
        setKeywords((a.keywords || latestVer?.keywords || []).join(', '))
        setDisclosureStatement(a.disclosureStatement || '')
        setCoverLetter((latestVer?.coverLetter) || '')
        setAuthors((a.authors || []).map((au, i) => ({
          userId: au.userId, fullName: au.fullName || '', email: au.email || '',
          phone: au.phone || '', department: au.department || '', affiliation: au.affiliation || '',
          isCorresponding: !!au.isCorresponding, orderIndex: au.orderIndex ?? i,
        })))
        setExistingSubmissionCode(a.submissionCode)
      } catch (e) {
        toast.error(e.message)
        setRoute({ name: 'my-abstracts' })
      } finally { setDraftLoading(false) }
    })()
  }, [draftId, setRoute])

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
    if (keywordList.length < 3) issues.push(`Provide at least 3 keywords (currently ${keywordList.length}).`)
    else if (keywordList.length > 5) issues.push(`Too many keywords (${keywordList.length}). Maximum is 5.`)
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
      let absId = draftId
      const payload = {
        conferenceId, themeId: themeId || null, title,
        reportType, body, keywords: keywordList, coverLetter,
        disclosureStatement, authors,
      }
      if (draftId) {
        // Update existing draft in place — no new submissionCode is generated
        await api(`/abstracts/${draftId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        // Fresh draft — create the abstract row
        const created = await api('/abstracts', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        absId = created.abstract.id
      }
      // Upload the doc file if provided
      if (docFile) {
        const fd = new FormData()
        fd.append('file', docFile)
        fd.append('category', 'ABSTRACT')
        await apiUpload(`/abstracts/${absId}/documents`, fd)
      }
      if (!asDraft) {
        await api(`/abstracts/${absId}/submit`, { method: 'POST' })
        toast.success(`Submitted successfully`)
        // After a real submission the user should see the (now read-only) abstract detail
        setRoute({ name: 'abstract', id: absId, from: 'my-abstracts' })
      } else {
        toast.success(draftId ? 'Draft updated' : 'Draft saved')
        // Keep drafts inside My submissions until they are formally submitted
        setRoute({ name: 'my-abstracts' })
      }
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
      {draftLoading && (
        <div className="mb-4 flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="ml-2 text-sm text-muted-foreground">Loading your saved draft…</span>
        </div>
      )}
      {/* Hero header */}
      <Card className="mb-5 border-0 shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-rose-500 p-6 text-white">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <Badge className="bg-white/25 border-white/40 text-white backdrop-blur-sm mb-2">
                <FileUp className="h-3 w-3 mr-1" /> {draftId ? 'RESUMING DRAFT' : 'AUTHORS'}
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight">
                {draftId ? 'Continue your draft' : 'Submit new abstract'}
              </h1>
              <p className="text-white/90 text-sm mt-1">
                {draftId
                  ? <>You are editing draft <span className="font-mono bg-white/15 px-1.5 py-0.5 rounded">{existingSubmissionCode || draftId}</span>. Complete the required fields and click "Submit for review" when ready — the draft will not reach the editorial office until it is submitted.</>
                  : 'All fields are required unless marked otherwise. Follow the guidelines below to maximise your chance of acceptance.'}
              </p>
            </div>
            <Button variant="outline" onClick={downloadGuidelines} className="bg-white text-indigo-700 hover:bg-slate-100 border-0 shadow"><Download className="h-4 w-4 mr-1" /> Access submission guidelines</Button>
          </div>
        </div>
      </Card>

      {/* Recommendations alert */}
      <Card className="mb-4 border-amber-200 bg-amber-50/80">
        <CardContent className="p-4">
          <div className="flex gap-2 items-start">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-amber-900 mb-1">Please read before submitting</div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                <li>Title: max <b>{TITLE_WORD_LIMIT} words</b> (capitalize each word), Times New Roman size 12.</li>
                <li>Abstract body: max <b>{WORD_LIMIT} words</b>, no citations.</li>
                <li>Uploaded Word document: <b>.doc / .docx only</b>, max <b>2 MB</b>. Must NOT include author names (double-blind).</li>
                <li>Provide <b>3 – 5 keywords</b>, disclosure statement (or "no conflict of interest to declare"), and one corresponding author (*).</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {/* Section 1: Study design & aligning sub-theme */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50 to-white">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">1</div>
              <CardTitle className="text-lg">Study design &amp; aligning sub-theme</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Reminder banner — the main theme the conference is centred on */}
            {(() => {
              const activeConf = conferences.find(c => c.id === conferenceId) || conferences[0]
              const mainTheme = activeConf?.mainTheme
              return (
                <div className="rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 via-fuchsia-50 to-white p-4">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-indigo-700 flex items-center gap-1 mb-1">
                    <Award className="h-3 w-3" /> Main conference theme
                  </div>
                  {mainTheme ? (
                    <p className="text-sm md:text-base font-semibold text-slate-800 leading-snug">{mainTheme}</p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">The organisers have not yet published the main theme.</p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">
                    Please choose the study design that best describes your work, then align your abstract with one of the sub-themes below.
                  </p>
                </div>
              )
            })()}

            {/* Study Design (report type) first — full-width professional select */}
            <div>
              <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <FileText className="h-4 w-4 text-indigo-600" /> Study design *
              </Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select the study design that fits your work" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORIGINAL_RESEARCH">Original research</SelectItem>
                  <SelectItem value="CASE_REPORT">Case report</SelectItem>
                  <SelectItem value="CASE_SERIES">Case series</SelectItem>
                  <SelectItem value="REVIEW">Review</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Original research covers randomised trials, cohort / cross-sectional studies and other empirical work. Choose "Other" only if none of the categories apply.
              </p>
            </div>

            {/* Aligning sub-theme */}
            <div>
              <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Award className="h-4 w-4 text-fuchsia-600" /> Aligning sub-theme *
              </Label>
              <Select value={themeId} onValueChange={setThemeId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select the sub-theme your abstract fits under" /></SelectTrigger>
                <SelectContent>
                  {themes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                The editorial committee routes reviewers by sub-theme, so picking the closest match improves peer-review quality.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Title */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-fuchsia-50 to-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-fuchsia-600 text-white font-bold text-xs flex items-center justify-center">2</div>
                <CardTitle className="text-lg">Title</CardTitle>
              </div>
              <span className={`text-xs font-medium ${titleValid ? 'text-muted-foreground' : 'text-red-600'}`}>{titleWordCount}/{TITLE_WORD_LIMIT} words</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Concise Statement Of The Main Topic" className={!titleValid ? 'border-red-400' : ''} />
            <p className="text-[11px] text-muted-foreground mt-1">Capitalize Each Word. Max {TITLE_WORD_LIMIT} words.</p>
          </CardContent>
        </Card>

        {/* Section 3: Authors */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-rose-50 to-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-rose-600 text-white font-bold text-xs flex items-center justify-center">3</div>
                <CardTitle className="text-lg">Author(s)</CardTitle>
                <Badge variant="outline" className="text-[10px]">{authors.length} listed</Badge>
              </div>
              <Button size="sm" variant="outline" onClick={addAuthor}><Plus className="h-4 w-4 mr-1" /> Add author</Button>
            </div>
            <CardDescription>Mark one author as corresponding by selecting the radio button. Author details are hidden from reviewers (double-blind).</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {authors.map((a, i) => (
              <div key={i} className={`border rounded-lg p-3 ${a.isCorresponding ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50/50'}`}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 bg-white rounded border">#{i + 1}{i === 0 ? ' · principal' : ''}</span>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer font-medium">
                      <input type="radio" name="corr" checked={a.isCorresponding} onChange={() => setCorresponding(i)} />
                      Corresponding *
                    </label>
                    {a.isCorresponding && <Badge className="bg-rose-600 text-[10px]">CORRESPONDING</Badge>}
                  </div>
                  {authors.length > 1 && <Button size="sm" variant="ghost" className="text-red-600 h-7" onClick={() => removeAuthor(i)}><Trash2 className="h-3 w-3" /></Button>}
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
          </CardContent>
        </Card>

        {/* Section 4: Abstract body */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">4</div>
                <CardTitle className="text-lg">Abstract body</CardTitle>
              </div>
              <span className={`text-xs font-medium ${bodyValid ? 'text-muted-foreground' : 'text-red-600'}`}>{bodyWordCount}/{WORD_LIMIT} words</span>
            </div>
            <CardDescription>Type your abstract directly OR upload a Word document. Recommended structure shown below.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Textarea rows={12} value={body} onChange={e => setBody(e.target.value)}
                  className={!bodyValid ? 'border-red-400' : ''}
                  placeholder={`Structure your abstract with:\n\n${sectionHints.map(([h, hint]) => `${h}: ${hint}`).join('\n\n')}`} />
              </div>
              <div className="border-2 border-dashed rounded-lg p-3 bg-indigo-50/50 border-indigo-300">
                <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><FileUp className="h-4 w-4 text-indigo-600" /> Or upload Word document</div>
                <div className="text-xs text-slate-600 mb-2">
                  <b>.doc / .docx</b> only<br />
                  Max size: <b>2 MB</b><br />
                  Must NOT contain author names (double-blind).
                </div>
                <input type="file" accept=".doc,.docx" onChange={onDocChange} className="text-xs w-full" />
                {docFile && (
                  <div className="mt-2 p-2 bg-white rounded border text-xs">
                    <div className="font-medium truncate">{docFile.name}</div>
                    <div className="text-muted-foreground">{(docFile.size / 1024).toFixed(1)} KB</div>
                    <button className="text-red-600 mt-1 text-[11px]" onClick={() => setDocFile(null)}>Remove</button>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Recommended sections:</span>
              {sectionHints.map(([h]) => <Badge key={h} variant="outline" className="text-[10px] bg-white">{h}</Badge>)}
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Keywords + Disclosure */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-amber-600 text-white font-bold text-xs flex items-center justify-center">5</div>
              <CardTitle className="text-lg">Keywords & disclosure</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div>
              <div className="flex justify-between items-center">
                <Label>Keywords <span className="text-slate-500 font-normal text-xs">(3 – 5, comma separated)</span></Label>
                <span className={`text-xs font-medium ${keywordList.length >= 3 && keywordList.length <= 5 ? 'text-emerald-600' : 'text-red-600'}`}>{keywordList.length}/5 keywords</span>
              </div>
              <Input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. diabetes, prevalence, primary care, adherence, kenya" />
              {keywordList.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {keywordList.map((k, i) => <Badge key={i} variant="secondary" className="text-[11px]">{k}</Badge>)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">Enter between 3 and 5 keywords, separated by commas.</p>
            </div>
            <div>
              <Label>Disclosure statement</Label>
              <Textarea rows={3} value={disclosureStatement} onChange={e => setDisclosureStatement(e.target.value)}
                placeholder='If none, state: "No conflict of interest to declare."' />
              <p className="text-[11px] text-muted-foreground mt-1">Funding sources and any conflicts of interest.</p>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Cover letter + submit */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-slate-600 text-white font-bold text-xs flex items-center justify-center">6</div>
              <CardTitle className="text-lg">Cover letter & submit</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div>
              <Label>Cover letter <span className="text-slate-500 font-normal text-xs">(optional)</span></Label>
              <Textarea rows={3} value={coverLetter} onChange={e => setCoverLetter(e.target.value)} placeholder="Optional message to the editors — highlight why this work is important, novel, and appropriate for the conference." />
            </div>
            {submitError && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-300 text-red-800 text-sm whitespace-pre-line">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1"><b>Cannot submit: </b>{submitError}</div>
                <button type="button" onClick={() => setSubmitError('')} className="text-red-500 hover:text-red-700 text-xs shrink-0">✕</button>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => submit(true)} disabled={loading}>Save as draft</Button>
              <Button onClick={() => submit(false)} disabled={loading || !titleValid || !bodyValid} className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 shadow-md">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit abstract for review
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============ ABSTRACT DETAIL ============
function AbstractDetail({ id, route, user, isEditor, isAdmin, isReviewer, setRoute }) {
  const [abs, setAbs] = useState(null)
  const [tab, setTab] = useState('overview')
  const refresh = () => api(`/abstracts/${id}`).then(d => setAbs(d.abstract)).catch(e => toast.error(e.message))
  useEffect(() => { refresh() }, [id])
  if (!abs) return <div className="p-6"><Loader2 className="animate-spin" /></div>

  const isOwner = abs.submittedById === user.id
  const currentStateIndex = TIMELINE_STAGES.findIndex(s => s.key === abs.currentState || s.altKeys?.includes(abs.currentState))
  // Reviewer context — pick best (ACCEPTED > PENDING > DECLINED) of this reviewer's rows
  const myReviewerAsns = (abs.reviewAssignments || []).filter(r => r.reviewerId === user.id)
  const _priority = { ACCEPTED: 0, PENDING: 1, DECLINED: 2 }
  const myReviewerAssignment = myReviewerAsns.sort((a, b) => (_priority[a.invitationStatus] ?? 9) - (_priority[b.invitationStatus] ?? 9))[0]
  const isPureReviewer = !!myReviewerAssignment && !isEditor && !isAdmin && !isOwner
  const canWriteReview = isPureReviewer && myReviewerAssignment.invitationStatus === 'ACCEPTED' && !myReviewerAssignment.report

  // Prefer the explicit `from` route hint captured when navigating here; fall back to
  // role-based defaults so editorial users don't get dumped on "My abstracts".
  const backTarget = route?.from
    || (isEditor || isAdmin ? 'editorial'
      : isReviewer ? 'reviews'
      : 'my-abstracts')
  const backLabel = backTarget === 'editorial' ? 'Editorial Office'
    : backTarget === 'reviews' ? 'My review workspace'
    : backTarget === 'workspace' ? 'My editor workspace'
    : 'My abstracts'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button className="text-sm text-muted-foreground hover:text-foreground mb-3" onClick={() => setRoute({ name: backTarget })}>← Back to {backLabel}</button>
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

      {/* Editorial Process Tracker — hidden for pure reviewers (they only need
          the abstract content + review inputs, not the workflow state chips). */}
      {!isPureReviewer && (
      <Card className="mb-6 overflow-hidden border-0 shadow-md">
        <CardContent className="p-6 bg-gradient-to-br from-white via-indigo-50/40 to-fuchsia-50/40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center">
                <ClipboardCheck className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">Editorial Process Tracker</div>
                <div className="text-[11px] text-muted-foreground">Real-time visibility of your abstract's journey</div>
              </div>
            </div>
            {(() => {
              const currentIdx = TIMELINE_STAGES.findIndex(s => abs.currentState === s.key || s.altKeys?.includes(abs.currentState))
              const pct = currentIdx < 0 ? 0 : Math.round(((currentIdx + 1) / TIMELINE_STAGES.length) * 100)
              return (
                <div className="text-right">
                  <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">{pct}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">completed</div>
                </div>
              )
            })()}
          </div>
          {/* Visual progress bar */}
          {(() => {
            const currentIdx = TIMELINE_STAGES.findIndex(s => abs.currentState === s.key || s.altKeys?.includes(abs.currentState))
            const pct = currentIdx < 0 ? 0 : Math.round(((currentIdx + 1) / TIMELINE_STAGES.length) * 100)
            const failed = ['REJECTED', 'WITHDRAWN'].includes(abs.currentState)
            return (
              <div className="mb-4 h-2 rounded-full bg-slate-200 overflow-hidden relative">
                <div className={`h-full transition-all duration-700 ${failed ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-emerald-500'}`} style={{ width: pct + '%' }} />
              </div>
            )
          })()}
          {/* Stage chips */}
          <div className="flex flex-wrap gap-1">
            {TIMELINE_STAGES.map((s, i) => {
              const passed = abs.stateHistory?.some(h => h.newState === s.key || s.altKeys?.includes(h.newState))
              const current = abs.currentState === s.key || s.altKeys?.includes(abs.currentState)
              return (
                <div key={s.key} className="flex items-center">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition ${current ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200' : passed ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-500 border border-slate-200'}`}>
                    {passed && !current && <CheckCircle2 className="h-3 w-3" />}
                    {current && <Clock className="h-3 w-3 animate-pulse" />}
                    {s.label}
                  </div>
                  {i < TIMELINE_STAGES.length - 1 && <div className={`h-px w-3 ${passed ? 'bg-emerald-300' : 'bg-slate-300'}`} />}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Inline review flow for a pure reviewer with an ACCEPTED, not-yet-submitted assignment.
          Abstract content is shown FIRST (clearly labelled), then the review inputs below. */}
      {isPureReviewer && (
        <ReviewerAbstractView abstract={abs} />
      )}
      {canWriteReview && <InlineReviewForm abstract={abs} assignmentId={myReviewerAssignment.id} onDone={refresh} />}

      {/* Editorial tabs — hidden for pure reviewers (they only need abstract + inputs) */}
      {!isPureReviewer && (
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

          {(() => {
            const myRoles = (user?.roles || []).map(r => r.role || r)
            const isChiefOrAdmin = myRoles.some(r => ['CHIEF_EDITOR', 'SYSTEM_ADMIN'].includes(r))
            const isAssignedEditor = (abs.editorAssignments || []).some(e => e.active && e.editorId === user?.id)
            // Committee editors may only edit the abstracts assigned to them; the Chief
            // Editor and Admin retain edit access to all abstracts. Everyone else sees
            // no editorial actions on this abstract.
            const canEditorEdit = isChiefOrAdmin || isAssignedEditor
            if (!canEditorEdit) {
              // If the viewer is any kind of editor but not assigned, show a friendly note
              if (isEditor || isAdmin) {
                return (
                  <Card className="border-dashed">
                    <CardContent className="p-4 flex items-start gap-3 text-sm text-slate-600">
                      <AlertCircle className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-700 mb-0.5">Read-only view</div>
                        You are viewing this abstract's summary from the Editorial Office. Only the
                        assigned Committee Editor, the Chief Editor and the System Admin can edit
                        it here. Open <span className="font-medium">My Editor Workspace</span> to
                        manage abstracts assigned to you.
                      </div>
                    </CardContent>
                  </Card>
                )
              }
              return null
            }
            return (
              <>
                <TechnicalScoringPanel abstractId={id} user={user} />
                <EditorialPanel abs={abs} onRefresh={refresh} user={user} />
              </>
            )
          })()}
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
      )}
    </div>
  )
}

// ============ EDITORIAL PANEL (editors/admins) ============
function EditorialPanel({ abs, onRefresh, user }) {
  const [reviewers, setReviewers] = useState([])
  const [committeeEditors, setCommitteeEditors] = useState([])
  useEffect(() => {
    // Only registered external reviewers appear in the dropdown; the "invite by email"
    // input at the bottom covers reviewers who haven't registered yet.
    api('/users?role=EXTERNAL_REVIEWER').then(d => setReviewers(d.users || []))
    // Committee editors: COMMITTEE_EDITOR + legacy COMMITTEE_MEMBER + CHIEF_EDITOR
    Promise.all([
      api('/users?role=COMMITTEE_EDITOR').catch(() => ({ users: [] })),
      api('/users?role=COMMITTEE_MEMBER').catch(() => ({ users: [] })),
      api('/users?role=CHIEF_EDITOR').catch(() => ({ users: [] })),
    ]).then(([a, b, c]) => {
      const map = {}
      ;[...(a.users || []), ...(b.users || []), ...(c.users || [])].forEach(u => { map[u.id] = u })
      setCommitteeEditors(Object.values(map))
    })
  }, [])

  const myRoles = (user?.roles || []).map(r => r.role || r)
  // Only System Admin and Chief Editor can assign a committee editor. The Chief Editor
  // may also assign themselves.
  const isChiefOrAdmin = myRoles.some(r => ['CHIEF_EDITOR', 'SYSTEM_ADMIN'].includes(r))
  const canAssignEditor = isChiefOrAdmin
  // Reviewer invitations remain in the assigned committee editor's workspace, or with
  // the Chief Editor / Admin as an oversight fallback.
  const isAssignedEditor = (abs.editorAssignments || []).some(e => e.active && e.editorId === user?.id)
  const canInviteReviewers = isChiefOrAdmin || isAssignedEditor
  const assignedEditor = (abs.editorAssignments || []).find(e => e.active)

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

  const assignCommitteeEditor = async (editorId) => {
    if (!editorId) return
    try {
      await api(`/abstracts/${abs.id}/assign-editor`, { method: 'POST', body: JSON.stringify({ editorId, role: 'COMMITTEE_EDITOR' }) })
      toast.success(assignedEditor ? 'Committee editor reassigned' : 'Committee editor assigned')
      onRefresh()
    } catch (e) { toast.error(e.message) }
  }
  const assignReviewer = async (reviewerId, reviewType) => {
    await api(`/abstracts/${abs.id}/assign-reviewer`, { method: 'POST', body: JSON.stringify({ reviewerId, reviewType }) })
    toast.success('Reviewer assigned'); onRefresh()
  }

  // Invite an external reviewer by email (unregistered) — sends registration link email
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteSpecialty, setInviteSpecialty] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [showEmailInvite, setShowEmailInvite] = useState(false)
  const [inviting, setInviting] = useState(false)

  const sendEmailInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) return toast.error('Enter a valid email address')
    setInviting(true)
    try {
      await api('/reviewer-invitations', { method: 'POST', body: JSON.stringify({
        email: inviteEmail.trim(),
        fullName: inviteName.trim() || null,
        specialty: inviteSpecialty.trim() || null,
        message: inviteMsg.trim() || null,
        abstractId: abs.id,
      }) })
      toast.success(`Invitation email sent to ${inviteEmail}`)
      setInviteEmail(''); setInviteName(''); setInviteSpecialty(''); setInviteMsg(''); setShowEmailInvite(false)
    } catch (e) { toast.error(e.message) } finally { setInviting(false) }
  }

  const STATES = ['EDITORIAL_ASSIGNMENT', 'TECHNICAL_CHECK', 'RETURNED_FOR_FORMATTING', 'COMMITTEE_REVIEW', 'EXTERNAL_PEER_REVIEW', 'REVIEWS_COMPLETED', 'EDITORIAL_DECISION', 'MAJOR_REVISION', 'MINOR_REVISION', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'ORAL', 'POSTER', 'PROGRAMME_SCHEDULING', 'PUBLISHED', 'ARCHIVED']

  // Filter already-assigned reviewers from the dropdown
  const assignedReviewerIds = new Set((abs.reviewAssignments || []).map(r => r.reviewerId))
  const availableReviewers = reviewers.filter(r => !assignedReviewerIds.has(r.id))

  return (
    <Card className="border-indigo-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-indigo-600" /> Editorial actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Committee Editor assignment */}
        <div>
          <div className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-indigo-600" /> Committee editor
            {!canAssignEditor && <Badge variant="outline" className="text-[10px]">read-only</Badge>}
          </div>
          {assignedEditor ? (
            <div className="mb-2 rounded-md border border-indigo-200 bg-indigo-50 p-2">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-indigo-700">Currently assigned</div>
              <div className="font-medium">{assignedEditor.editor?.firstName} {assignedEditor.editor?.lastName}</div>
              <div className="text-[11px] text-muted-foreground">{assignedEditor.editor?.email}</div>
            </div>
          ) : (
            <div className="mb-2 rounded-md border border-dashed border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" /> No committee editor assigned yet.
            </div>
          )}
          {canAssignEditor ? (
            <Select value="" onValueChange={assignCommitteeEditor}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={assignedEditor ? 'Reassign to another committee editor…' : 'Choose a committee editor…'} />
              </SelectTrigger>
              <SelectContent>
                {committeeEditors.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No committee editors registered</div>}
                {committeeEditors
                  .filter(ce => !assignedEditor || ce.id !== assignedEditor.editorId)
                  .map(ce => {
                    const rs = (ce.roles || []).map(r => r.role || r)
                    const isChief = rs.includes('CHIEF_EDITOR')
                    const isMe = ce.id === user?.id
                    return (
                      <SelectItem key={ce.id} value={ce.id}>
                        {ce.title ? `${ce.title} ` : ''}{ce.firstName} {ce.lastName}
                        {isChief && ' · Chief Editor'}
                        {isMe && ' (me)'}
                      </SelectItem>
                    )
                  })}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              Only the Chief Editor and System Admin can assign or reassign a committee editor.
            </div>
          )}
        </div>

        <Separator />

        {/* Reviewer invitations */}
        {canInviteReviewers ? (
          <div>
            <div className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Send className="h-4 w-4 text-purple-600" /> Invite external reviewer
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Pick a registered reviewer from the dropdown, or use the last option to invite someone by email — they'll receive an email with a registration link.
            </p>
            <Select value=""
              onValueChange={(v) => {
                if (v === '__email__') { setShowEmailInvite(true); return }
                assignReviewer(v, 'EXTERNAL_REVIEWER')
              }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a registered reviewer or invite by email…" /></SelectTrigger>
              <SelectContent>
                {availableReviewers.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No registered external reviewers left to invite</div>
                ) : availableReviewers.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title ? `${r.title} ` : ''}{r.firstName} {r.lastName}
                    {r.specialties?.length > 0 && ` · ${r.specialties.slice(0, 2).join(', ')}`}
                  </SelectItem>
                ))}
                <div className="border-t my-1" />
                <SelectItem value="__email__">
                  ✉️  Invite external reviewer by email…
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Inline email-invite form */}
            {showEmailInvite && (
              <div className="mt-3 rounded-md border border-purple-200 bg-purple-50/40 p-3 space-y-2">
                <div className="text-xs font-semibold text-purple-700">Invite a new external reviewer</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Email *</Label><Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="reviewer@example.com" /></div>
                  <div><Label className="text-xs">Full name</Label><Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Dr. Jane Doe" /></div>
                </div>
                <div><Label className="text-xs">Specialty / expertise</Label><Input value={inviteSpecialty} onChange={e => setInviteSpecialty(e.target.value)} placeholder="e.g. Cardiology" /></div>
                <div><Label className="text-xs">Personal note (optional)</Label><Textarea rows={2} value={inviteMsg} onChange={e => setInviteMsg(e.target.value)} placeholder="A short line to the invitee — appears in the email." /></div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => { setShowEmailInvite(false); setInviteEmail(''); setInviteName(''); setInviteSpecialty(''); setInviteMsg('') }}>Cancel</Button>
                  <Button size="sm" onClick={sendEmailInvite} disabled={inviting} className="bg-purple-600 hover:bg-purple-700">
                    {inviting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Send invitation email
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-700 mb-0.5">Reviewer invitations restricted</div>
              Only the assigned Committee Editor and the Chief Editor can invite reviewers for this abstract. The Chief Editor / Admin assigns a Committee Editor from the panel above.
            </div>
          </div>
        )}

        <Separator />

        <div>
          <div className="text-sm font-semibold mb-2">Editorial process stage</div>
          <div className="flex gap-2">
            <Select value={transitionTarget} onValueChange={setTransitionTarget}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Choose editorial process stage" /></SelectTrigger>
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
                <SelectItem value="MINOR_REVISION">Minor revision</SelectItem>
                <SelectItem value="MAJOR_REVISION">Major revision</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
                <SelectItem value="WITHDRAW">Withdraw</SelectItem>
                <SelectItem value="ACCEPT">Accept</SelectItem>
                <SelectItem value="REJECT">Reject</SelectItem>
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
                {(d.sizeBytes / 1024).toFixed(1)} KB · Uploaded by {d.uploadedBy?.firstName} {d.uploadedBy?.lastName} · {formatDate(d.createdAt)}
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
  const isPrivileged = isEditor || isAdmin // author sees a blinded view — reviewer identities are hidden
  return (
    <Card>
      <CardHeader><CardTitle>Peer reviews</CardTitle><CardDescription>{isPrivileged ? 'Reviews submitted by assigned reviewers' : 'Blind reviewer feedback — reviewer identities are hidden to preserve double-blind integrity'}</CardDescription></CardHeader>
      <CardContent>
        {assignments.length === 0 ? <div className="text-sm text-muted-foreground py-4">No reviewers assigned yet</div>
        : assignments.map((a, idx) => (
          <div key={a.id} className="border rounded-md p-4 mb-3">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-medium">
                  {isPrivileged
                    ? `${a.reviewer.firstName} ${a.reviewer.lastName}`
                    : `Reviewer ${idx + 1}`}
                </div>
                <div className="text-xs text-muted-foreground">{a.reviewType.replace('_',' ')} · Invited {formatDate(a.assignedAt)}</div>
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
  const [committeeEditors, setCommitteeEditors] = useState([])
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const refresh = () => api('/abstracts').then(d => setAll(d.abstracts || [])).finally(() => setLoading(false))
  useEffect(() => {
    refresh()
    // Fetch users eligible to serve as Committee Editors (COMMITTEE_MEMBER + COMMITTEE_EDITOR)
    Promise.all([
      api('/users?role=COMMITTEE_MEMBER').catch(() => ({ users: [] })),
      api('/users?role=COMMITTEE_EDITOR').catch(() => ({ users: [] })),
    ]).then(([a, b]) => {
      const map = {}
      ;[...(a.users || []), ...(b.users || [])].forEach(u => { map[u.id] = u })
      setCommitteeEditors(Object.values(map))
    })
    api('/auth/me').then(d => setMe(d.user)).catch(() => {})
  }, [])
  const q = search.trim().toLowerCase()
  const visible = all.filter(a => {
    if (filter && a.currentState !== filter) return false
    if (!q) return true
    if (a.title?.toLowerCase().includes(q)) return true
    if (a.submissionCode?.toLowerCase().includes(q)) return true
    // Search across all author names (multi-author aware)
    if ((a.authors || []).some(au => (au.fullName || '').toLowerCase().includes(q))) return true
    if (a.submittedBy) {
      const full = `${a.submittedBy.firstName || ''} ${a.submittedBy.lastName || ''}`.toLowerCase()
      if (full.includes(q)) return true
    }
    return false
  })

  const myRoles = (me?.roles || []).map(r => r.role || r)
  // Only System Admin and Chief Editor can assign / reassign a Committee Editor.
  // Managing Editors, Committee Editors and Section Editors are read-only in this panel.
  const canAssignEditor = myRoles.some(r => ['CHIEF_EDITOR', 'SYSTEM_ADMIN'].includes(r))

  const assignCommitteeEditor = async (abstractId, editorId) => {
    if (!editorId) return
    try {
      await api(`/abstracts/${abstractId}/assign-editor`, { method: 'POST', body: JSON.stringify({ editorId, role: 'COMMITTEE_EDITOR' }) })
      toast.success('Committee Editor assigned')
      refresh()
    } catch (e) { toast.error(e.message) }
  }

  // Compute stat summary
  const stats = {
    total: all.length,
    awaitingAssignment: all.filter(a => !(a.editorAssignments || []).some(e => e.active) && !['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'PUBLISHED'].includes(a.currentState)).length,
    inReview: all.filter(a => ['COMMITTEE_REVIEW', 'EXTERNAL_PEER_REVIEW', 'REVIEWS_COMPLETED', 'EDITORIAL_DECISION'].includes(a.currentState)).length,
    accepted: all.filter(a => ['ACCEPTED', 'ORAL', 'POSTER', 'FINAL_ACCEPTANCE', 'PROGRAMME_SCHEDULING', 'PUBLISHED'].includes(a.currentState)).length,
    rejected: all.filter(a => a.currentState === 'REJECTED').length,
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><ClipboardCheck className="h-7 w-7 text-indigo-600" /> Editorial Office</h1>
          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">Central overview</Badge>
        </div>
        <p className="text-muted-foreground text-sm">All submissions across the platform. Author correspondence is handled inside each assigned editor's workspace.</p>
      </div>

      {/* Stat summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatBadge label="Total papers" value={stats.total} color="from-slate-600 to-slate-700" icon={FileText} />
        <StatBadge label="Awaiting editor" value={stats.awaitingAssignment} color="from-amber-500 to-orange-600" icon={AlertCircle} attention />
        <StatBadge label="In review" value={stats.inReview} color="from-indigo-500 to-fuchsia-500" icon={Clock} />
        <StatBadge label="Accepted" value={stats.accepted} color="from-emerald-500 to-teal-600" icon={CheckCircle2} />
        <StatBadge label="Rejected" value={stats.rejected} color="from-rose-500 to-red-600" icon={XCircle} />
      </div>

      {/* Filter bar */}
      <Card className="mb-4 border-0 shadow-sm">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title, submission code or author name" className="pl-8" />
          </div>
          <Select value={filter || 'ALL'} onValueChange={(v) => setFilter(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Filter by state" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All states ({all.length})</SelectItem>
              {['SUBMITTED','TECHNICAL_CHECK','EDITORIAL_ASSIGNMENT','COMMITTEE_REVIEW','EXTERNAL_PEER_REVIEW','REVIEWS_COMPLETED','EDITORIAL_DECISION','MINOR_REVISION','MAJOR_REVISION','ACCEPTED','REJECTED']
                .map(s => <SelectItem key={s} value={s}>{stateLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground shrink-0">{visible.length} paper{visible.length !== 1 ? 's' : ''}</div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? <div className="p-10 text-center"><Loader2 className="animate-spin inline" /></div>
      : visible.length === 0 ? <EmptyState label="No abstracts match filter" />
      : <div className="grid gap-3">{visible.map(a => (
          <EditorialAbstractRow
            key={a.id}
            a={a}
            onOpen={() => setRoute({ name: 'abstract', id: a.id, from: 'editorial' })}
            committeeEditors={committeeEditors}
            canAssignEditor={canAssignEditor}
            onAssignEditor={(editorId) => assignCommitteeEditor(a.id, editorId)}
          />
        ))}</div>}
    </div>
  )
}

function StatBadge({ label, value, color, icon: Icon, attention }) {
  return (
    <Card className={`overflow-hidden border-0 shadow-md ${attention && value > 0 ? 'ring-2 ring-amber-300' : ''}`}>
      <div className={`bg-gradient-to-br ${color} p-3 text-white flex items-center justify-between`}>
        <Icon className="h-5 w-5 opacity-90" />
        <div className="text-3xl font-bold">{value}</div>
      </div>
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600 bg-white">{label}</div>
    </Card>
  )
}

function EditorialAbstractRow({ a, onOpen, committeeEditors = [], canAssignEditor = false, onAssignEditor, inWorkspace }) {
  const assignedEditor = (a.editorAssignments || []).find(e => e.active) || (a.editorAssignments || [])[0]
  const reviewers = a.reviewAssignments || []
  const techScore = a.technicalScoreAverage
  const techScoreCount = a.technicalScoreCount || 0
  const scoreColor = techScore == null ? 'bg-slate-400'
    : techScore >= 8 ? 'bg-emerald-600'
    : techScore >= 6 ? 'bg-lime-600'
    : techScore >= 4 ? 'bg-amber-500'
    : 'bg-rose-600'
  const stateColor = ({
    SUBMITTED: 'bg-slate-500', TECHNICAL_CHECK: 'bg-blue-500', EDITORIAL_ASSIGNMENT: 'bg-amber-500',
    COMMITTEE_REVIEW: 'bg-indigo-500', EXTERNAL_PEER_REVIEW: 'bg-fuchsia-500', REVIEWS_COMPLETED: 'bg-teal-500',
    EDITORIAL_DECISION: 'bg-purple-500', ACCEPTED: 'bg-green-600', REJECTED: 'bg-red-600',
    MINOR_REVISION: 'bg-amber-500', MAJOR_REVISION: 'bg-orange-500',
  })[a.currentState] || 'bg-slate-500'
  return (
    <Card className="hover:shadow-md transition">
      <CardContent className="p-4">
        <div className="flex items-start gap-4 cursor-pointer" onClick={onOpen}>
          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
            {a.submissionCode?.split('-').pop() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-semibold text-indigo-600">{a.submissionCode}</span>
              <Badge className={`${stateColor} text-white text-[10px]`}>{stateLabel(a.currentState)}</Badge>
              {a.theme?.name && <Badge variant="outline" className="text-[10px]">{a.theme.name}</Badge>}
              {a.reportType && <Badge variant="outline" className="text-[10px]">{a.reportType.replace(/_/g, ' ')}</Badge>}
              {/* Technical score summary — helps editors prioritise */}
              {techScore != null ? (
                <span className={`inline-flex items-center gap-1 rounded-md ${scoreColor} text-white text-[10px] font-semibold px-2 py-0.5`} title={`Average of ${techScoreCount} committee score${techScoreCount !== 1 ? 's' : ''}`}>
                  <ClipboardCheck className="h-3 w-3" /> Tech {techScore}/10
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5" title="No committee technical scores submitted yet">
                  <ClipboardCheck className="h-3 w-3" /> Tech —
                </span>
              )}
            </div>
            <div className="font-semibold mb-2 truncate">{a.title}</div>
            <div className="grid md:grid-cols-2 gap-3 mt-2 text-xs">
              {/* Assigned editor */}
              <div className={`rounded p-2 border ${assignedEditor ? 'bg-indigo-50 border-indigo-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${assignedEditor ? 'text-indigo-700' : 'text-amber-700'}`}>Committee editor</div>
                {assignedEditor ? (
                  <div className="mt-1">
                    <div className="font-semibold text-slate-800">{assignedEditor.editor?.firstName} {assignedEditor.editor?.lastName}</div>
                    <div className="text-[10px] text-slate-500">{assignedEditor.editor?.email}</div>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-1 text-amber-800">
                    <AlertCircle className="h-3 w-3" />
                    <span className="italic">Awaiting assignment to committee editor</span>
                  </div>
                )}
              </div>
              {/* Reviewers */}
              <div className={`rounded p-2 border ${reviewers.length > 0 ? 'bg-fuchsia-50 border-fuchsia-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${reviewers.length > 0 ? 'text-fuchsia-700' : 'text-slate-600'}`}>External reviewers · {reviewers.length}</div>
                {reviewers.length === 0 ? (
                  <div className="mt-1 italic text-slate-500">No reviewers assigned yet</div>
                ) : (
                  <div className="mt-1 space-y-0.5">
                    {reviewers.slice(0, 3).map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{r.reviewer?.firstName} {r.reviewer?.lastName}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">{r.status || 'PENDING'}</Badge>
                      </div>
                    ))}
                    {reviewers.length > 3 && <div className="text-[10px] text-slate-500">+{reviewers.length - 3} more</div>}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3" /> Submitted {a.submittedAt ? formatDate(a.submittedAt) : '—'}
              {assignedEditor && <span>· Author correspondence handled in editor's workspace</span>}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
        </div>

        {/* Assign Committee Editor control — only for Chief Editor / Managing Editor / System Admin */}
        {canAssignEditor && !inWorkspace && (
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-600 shrink-0">
              {assignedEditor ? 'Reassign to' : 'Assign to'}
            </span>
            <Select value="" onValueChange={(v) => onAssignEditor && onAssignEditor(v)}>
              <SelectTrigger className="w-64 h-8 text-xs bg-white">
                <SelectValue placeholder={assignedEditor ? 'Select a different Committee Editor…' : 'Choose Committee Editor…'} />
              </SelectTrigger>
              <SelectContent>
                {committeeEditors.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No committee editors available</div>}
                {committeeEditors
                  .filter(ce => !assignedEditor || ce.id !== assignedEditor.editorId)
                  .map(ce => (
                    <SelectItem key={ce.id} value={ce.id}>
                      {ce.title ? `${ce.title} ` : ''}{ce.firstName} {ce.lastName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {assignedEditor && (
              <span className="text-[10px] text-muted-foreground">
                Currently: {assignedEditor.editor?.firstName} {assignedEditor.editor?.lastName}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============ REVIEWER WORKSPACE ============
function ReviewerWorkspace({ setRoute }) {
  const [assignments, setAssignments] = useState([])
  const [active, setActive] = useState(null)
  const [filter, setFilter] = useState('all')
  const refresh = () => api('/reviewer/assignments').then(d => setAssignments(d.assignments || []))
  useEffect(() => { refresh() }, [])

  const pendingInv = assignments.filter(a => a.invitationStatus === 'PENDING').length
  const inProgress = assignments.filter(a => a.invitationStatus === 'ACCEPTED' && !a.report).length
  const submitted = assignments.filter(a => a.report).length
  const dueSoon = assignments.filter(a => a.invitationStatus === 'ACCEPTED' && !a.report && a.dueDate && new Date(a.dueDate) - new Date() < 7 * 86400000).length

  const visible = assignments.filter(a => {
    if (filter === 'all') return true
    if (filter === 'pending') return a.invitationStatus === 'PENDING'
    if (filter === 'progress') return a.invitationStatus === 'ACCEPTED' && !a.report
    if (filter === 'submitted') return !!a.report
    return true
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Award className="h-7 w-7 text-purple-600" /> My Review workspace</h1>
          <Badge className="bg-purple-100 text-purple-700 border-purple-200">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">Your review assignments across all conferences. Double-blind: author identities are hidden.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatBadge label="Pending invitations" value={pendingInv} color="from-amber-500 to-orange-600" icon={AlertCircle} attention />
        <StatBadge label="In progress" value={inProgress} color="from-indigo-500 to-purple-600" icon={Clock} />
        <StatBadge label="Due within 7 days" value={dueSoon} color="from-rose-500 to-red-600" icon={AlertCircle} attention />
        <StatBadge label="Submitted" value={submitted} color="from-emerald-500 to-teal-600" icon={CheckCircle2} />
      </div>

      <Card className="mb-4 border-0 shadow-sm">
        <CardContent className="p-3 flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {[['all', 'All'], ['pending', 'Pending'], ['progress', 'In progress'], ['submitted', 'Submitted']].map(([k, l]) => (
              <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} onClick={() => setFilter(k)} className={filter === k ? 'bg-purple-600 hover:bg-purple-700' : ''}>{l}</Button>
            ))}
          </div>
          <div className="ml-auto text-xs text-muted-foreground">{visible.length} shown</div>
        </CardContent>
      </Card>

      {visible.length === 0 ? <EmptyState label="No review assignments in this view" /> : (
        <div className="grid gap-3">
          {visible.map(a => {
            const isPending = a.invitationStatus === 'PENDING'
            const isDeclined = a.invitationStatus === 'DECLINED'
            const done = !!a.report
            return (
              <Card key={a.id} className={`overflow-hidden ${isPending ? 'ring-1 ring-amber-200' : isDeclined ? 'ring-1 ring-rose-200 opacity-80' : done ? 'ring-1 ring-emerald-200' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    <div className="flex gap-3 flex-1 min-w-[300px]">
                      <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${isPending ? 'bg-amber-500' : isDeclined ? 'bg-rose-500' : done ? 'bg-emerald-600' : 'bg-purple-600'} text-white`}>
                        <Award className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-slate-500">{a.abstract.submissionCode}</span>
                          <Badge variant="outline" className="text-[10px]">{a.reviewType.replace('_', ' ')}</Badge>
                          <Badge className={`text-[10px] border ${STATE_COLORS[a.abstract.currentState] || ''}`}>{stateLabel(a.abstract.currentState)}</Badge>
                          {isPending ? <Badge className="bg-amber-500 text-white text-[10px]">INVITATION PENDING</Badge>
                            : isDeclined ? <Badge className="bg-rose-500 text-white text-[10px]">YOU DECLINED</Badge>
                            : done ? <Badge className="bg-emerald-600 text-[10px]">SUBMITTED</Badge>
                            : <Badge className="bg-purple-600 text-[10px]">ACCEPTED — REVIEW DUE</Badge>}
                        </div>
                        <div className="font-semibold text-lg">{a.abstract.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Invited {formatDate(a.assignedAt)}
                          {a.dueDate && ` · Due ${formatDate(a.dueDate)}`}
                          {a.completedAt && ` · Completed ${formatDate(a.completedAt)}`}
                        </div>
                        {isPending && (
                          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2 inline-block">
                            Please accept the invitation to view the abstract.
                          </div>
                        )}
                        {isDeclined && (
                          <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded px-2 py-1 mt-2 inline-block">
                            You declined this review. The editorial office has been notified.
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {isPending && (
                        <>
                          <Button size="sm" variant="outline" onClick={async () => {
                            if (!confirm('Decline this review invitation? The committee editor will be notified and you will no longer have access to this abstract.')) return
                            await api(`/reviewer/assignments/${a.id}/respond`, { method: 'POST', body: JSON.stringify({ status: 'DECLINED' }) })
                            toast.success('Invitation declined. Editors have been notified.')
                            refresh()
                          }}>Decline</Button>
                          <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={async () => {
                            await api(`/reviewer/assignments/${a.id}/respond`, { method: 'POST', body: JSON.stringify({ status: 'ACCEPTED' }) })
                            toast.success('Invitation accepted. You can now view the abstract.')
                            refresh()
                          }}>Accept</Button>
                        </>
                      )}
                      {/* Abstract is viewable only AFTER acceptance */}
                      {!isPending && !isDeclined && (
                        <Button size="sm" variant="outline" onClick={() => setRoute({ name: 'abstract', id: a.abstract.id, from: 'reviews' })}>Open abstract</Button>
                      )}
                      {a.invitationStatus === 'ACCEPTED' && !a.report && (
                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setRoute({ name: 'abstract', id: a.abstract.id, from: 'reviews' })}>Open &amp; review</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
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

  // Fetch the FULL abstract (with body + latest version + author-uploaded documents)
  // so the reviewer sees exactly what they are reviewing without leaving the dialog.
  const [fullAbstract, setFullAbstract] = useState(null)
  const [absLoading, setAbsLoading] = useState(true)
  useEffect(() => {
    api(`/abstracts/${assignment.abstract.id}`)
      .then(d => setFullAbstract(d.abstract))
      .catch(e => toast.error(e.message))
      .finally(() => setAbsLoading(false))
  }, [assignment.abstract.id])

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
      toast.success('Review submitted to the committee editor')
      onDone()
    } catch (e) { toast.error(e.message || 'Failed to submit review') }
    finally { setSubmitting(false) }
  }

  const latestVersion = fullAbstract?.versions?.[0]
  const authorDocs = (fullAbstract?.documents || []).filter(d =>
    ['ABSTRACT', 'FIGURE', 'SUPPLEMENTARY', 'COVER_LETTER'].includes(d.category)
  )

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Submit review — {assignment.abstract.submissionCode}</DialogTitle>
          <DialogDescription>Your review will be delivered to the committee editor who invited you.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-2.5 rounded-md bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
            <span><strong>Double-blind:</strong> author identities are hidden. Your review, scores, comments and any attached files go directly to the <strong>committee editor</strong>. You never correspond with the author.</span>
          </div>

          {/* ── LATEST ABSTRACT SUBMISSION FROM THE AUTHOR ── */}
          <Card className="border-indigo-200 border-2 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-indigo-50 via-white to-fuchsia-50 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-indigo-600 text-white text-[10px] uppercase tracking-widest">Latest submission</Badge>
                {latestVersion && <Badge variant="outline" className="text-[10px]">v{latestVersion.versionNumber}</Badge>}
                {fullAbstract?.theme && <Badge variant="outline" className="text-[10px]">{fullAbstract.theme.name}</Badge>}
                {fullAbstract?.reportType && <Badge variant="outline" className="text-[10px]">{fullAbstract.reportType.replace(/_/g, ' ')}</Badge>}
              </div>
              <CardTitle className="text-lg leading-snug mt-1">{fullAbstract?.title || assignment.abstract.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-3">
              {absLoading ? (
                <div className="py-6 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin text-indigo-500" /><div className="text-xs text-muted-foreground mt-1">Loading the latest version…</div></div>
              ) : latestVersion ? (
                <>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">Abstract body</div>
                    <div className="max-h-72 overflow-auto p-3 border rounded bg-slate-50 text-sm whitespace-pre-wrap leading-relaxed">
                      {latestVersion.body || <em className="text-muted-foreground">No body content provided.</em>}
                    </div>
                  </div>
                  {latestVersion.keywords?.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">Keywords</div>
                      <div className="flex flex-wrap gap-1">
                        {latestVersion.keywords.map(k => <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">{k}</span>)}
                      </div>
                    </div>
                  )}
                  {authorDocs.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">Author-uploaded documents</div>
                      <div className="space-y-1">
                        {authorDocs.map(d => (
                          <a key={d.id} href={d.storagePath || d.url || `/api/uploads/${d.filePath}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 border rounded hover:bg-slate-50 text-sm">
                            <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span className="flex-1 truncate">{d.fileName}</span>
                            <Badge variant="outline" className="text-[10px]">{d.category}</Badge>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground italic">No version content available.</div>
              )}
            </CardContent>
          </Card>

          {/* ── REVIEW SCORES ── */}
          <div>
            <Label className="text-sm font-semibold">Scores (1–10)</Label>
            <div className="grid grid-cols-5 gap-2 mt-1">
              {['originalityScore','significanceScore','methodologyScore','clarityScore','overallScore'].map(k => (
                <div key={k}>
                  <Label className="text-[10px] text-muted-foreground">{k.replace('Score','').replace(/^./, c => c.toUpperCase())}</Label>
                  <Input type="number" min={1} max={10} value={scores[k]} onChange={e => setScores({ ...scores, [k]: parseInt(e.target.value) || 0 })} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold">Recommendation</Label>
            <Select value={recommendation} onValueChange={setRecommendation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MINOR_REVISION">Minor revision</SelectItem>
                <SelectItem value="MAJOR_REVISION">Major revision</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
                <SelectItem value="ACCEPT">Accept</SelectItem>
                <SelectItem value="REJECT">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-semibold">Review comments <span className="text-red-500">*</span></Label>
            <p className="text-[11px] text-muted-foreground mb-1">Detailed critique of the abstract — delivered to the committee editor.</p>
            <Textarea rows={7} value={reviewComments} onChange={e => setReviewComments(e.target.value)} placeholder="Strengths, weaknesses, methodology observations, suggestions for improvement…" />
          </div>

          <div>
            <Label className="text-sm font-semibold">Confidential notes to editor (optional)</Label>
            <p className="text-[11px] text-muted-foreground mb-1">Only visible to the committee editor — never shared with the author.</p>
            <Textarea rows={3} value={confidentialNotes} onChange={e => setConfidentialNotes(e.target.value)} placeholder="Concerns, conflicts of interest, or context for the editor…" />
          </div>

          <div>
            <Label className="text-sm font-semibold">Supporting files (optional)</Label>
            <p className="text-[11px] text-muted-foreground mb-1">Annotated abstract, marked-up PDFs or supplementary materials. Files are sent to the committee editor (max 25 MB each).</p>
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
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Send review to committee editor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Full-view abstract card for a pure reviewer — clearly labelled "Abstract"
// and rendered ABOVE the review-input card on AbstractDetail.
function ReviewerAbstractView({ abstract }) {
  const latest = abstract?.versions?.[0]
  const authorDocs = (abstract?.documents || []).filter(d =>
    ['ABSTRACT', 'FIGURE', 'SUPPLEMENTARY', 'COVER_LETTER'].includes(d.category)
  )
  return (
    <Card className="mb-6 border-2 border-slate-200 shadow-md">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-white pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-slate-800 text-white text-[10px] uppercase tracking-widest">Abstract to review</Badge>
          <span className="text-xs font-mono text-slate-500">{abstract.submissionCode}</span>
          {latest && <Badge variant="outline" className="text-[10px]">v{latest.versionNumber}</Badge>}
          {abstract?.theme && <Badge variant="outline" className="text-[10px]">{abstract.theme.name}</Badge>}
          {abstract?.reportType && <Badge variant="outline" className="text-[10px]">{abstract.reportType.replace(/_/g, ' ')}</Badge>}
        </div>
        <CardTitle className="text-xl leading-snug mt-1">{abstract.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">Abstract body</div>
          <div className="p-4 border rounded bg-slate-50 text-sm whitespace-pre-wrap leading-relaxed">
            {latest?.body || <em className="text-muted-foreground">No body content provided.</em>}
          </div>
        </div>
        {latest?.keywords?.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">Keywords</div>
            <div className="flex flex-wrap gap-1">
              {latest.keywords.map(k => (
                <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">{k}</span>
              ))}
            </div>
          </div>
        )}
        {authorDocs.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">Author-uploaded documents</div>
            <div className="space-y-1">
              {authorDocs.map(d => (
                <a
                  key={d.id}
                  href={d.storagePath || d.url || `/api/uploads/${d.filePath}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2 border rounded hover:bg-slate-50 text-sm"
                >
                  <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span className="flex-1 truncate">{d.fileName}</span>
                  <Badge variant="outline" className="text-[10px]">{d.category}</Badge>
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Inline peer-review submission — used on the AbstractDetail page for pure reviewers
// with an ACCEPTED, not-yet-submitted assignment. Renders below the abstract content
// so the reviewer sees the full paper while writing the review.
function InlineReviewForm({ abstract, assignmentId, onDone }) {
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
      for (const f of files) {
        const fd = new FormData()
        fd.append('file', f)
        fd.append('category', 'REVIEWER_ANNOTATION')
        await apiUpload(`/abstracts/${abstract.id}/documents`, fd)
      }
      await api(`/reviewer/assignments/${assignmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          ...scores,
          recommendation,
          commentsToAuthor: reviewComments,
          commentsToEditor: confidentialNotes || null,
        }),
      })
      toast.success('Review submitted to the committee editor')
      onDone && onDone()
    } catch (e) {
      toast.error(e.message || 'Failed to submit review')
    } finally { setSubmitting(false) }
  }

  return (
    <Card className="mb-6 border-2 border-indigo-300 shadow-md">
      <CardHeader className="bg-gradient-to-r from-indigo-50 via-white to-fuchsia-50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center">
            <Award className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Your peer review</CardTitle>
            <CardDescription>Complete the fields below — your review, comments and any attached files are delivered directly to the committee editor.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="p-2.5 rounded-md bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <span><strong>Double-blind:</strong> author identities are hidden. You never correspond with the author — everything you submit here goes to the committee editor.</span>
        </div>

        <div>
          <Label className="text-sm font-semibold">Scores (1–10)</Label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-1">
            {['originalityScore','significanceScore','methodologyScore','clarityScore','overallScore'].map(k => (
              <div key={k}>
                <Label className="text-[10px] text-muted-foreground">{k.replace('Score','').replace(/^./, c => c.toUpperCase())}</Label>
                <Input type="number" min={1} max={10} value={scores[k]} onChange={e => setScores({ ...scores, [k]: parseInt(e.target.value) || 0 })} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-semibold">Recommendation</Label>
          <Select value={recommendation} onValueChange={setRecommendation}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MINOR_REVISION">Minor revision</SelectItem>
              <SelectItem value="MAJOR_REVISION">Major revision</SelectItem>
              <SelectItem value="TRANSFER">Transfer</SelectItem>
              <SelectItem value="ACCEPT">Accept</SelectItem>
              <SelectItem value="REJECT">Reject</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-semibold">Review comments <span className="text-red-500">*</span></Label>
          <p className="text-[11px] text-muted-foreground mb-1">Detailed critique of the abstract — delivered to the committee editor.</p>
          <Textarea rows={8} value={reviewComments} onChange={e => setReviewComments(e.target.value)} placeholder="Strengths, weaknesses, methodology observations, suggestions for improvement…" />
        </div>

        <div>
          <Label className="text-sm font-semibold">Confidential notes to the committee editor (optional)</Label>
          <p className="text-[11px] text-muted-foreground mb-1">Only visible to the editorial team — never shared with the author.</p>
          <Textarea rows={3} value={confidentialNotes} onChange={e => setConfidentialNotes(e.target.value)} placeholder="Concerns, conflicts of interest, or context for the editor…" />
        </div>

        <div>
          <Label className="text-sm font-semibold">Supporting files (optional)</Label>
          <p className="text-[11px] text-muted-foreground mb-1">Annotated abstract, marked-up PDFs or supplementary materials sent to the committee editor (max 25 MB each).</p>
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

        <div className="flex justify-end">
          <Button onClick={submit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Send review to committee editor
          </Button>
        </div>
      </CardContent>
    </Card>
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
              <div>📅 {formatDateRange(c.startDate, c.endDate)}</div>
              <div>📝 Submissions until {formatDate(c.submissionClose)}</div>
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
      if (!conf.attendeeRegistrationOpen) return setError('Attendee registration is not yet open. The organisers will open it approximately one month before the conference. Please try again later, or register as an Author or Sponsor.')
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
              {!conf.attendeeRegistrationOpen && (
                <div className="p-3 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-700" />
                  <div>
                    <div className="font-semibold">Attendee registration is not yet open.</div>
                    Attendee registration is scheduled to open approximately one month before the conference. The organisers will notify you (and enable the toggle in the platform) when it's live. You are welcome to register as an Author or Sponsor now.
                  </div>
                </div>
              )}
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
                Authors submit abstracts through the platform. Registration is open until abstract submission closes ({formatDate(conf.submissionClose)}).
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
          <Button onClick={submit} disabled={saving || (type === 'ATTENDEE' && !conf.attendeeRegistrationOpen)} className="bg-indigo-600 hover:bg-indigo-700">{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Complete registration</Button>
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
  const [manageUser, setManageUser] = useState(null)
  const refresh = () => api('/users').then(d => setUsers(d.users || []))
  useEffect(() => { refresh() }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-3xl font-bold">User management</h1><p className="text-muted-foreground">Manage accounts, roles and permissions. Assign editorial or logistics roles here.</p></div>
        <Button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="h-4 w-4 mr-1" /> Create user</Button>
      </div>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr className="border-b">
            <th className="text-left p-3">Name</th><th className="text-left p-3">Email</th><th className="text-left p-3">Roles</th><th className="text-left p-3">Institution</th><th className="text-left p-3">Country</th><th className="text-left p-3">Actions</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b hover:bg-slate-50">
                <td className="p-3 font-medium">{u.firstName} {u.lastName}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{u.roles.map(r => <Badge key={r.id} variant="outline" className="text-[10px]">{ROLE_LABELS[r.role]}</Badge>)}</div></td>
                <td className="p-3">{u.institution?.name || u.affiliation || '—'}</td>
                <td className="p-3">{u.country || '—'}</td>
                <td className="p-3"><Button size="sm" variant="outline" onClick={() => setManageUser(u)}>Manage roles</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
      {open && <CreateUserDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); refresh() }} />}
      {manageUser && <ManageRolesDialog user={manageUser} onClose={() => setManageUser(null)} onDone={() => { setManageUser(null); refresh() }} />}
    </div>
  )
}

function ManageRolesDialog({ user, onClose, onDone }) {
  const [roles, setRoles] = useState((user.roles || []).map(r => r.role))
  const [saving, setSaving] = useState(false)

  // Categorise roles for the admin UX
  const roleGroups = [
    { label: 'Editorial Committee', keys: ['CHIEF_EDITOR', 'MANAGING_EDITOR', 'COMMITTEE_EDITOR', 'COMMITTEE_MEMBER'] },
    { label: 'Logistics Committee', keys: ['CHIEF_LOGISTICS', 'COMMITTEE_LOGISTICS'] },
    { label: 'Reviewers & Participants', keys: ['EXTERNAL_REVIEWER', 'AUTHOR', 'ATTENDEE', 'INDUSTRY_PARTNER', 'GUEST'] },
    { label: 'Administrative', keys: ['SYSTEM_ADMIN'] },
  ]

  const toggle = (role) => {
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
  }

  const save = async () => {
    setSaving(true)
    try {
      const currentRoles = (user.roles || []).map(r => r.role)
      const toAdd = roles.filter(r => !currentRoles.includes(r))
      const toRemove = currentRoles.filter(r => !roles.includes(r))
      for (const r of toAdd) {
        await api(`/users/${user.id}/roles`, { method: 'POST', body: JSON.stringify({ role: r }) })
      }
      for (const r of toRemove) {
        await api(`/users/${user.id}/roles/${r}`, { method: 'DELETE' })
      }
      toast.success('Roles updated')
      onDone()
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Manage roles — {user.firstName} {user.lastName}</DialogTitle>
          <p className="text-xs text-muted-foreground">Every editorial and logistics role also implicitly grants Author privileges — they can submit abstracts.</p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {roleGroups.map(g => (
            <div key={g.label}>
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1.5">{g.label}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {g.keys.map(r => (
                  <label key={r} className={`flex items-center gap-2 px-2 py-1.5 rounded-md border cursor-pointer transition ${roles.includes(r) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={roles.includes(r)} onChange={() => toggle(r)} />
                    <span className="text-sm">{ROLE_LABELS[r] || r}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save roles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

      {/* Merged Conference Presentation */}
      {confId && <SequenceEditorPanel confId={confId} />}
      {confId && <MergedPresentationPanel confId={confId} />}
    </div>
  )
}

// ============ SEQUENCE EDITOR PANEL ============
// Lets Admin/Chief Editor build the running order of the merged presentation:
// talks (from the programme), sponsor talks (linked to an exhibition booth for
// logo re-use), and breaks (tea/lunch/coffee/networking). Each item has an
// editable duration in minutes; the merged PDF will show the running clock
// cascading from the previous item's finish time (or any explicit startTime).
function SequenceEditorPanel({ confId }) {
  const [items, setItems] = useState([])
  const [booths, setBooths] = useState([])
  const [source, setSource] = useState('auto')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const refresh = () => {
    setLoading(true)
    Promise.all([
      api(`/conferences/${confId}/presentation-sequence`),
      api(`/conferences/${confId}/booths`).catch(() => ({ booths: [] })),
    ]).then(([seq, boothsRes]) => {
      setItems(seq.sequence?.items || [])
      setSource(seq.sequence?.source || 'auto')
      setBooths(boothsRes.booths || [])
      setDirty(false)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [confId])

  const updateItem = (id, patch) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
    setDirty(true)
  }
  const move = (idx, dir) => {
    const j = idx + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setItems(next)
    setDirty(true)
  }
  const remove = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }
  const insertAt = (idx, item) => {
    const withId = { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...item }
    setItems(prev => [...prev.slice(0, idx), withId, ...prev.slice(idx)])
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const clean = items.map(it => {
        const base = { id: it.id, type: it.type, durationMin: it.durationMin || 15, startTime: it.startTime || null }
        if (it.type === 'talk') return { ...base, abstractId: it.abstractId, sessionId: it.sessionId, sessionTitle: it.sessionTitle }
        if (it.type === 'sponsor') return { ...base, sponsorBoothId: it.sponsorBoothId || null, sponsorName: it.sponsorName || '', title: it.title || '', speakerName: it.speakerName || '', speakerBio: it.speakerBio || '', description: it.description || '' }
        if (it.type === 'break') return { ...base, kind: it.kind || 'tea', title: it.title || '' }
        return base
      })
      const d = await api(`/conferences/${confId}/presentation-sequence`, { method: 'PUT', body: JSON.stringify({ items: clean }) })
      setItems(d.sequence?.items || [])
      setSource('saved')
      setDirty(false)
      toast.success('Sequence saved. Click "Regenerate" below to rebuild the merged PDF.')
    } catch (e) {
      toast.error(e.message || 'Could not save sequence')
    } finally { setSaving(false) }
  }

  const reset = () => {
    if (!confirm('Reset the sequence to auto-derive from the current programme? Your custom breaks and sponsor talks will be lost.')) return
    // Filtering out non-talks and restoring order from programme is simplest by
    // clearing local state and asking the backend for the auto-derived sequence.
    setItems([])
    setDirty(true)
    api(`/conferences/${confId}/presentation-sequence`).then(seq => {
      setItems(seq.sequence?.items || [])
      setSource(seq.sequence?.source || 'auto')
      setDirty(true)
    })
  }

  // Running clock preview
  const withRunningTime = (() => {
    let clock = null
    return items.map(it => {
      const dur = Number(it.durationMin) || 15
      const start = it.startTime ? new Date(it.startTime) : (clock ? new Date(clock) : null)
      const end = start ? new Date(start.getTime() + dur * 60_000) : null
      if (end) clock = end
      return { ...it, _start: start, _end: end }
    })
  })()

  const fmt = (d) => d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

  const badge = (type) => {
    if (type === 'talk') return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200"><Mic /> Talk</Badge>
    if (type === 'sponsor') return <Badge className="bg-amber-100 text-amber-800 border-amber-200">💼 Sponsor</Badge>
    if (type === 'break') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">☕ Break</Badge>
    return null
  }

  return (
    <Card className="mt-6 border-2 border-slate-200">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-indigo-50">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-lg flex items-center gap-2"><ListChecks className="h-5 w-5 text-indigo-600" /> Presentation sequence editor</CardTitle>
            <CardDescription className="mt-1">
              Arrange the running order of the merged conference presentation. Insert sponsor talks and tea/lunch/coffee breaks between talks; durations cascade down so times stay in sync. Save your sequence, then click <b>Regenerate</b> on the panel below to rebuild the PDF.
              {source === 'auto' && <span className="ml-1 italic">Currently showing an auto-derived sequence from the Programme — save it to lock it in.</span>}
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={reset} disabled={saving || loading}>Reset from programme</Button>
            <Button onClick={save} disabled={saving || !dirty} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileUp className="h-4 w-4 mr-1" />}
              Save sequence
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {loading ? (
          <div className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 inline animate-spin mr-1" /> Loading…</div>
        ) : (
          <div className="space-y-2">
            <InsertRow index={0} onInsert={(t) => insertAt(0, t)} booths={booths} />
            {withRunningTime.map((it, idx) => (
              <div key={it.id}>
                <div className={`border rounded-lg p-3 flex flex-wrap items-start gap-3 ${it.type === 'talk' ? 'bg-white' : it.type === 'sponsor' ? 'bg-amber-50/50' : 'bg-emerald-50/50'}`}>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs text-muted-foreground">#{idx + 1}</span>
                    <div className="flex flex-col">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => move(idx, -1)} disabled={idx === 0}>▲</Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}>▼</Button>
                    </div>
                  </div>
                  <div className="flex-1 min-w-[240px] space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {badge(it.type)}
                      <span className="text-xs font-mono text-muted-foreground">{fmt(it._start)} – {fmt(it._end)}</span>
                    </div>
                    {it.type === 'talk' && (
                      <div>
                        <div className="text-sm font-semibold truncate">{it.title || <span className="text-red-600">Talk removed from programme — please delete</span>}</div>
                        <div className="text-xs text-muted-foreground truncate">{it.sessionTitle} · <span className="font-mono">{it.submissionCode}</span></div>
                      </div>
                    )}
                    {it.type === 'sponsor' && (
                      <div className="space-y-2">
                        <Input value={it.title || ''} placeholder="Sponsor talk title" onChange={(e) => updateItem(it.id, { title: e.target.value })} className="text-sm font-semibold" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] uppercase font-semibold text-amber-800">Sponsor</label>
                            <select value={it.sponsorBoothId || ''} onChange={(e) => {
                              const b = booths.find(x => x.id === e.target.value)
                              updateItem(it.id, { sponsorBoothId: e.target.value || null, sponsorName: b ? b.sponsorName : it.sponsorName })
                            }} className="w-full border rounded px-2 py-1 text-sm bg-white">
                              <option value="">— Pick from exhibition booths —</option>
                              {booths.map(b => <option key={b.id} value={b.id}>{b.sponsorName}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-semibold text-amber-800">Or type sponsor name</label>
                            <Input value={it.sponsorName || ''} placeholder="Custom sponsor name" onChange={(e) => updateItem(it.id, { sponsorName: e.target.value })} className="text-sm" />
                          </div>
                          <Input value={it.speakerName || ''} placeholder="Speaker name" onChange={(e) => updateItem(it.id, { speakerName: e.target.value })} className="text-sm" />
                          <Input value={it.description || ''} placeholder="Short description of the talk" onChange={(e) => updateItem(it.id, { description: e.target.value })} className="text-sm" />
                        </div>
                        <textarea value={it.speakerBio || ''} placeholder="Speaker biography (2-3 sentences)" onChange={(e) => updateItem(it.id, { speakerBio: e.target.value })} rows={2} className="w-full border rounded px-2 py-1 text-sm resize-none bg-white" />
                      </div>
                    )}
                    {it.type === 'break' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <select value={it.kind || 'tea'} onChange={(e) => updateItem(it.id, { kind: e.target.value })} className="border rounded px-2 py-1 text-sm bg-white">
                          <option value="tea">🫖 Tea break</option>
                          <option value="coffee">☕ Coffee break</option>
                          <option value="lunch">🍽 Lunch</option>
                          <option value="networking">🤝 Networking</option>
                          <option value="other">📌 Other</option>
                        </select>
                        <Input value={it.title || ''} placeholder="Custom label (optional)" onChange={(e) => updateItem(it.id, { title: e.target.value })} className="text-sm max-w-[280px]" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground">Duration</label>
                      <div className="flex items-center gap-1">
                        <Input type="number" min="1" max="480" value={it.durationMin || 15} onChange={(e) => updateItem(it.id, { durationMin: Number(e.target.value) })} className="text-sm w-20" />
                        <span className="text-xs text-muted-foreground">min</span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove(idx)} title="Remove from sequence"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <InsertRow index={idx + 1} onInsert={(t) => insertAt(idx + 1, t)} booths={booths} />
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-sm text-muted-foreground bg-slate-50 rounded-lg p-4 text-center">
                No items in the sequence yet. Insert a talk, sponsor talk or break using the + buttons above.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InsertRow({ index, onInsert, booths }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative flex items-center justify-center h-2 group my-1">
      <div className="absolute inset-x-0 top-1/2 h-px bg-transparent group-hover:bg-indigo-200 transition-colors" />
      {!open ? (
        <button onClick={() => setOpen(true)} className="relative z-10 opacity-40 group-hover:opacity-100 transition-opacity">
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <Plus className="h-3 w-3" /> Insert here
          </span>
        </button>
      ) : (
        <div className="relative z-10 flex gap-1 bg-white border border-indigo-200 rounded-full px-2 py-1 shadow-sm">
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { onInsert({ type: 'sponsor', durationMin: 15, sponsorName: '', title: '', speakerName: '', description: '', speakerBio: '' }); setOpen(false) }}>💼 Sponsor talk</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { onInsert({ type: 'break', kind: 'tea', title: '', durationMin: 15 }); setOpen(false) }}>🫖 Tea</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { onInsert({ type: 'break', kind: 'coffee', title: '', durationMin: 15 }); setOpen(false) }}>☕ Coffee</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { onInsert({ type: 'break', kind: 'lunch', title: '', durationMin: 60 }); setOpen(false) }}>🍽 Lunch</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs text-red-600" onClick={() => setOpen(false)}><X className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  )
}

// Small mic icon for talk badge
function Mic() { return <span className="mr-1">🎤</span> }

// ============ MERGED CONFERENCE PRESENTATION PANEL ============
// Admin / Chief Editor generates a single PDF combining all scheduled talks in
// programme order (cover page + author photo + bio + slide deck). The generated
// PDF is served from /api/uploads/merged/<confId>/merged.pdf and is auto-loaded
// by the Live Conference viewer, syncing slide changes across all participants.
function MergedPresentationPanel({ confId }) {
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const refresh = () => {
    setLoading(true)
    api(`/conferences/${confId}/merged-presentation`).then(d => setMeta(d.presentation || null))
      .catch(() => setMeta(null))
      .finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [confId])

  const generate = async () => {
    if (!confirm('Generate the merged conference presentation now? This combines every scheduled talk (title, author photo, bio and slides) into a single PDF. It may take a minute.')) return
    setGenerating(true)
    try {
      const d = await api(`/conferences/${confId}/merged-presentation`, { method: 'POST' })
      setMeta(d.presentation || null)
      toast.success('Merged presentation generated successfully.')
    } catch (e) {
      toast.error(e.message || 'Could not generate merged presentation')
    } finally { setGenerating(false) }
  }

  return (
    <>
    <Card className="mt-6 border-2 border-indigo-200">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><Presentation className="h-5 w-5 text-indigo-600" /> Merged conference presentation</CardTitle>
            <CardDescription className="mt-1">
              A single PDF combining every scheduled talk in programme order — cover page with title, author photo, bio and time slot, followed by the presenter's slide deck. Auto-loaded in the Live Conference room so slides sync to every viewer.
            </CardDescription>
          </div>
          <Button onClick={generate} disabled={generating} className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap">
            {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {meta ? 'Regenerate' : 'Generate merged presentation'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {loading ? (
          <div className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 inline animate-spin mr-1" /> Loading…</div>
        ) : meta ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Generated</div>
                <div className="font-semibold">{new Date(meta.generatedAt).toLocaleString('en-GB')}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Total pages</div>
                <div className="font-semibold">{meta.totalPages}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Talks included</div>
                <div className="font-semibold">{(meta.slideIndex || []).length}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">File size</div>
                <div className="font-semibold">{(meta.sizeBytes / (1024 * 1024)).toFixed(1)} MB</div>
              </div>
            </div>

            {(meta.slideIndex || []).length > 0 && (
              <details className="border rounded-lg overflow-hidden">
                <summary className="px-3 py-2 cursor-pointer bg-slate-50 text-sm font-medium hover:bg-slate-100">Programme order ({meta.slideIndex.length} talks)</summary>
                <div className="max-h-[280px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 sticky top-0"><tr>
                      <th className="text-left p-2">#</th><th className="text-left p-2">Session</th>
                      <th className="text-left p-2">Talk</th><th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Cover page</th>
                    </tr></thead>
                    <tbody>
                      {meta.slideIndex.map((t, i) => (
                        <tr key={t.abstractId} className="border-t hover:bg-slate-50">
                          <td className="p-2 font-mono text-muted-foreground">{i + 1}</td>
                          <td className="p-2 text-muted-foreground truncate max-w-[160px]">{t.sessionTitle}</td>
                          <td className="p-2 font-medium truncate max-w-[280px]">
                            <span className="font-mono text-[10px] text-indigo-700 mr-1">{t.submissionCode}</span>
                            {t.title}
                          </td>
                          <td className="p-2"><Badge variant="outline" className="text-[10px]">{t.presentationType || '—'}</Badge></td>
                          <td className="p-2 font-mono text-muted-foreground">p. {t.coverPage} ({t.slideCount} slide{t.slideCount === 1 ? '' : 's'})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                <FileText className="h-4 w-4 mr-1" /> Preview in-browser
              </Button>
              <a href={meta.url} target="_blank" rel="noreferrer">
                <Button variant="outline"><Download className="h-4 w-4 mr-1" /> Download PDF</Button>
              </a>
              <a href={meta.url} target="_blank" rel="noreferrer">
                <Button variant="outline">Open in new tab</Button>
              </a>
            </div>
            <div className="text-xs text-muted-foreground border-l-2 border-indigo-500 pl-3 mt-2">
              💡 During the live conference, this deck is displayed alongside the video and slides advance in sync when the host clicks the next arrow — every viewer sees the same page.
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground bg-slate-50 rounded-lg p-4">
            <div className="font-medium text-slate-700 mb-1">No merged presentation yet</div>
            Click <span className="font-semibold">Generate merged presentation</span> above to build one. Make sure the programme has been scheduled (at least one session with talks) and that presenters have uploaded their PDF slides on the Templates page.
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2"><Presentation className="h-5 w-5 text-indigo-600" /> Merged presentation preview</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden bg-slate-900">
          {meta?.url && <MergedPresentationViewer url={meta.url} slideIndex={meta.slideIndex || []} isPresenter={true} height="100%" />}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
function ConferenceAdmin() {
  const [list, setList] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [themeConfId, setThemeConfId] = useState(null)
  const [heroConfId, setHeroConfId] = useState(null)
  const [headerConfId, setHeaderConfId] = useState(null)
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
                      <span>📅 {formatDateRange(c.startDate, c.endDate)}</span>
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
                    <Button size="sm" variant="outline" onClick={() => setHeaderConfId(c.id)}>Header logos</Button>
                    <Button size="sm" variant={c.attendeeRegistrationOpen ? 'default' : 'outline'}
                      className={c.attendeeRegistrationOpen ? 'bg-amber-600 hover:bg-amber-700' : ''}
                      onClick={async () => {
                        const goOn = !c.attendeeRegistrationOpen
                        if (goOn && !confirm('This will BROADCAST a notification (and best-effort email) to every user that attendee registration is now open. Continue?')) return
                        try {
                          await api(`/conferences/${c.id}/attendee-registration`, { method: 'PUT', body: JSON.stringify({ open: goOn }) })
                          toast.success(goOn ? 'Attendee registration OPEN — users notified.' : 'Attendee registration closed.')
                          refresh()
                        } catch (e) { toast.error(e.message) }
                      }}>
                      {c.attendeeRegistrationOpen ? '🎟 Attendee registration ON' : 'Open attendee registration'}
                    </Button>
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
      {headerConfId && <HeaderLogosDialog conference={list.find(x => x.id === headerConfId)} onClose={() => setHeaderConfId(null)} onDone={() => { setHeaderConfId(null); refresh() }} />}
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

function HeaderLogosDialog({ conference, onClose, onDone }) {
  const [leftLogo, setLeftLogo] = useState(conference?.headerLogoLeft || '')
  const [rightLogo, setRightLogo] = useState(conference?.headerLogoRight || '')
  const [background, setBackground] = useState(conference?.headerBackground || '')
  const [uploading, setUploading] = useState(null)

  const upload = async (side, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Only image files allowed'); return }
    const limit = side === 'background' ? 5 : 2
    if (file.size > limit * 1024 * 1024) { toast.error(`Image exceeds ${limit} MB limit`); return }
    setUploading(side)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('side', side)
      const d = await apiUpload(`/conferences/${conference.id}/header-logo`, fd)
      if (side === 'left') setLeftLogo(d.conference.headerLogoLeft || '')
      else if (side === 'right') setRightLogo(d.conference.headerLogoRight || '')
      else setBackground(d.conference.headerBackground || '')
      toast.success(`${side.charAt(0).toUpperCase() + side.slice(1)} header image updated`)
    } catch (e) { toast.error(e.message) }
    finally { setUploading(null); e.target.value = '' }
  }

  const clear = async (side) => {
    if (!confirm(`Reset the ${side} header image to the default?`)) return
    try {
      const res = await fetch(`/api/conferences/${conference.id}/header-logo`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
        body: JSON.stringify({ side }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      if (side === 'left') setLeftLogo('')
      else if (side === 'right') setRightLogo('')
      else setBackground('')
      toast.success(`${side.charAt(0).toUpperCase() + side.slice(1)} header image reset`)
    } catch (e) { toast.error(e.message) }
  }

  const renderSlot = (side, current, opts = {}) => (
    <div className="border rounded-lg p-4 bg-slate-50">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-sm capitalize">{opts.label || `${side} header icon`}</div>
        <Badge variant="outline" className="text-[10px]">{opts.badge || (side === 'left' ? 'Default: Kenyan flag' : side === 'right' ? 'Optional emblem' : 'Optional background')}</Badge>
      </div>
      <div className="flex items-center gap-4">
        <div className={`${side === 'background' ? 'h-16 w-32' : 'h-14 w-20'} border rounded bg-white flex items-center justify-center overflow-hidden`}>
          {current ? (
            <img src={current} alt={`${side} preview`} className={side === 'background' ? 'h-full w-full object-cover' : 'max-h-full max-w-full object-contain'} />
          ) : side === 'left' ? (
            <img src="/kenya-flag.svg" alt="Kenya flag (default)" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-slate-400">Empty</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <label className="block text-xs text-muted-foreground">Upload replacement (PNG/JPG/SVG, max {side === 'background' ? 5 : 2} MB)</label>
          <input type="file" accept="image/*,image/svg+xml" onChange={(e) => upload(side, e)} disabled={uploading === side} className="text-xs" />
          {current && (
            <Button variant="outline" size="sm" onClick={() => clear(side)} disabled={uploading === side}>
              <Trash2 className="h-3 w-3 mr-1" /> Reset to default
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fixed header assets</DialogTitle>
          <DialogDescription>
            The public site header shows a small icon on each side of the centered conference title and an optional
            background image. The <span className="font-medium">left</span> slot defaults to the Kenyan flag; the{' '}
            <span className="font-medium">right</span> slot is a placeholder for an institutional emblem.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {renderSlot('background', background, { label: 'Header background image', badge: 'Optional (max 5 MB)' })}
          {renderSlot('left', leftLogo)}
          {renderSlot('right', rightLogo)}
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
    mainTheme: editing?.mainTheme || '',
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
          <div className="grid grid-cols-1 gap-2">
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
          <div><Label>Main theme <span className="text-[10px] text-muted-foreground">(the overarching scientific main theme — sub-themes are added below, max 5)</span></Label><Input value={form.mainTheme} onChange={e => setForm({ ...form, mainTheme: e.target.value })} placeholder="e.g. Precision Medicine and Public Health" /></div>
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
  const [existing, setExisting] = useState([])
  const [conf, setConf] = useState(null)
  const MAX_SUBTHEMES = 5

  const refresh = () => {
    api(`/conferences/${conferenceId}`).then(d => {
      setConf(d.conference)
      setExisting(d.conference?.themes || [])
    }).catch(() => {})
  }
  useEffect(() => { refresh() }, [conferenceId])

  const submit = async () => {
    if (!name) return toast.error('Sub-theme name required')
    if (existing.length >= MAX_SUBTHEMES) return toast.error(`A conference can have at most ${MAX_SUBTHEMES} sub-themes.`)
    try {
      await api(`/conferences/${conferenceId}/themes`, {
        method: 'POST',
        body: JSON.stringify({ name, description, keywords: keywords.split(',').map(k => k.trim()).filter(Boolean) }),
      })
      toast.success('Sub-theme added')
      setName(''); setDescription(''); setKeywords('')
      refresh()
    } catch (e) { toast.error(e.message) }
  }

  const removeTheme = async (themeId) => {
    if (!confirm('Remove this sub-theme? Any abstracts already tagged with it will remain but lose the tag.')) return
    try {
      await api(`/themes/${themeId}`, { method: 'DELETE' })
      toast.success('Sub-theme removed')
      refresh()
    } catch (e) { toast.error(e.message) }
  }

  const remaining = MAX_SUBTHEMES - existing.length

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Sub-themes for “{conf?.name || 'this conference'}”</DialogTitle>
          <DialogDescription>
            Main theme: <span className="font-medium text-slate-800">{conf?.mainTheme || <em className="text-muted-foreground">(not set — edit the conference to add one)</em>}</span>
            <br />Sub-themes are shown in the dropdown when authors submit abstracts. Maximum 5.
          </DialogDescription>
        </DialogHeader>

        {/* Existing sub-themes */}
        <div className="border rounded-lg bg-slate-50 p-3 space-y-1">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-600 mb-1">Current sub-themes ({existing.length}/{MAX_SUBTHEMES})</div>
          {existing.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No sub-themes yet. Add up to {MAX_SUBTHEMES} below.</div>
          ) : existing.map(t => (
            <div key={t.id} className="flex items-center justify-between bg-white border rounded px-2 py-1.5">
              <div>
                <div className="font-medium text-sm">{t.name}</div>
                {t.keywords?.length > 0 && <div className="text-[10px] text-muted-foreground">Keywords: {t.keywords.join(', ')}</div>}
              </div>
              <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => removeTheme(t.id)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add new sub-theme */}
        {remaining > 0 ? (
          <div className="space-y-2 border rounded-lg p-3">
            <div className="text-xs uppercase tracking-wider font-semibold text-indigo-600 mb-1">Add sub-theme ({remaining} slot{remaining !== 1 ? 's' : ''} remaining)</div>
            <div><Label>Sub-theme name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Machine Learning in Radiology" /></div>
            <div><Label>Description</Label><Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div><Label>Keywords (comma separated)</Label><Input value={keywords} onChange={e => setKeywords(e.target.value)} /></div>
          </div>
        ) : (
          <div className="p-3 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-800">
            You have reached the maximum of {MAX_SUBTHEMES} sub-themes. Remove one first to add another.
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={submit} disabled={remaining <= 0}>Add sub-theme</Button>
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
        {templates.length === 0 ? <EmptyState label="PowerPoint and poster templates will be available for download once your abstract is accepted for presentation in the conference." />
        : templates.map(t => (
          <Card key={t.id}>
            <CardContent className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-indigo-600" />
                <div>
                  <div className="font-medium">{t.fileName}</div>
                  <div className="text-xs text-muted-foreground">{t.type} · {(t.sizeBytes / 1024).toFixed(1)} KB · Uploaded {formatDate(t.createdAt)}</div>
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

      {/* ── Presentation package (authors of accepted abstracts) ── */}
      <PresentationPackageSection user={user} isAdmin={isAdmin} isEditor={isEditor} />
    </div>
  )
}

// Presentation package uploader — appears on the Templates page. Loads all abstracts
// that belong to the current user (or every accepted abstract for admins/editors) and
// lets the presenting author upload/replace the PPTX, passport photo, and biography.
function PresentationPackageSection({ user, isAdmin, isEditor }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    // Authors see their own accepted abstracts; admin/editors see everyone's.
    const scope = (isAdmin || isEditor) ? '' : '?scope=mine'
    api(`/abstracts${scope}`).then(d => {
      const accepted = (d.abstracts || []).filter(a =>
        ['ACCEPTED', 'ORAL', 'POSTER', 'PRESENTATION_UPLOAD', 'PROGRAMME_SCHEDULING', 'PUBLISHED'].includes(a.currentState)
      )
      setItems(accepted)
    }).finally(() => setLoading(false))
  }, [isAdmin, isEditor])

  if (loading) return <div className="mt-8"><Loader2 className="animate-spin h-5 w-5 text-indigo-500" /></div>
  if (items.length === 0) return null
  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><Upload className="h-5 w-5 text-indigo-600" /> Your presentation package</h2>
      <p className="text-xs text-muted-foreground mb-4">Upload your PowerPoint presentation, a passport-size photo and a short biography for each accepted abstract. You can delete and re-upload as many times as needed until the editors are satisfied.</p>
      <div className="space-y-4">
        {items.map(a => <PresentationCard key={a.id} abstract={a} user={user} />)}
      </div>
    </div>
  )
}

function PresentationCard({ abstract: initialAbs, user }) {
  const [abs, setAbs] = useState(initialAbs)
  const [bio, setBio] = useState(initialAbs.biography || `Author: ${user.title || ''} ${user.firstName} ${user.lastName}\nInstitution: ${user.affiliation || ''}\nEmail: ${user.email}\n\nShort biography (max 200 words):\n`)
  const [savingBio, setSavingBio] = useState(false)

  const upload = async (kind, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const fd = new FormData(); fd.append('file', file)
      const d = await apiUpload(`/abstracts/${abs.id}/${kind}`, fd)
      setAbs(d.abstract); toast.success(`${kind.replace('-', ' ')} uploaded`)
    } catch (e) { toast.error(e.message) }
    finally { e.target.value = '' }
  }
  const del = async (kind) => {
    if (!confirm(`Delete the current ${kind.replace('-', ' ')}?`)) return
    try {
      const res = await fetch(`/api/abstracts/${abs.id}/${kind}`, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) } })
      const d = await res.json(); if (!res.ok) throw new Error(d.error)
      setAbs(d.abstract); toast.success('Deleted — you may upload afresh')
    } catch (e) { toast.error(e.message) }
  }
  const saveBio = async () => {
    setSavingBio(true)
    try {
      const d = await api(`/abstracts/${abs.id}/biography`, { method: 'PUT', body: JSON.stringify({ biography: bio }) })
      setAbs(d.abstract); toast.success('Biography saved')
    } catch (e) { toast.error(e.message) }
    finally { setSavingBio(false) }
  }

  return (
    <Card className="border-2 border-indigo-100">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-white pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-emerald-600 text-white text-[10px]">{abs.currentState}</Badge>
          <span className="text-xs font-mono text-slate-500">{abs.submissionCode}</span>
        </div>
        <CardTitle className="text-base leading-snug mt-1">{abs.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Presentation */}
        <div className="border rounded-lg p-3 bg-slate-50">
          <Label className="text-sm font-semibold flex items-center gap-1.5"><FileText className="h-4 w-4 text-indigo-600" /> PowerPoint presentation (PPTX/PPT/PDF, max 50 MB)</Label>
          {abs.presentationPath ? (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <a href={abs.presentationPath} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm hover:underline flex items-center gap-1"><FileText className="h-4 w-4" /> Current file</a>
              <Button variant="outline" size="sm" onClick={() => del('presentation')}><Trash2 className="h-3 w-3 mr-1" /> Delete &amp; re-upload</Button>
            </div>
          ) : (
            <input type="file" accept=".ppt,.pptx,.pdf" onChange={e => upload('presentation', e)} className="text-xs mt-2" />
          )}
        </div>
        {/* Photo */}
        <div className="border rounded-lg p-3 bg-slate-50">
          <Label className="text-sm font-semibold flex items-center gap-1.5"><Users className="h-4 w-4 text-fuchsia-600" /> Passport-size photo (JPG/PNG, max 2 MB)</Label>
          {abs.authorPhotoPath ? (
            <div className="mt-2 flex items-center gap-3">
              <img src={abs.authorPhotoPath} alt="Author" className="h-20 w-20 rounded object-cover border" />
              <Button variant="outline" size="sm" onClick={() => del('author-photo')}><Trash2 className="h-3 w-3 mr-1" /> Delete &amp; re-upload</Button>
            </div>
          ) : (
            <input type="file" accept="image/*" onChange={e => upload('author-photo', e)} className="text-xs mt-2" />
          )}
        </div>
        {/* Bio */}
        <div className="border rounded-lg p-3 bg-slate-50">
          <Label className="text-sm font-semibold flex items-center gap-1.5"><FileText className="h-4 w-4 text-slate-600" /> Short biography</Label>
          <Textarea rows={6} value={bio} onChange={e => setBio(e.target.value)} className="mt-2" />
          <div className="flex justify-end mt-2">
            <Button onClick={saveBio} disabled={savingBio} className="bg-indigo-600 hover:bg-indigo-700" size="sm">{savingBio && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Save biography</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ ANNOUNCEMENTS BOARD ============
function AnnouncementsBoard({ user, channel = 'EDITORIAL' }) {
  const [list, setList] = useState([])
  const [text, setText] = useState('')
  const refresh = () => api(`/announcements?channel=${channel}`).then(d => setList(d.announcements || [])).catch(() => {})
  useEffect(() => { refresh(); const i = setInterval(refresh, 15000); return () => clearInterval(i) }, [channel])
  const post = async () => {
    if (!text.trim()) return
    try { await api(`/announcements?channel=${channel}`, { method: 'POST', body: JSON.stringify({ body: text }) }); setText(''); refresh() } catch (e) { toast.error(e.message) }
  }
  const isLogistics = channel === 'LOGISTICS'
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{isLogistics ? 'Logistics Boardroom Chat' : "Editors' Chat & Announcements"}</h1>
        <p className="text-muted-foreground">{isLogistics
          ? 'Private board for the logistics committee — operations, venue, sponsorship coordination, and other on-the-ground matters.'
          : 'Common board for editorial office announcements and discussions. Visible to all editors.'}</p>
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
            <Input placeholder={isLogistics ? 'Type a logistics message…' : 'Type an announcement or message…'} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post() } }} />
            <Button onClick={post} className="bg-indigo-600 hover:bg-indigo-700"><Send className="h-4 w-4 mr-1" /> Post</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============ LOGISTICS BOARDROOM ============
function LogisticsBoardroom({ user }) {
  const [members, setMembers] = useState([])
  const [requests, setRequests] = useState([])
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [reviewNotes, setReviewNotes] = useState('')

  const refresh = () => {
    api('/logistics/members').then(d => setMembers(d.members || [])).catch(() => {})
    api('/sponsorship-requests').then(d => setRequests(d.requests || [])).catch(() => {})
  }
  useEffect(() => { refresh(); const i = setInterval(refresh, 30000); return () => clearInterval(i) }, [])

  const roleLabel = (r) => ({
    CHIEF_LOGISTICS: 'Chief Logistics',
    COMMITTEE_LOGISTICS: 'Committee Logistics',
  })[r] || r

  const handleDecision = async (id, status) => {
    try {
      await api(`/sponsorship-requests/${id}`, { method: 'PUT', body: JSON.stringify({ status, reviewNotes }) })
      toast.success(`Request ${status.toLowerCase()}`)
      setSelectedRequest(null); setReviewNotes('')
      refresh()
    } catch (e) { toast.error(e.message) }
  }

  const pendingRequests = requests.filter(r => r.status === 'PENDING')

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="bg-gradient-to-br from-amber-600 via-orange-600 to-rose-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold leading-tight flex items-center gap-2">
              <Building2 className="h-5 w-5 opacity-90" /> Logistics Boardroom
            </h1>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/20 text-white border-white/30">{members.length} member{members.length !== 1 ? 's' : ''}</Badge>
              <Badge className="bg-amber-100 text-amber-900 border-0">{pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''}</Badge>
            </div>
          </div>
          <p className="text-white/90 text-sm mt-3 leading-snug w-full">A private space for the logistics committee to coordinate operations, venue matters, sponsor relations and delegate handling.</p>
          <p className="text-white/90 text-sm mt-1 leading-snug w-full">Use the boardroom chat and pending-request queue below to keep the committee aligned.</p>
        </div>
      </Card>

      {/* Members list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-orange-600" /> Logistics committee members</CardTitle>
          <CardDescription>Chief Logistics leads the committee; Committee Logistics support operations.</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? <div className="text-sm text-muted-foreground py-4">No logistics members appointed yet. Admin can assign roles via User Management.</div>
          : <div className="grid md:grid-cols-2 gap-2">
              {members.map(m => {
                const primaryRole = m.roles.some(r => r.role === 'CHIEF_LOGISTICS') ? 'CHIEF_LOGISTICS' : 'COMMITTEE_LOGISTICS'
                const rColor = primaryRole === 'CHIEF_LOGISTICS' ? 'bg-orange-600' : 'bg-amber-600'
                return (
                  <div key={m.id} className="flex items-center gap-3 border rounded-lg p-3 bg-white hover:shadow-sm transition">
                    <div className={`h-10 w-10 rounded-full ${rColor} text-white flex items-center justify-center font-semibold shrink-0`}>
                      {(m.firstName?.[0] || '').toUpperCase()}{(m.lastName?.[0] || '').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{m.title ? m.title + ' ' : ''}{m.firstName} {m.lastName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{m.affiliation || m.email}</div>
                    </div>
                    <Badge className={`${rColor} text-white text-[10px]`}>{roleLabel(primaryRole)}</Badge>
                  </div>
                )
              })}
            </div>}
        </CardContent>
      </Card>

      {/* Sponsorship requests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><Award className="h-5 w-5 text-orange-600" /> Sponsorship requests</CardTitle>
          <CardDescription>Requests from prospective sponsors awaiting logistics review.</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? <div className="text-sm text-muted-foreground py-4">No sponsorship requests yet.</div>
          : <div className="space-y-2">
              {requests.map(r => {
                const statusColor = r.status === 'APPROVED' ? 'bg-emerald-600'
                  : r.status === 'DECLINED' ? 'bg-rose-600'
                  : 'bg-amber-500'
                return (
                  <div key={r.id} className="border rounded-lg p-3 bg-white">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="font-semibold">{r.companyName}
                          {r.sponsorTier && <Badge variant="outline" className="ml-2 text-[10px]">{r.sponsorTier}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.industry || '—'} · {r.contactEmail}</div>
                        {r.message && <div className="text-sm mt-2 whitespace-pre-wrap">{r.message}</div>}
                        <div className="text-[11px] text-muted-foreground mt-2">
                          Requested by {r.requester?.firstName} {r.requester?.lastName} · {new Date(r.createdAt).toLocaleString()}
                          {r.virtualBoothRequested && ' · Virtual booth'}{r.physicalBoothRequested && ' · Physical booth'}
                        </div>
                      </div>
                      <Badge className={`${statusColor} text-white text-[10px]`}>{r.status}</Badge>
                    </div>
                    {r.status === 'PENDING' && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
                        {selectedRequest === r.id ? (
                          <>
                            <Input placeholder="Optional review notes…" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} className="flex-1 min-w-[200px]" />
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleDecision(r.id, 'APPROVED')}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDecision(r.id, 'DECLINED')}>Decline</Button>
                            <Button size="sm" variant="outline" onClick={() => { setSelectedRequest(null); setReviewNotes('') }}>Cancel</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setSelectedRequest(r.id)}>Review</Button>
                        )}
                      </div>
                    )}
                    {r.reviewNotes && r.status !== 'PENDING' && (
                      <div className="mt-2 text-xs text-slate-600 italic">Review notes: {r.reviewNotes}</div>
                    )}
                  </div>
                )
              })}
            </div>}
        </CardContent>
      </Card>

      {/* Chat channel */}
      <AnnouncementsBoard user={user} channel="LOGISTICS" />
    </div>
  )
}

// ============ SPONSORS PAGE (public + authenticated view) ============
// Helper — display formatted amount with currency code
function fmtSponsorPrice(t) {
  const c = (t.currency || 'USD').toUpperCase()
  return `${c} ${t.price}`
}

function SponsorsPage({ user, featured, setRoute }) {
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    setLoading(true)
    api('/sponsorship-tiers')
      .then(d => setTiers(d.tiers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [])

  const confName = featured?.name || 'the Scientific Conference'
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Welcome / Header */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-br from-amber-600 via-yellow-600 to-orange-500 px-6 py-4 md:px-8 md:py-5 text-white">
          <h1 className="text-xl md:text-2xl font-bold leading-tight flex items-center gap-2">
            <Award className="h-5 w-5 opacity-90" /> Welcome{user?.firstName ? `, ${user.firstName}` : ''} — and thank you.
          </h1>
          <p className="text-white/95 text-sm mt-3 leading-snug w-full">
            We are grateful for your interest in partnering with <span className="font-semibold">{confName}</span>. Your support helps convene the leading researchers, clinicians and innovators driving this event.
          </p>
          <p className="text-white/90 text-sm mt-1 leading-snug w-full">
            Choose a sponsorship tier below and submit the request form — Chief Logistics will follow up with the next steps.
          </p>
        </div>
      </Card>

      {/* Sponsorship tiers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sponsorship categories &amp; pricing</CardTitle>
          <CardDescription>Choose the tier that best fits your organisation's outreach goals.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 mx-auto animate-spin text-amber-500" /></div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              {tiers.map(t => (
                <div key={t.id || t.key} className="border rounded-lg p-4 hover:shadow-md transition bg-white">
                  <div className="flex justify-between items-baseline mb-2">
                    <div className="font-bold text-lg">{t.label}</div>
                    <Badge className="bg-amber-100 text-amber-900 border-0">{fmtSponsorPrice(t)}</Badge>
                  </div>
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                    {(t.benefits || []).map(b => <li key={b}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline sponsorship request form */}
      <SponsorshipRequestInline user={user} conferenceId={featured?.id} tiers={tiers} confName={confName} onSubmitted={refresh} />

      {/* Invitation to view exhibition booths */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 via-fuchsia-50 to-rose-50 p-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold text-slate-800">Curious what other sponsors look like?</div>
              <div className="text-sm text-muted-foreground">Preview the current exhibition hall — see how sponsors are showcased to conference delegates.</div>
            </div>
          </div>
          <Button onClick={() => setRoute && setRoute({ name: 'booths' })} className="bg-indigo-600 hover:bg-indigo-700">
            <Building2 className="h-4 w-4 mr-1" /> View sponsor exhibition booths
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ============ SPONSORSHIP REQUEST INLINE FORM (booth-style) ============
function SponsorshipRequestInline({ user, conferenceId, tiers, onSubmitted }) {
  const [form, setForm] = useState({
    companyName: '', companyType: '', industry: '', companyAddress: '',
    websiteUrl: '', contactEmail: user?.email || '', contactPhone: '',
    sponsorTier: '', virtualBoothRequested: false, physicalBoothRequested: false,
    products: '', message: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Set default tier once tiers are loaded
  useEffect(() => {
    if (!form.sponsorTier && tiers.length) setForm(f => ({ ...f, sponsorTier: tiers[tiers.length - 1].key }))
  }, [tiers.length])

  const submit = async () => {
    setError(''); setSuccess('')
    if (!form.companyName.trim()) return setError('Company name is required.')
    if (!conferenceId) return setError('No active conference selected.')
    setSaving(true)
    try {
      await api('/sponsorship-requests', {
        method: 'POST',
        body: JSON.stringify({ ...form, conferenceId }),
      })
      setSuccess('Your sponsorship request has been sent — the Chief Logistics team will be in touch shortly.')
      toast.success('Sponsorship request submitted')
      setForm(f => ({ ...f, companyName: '', companyType: '', industry: '', companyAddress: '', websiteUrl: '', contactPhone: '', products: '', message: '', virtualBoothRequested: false, physicalBoothRequested: false }))
      if (onSubmitted) onSubmitted()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Send className="h-5 w-5 text-amber-600" /> Request sponsorship
        </CardTitle>
        <CardDescription>Complete the form to formally request sponsorship. Your request will be reviewed by the Chief Logistics team.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <div className="p-2 rounded bg-rose-50 border border-rose-200 text-sm text-rose-700">{error}</div>}
        {success && <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" /><div>{success}</div></div>}
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Company / Institution *</Label><Input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} /></div>
          <div><Label>Company type</Label><Input value={form.companyType} onChange={e => setForm({ ...form, companyType: e.target.value })} placeholder="e.g. Pharmaceutical" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Industry</Label><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="e.g. Medical Devices" /></div>
          <div><Label>Company address</Label><Input value={form.companyAddress} onChange={e => setForm({ ...form, companyAddress: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>Website</Label><Input value={form.websiteUrl} onChange={e => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://..." /></div>
          <div><Label>Contact email</Label><Input value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div>
          <div><Label>Contact phone</Label><Input value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} /></div>
        </div>
        <div><Label>Products / Services</Label><Textarea rows={3} value={form.products} onChange={e => setForm({ ...form, products: e.target.value })} placeholder="What will you be showcasing?" /></div>
        <div>
          <Label>Preferred sponsorship tier</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
            {tiers.map(t => (
              <button key={t.id || t.key} type="button" onClick={() => setForm({ ...form, sponsorTier: t.key })}
                className={`text-left p-2 rounded-md border ${form.sponsorTier === t.key ? 'border-amber-600 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-sm">{t.label}</div>
                  <Badge variant="outline">{fmtSponsorPrice(t)}</Badge>
                </div>
                <ul className="text-[11px] text-muted-foreground mt-1 list-disc list-inside">
                  {(t.benefits || []).slice(0, 3).map(b => <li key={b}>{b}</li>)}
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
        <div><Label>Message to Chief Logistics (optional)</Label><Textarea rows={3} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></div>
        <div className="flex justify-end pt-1">
          <Button onClick={submit} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Send sponsorship request
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ SPONSORSHIP TIERS ADMIN (Admin + Chief Logistics) ============
function SponsorshipTiersAdmin() {
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)
  const refresh = () => {
    setLoading(true)
    api('/sponsorship-tiers').then(d => setTiers(d.tiers || [])).finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [])

  const addBlank = async () => {
    const key = prompt('Unique key for the new tier (e.g. TITANIUM)')?.trim().toUpperCase()
    if (!key) return
    try {
      await api('/sponsorship-tiers', { method: 'POST', body: JSON.stringify({ key, label: key.charAt(0) + key.slice(1).toLowerCase() + ' Sponsor', price: '0', currency: 'USD', benefits: [], displayOrder: (tiers.length + 1) * 10 }) })
      toast.success('Tier added — edit its fields below')
      refresh()
    } catch (e) { toast.error(e.message) }
  }
  const saveTier = async (t) => {
    try {
      await api(`/sponsorship-tiers/${t.id}`, { method: 'PUT', body: JSON.stringify(t) })
      toast.success(`${t.label} saved`)
      refresh()
    } catch (e) { toast.error(e.message) }
  }
  const removeTier = async (t) => {
    if (!confirm(`Delete "${t.label}"? This cannot be undone.`)) return
    try { await api(`/sponsorship-tiers/${t.id}`, { method: 'DELETE' }); toast.success('Tier removed'); refresh() } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sponsorship Tiers</h1>
          <p className="text-muted-foreground">Edit tier names, prices, benefits and currency (USD / KES). Changes appear on the public Sponsors page immediately.</p>
        </div>
        <Button onClick={addBlank} className="bg-amber-600 hover:bg-amber-700"><Plus className="h-4 w-4 mr-1" /> Add tier</Button>
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="h-6 w-6 mx-auto animate-spin text-amber-500" /></div>
        : tiers.length === 0 ? <EmptyState label="No tiers configured" />
        : <div className="space-y-3">
            {tiers.map(t => <TierEditRow key={t.id} tier={t} onSave={saveTier} onDelete={removeTier} />)}
          </div>}
    </div>
  )
}

function TierEditRow({ tier, onSave, onDelete }) {
  const [t, setT] = useState({ ...tier, benefits: [...(tier.benefits || [])] })
  const [newBenefit, setNewBenefit] = useState('')
  const setField = (k, v) => setT(prev => ({ ...prev, [k]: v }))
  const addBenefit = () => {
    if (!newBenefit.trim()) return
    setT(prev => ({ ...prev, benefits: [...prev.benefits, newBenefit.trim()] }))
    setNewBenefit('')
  }
  const removeBenefit = (i) => setT(prev => ({ ...prev, benefits: prev.benefits.filter((_, idx) => idx !== i) }))
  const dirty = JSON.stringify(t) !== JSON.stringify({ ...tier, benefits: [...(tier.benefits || [])] })

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4 space-y-3">
        <div className="grid md:grid-cols-6 gap-2">
          <div className="md:col-span-2"><Label>Label</Label><Input value={t.label} onChange={e => setField('label', e.target.value)} /></div>
          <div><Label>Key</Label><Input value={t.key} onChange={e => setField('key', e.target.value.toUpperCase())} /></div>
          <div><Label>Price</Label><Input value={t.price} onChange={e => setField('price', e.target.value)} placeholder="e.g. 20,000" /></div>
          <div>
            <Label>Currency</Label>
            <Select value={t.currency || 'USD'} onValueChange={v => setField('currency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD (US Dollar)</SelectItem>
                <SelectItem value="KES">KES (Kenyan Shilling)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Display order</Label><Input type="number" value={t.displayOrder} onChange={e => setField('displayOrder', parseInt(e.target.value, 10) || 0)} /></div>
        </div>
        <div>
          <Label>Benefits</Label>
          <div className="border rounded-md p-2 bg-slate-50 space-y-1 min-h-[60px]">
            {t.benefits.length === 0 ? <div className="text-xs text-muted-foreground italic">No benefits added yet.</div>
              : t.benefits.map((b, i) => (
                <div key={i} className="flex items-center justify-between gap-2 bg-white border rounded px-2 py-1">
                  <span className="text-sm">{b}</span>
                  <button onClick={() => removeBenefit(i)} className="text-rose-500 hover:text-rose-700"><XCircle className="h-4 w-4" /></button>
                </div>
              ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input value={newBenefit} onChange={e => setNewBenefit(e.target.value)} placeholder="Add a benefit line and press Enter or the plus" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBenefit() } }} />
            <Button variant="outline" onClick={addBenefit}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={t.isActive} onChange={e => setField('isActive', e.target.checked)} />
            Active (visible on public Sponsors page)
          </label>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={() => onDelete(t)}>Delete</Button>
            <Button size="sm" onClick={() => onSave(t)} disabled={!dirty} className={dirty ? 'bg-amber-600 hover:bg-amber-700' : ''}>Save</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ SPONSORSHIP REQUEST DIALOG (booth-style) — retained for compatibility ============
function SponsorshipRequestDialog({ user, conferenceId, tiers, onClose, onDone }) {
  return null // Replaced by inline form. Kept as placeholder to avoid breaking imports.
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
                <div className="text-xs text-muted-foreground">{i.email} · {i.specialty} · Invited {formatDate(i.createdAt)}</div>
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
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [prevIdx, setPrevIdx] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (!conf?.id) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/conferences/${conf.id}/booths`)
      .then(r => r.json())
      .then(d => setBooths(d.booths || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [conf?.id])

  const goTo = (nextIdx) => {
    if (nextIdx === idx) return
    setPrevIdx(idx)
    setTransitioning(true)
    setIdx(nextIdx)
    setTimeout(() => setTransitioning(false), 700)
  }

  useEffect(() => {
    if (booths.length < 2 || paused) return
    const t = setInterval(() => goTo((idx + 1) % booths.length), 5000)
    return () => clearInterval(t)
  }, [booths.length, paused, idx])

  if (loading) return (
    <div className="container mx-auto px-6 py-24 text-center">
      <Loader2 className="h-8 w-8 mx-auto text-indigo-500 animate-spin mb-3" />
      <div className="text-sm text-muted-foreground">Loading exhibition booths…</div>
    </div>
  )
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
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        {/* Main rotating card — begins immediately, no page header */}
        <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <Card key={idx} className="overflow-hidden shadow-2xl border-0 ring-1 ring-slate-200 animate-in fade-in slide-in-from-right-6 duration-700">
            <CardContent className="p-0">
              {/* Top strip: company name + tier badge — prominent, professional */}
              <div
                className="relative px-6 md:px-8 py-4 md:py-5 text-white overflow-hidden"
                style={{
                  background: (() => {
                    const tier = (b.tier || b.companyType || '').toLowerCase()
                    if (tier.includes('platinum')) return 'linear-gradient(135deg, #4b5563 0%, #1f2937 50%, #0f172a 100%)'
                    if (tier.includes('gold')) return 'linear-gradient(135deg, #d97706 0%, #b45309 50%, #78350f 100%)'
                    if (tier.includes('silver')) return 'linear-gradient(135deg, #94a3b8 0%, #64748b 50%, #334155 100%)'
                    if (tier.includes('bronze')) return 'linear-gradient(135deg, #a16207 0%, #713f12 50%, #451a03 100%)'
                    if (tier.includes('diamond')) return 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 50%, #0369a1 100%)'
                    return 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #a21caf 100%)'
                  })(),
                }}
              >
                <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.5), transparent 60%)' }} />
                <div className="relative flex items-center gap-4">
                  {b.logoPath && (
                    <div className="h-16 w-16 md:h-20 md:w-20 bg-white rounded-xl p-2 shadow-2xl shrink-0 ring-2 ring-white/40">
                      <img src={b.logoPath} alt="" className="h-full w-full object-contain" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Badge className="bg-white text-slate-900 border-0 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest shadow">
                        {b.tier || b.companyType || 'Industry Partner'}
                      </Badge>
                      <span className="text-[11px] text-white/70 uppercase tracking-wider font-medium">Sponsor</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold drop-shadow-md leading-tight truncate">
                      {b.sponsorName}
                    </h2>
                  </div>
                </div>
              </div>

              {/* Body: image + text laid out horizontally to fit within one screen */}
              <div className="grid md:grid-cols-5 gap-0 bg-white">
                {/* Left column: banner image */}
                <div className="md:col-span-2 bg-slate-100 flex items-center justify-center">
                  {b.bannerPath ? (
                    <div className="w-full aspect-[4/3] md:aspect-auto md:h-full overflow-hidden">
                      <img src={b.bannerPath} alt={b.sponsorName} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full aspect-[4/3] md:aspect-auto md:h-full bg-gradient-to-br from-indigo-100 via-fuchsia-100 to-rose-100 flex items-center justify-center">
                      <Building2 className="h-20 w-20 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Right column: about + products + contacts */}
                <div className="md:col-span-3 p-5 md:p-6 flex flex-col gap-3 min-h-0">
                  {b.message && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">About</div>
                      <p className="text-sm md:text-[15px] leading-relaxed text-slate-700 whitespace-pre-wrap line-clamp-4">{b.message}</p>
                    </div>
                  )}
                  {b.products && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">Products &amp; Services</div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3">{b.products}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-auto pt-3 border-t">
                    <div className="p-3 rounded-md bg-gradient-to-br from-slate-50 to-white border shadow-sm">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Get in touch</div>
                      <div className="space-y-1 text-xs">
                        {b.websiteUrl && (
                          <a href={b.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-indigo-600 hover:underline">
                            <Globe className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{b.websiteUrl.replace(/^https?:\/\//, '')}</span>
                          </a>
                        )}
                        {b.contactEmail && (
                          <a href={`mailto:${b.contactEmail}`} className="flex items-center gap-1.5 text-indigo-600 hover:underline">
                            <Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{b.contactEmail}</span>
                          </a>
                        )}
                        {b.contactPhone && (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h1.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.21l-2.26 1.13a11 11 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" /></svg>
                            <span>{b.contactPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {b.otherLinks && b.otherLinks.length > 0 && (
                      <div className="p-3 rounded-md bg-gradient-to-br from-indigo-50 to-fuchsia-50 border border-indigo-100 shadow-sm">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 mb-1.5">Explore more</div>
                        <div className="space-y-1">
                          {b.otherLinks.slice(0, 3).map((l, i) => (
                            <a key={i} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-700 hover:underline">
                              <ChevronRight className="h-3 w-3 shrink-0" /><span className="truncate">{l.label}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Nav arrows */}
          {booths.length > 1 && (
            <>
              <button onClick={() => goTo((idx - 1 + booths.length) % booths.length)} className="absolute -left-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-50 border transition hover:scale-110">
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>
              <button onClick={() => goTo((idx + 1) % booths.length)} className="absolute -right-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-50 border transition hover:scale-110">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Progress + thumbs */}
        <div className="mt-8">
          {/* Auto-advance timer bar */}
          {booths.length > 1 && !paused && (
            <div className="h-1 rounded-full bg-slate-200 overflow-hidden mb-3 max-w-xs mx-auto">
              <div key={idx} className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 animate-[shrink_8s_linear_forwards]" style={{ width: '100%', animation: 'boothProgress 8s linear forwards' }} />
            </div>
          )}
          <div className="text-center text-xs text-muted-foreground mb-3">
            Booth {idx + 1} of {booths.length} · {paused ? 'Paused (hovering)' : 'Auto-rotates every 5 seconds'}
          </div>
          <div className="flex justify-center gap-2 flex-wrap">
            {booths.map((booth, i) => (
              <button key={i} onClick={() => goTo(i)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${i === idx ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`}>
                <div className={`h-1.5 w-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-slate-400'}`} />
                <span className="font-medium">{booth.sponsorName}</span>
              </button>
            ))}
          </div>
        </div>
        <style jsx>{`
          @keyframes boothProgress {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>
      </div>
    </div>
  )
}

function BoothAdmin() {
  const [confs, setConfs] = useState([])
  const [confId, setConfId] = useState('')
  const [booths, setBooths] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const refresh = () => {
    if (!confId) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/conferences/${confId}/booths`).then(r => r.json())
      .then(d => setBooths(d.booths || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
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
      {loading ? <div className="p-10 text-center"><Loader2 className="h-6 w-6 mx-auto animate-spin text-indigo-500" /><div className="text-sm text-muted-foreground mt-2">Loading booths…</div></div>
        : booths.length === 0 ? <EmptyState label="No booths yet" onAction={create} actionLabel="Add first booth" />
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
function ConferenceBookAdmin({ readOnly = false }) {
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
          {readOnly && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] px-2 py-1">
              <AlertCircle className="h-3 w-3" /> Read-only view — Committee Editors can review and download the book but cannot edit it.
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {!readOnly && (
            <Button variant="outline" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
          )}
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
                  <button onClick={() => moveSection(i, -1)} className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-40" disabled={readOnly || i === 0}>▲</button>
                  <button onClick={() => moveSection(i, 1)} className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-40" disabled={readOnly || i === book.sections.length - 1}>▼</button>
                </div>
                <div className="flex-1 text-sm">{s.label}</div>
                <input type="checkbox" checked={!!s.enabled} onChange={() => toggleSection(s.key)} className="h-4 w-4" disabled={readOnly} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Content */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Cover</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div><Label>Cover title</Label><Input value={book.coverTitle || ''} onChange={e => update('coverTitle', e.target.value)} placeholder="Overrides conference name on the cover" readOnly={readOnly} disabled={readOnly} /></div>
              <div><Label>Cover subtitle</Label><Input value={book.coverSubtitle || ''} onChange={e => update('coverSubtitle', e.target.value)} readOnly={readOnly} disabled={readOnly} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Chief Guest</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Name</Label><Input value={book.chiefGuestName || ''} onChange={e => update('chiefGuestName', e.target.value)} placeholder="e.g. Prof. Jane Doe" readOnly={readOnly} disabled={readOnly} /></div>
                <div><Label>Title / Designation</Label><Input value={book.chiefGuestTitle || ''} onChange={e => update('chiefGuestTitle', e.target.value)} placeholder="e.g. President, World Medical Society" readOnly={readOnly} disabled={readOnly} /></div>
              </div>
              <div><Label>Message</Label><Textarea rows={5} value={book.chiefGuestMessage || ''} onChange={e => update('chiefGuestMessage', e.target.value)} readOnly={readOnly} disabled={readOnly} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Conference Chair</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Name</Label><Input value={book.chairName || ''} onChange={e => update('chairName', e.target.value)} readOnly={readOnly} disabled={readOnly} /></div>
                <div><Label>Title</Label><Input value={book.chairTitle || ''} onChange={e => update('chairTitle', e.target.value)} readOnly={readOnly} disabled={readOnly} /></div>
              </div>
              <div><Label>Message</Label><Textarea rows={5} value={book.chairMessage || ''} onChange={e => update('chairMessage', e.target.value)} readOnly={readOnly} disabled={readOnly} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Foreword & Acknowledgements</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div><Label>Foreword</Label><Textarea rows={4} value={book.foreword || ''} onChange={e => update('foreword', e.target.value)} readOnly={readOnly} disabled={readOnly} /></div>
              <div><Label>Acknowledgements</Label><Textarea rows={4} value={book.acknowledgements || ''} onChange={e => update('acknowledgements', e.target.value)} readOnly={readOnly} disabled={readOnly} /></div>
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
function SurveyAdmin({ readOnly = false }) {
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
          {readOnly && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] px-2 py-1">
              <AlertCircle className="h-3 w-3" /> Read-only view — Committee Editors can review surveys and results but cannot create, send or edit them.
            </div>
          )}
        </div>
        {!readOnly && (
          <Button onClick={create} disabled={!confId} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="h-4 w-4 mr-1" /> New survey</Button>
        )}
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
                  {s.questions?.length || 0} questions · {s.submittedCount || 0} responses received{s.sentAt ? ` · Last sent ${formatDate(s.sentAt)}` : ''}
                </div>
              </div>
              <div className="flex flex-col gap-1 w-40">
                {!readOnly && <Button size="sm" variant="outline" onClick={() => setEditing(s)}>Edit</Button>}
                <Button size="sm" variant="outline" onClick={() => setViewingAnalytics(s)}><BarChart3 className="h-3 w-3 mr-1" />Results</Button>
                {!readOnly && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => sendTest(s)} disabled={sendingId === s.id + ':test'}>
                      {sendingId === s.id + ':test' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Mail className="h-3 w-3 mr-1" />}Send test
                    </Button>
                    <Button size="sm" onClick={() => send(s)} disabled={sendingId === s.id} className="bg-indigo-600 hover:bg-indigo-700">
                      {sendingId === s.id ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Sending…</> : <><Send className="h-3 w-3 mr-1" />Send to all</>}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(s.id)}><Trash2 className="h-3 w-3" /></Button>
                  </>
                )}
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
function ProgrammeAdmin({ readOnly = false }) {
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
          {readOnly && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] px-2 py-1">
              <AlertCircle className="h-3 w-3" /> Read-only view — Committee Editors can review the programme but cannot create or edit sessions.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={confId} onValueChange={setConfId}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{confs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
          </Select>
          {!readOnly && (
            <Button onClick={createSession} disabled={!confId} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="h-4 w-4 mr-1" /> New session</Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-6">
          {loading && <div className="text-center py-6"><Loader2 className="animate-spin inline" /></div>}
          {!loading && sessions.length === 0 && (
            readOnly
              ? <EmptyState label="No sessions scheduled yet" />
              : <EmptyState label="No sessions scheduled yet" onAction={createSession} actionLabel="Create first session" />
          )}
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
                          {!readOnly && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => setEditing(s)}>Edit</Button>
                              <Button size="sm" variant="outline" onClick={() => setAddingToSession(s)}><Plus className="h-3 w-3" /></Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteSession(s.id)}><Trash2 className="h-3 w-3" /></Button>
                            </>
                          )}
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
                              {!readOnly && (
                                <button onClick={() => removeItem(i.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"><Trash2 className="h-3 w-3" /></button>
                              )}
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
  const [search, setSearch] = useState('')
  useEffect(() => {
    api('/abstracts?scope=assigned').then(d => setList(d.abstracts || [])).catch(e => toast.error(e.message)).finally(() => setLoading(false))
  }, [])

  const activeStates = ['UNDER_REVIEW', 'PEER_REVIEW', 'EDITORIAL_DECISION', 'AWAITING_DECISION', 'ASSIGNED', 'REVIEW_IN_PROGRESS', 'MINOR_REVISION', 'MAJOR_REVISION', 'AWAITING_REVISION', 'RESUBMITTED', 'PROGRAMME_SCHEDULING', 'COMMITTEE_REVIEW', 'EXTERNAL_PEER_REVIEW', 'REVIEWS_COMPLETED', 'EDITORIAL_ASSIGNMENT', 'TECHNICAL_CHECK', 'SUBMITTED']
  const doneStates = ['ACCEPTED', 'FINAL_ACCEPTANCE', 'ORAL', 'POSTER', 'REJECTED', 'PUBLISHED', 'WITHDRAWN']
  const q = search.trim().toLowerCase()
  const visible = list.filter(a => {
    if (q && !a.title?.toLowerCase().includes(q) && !a.submissionCode?.toLowerCase().includes(q)) return false
    if (filter === 'all') return true
    if (filter === 'active') return activeStates.includes(a.currentState)
    if (filter === 'done') return doneStates.includes(a.currentState)
    return true
  })
  const counts = {
    active: list.filter(a => activeStates.includes(a.currentState)).length,
    done: list.filter(a => doneStates.includes(a.currentState)).length,
    all: list.length,
    urgent: list.filter(a => (a.reviewAssignments || []).length === 0 && activeStates.includes(a.currentState)).length,
  }

  const groups = { }
  visible.forEach(a => { const s = a.currentState; if (!groups[s]) groups[s] = []; groups[s].push(a) })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Briefcase className="h-7 w-7 text-indigo-600" /> My Editor Workspace</h1>
          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">{list.length} paper{list.length !== 1 ? 's' : ''} in my queue</Badge>
        </div>
        <p className="text-muted-foreground text-sm">Handle editor review, reviewer assignment, correspondence with authors and decisions from one place. Click any card to open its full workspace.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatBadge label="Active" value={counts.active} color="from-indigo-500 to-fuchsia-500" icon={Clock} />
        <StatBadge label="Needs reviewers" value={counts.urgent} color="from-amber-500 to-orange-600" icon={AlertCircle} attention />
        <StatBadge label="Decided" value={counts.done} color="from-emerald-500 to-teal-600" icon={CheckCircle2} />
        <StatBadge label="All time" value={counts.all} color="from-slate-600 to-slate-700" icon={FileText} />
      </div>

      {/* Filter bar */}
      <Card className="mb-4 border-0 shadow-sm">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search my papers" className="pl-8" />
          </div>
          <div className="flex gap-1">
            <Button variant={filter === 'active' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('active')} className={filter === 'active' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>Active</Button>
            <Button variant={filter === 'done' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('done')} className={filter === 'done' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>Decided</Button>
            <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')} className={filter === 'all' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>All</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? <div className="p-10 text-center"><Loader2 className="animate-spin inline" /></div> : (
        list.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">
              <Briefcase className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <div className="text-lg font-semibold text-slate-500">No abstracts assigned yet</div>
              <div className="text-sm text-muted-foreground mt-1">The Managing Editor will assign abstracts to your queue. Once assigned, they appear here for full editorial handling.</div>
              <Button className="mt-4" variant="outline" onClick={() => setRoute({ name: 'editorial' })}>Browse Editorial Office</Button>
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
                  {abs.map(a => <EditorialAbstractRow key={a.id} a={a} onOpen={() => setRoute({ name: 'abstract', id: a.id, from: 'workspace' })} inWorkspace />)}
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
function LiveConferencePage({ user, setRoute }) {
  const [confs, setConfs] = useState([])
  const [confId, setConfId] = useState('')
  useEffect(() => { api('/conferences').then(d => { const list = d.conferences || []; setConfs(list); const featured = list.find(c => c.isFeatured) || list[0]; if (featured) setConfId(featured.id) }).catch(() => {}) }, [])
  const conf = confs.find(c => c.id === confId)
  const isAdmin = user?.roles?.some(r => ['SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR'].includes(r.role || r))

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

// ============ PUBLIC VIRTUAL CONFERENCE (public/anonymous) ============
function PublicVirtualConference({ conf, onSignIn }) {
  if (!conf) return <div className="p-8 text-center text-muted-foreground">Loading…</div>
  return (
    <div className="min-h-screen">
      <LiveConference conf={conf} isAdmin={false} fallback={<ExhibitionBoothsPublic conf={conf} />} onNeedsSignIn={onSignIn} />
    </div>
  )
}

export default App

