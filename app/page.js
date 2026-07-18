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
} from 'lucide-react'

const api = async (path, opts = {}) => {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

const apiUpload = async (path, formData) => {
  const res = await fetch(`/api${path}`, { method: 'POST', body: formData, credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data
}

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#84cc16']

// ============ MAIN APP ============
function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('landing') // landing | login | register | app
  const [route, setRoute] = useState({ name: 'dashboard' })

  useEffect(() => {
    api('/auth/me').then(d => { setUser(d.user); setView('app') }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  if (view === 'landing' && !user) return <Landing onLogin={() => setView('login')} onRegister={() => setView('register')} />
  if (view === 'login') return <AuthPage mode="login" onDone={(u) => { setUser(u); setView('app') }} onSwitch={() => setView('register')} onBack={() => setView('landing')} />
  if (view === 'register') return <AuthPage mode="register" onDone={(u) => { setUser(u); setView('app') }} onSwitch={() => setView('login')} onBack={() => setView('landing')} />

  return <AppShell user={user} setUser={setUser} route={route} setRoute={setRoute} onLogout={() => { api('/auth/logout', { method: 'POST' }); setUser(null); setView('landing') }} />
}

// ============ LANDING ============
function Landing({ onLogin, onRegister }) {
  const [conferences, setConferences] = useState([])
  useEffect(() => { api('/conferences').then(d => setConferences(d.conferences || [])).catch(() => {}) }, [])
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white font-bold">S</div>
            <div>
              <div className="font-bold tracking-tight text-lg">SCMS</div>
              <div className="text-[10px] text-muted-foreground -mt-1">Scientific Conference Management</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onLogin}>Sign in</Button>
            <Button onClick={onRegister} className="bg-indigo-600 hover:bg-indigo-700">Get started</Button>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-6 py-20 lg:py-28">
        <div className="max-w-3xl">
          <Badge variant="outline" className="mb-4 border-indigo-200 bg-indigo-50 text-indigo-700">Enterprise conference platform</Badge>
          <h1 className="text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            The complete lifecycle for <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">scientific conferences</span>
          </h1>
          <p className="mt-6 text-xl text-muted-foreground leading-relaxed">
            Submission, editorial review, peer review, revisions, decisions, programme scheduling,
            presentation management and long-term archive — all in one enterprise-grade platform.
          </p>
          <div className="mt-8 flex gap-3">
            <Button size="lg" onClick={onRegister} className="bg-indigo-600 hover:bg-indigo-700">
              Create an account <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={onLogin}>Sign in to platform</Button>
          </div>
          <div className="mt-6 text-sm text-muted-foreground">
            Try demo accounts (password: <code className="bg-slate-100 px-1.5 py-0.5 rounded">password123</code>):
            <span className="ml-1">admin@scms.io · managing@scms.io · section@scms.io · reviewer1@scms.io · author@scms.io</span>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold mb-6">Twelve integrated modules</h2>
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
        <section className="container mx-auto px-6 pb-20">
          <h2 className="text-2xl font-bold mb-6">Upcoming conferences</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {conferences.map(c => (
              <Card key={c.id} className="hover:shadow-lg transition">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">{c.code}</Badge>
                    <Badge variant="outline">{stateLabel(c.status)}</Badge>
                  </div>
                  <CardTitle className="text-lg mt-2">{c.name}</CardTitle>
                  <CardDescription>{c.venue}, {c.city}, {c.country}</CardDescription>
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

      <footer className="border-t bg-slate-50 py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          SCMS · Enterprise Scientific Conference Management · Next.js + PostgreSQL + Prisma
        </div>
      </footer>
    </div>
  )
}

function BarChartIcon(props) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg> }

// ============ AUTH ============
function AuthPage({ mode, onDone, onSwitch, onBack }) {
  const [email, setEmail] = useState(mode === 'login' ? 'managing@scms.io' : '')
  const [password, setPassword] = useState(mode === 'login' ? 'password123' : '')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState('AUTHOR')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const d = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
        toast.success(`Welcome back, ${d.user.firstName}!`)
        onDone(d.user)
      } else {
        const d = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, firstName, lastName, role }) })
        toast.success('Account created')
        onDone(d.user)
      }
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white font-bold">S</div>
            <span className="font-bold text-xl">SCMS</span>
          </div>
          <CardTitle>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</CardTitle>
          <CardDescription>Enterprise scientific conference platform</CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-3">
            {mode === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>First name</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} required /></div>
                  <div><Label>Last name</Label><Input value={lastName} onChange={e => setLastName(e.target.value)} required /></div>
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTHOR">Author (submit abstracts)</SelectItem>
                      <SelectItem value="ATTENDEE">Attendee (register for conferences)</SelectItem>
                      <SelectItem value="EXTERNAL_REVIEWER">External Reviewer</SelectItem>
                      <SelectItem value="INDUSTRY_PARTNER">Industry Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          </CardContent>
          <CardFooter className="flex-col gap-2 items-stretch">
            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground">← Back</button>
              <button type="button" onClick={onSwitch} className="text-indigo-600 hover:underline">
                {mode === 'login' ? "Don't have an account? Register" : 'Have an account? Sign in'}
              </button>
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
  const roles = user.roles.map(r => r.role)
  const isAdmin = roles.includes('SYSTEM_ADMIN')
  const isEditor = roles.some(r => ['MANAGING_EDITOR', 'SECTION_EDITOR', 'COMMITTEE_MEMBER'].includes(r))
  const isReviewer = roles.some(r => ['EXTERNAL_REVIEWER', 'COMMITTEE_MEMBER'].includes(r))
  const isAuthor = roles.includes('AUTHOR') || roles.includes('ATTENDEE') || true // any user can author

  const refreshNotifs = () => api('/notifications').then(d => setNotifs(d.notifications || [])).catch(() => {})
  useEffect(() => { refreshNotifs(); const i = setInterval(refreshNotifs, 30000); return () => clearInterval(i) }, [])

  const unread = notifs.filter(n => !n.isRead).length

  const nav = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { key: 'my-abstracts', label: 'My Abstracts', icon: FileText, show: true },
    { key: 'submit', label: 'New Submission', icon: Plus, show: true },
    { key: 'editorial', label: 'Editorial Office', icon: ClipboardCheck, show: isEditor || isAdmin },
    { key: 'reviews', label: 'My Reviews', icon: Award, show: isReviewer },
    { key: 'conferences', label: 'Conferences', icon: Calendar, show: true },
    { key: 'programme', label: 'Programme', icon: GraduationCap, show: true },
    { key: 'analytics', label: 'Analytics', icon: BarChartIcon, show: isEditor || isAdmin },
    { key: 'users', label: 'User Management', icon: Users, show: isAdmin },
    { key: 'audit', label: 'Audit Log', icon: ShieldCheck, show: isAdmin },
  ]

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
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
      <main className="flex-1 flex flex-col">
        <header className="h-14 border-b bg-white flex items-center justify-between px-6">
          <div className="text-sm text-muted-foreground">{route.name === 'abstract' ? 'Abstract detail' : nav.find(n => n.key === route.name)?.label || 'SCMS'}</div>
          <NotificationsBell notifs={notifs} onOpen={(n) => { if (n.link?.startsWith('/abstracts/')) setRoute({ name: 'abstract', id: n.link.split('/')[2] }); api(`/notifications/${n.id}/read`, { method: 'POST' }).then(refreshNotifs) }} onReadAll={() => api('/notifications/read-all', { method: 'POST' }).then(refreshNotifs)} unread={unread} />
        </header>
        <div className="flex-1 overflow-auto">
          <ViewRouter route={route} setRoute={setRoute} user={user} setUser={setUser} isAdmin={isAdmin} isEditor={isEditor} isReviewer={isReviewer} />
        </div>
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
  if (route.name === 'reviews') return <ReviewerWorkspace setRoute={setRoute} />
  if (route.name === 'conferences') return <Conferences />
  if (route.name === 'programme') return <Programme />
  if (route.name === 'analytics') return <Analytics />
  if (route.name === 'users') return <UserManagement />
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

// ============ SUBMIT ABSTRACT ============
function SubmitAbstract({ setRoute, user }) {
  const [conferences, setConferences] = useState([])
  const [conferenceId, setConferenceId] = useState('')
  const [themeId, setThemeId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [keywords, setKeywords] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { api('/conferences').then(d => {
    setConferences(d.conferences || [])
    if (d.conferences?.[0]) setConferenceId(d.conferences[0].id)
  }) }, [])

  const themes = conferences.find(c => c.id === conferenceId)?.themes || []

  const submit = async (asDraft) => {
    if (!conferenceId || !title || !body) { toast.error('Fill required fields'); return }
    setLoading(true)
    try {
      const d = await api('/abstracts', {
        method: 'POST',
        body: JSON.stringify({
          conferenceId, themeId: themeId || null, title, body,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
          coverLetter,
        }),
      })
      if (!asDraft) {
        await api(`/abstracts/${d.abstract.id}/submit`, { method: 'POST' })
        toast.success(`Submitted as ${d.abstract.submissionCode}`)
      } else {
        toast.success(`Draft saved as ${d.abstract.submissionCode}`)
      }
      setRoute({ name: 'abstract', id: d.abstract.id })
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">New abstract submission</h1>
        <p className="text-muted-foreground">Submit an abstract for peer review</p>
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Conference *</Label>
              <Select value={conferenceId} onValueChange={setConferenceId}>
                <SelectTrigger><SelectValue placeholder="Choose conference" /></SelectTrigger>
                <SelectContent>{conferences.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scientific theme</Label>
              <Select value={themeId} onValueChange={setThemeId}>
                <SelectTrigger><SelectValue placeholder="Choose theme" /></SelectTrigger>
                <SelectContent>{themes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter abstract title" />
          </div>
          <div>
            <Label>Abstract body *</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={10} placeholder="Enter your abstract text (background, methods, results, conclusions)" />
          </div>
          <div>
            <Label>Keywords (comma separated)</Label>
            <Input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. neural networks, transformer, NLP" />
          </div>
          <div>
            <Label>Cover letter (optional)</Label>
            <Textarea value={coverLetter} onChange={e => setCoverLetter(e.target.value)} rows={4} placeholder="Optional message to the editors" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => submit(true)} disabled={loading}>Save as draft</Button>
            <Button onClick={() => submit(false)} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit for review
            </Button>
          </div>
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
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [recipient, setRecipient] = useState('')
  const [channel, setChannel] = useState('EDITOR_AUTHOR')
  const refresh = () => api(`/abstracts/${abstractId}/messages`).then(d => setMessages(d.messages || []))
  useEffect(() => { refresh(); api('/users').then(d => setUsers(d.users || [])) }, [])

  const send = async () => {
    if (!subject || !body) return toast.error('Subject and body required')
    await api(`/abstracts/${abstractId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ subject, body, channel, recipientIds: recipient ? [recipient] : [] }),
    })
    setSubject(''); setBody(''); refresh(); toast.success('Message sent')
  }

  return (
    <Card>
      <CardHeader><CardTitle>Internal messaging</CardTitle><CardDescription>All communication is scoped to this abstract and audited</CardDescription></CardHeader>
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
              <Badge variant="outline" className="text-[10px] mt-2">{m.channel.replace('_', ' ↔ ')}</Badge>
            </div>
          ))}
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EDITOR_AUTHOR">Editor ↔ Author</SelectItem>
                <SelectItem value="EDITOR_REVIEWER">Editor ↔ Reviewer</SelectItem>
                <SelectItem value="EDITOR_EDITOR">Editor ↔ Editor</SelectItem>
                <SelectItem value="REVIEWER_EDITOR">Reviewer ↔ Editor</SelectItem>
              </SelectContent>
            </Select>
            <Select value={recipient} onValueChange={setRecipient}>
              <SelectTrigger><SelectValue placeholder="Recipient" /></SelectTrigger>
              <SelectContent>{users.filter(u => u.id !== user.id).map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
          <Textarea placeholder="Message body" value={body} onChange={e => setBody(e.target.value)} rows={4} />
          <Button onClick={send}><Send className="h-4 w-4 mr-1" /> Send message</Button>
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
  const [commentsToAuthor, setCommentsToAuthor] = useState('')
  const [commentsToEditor, setCommentsToEditor] = useState('')
  const submit = async () => {
    if (!commentsToAuthor) return toast.error('Comments to author required')
    await api(`/reviewer/assignments/${assignment.id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ ...scores, recommendation, commentsToAuthor, commentsToEditor }),
    })
    toast.success('Review submitted'); onDone()
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Submit review</DialogTitle>
          <DialogDescription>{assignment.abstract.submissionCode} — {assignment.abstract.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
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
            <Label>Comments to author</Label>
            <Textarea rows={6} value={commentsToAuthor} onChange={e => setCommentsToAuthor(e.target.value)} />
          </div>
          <div>
            <Label>Confidential comments to editor</Label>
            <Textarea rows={3} value={commentsToEditor} onChange={e => setCommentsToEditor(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} className="bg-indigo-600 hover:bg-indigo-700">Submit review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ CONFERENCES ============
function Conferences() {
  const [list, setList] = useState([])
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
              <div className="pt-3">
                <Button size="sm" onClick={async () => { try { await api(`/conferences/${c.id}/register`, { method: 'POST', body: JSON.stringify({}) }); toast.success('Registered') } catch (e) { toast.error(e.message) } }}>Register</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Programme() {
  const [confs, setConfs] = useState([])
  const [confId, setConfId] = useState('')
  const [sessions, setSessions] = useState([])
  useEffect(() => { api('/conferences').then(d => { setConfs(d.conferences || []); if (d.conferences?.[0]) setConfId(d.conferences[0].id) }) }, [])
  useEffect(() => { if (confId) api(`/programme/${confId}`).then(d => setSessions(d.sessions || [])) }, [confId])
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Conference programme</h1>
        <Select value={confId} onValueChange={setConfId}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>{confs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {sessions.length === 0 ? <EmptyState label="No sessions scheduled yet" /> : (
        <div className="space-y-4">
          {sessions.map(s => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle>{s.title}</CardTitle>
                <CardDescription>{new Date(s.startTime).toLocaleString()} – {new Date(s.endTime).toLocaleTimeString()} · Room: {s.room} · Chair: {s.chair}</CardDescription>
              </CardHeader>
              <CardContent>
                {s.items.map(i => (
                  <div key={i.id} className="border-l-2 border-indigo-200 pl-3 py-1.5 mb-1">
                    <div className="text-sm font-medium">{i.abstract.title}</div>
                    <div className="text-xs text-muted-foreground">{i.abstract.authors.map(a => a.fullName).join(', ')} · {i.durationMin} min</div>
                  </div>
                ))}
              </CardContent>
            </Card>
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

export default App
