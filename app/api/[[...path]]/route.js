import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { hashPassword, verifyPassword, signToken, getCurrentUser, hasRole, logAudit } from '@/lib/auth'
import { transitionState, generateSubmissionCode, createNotification, STATE_TRANSITIONS } from '@/lib/workflow'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads'

function ok(data, status = 200) {
  const res = NextResponse.json(data, { status })
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
function err(msg, status = 400) {
  return ok({ error: msg }, status)
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 200 })
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

// ============ HANDLERS ============

async function handleAuth(route, method, request) {
  if (route === '/auth/register' && method === 'POST') {
    const body = await request.json()
    const { email, password, firstName, lastName, title, affiliation, country, role, inviteToken, specialty } = body
    if (!email || !password || !firstName || !lastName) return err('Missing required fields')
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return err('Email already registered', 409)
    // Resolve role: if invitation token is present, force EXTERNAL_REVIEWER role
    let actualRole = role || 'AUTHOR'
    let matchingInvite = null
    if (inviteToken) {
      matchingInvite = await prisma.reviewerInvitation.findUnique({ where: { token: inviteToken } })
      if (matchingInvite) actualRole = 'EXTERNAL_REVIEWER'
    }
    // Attendee gate: signing up as a Conference Attendee is only permitted when the
    // organisers have opened attendee registration on the featured/latest conference.
    if (actualRole === 'ATTENDEE') {
      const gateConf = await prisma.conference.findFirst({ where: { isFeatured: true } })
        || await prisma.conference.findFirst({ where: { status: { not: 'DRAFT' } }, orderBy: { updatedAt: 'desc' } })
        || await prisma.conference.findFirst({ orderBy: { createdAt: 'desc' } })
      if (!gateConf || !gateConf.attendeeRegistrationOpen) {
        return err(
          'Attendee registration is not yet open. The organisers will announce the opening date approximately one month before the conference. You can still register as an Author or Sponsor / Industry Partner in the meantime.',
          409,
        )
      }
    }
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        firstName, lastName, title, affiliation, country,
        specialties: specialty ? [specialty] : [],
        roles: { create: { role: actualRole } },
      },
      include: { roles: true },
    })
    if (matchingInvite) {
      await prisma.reviewerInvitation.update({
        where: { id: matchingInvite.id },
        data: { respondedAt: new Date(), registeredUserId: user.id },
      })
      // If the invitation was created for a specific abstract, auto-assign the reviewer
      // to that abstract so it appears in their workspace immediately after registration.
      if (matchingInvite.abstractId) {
        const already = await prisma.reviewAssignment.findFirst({
          where: { abstractId: matchingInvite.abstractId, reviewerId: user.id },
        })
        if (!already) {
          await prisma.reviewAssignment.create({
            data: {
              abstractId: matchingInvite.abstractId,
              reviewerId: user.id,
              reviewType: 'EXTERNAL_REVIEWER',
              invitationStatus: 'ACCEPTED',
              assignedAt: new Date(),
            },
          })
        }
      }
    }
    // Send a persistent welcome notification for this first-time registration
    try {
      const conf = await prisma.conference.findFirst({ where: { isFeatured: true } })
        || await prisma.conference.findFirst({ orderBy: { createdAt: 'desc' } })
      const confName = conf?.name || 'the Scientific Conference'
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'GENERIC',
          title: `Welcome to ${confName}!`,
          body: `Your registration was successful — thank you for joining ${confName}. Log in to continue with your role as ${actualRole.replace(/_/g, ' ').toLowerCase()}.`,
        },
      })
    } catch (e) { /* non-fatal */ }
    const token = signToken({ userId: user.id })
    const c = await cookies(); c.set('scms_token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60*60*24*30 })
    await logAudit({ actorId: user.id, action: 'REGISTER', entityType: 'User', entityId: user.id })
    return ok({ user: sanitizeUser(user), token, welcome: `Welcome, ${user.firstName}! Your registration was successful.` })
  }

  if (route === '/auth/login' && method === 'POST') {
    const { email, password } = await request.json()
    const user = await prisma.user.findUnique({ where: { email }, include: { roles: true, institution: true } })
    if (!user || !(await verifyPassword(password, user.passwordHash))) return err('Invalid credentials', 401)
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    const token = signToken({ userId: user.id })
    const c = await cookies(); c.set('scms_token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60*60*24*30 })
    await logAudit({ actorId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id })
    return ok({ user: sanitizeUser(user), token })
  }

  if (route === '/auth/logout' && method === 'POST') {
    const c = await cookies(); c.delete('scms_token')
    return ok({ ok: true })
  }

  if (route === '/auth/me' && method === 'GET') {
    const user = await getCurrentUser(request)
    if (!user) return err('Unauthenticated', 401)
    return ok({ user: sanitizeUser(user) })
  }
  return null
}

function sanitizeUser(u) {
  if (!u) return null
  const { passwordHash, ...rest } = u
  return rest
}

async function handleConferences(route, method, request) {
  // Public config for header/footer/hero (no auth required)
  if (route === '/public/config' && method === 'GET') {
    // Featured conference or the latest non-draft one
    let conf = await prisma.conference.findFirst({
      where: { isFeatured: true },
      include: { themes: true },
    })
    if (!conf) {
      conf = await prisma.conference.findFirst({
        where: { status: { not: 'DRAFT' } },
        orderBy: { updatedAt: 'desc' },
        include: { themes: true },
      })
    }
    if (!conf) {
      conf = await prisma.conference.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { themes: true },
      })
    }
    return ok({ conference: conf })
  }

  // GET /conferences
  if (route === '/conferences' && method === 'GET') {
    const list = await prisma.conference.findMany({
      orderBy: { createdAt: 'desc' },
      include: { themes: true, _count: { select: { abstracts: true, registrations: true } } },
    })
    return ok({ conferences: list })
  }
  if (route === '/conferences' && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN')) return err('Forbidden', 403)
    const body = await request.json()
    const conf = await prisma.conference.create({ data: body })
    await logAudit({ actorId: user.id, action: 'CREATE_CONFERENCE', entityType: 'Conference', entityId: conf.id })
    return ok({ conference: conf })
  }

  const m = route.match(/^\/conferences\/([^\/]+)$/)
  if (m && method === 'GET') {
    const conf = await prisma.conference.findUnique({
      where: { id: m[1] },
      include: { themes: true, _count: { select: { abstracts: true, registrations: true } } },
    })
    if (!conf) return err('Not found', 404)
    return ok({ conference: conf })
  }
  if (m && method === 'PUT') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const conf = await prisma.conference.update({ where: { id: m[1] }, data: body })
    return ok({ conference: conf })
  }
  if (m && method === 'DELETE') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN')) return err('Forbidden', 403)
    // Cascade: delete themes, abstracts, sessions, registrations first via schema onDelete Cascade where present
    await prisma.$transaction([
      prisma.programmeItem.deleteMany({ where: { session: { conferenceId: m[1] } } }),
      prisma.programmeSession.deleteMany({ where: { conferenceId: m[1] } }),
      prisma.registration.deleteMany({ where: { conferenceId: m[1] } }),
      prisma.workflowStateHistory.deleteMany({ where: { abstract: { conferenceId: m[1] } } }),
      prisma.reviewReport.deleteMany({ where: { assignment: { abstract: { conferenceId: m[1] } } } }),
      prisma.reviewAssignment.deleteMany({ where: { abstract: { conferenceId: m[1] } } }),
      prisma.editorAssignment.deleteMany({ where: { abstract: { conferenceId: m[1] } } }),
      prisma.editorialDecision.deleteMany({ where: { abstract: { conferenceId: m[1] } } }),
      prisma.message.deleteMany({ where: { abstract: { conferenceId: m[1] } } }),
      prisma.document.deleteMany({ where: { abstract: { conferenceId: m[1] } } }),
      prisma.abstractVersion.deleteMany({ where: { abstract: { conferenceId: m[1] } } }),
      prisma.abstractAuthor.deleteMany({ where: { abstract: { conferenceId: m[1] } } }),
      prisma.abstract.deleteMany({ where: { conferenceId: m[1] } }),
      prisma.theme.deleteMany({ where: { conferenceId: m[1] } }),
      prisma.userRole.deleteMany({ where: { conferenceId: m[1] } }),
      prisma.conference.delete({ where: { id: m[1] } }),
    ])
    await logAudit({ actorId: user.id, action: 'DELETE_CONFERENCE', entityType: 'Conference', entityId: m[1] })
    return ok({ ok: true })
  }

  const themeMatch = route.match(/^\/conferences\/([^\/]+)\/themes$/)
  if (themeMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    // Enforce max of 5 sub-themes per conference
    const existingCount = await prisma.theme.count({ where: { conferenceId: themeMatch[1] } })
    if (existingCount >= 5) return err('This conference already has the maximum of 5 sub-themes.', 400)
    const body = await request.json()
    const theme = await prisma.theme.create({
      data: { conferenceId: themeMatch[1], name: body.name, description: body.description, keywords: body.keywords || [] },
    })
    return ok({ theme })
  }
  // Delete an individual sub-theme
  const themeDelMatch = route.match(/^\/themes\/([^\/]+)$/)
  if (themeDelMatch && method === 'DELETE') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    // Detach abstracts that reference this theme so we don't break FK
    await prisma.abstract.updateMany({ where: { themeId: themeDelMatch[1] }, data: { themeId: null } })
    await prisma.theme.delete({ where: { id: themeDelMatch[1] } })
    return ok({ ok: true })
  }

  const regMatch = route.match(/^\/conferences\/([^\/]+)\/register$/)
  if (regMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!user) return err('Unauthenticated', 401)
    const body = await request.json().catch(() => ({}))
    const conf = await prisma.conference.findUnique({ where: { id: regMatch[1] } })
    if (!conf) return err('Conference not found', 404)
    const now = new Date()
    // Timing rules:
    // AUTHOR: registration open while submission window is open
    // ATTENDEE: opens 1 month before conference start AND requires admin's attendeeRegistrationOpen toggle
    // SPONSOR: always open until conference end
    const regType = body.type || 'ATTENDEE'
    // Reuse the same ordinal-day format the front-end uses
    const fmtOrdinal = (d) => {
      const day = d.getDate()
      const month = d.toLocaleString('en-GB', { month: 'long' })
      const year = d.getFullYear()
      const j = day % 10, k = day % 100
      const suffix = (k >= 11 && k <= 13) ? 'th' : j === 1 ? 'st' : j === 2 ? 'nd' : j === 3 ? 'rd' : 'th'
      return `${day}${suffix} ${month} ${year}`
    }
    if (regType === 'ATTENDEE') {
      if (!conf.attendeeRegistrationOpen) {
        const dateHint = conf.startDate
          ? (() => { const d = new Date(conf.startDate); d.setMonth(d.getMonth() - 1); return fmtOrdinal(d) })()
          : null
        return err(
          dateHint
            ? `Attendee registration is not yet open. It will be opened by the organisers around ${dateHint} (one month before the conference).`
            : 'Attendee registration is not yet open. Please check back closer to the conference date.',
          409,
        )
      }
      if (conf.startDate) {
        const oneMonthBefore = new Date(conf.startDate); oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1)
        if (now < oneMonthBefore) return err(`Attendee registration opens on ${fmtOrdinal(oneMonthBefore)}.`)
        if (conf.endDate && now > conf.endDate) return err('Attendee registration is closed.')
      }
    }
    if (regType === 'AUTHOR' && conf.submissionClose && now > conf.submissionClose) return err('Author registration closed (submission window ended).')
    const reg = await prisma.registration.upsert({
      where: { conferenceId_userId: { conferenceId: regMatch[1], userId: user.id } },
      update: {
        type: regType, mode: body.mode || null,
        prefix: body.prefix || null, fullName: body.fullName || null,
        rank: body.rank || null, unit: body.unit || null, affiliation: body.affiliation || null,
        companyName: body.companyName || null, companyAddress: body.companyAddress || null, industry: body.industry || null,
        sponsorTier: body.sponsorTier || null,
        virtualBoothRequested: !!body.virtualBoothRequested,
        physicalBoothRequested: !!body.physicalBoothRequested,
        sponsorMessage: body.sponsorMessage || null,
      },
      create: {
        conferenceId: regMatch[1], userId: user.id, type: regType, mode: body.mode || null,
        prefix: body.prefix || null, fullName: body.fullName || null,
        rank: body.rank || null, unit: body.unit || null, affiliation: body.affiliation || null,
        companyName: body.companyName || null, companyAddress: body.companyAddress || null, industry: body.industry || null,
        sponsorTier: body.sponsorTier || null,
        virtualBoothRequested: !!body.virtualBoothRequested,
        physicalBoothRequested: !!body.physicalBoothRequested,
        sponsorMessage: body.sponsorMessage || null,
      },
    })
    return ok({ registration: reg })
  }

  // Admin: download name tags PDF (physical delegates + editors)
  const tagMatch = route.match(/^\/conferences\/([^\/]+)\/name-tags\.pdf$/)
  if (tagMatch && method === 'GET') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const conf = await prisma.conference.findUnique({ where: { id: tagMatch[1] } })
    if (!conf) return err('Conference not found', 404)
    const regs = await prisma.registration.findMany({
      where: { conferenceId: tagMatch[1], OR: [{ mode: 'PHYSICAL' }, { type: 'SPONSOR', physicalBoothRequested: true }] },
      include: { user: { select: { firstName: true, lastName: true, affiliation: true } } },
    })
    const editors = await prisma.user.findMany({
      where: { roles: { some: { role: { in: ['SYSTEM_ADMIN','MANAGING_EDITOR','CHIEF_EDITOR','COMMITTEE_EDITOR','COMMITTEE_MEMBER'] } } } },
      select: { firstName: true, lastName: true, title: true, affiliation: true, roles: { select: { role: true } } },
    })
    const logistics = await prisma.user.findMany({
      where: { roles: { some: { role: { in: ['CHIEF_LOGISTICS','COMMITTEE_LOGISTICS'] } } } },
      select: { firstName: true, lastName: true, title: true, affiliation: true, roles: { select: { role: true } } },
    })
    const seen = new Set()
    const delegates = [
      ...regs.map(r => ({
        prefix: r.prefix, fullName: r.fullName || `${r.user.firstName} ${r.user.lastName}`.trim(),
        rank: r.rank || (r.type === 'SPONSOR' ? 'Sponsor' : ''), affiliation: r.affiliation || r.companyName || r.user.affiliation,
      })),
      ...editors.filter(e => {
        // If a user is both editorial and logistics, prefer their editorial tag (they'll be added once here)
        const key = `${e.firstName}|${e.lastName}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).map(e => ({ prefix: e.title || '', fullName: `${e.firstName} ${e.lastName}`, rank: 'Scientific Committee Editor', affiliation: e.affiliation || '' })),
      ...logistics.filter(l => {
        const key = `${l.firstName}|${l.lastName}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).map(l => ({ prefix: l.title || '', fullName: `${l.firstName} ${l.lastName}`, rank: 'Scientific Committee Logistics', affiliation: l.affiliation || '' })),
    ]
    const { generateNameTagsPDF } = await import('@/lib/pdf')
    const buf = await generateNameTagsPDF(delegates, conf)
    return new NextResponse(buf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="name-tags-${conf.code}.pdf"` } })
  }

  // Admin: send attendance certificates via email to all registered attendees
  const attCertMatch = route.match(/^\/conferences\/([^\/]+)\/send-attendance-certificates$/)
  if (attCertMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const conf = await prisma.conference.findUnique({ where: { id: attCertMatch[1] } })
    const regs = await prisma.registration.findMany({
      where: { conferenceId: attCertMatch[1], type: 'ATTENDEE' },
      include: { user: { select: { firstName: true, lastName: true, email: true, affiliation: true } } },
    })
    const { generateCertificatePDF } = await import('@/lib/pdf')
    const { sendEmail } = await import('@/lib/email')
    const { renderEmailHtml } = await import('@/lib/email-templates')
    let sent = 0
    for (const r of regs) {
      const buf = await generateCertificatePDF({
        recipient: {
          prefix: r.prefix, fullName: r.fullName || `${r.user.firstName} ${r.user.lastName}`.trim(),
          firstName: r.user.firstName, lastName: r.user.lastName,
          rank: r.rank, affiliation: r.affiliation || r.user.affiliation, mode: r.mode,
        },
        conference: conf, kind: 'ATTENDANCE',
      })
      const subject = `Certificate of Attendance — ${conf.name}`
      const body = `Dear ${r.prefix || ''} ${r.fullName || r.user.firstName + ' ' + r.user.lastName},\n\nThank you for attending ${conf.name}${r.mode === 'VIRTUAL' ? ' (virtually)' : ''}. Please find your certificate of attendance attached.\n\nWith warm regards,\n${conf.name} Editorial Office`
      await sendEmail({
        to: r.user.email, subject, text: body,
        html: renderEmailHtml({ subject, body, conferenceName: conf.name }),
        attachments: [{ filename: `Certificate_${(r.fullName || r.user.firstName).replace(/\s/g, '_')}.pdf`, mimeType: 'application/pdf', contentBase64: buf.toString('base64') }],
      })
      sent++
    }
    return ok({ sent })
  }

  // Admin: send presentation certificates to authors of accepted+presenting abstracts
  const presCertMatch = route.match(/^\/conferences\/([^\/]+)\/send-presentation-certificates$/)
  if (presCertMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const conf = await prisma.conference.findUnique({ where: { id: presCertMatch[1] } })
    const abstracts = await prisma.abstract.findMany({
      where: {
        conferenceId: presCertMatch[1],
        currentState: { in: ['ACCEPTED', 'ORAL', 'POSTER', 'PRESENTATION_UPLOAD', 'PRESENTATION_REVIEW', 'PROGRAMME_SCHEDULING', 'FINAL_ACCEPTANCE', 'PUBLISHED'] },
      },
      include: { submittedBy: { select: { firstName: true, lastName: true, email: true, title: true, affiliation: true } }, authors: true },
    })
    const { generateCertificatePDF } = await import('@/lib/pdf')
    const { sendEmail } = await import('@/lib/email')
    const { renderEmailHtml } = await import('@/lib/email-templates')
    let sent = 0
    for (const a of abstracts) {
      const buf = await generateCertificatePDF({
        recipient: {
          prefix: a.submittedBy.title, fullName: `${a.submittedBy.firstName} ${a.submittedBy.lastName}`,
          firstName: a.submittedBy.firstName, lastName: a.submittedBy.lastName,
          rank: 'Presenter', affiliation: a.submittedBy.affiliation, abstractTitle: a.title,
        },
        conference: conf, kind: 'PRESENTATION',
      })
      const subject = `Certificate of Presentation — ${conf.name}`
      const body = `Dear ${a.submittedBy.title || ''} ${a.submittedBy.firstName} ${a.submittedBy.lastName},\n\nCongratulations on presenting "${a.title}" at ${conf.name}. Please find your certificate of presentation attached.\n\nWith warm regards,\n${conf.name} Editorial Office`
      await sendEmail({
        to: a.submittedBy.email, subject, text: body,
        html: renderEmailHtml({ subject, body, conferenceName: conf.name }),
        attachments: [{ filename: `Presentation_Certificate_${a.submissionCode}.pdf`, mimeType: 'application/pdf', contentBase64: buf.toString('base64') }],
      })
      sent++
    }
    return ok({ sent })
  }
  const dlMatch = route.match(/^\/conferences\/([^\/]+)\/delegates\.csv$/)
  if (dlMatch && method === 'GET') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const url = new URL(request.url)
    const modeFilter = url.searchParams.get('mode') // PHYSICAL | VIRTUAL | ''
    const where = { conferenceId: dlMatch[1] }
    if (modeFilter === 'PHYSICAL') where.OR = [{ mode: 'PHYSICAL' }, { type: 'SPONSOR', physicalBoothRequested: true }]
    else if (modeFilter === 'VIRTUAL') where.mode = 'VIRTUAL'
    const regs = await prisma.registration.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, email: true, roles: { select: { role: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
    // Physical delegates should also include editors + admin per requirement
    let editorRegs = []
    if (modeFilter === 'PHYSICAL') {
      const editors = await prisma.user.findMany({
        where: { roles: { some: { role: { in: ['SYSTEM_ADMIN','MANAGING_EDITOR','CHIEF_EDITOR','COMMITTEE_EDITOR','COMMITTEE_MEMBER'] } } } },
        select: { firstName: true, lastName: true, email: true, affiliation: true, roles: { select: { role: true } } },
      })
      editorRegs = editors.map(e => ({
        user: { firstName: e.firstName, lastName: e.lastName, email: e.email, roles: e.roles },
        prefix: '', rank: '', unit: '', affiliation: e.affiliation, type: 'EDITOR', mode: 'PHYSICAL', companyName: '',
      }))
    }
    const rows = [...regs, ...editorRegs]
    const escapeCsv = (v) => {
      if (v == null) return ''
      const s = String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
      return s
    }
    const header = ['Prefix','First Name','Last Name','Email','Type','Mode','Rank','Unit','Affiliation','Company','Registered']
    const csv = [header.join(',')].concat(rows.map(r => [
      escapeCsv(r.prefix), escapeCsv(r.user?.firstName), escapeCsv(r.user?.lastName),
      escapeCsv(r.user?.email), escapeCsv(r.type), escapeCsv(r.mode),
      escapeCsv(r.rank), escapeCsv(r.unit), escapeCsv(r.affiliation || r.user?.affiliation),
      escapeCsv(r.companyName), escapeCsv(r.createdAt ? new Date(r.createdAt).toISOString() : ''),
    ].join(','))).join('\n')
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="delegates_${modeFilter || 'all'}.csv"`,
      },
    })
  }

  // Hero image upload (admin/chief editor, multipart)
  const heroMatch = route.match(/^\/conferences\/([^\/]+)\/hero-images$/)
  if (heroMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return err('No file')
    if (file.size > 5 * 1024 * 1024) return err('Image too large (max 5 MB)')
    const buf = Buffer.from(await file.arrayBuffer())
    const safeName = `hero_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const dir = path.join(UPLOAD_DIR, 'hero', heroMatch[1])
    await fs.mkdir(dir, { recursive: true })
    const filePath = path.join(dir, safeName)
    await fs.writeFile(filePath, buf)
    const publicPath = `/api/uploads/hero/${heroMatch[1]}/${safeName}`
    // Read current, append, save (avoids race conditions with Prisma push)
    const existing = await prisma.conference.findUnique({ where: { id: heroMatch[1] }, select: { heroImages: true } })
    const newImages = [...(existing?.heroImages || []), publicPath]
    const conf = await prisma.conference.update({
      where: { id: heroMatch[1] },
      data: { heroImages: newImages },
    })
    return ok({ conference: conf, imagePath: publicPath })
  }
  if (heroMatch && method === 'DELETE') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const conf = await prisma.conference.findUnique({ where: { id: heroMatch[1] } })
    const filtered = (conf.heroImages || []).filter(p => p !== body.imagePath)
    const updated = await prisma.conference.update({ where: { id: heroMatch[1] }, data: { heroImages: filtered } })
    return ok({ conference: updated })
  }

  // Header logo upload (left/right/background side icon on the fixed public header)
  // POST with multipart body {file, side: 'left'|'right'|'background'} → replaces existing
  // DELETE with body {side} → clears (reverts to default)
  const headerLogoMatch = route.match(/^\/conferences\/([^\/]+)\/header-logo$/)
  if (headerLogoMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const formData = await request.formData()
    const file = formData.get('file')
    const side = (formData.get('side') || 'left').toString().toLowerCase()
    if (!['left', 'right', 'background'].includes(side)) return err('side must be "left", "right" or "background"')
    if (!file) return err('No file')
    // background can be larger (up to 5 MB), icons stay small
    const sizeLimit = side === 'background' ? 5 * 1024 * 1024 : 2 * 1024 * 1024
    if (file.size > sizeLimit) return err(`Image too large (max ${sizeLimit / 1024 / 1024} MB). Please upload a compressed image.`)
    const buf = Buffer.from(await file.arrayBuffer())
    const safeName = `header_${side}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const dir = path.join(UPLOAD_DIR, 'header', headerLogoMatch[1])
    await fs.mkdir(dir, { recursive: true })
    const filePath = path.join(dir, safeName)
    await fs.writeFile(filePath, buf)
    const publicPath = `/api/uploads/header/${headerLogoMatch[1]}/${safeName}`
    const data = side === 'left' ? { headerLogoLeft: publicPath }
               : side === 'right' ? { headerLogoRight: publicPath }
               : { headerBackground: publicPath }
    const conf = await prisma.conference.update({ where: { id: headerLogoMatch[1] }, data })
    await logAudit({ actorId: user.id, action: 'UPDATE_HEADER_LOGO', entityType: 'Conference', entityId: headerLogoMatch[1], metadata: { side } })
    return ok({ conference: conf, imagePath: publicPath, side })
  }
  if (headerLogoMatch && method === 'DELETE') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const side = (body.side || '').toString().toLowerCase()
    if (!['left', 'right', 'background'].includes(side)) return err('side must be "left", "right" or "background"')
    const data = side === 'left' ? { headerLogoLeft: null }
               : side === 'right' ? { headerLogoRight: null }
               : { headerBackground: null }
    const conf = await prisma.conference.update({ where: { id: headerLogoMatch[1] }, data })
    return ok({ conference: conf })
  }

  // Hotel/venue image upload
  const hotelMatch = route.match(/^\/conferences\/([^\/]+)\/hotel-image$/)
  if (hotelMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return err('No file')
    if (file.size > 8 * 1024 * 1024) return err('Image too large (max 8 MB)')
    const buf = Buffer.from(await file.arrayBuffer())
    const safeName = `hotel_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const dir = path.join(UPLOAD_DIR, 'hotel', hotelMatch[1])
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, safeName), buf)
    const publicPath = `/api/uploads/hotel/${hotelMatch[1]}/${safeName}`
    const conf = await prisma.conference.update({ where: { id: hotelMatch[1] }, data: { hotelImagePath: publicPath } })
    await logAudit({ actorId: user.id, action: 'UPLOAD_HOTEL_IMAGE', entityType: 'Conference', entityId: hotelMatch[1] })
    return ok({ conference: conf, imagePath: publicPath })
  }
  return null
}

// Serve uploaded images publicly
async function handleUploadServe(route, method, request) {
  if (method !== 'GET') return null
  const m = route.match(/^\/uploads\/(.+)$/)
  if (!m) return null
  const relative = m[1]
  const abs = path.join(UPLOAD_DIR, relative)
  // Prevent traversal
  if (!abs.startsWith(UPLOAD_DIR)) return err('Bad path', 400)
  try {
    const buf = await fs.readFile(abs)
    const ext = path.extname(abs).toLowerCase()
    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
    return new NextResponse(buf, { status: 200, headers: { 'Content-Type': mimeMap[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' } })
  } catch {
    return err('Not found', 404)
  }
}

async function _unused() {
  return null
}

async function handleAbstracts(route, method, request) {
  // Skip if route doesn't belong to this handler
  if (!route.startsWith('/abstracts') && !route.startsWith('/documents')) return null
  const user = await getCurrentUser(request)
  if (!user) return err('Unauthenticated', 401)

  // LIST
  if (route === '/abstracts' && method === 'GET') {
    const url = new URL(request.url)
    const conferenceId = url.searchParams.get('conferenceId')
    const state = url.searchParams.get('state')
    const scope = url.searchParams.get('scope') // 'mine' | 'assigned' | 'all'
    const q = (url.searchParams.get('q') || '').trim()
    const where = {}
    if (conferenceId) where.conferenceId = conferenceId
    if (state) {
      if (state.includes(',')) where.currentState = { in: state.split(',').map(s => s.trim()).filter(Boolean) }
      else where.currentState = state
    }
    if (scope === 'mine') where.submittedById = user.id
    if (scope === 'assigned') {
      // editor or reviewer assignments
      if (hasRole(user, 'EXTERNAL_REVIEWER', 'COMMITTEE_MEMBER')) {
        where.reviewAssignments = { some: { reviewerId: user.id } }
      } else if (hasRole(user, 'MANAGING_EDITOR', 'CHIEF_EDITOR', 'COMMITTEE_EDITOR')) {
        where.editorAssignments = { some: { editorId: user.id, active: true } }
      }
    }
    // authors see only their own by default
    if (!scope && !hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'COMMITTEE_MEMBER', 'CHIEF_EDITOR', 'COMMITTEE_EDITOR', 'EXTERNAL_REVIEWER')) {
      where.submittedById = user.id
    }
    // DRAFT visibility rule: only the submitting author (and the system admin, for support) can see
    // draft abstracts. Editors, committee members and reviewers should NEVER see drafts — those
    // abstracts have not yet been formally submitted.
    if (where.submittedById !== user.id && !hasRole(user, 'SYSTEM_ADMIN')) {
      // If caller specifically requested draft (via ?state=DRAFT) they still get denied unless owner
      if (where.currentState === 'DRAFT' || (where.currentState?.in || []).includes('DRAFT')) {
        return err('Draft abstracts are only visible to their authors', 403)
      }
      // Otherwise silently exclude drafts from listing
      if (!where.currentState) {
        where.currentState = { not: 'DRAFT' }
      }
    }
    // Free-text search across title, submissionCode, and author names (case-insensitive)
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { submissionCode: { contains: q, mode: 'insensitive' } },
        { authors: { some: { fullName: { contains: q, mode: 'insensitive' } } } },
        { submittedBy: { firstName: { contains: q, mode: 'insensitive' } } },
        { submittedBy: { lastName: { contains: q, mode: 'insensitive' } } },
      ]
    }
    const list = await prisma.abstract.findMany({
      where,
      include: {
        conference: { select: { id: true, code: true, name: true, doubleBlind: true } },
        theme: true,
        authors: true,
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        editorAssignments: { where: { active: true }, include: { editor: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        reviewAssignments: { include: { reviewer: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        _count: { select: { reviewAssignments: true, messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    // Attach technical-score averages (committee reviewer scores) so the Editorial Office can prioritise
    const ids = list.map(a => a.id)
    if (ids.length) {
      const scores = await prisma.technicalScore.findMany({ where: { abstractId: { in: ids } } })
      const grouped = {}
      for (const s of scores) {
        if (!grouped[s.abstractId]) grouped[s.abstractId] = []
        grouped[s.abstractId].push((s.originality + s.methodology + s.relevance + s.language + s.themeAlignment) / 5)
      }
      for (const a of list) {
        const arr = grouped[a.id] || []
        a.technicalScoreCount = arr.length
        a.technicalScoreAverage = arr.length ? Math.round((arr.reduce((x, y) => x + y, 0) / arr.length) * 10) / 10 : null
      }
    }
    return ok({ abstracts: list })
  }

  // CREATE
  if (route === '/abstracts' && method === 'POST') {
    const body = await request.json()
    const { conferenceId, themeId, title, body: absBody, keywords, coverLetter, authors, reportType, disclosureStatement } = body
    if (!conferenceId || !title) return err('conferenceId and title required')
    // Validate title word count (max 20)
    const titleWords = (title || '').trim().split(/\s+/).filter(Boolean).length
    if (titleWords > 20) return err(`Title exceeds 20 words (got ${titleWords})`)
    // Validate body word count (max 300)
    if (absBody) {
      const bodyWords = (absBody || '').trim().split(/\s+/).filter(Boolean).length
      if (bodyWords > 300) return err(`Abstract body exceeds 300 words (got ${bodyWords})`)
    }
    const code = await generateSubmissionCode(conferenceId)
    const authorsData = (authors && authors.length ? authors : [{
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      affiliation: user.affiliation,
      isCorresponding: true,
      orderIndex: 0,
      userId: user.id,
    }]).map((a, i) => ({
      userId: a.userId || (i === 0 ? user.id : null),
      fullName: a.fullName,
      email: a.email,
      phone: a.phone || null,
      department: a.department || null,
      affiliation: a.affiliation || null,
      isCorresponding: !!a.isCorresponding,
      orderIndex: a.orderIndex ?? i,
    }))
    const abstract = await prisma.abstract.create({
      data: {
        submissionCode: code,
        conferenceId,
        themeId: themeId || null,
        submittedById: user.id,
        title,
        reportType: reportType || 'ORIGINAL_RESEARCH',
        disclosureStatement: disclosureStatement || null,
        keywords: keywords || [],
        currentState: 'DRAFT',
        authors: { create: authorsData },
        versions: { create: { versionNumber: 1, title, body: absBody || '', keywords: keywords || [], coverLetter: coverLetter || null, createdById: user.id } },
        stateHistory: { create: { newState: 'DRAFT', actorId: user.id, comment: 'Draft created' } },
      },
      include: { authors: true, versions: true },
    })
    await logAudit({ actorId: user.id, action: 'CREATE_ABSTRACT', entityType: 'Abstract', entityId: abstract.id })
    return ok({ abstract })
  }

  // Single abstract
  const idMatch = route.match(/^\/abstracts\/([^\/]+)$/)
  if (idMatch && method === 'GET') {
    const abstract = await prisma.abstract.findUnique({
      where: { id: idMatch[1] },
      include: {
        conference: true, theme: true, authors: true,
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true, affiliation: true } },
        versions: { orderBy: { versionNumber: 'desc' } },
        editorAssignments: { where: { active: true }, include: { editor: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        reviewAssignments: {
          include: {
            reviewer: { select: { id: true, firstName: true, lastName: true, email: true, specialties: true } },
            report: true,
          },
        },
        decisions: { orderBy: { createdAt: 'desc' }, include: { decidedBy: { select: { firstName: true, lastName: true } } } },
        stateHistory: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { firstName: true, lastName: true } } } },
        documents: { where: { isDeleted: false }, include: { uploadedBy: { select: { firstName: true, lastName: true } } } },
        programmeItem: { include: { session: true } },
      },
    })
    if (!abstract) return err('Not found', 404)
    // Access control: authors can see own, editors/reviewers can see if assigned, admin all
    const isOwner = abstract.submittedById === user.id
    // A reviewer may have multiple ReviewAssignment rows for the same abstract (e.g. after
    // re-invitation). We pick the "best" one: ACCEPTED > PENDING > DECLINED. This ensures
    // that a reviewer who has ACCEPTED at least one invitation for this abstract retains
    // access even if older DECLINED / PENDING rows still exist in the database.
    const myAssignments = abstract.reviewAssignments.filter(r => r.reviewerId === user.id)
    const priority = { ACCEPTED: 0, PENDING: 1, DECLINED: 2 }
    const myReviewerAssignment = myAssignments.sort((a, b) => (priority[a.invitationStatus] ?? 9) - (priority[b.invitationStatus] ?? 9))[0]
    // An external reviewer can only read the abstract AFTER accepting the invitation.
    // If they have DECLINED (or are still pending), access is denied — they only see
    // metadata on their reviewer workspace, not the full abstract body.
    const isAcceptedReviewer = !!myReviewerAssignment && myReviewerAssignment.invitationStatus === 'ACCEPTED'
    const isAssignedEditor = abstract.editorAssignments.some(e => e.editorId === user.id)
    const isAssigned = isAcceptedReviewer || isAssignedEditor
    const isPrivileged = hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')
    // Committee editors / committee members with a broad review remit still see abstracts
    // (they act as editorial reviewers), but a PURE EXTERNAL_REVIEWER without acceptance
    // must not get in.
    const isCommitteeInsider = hasRole(user, 'COMMITTEE_MEMBER', 'COMMITTEE_EDITOR')
    const isPendingOrDeclinedExternal = !!myReviewerAssignment && myReviewerAssignment.invitationStatus !== 'ACCEPTED' && hasRole(user, 'EXTERNAL_REVIEWER') && !isPrivileged && !isCommitteeInsider && !isOwner
    if (isPendingOrDeclinedExternal) {
      const msg = myReviewerAssignment.invitationStatus === 'DECLINED'
        ? 'Access denied — you declined this review invitation. Please contact the editorial office if this was a mistake.'
        : 'Access denied — please accept the review invitation to view this abstract.'
      return err(msg, 403)
    }
    if (!isOwner && !isAssigned && !isPrivileged && !isCommitteeInsider) {
      return err('Forbidden', 403)
    }
    // Draft-visibility rule: a DRAFT abstract must never be visible to editors,
    // committee members or reviewers — drafts have not yet been formally submitted.
    // Only the submitting author and SYSTEM_ADMIN (for support) can open a draft.
    if (abstract.currentState === 'DRAFT' && !isOwner && !hasRole(user, 'SYSTEM_ADMIN')) {
      return err('This abstract is still a draft and has not been submitted yet.', 403)
    }
    // Double-blind: hide author identity from reviewers if enabled
    let result = abstract
    if (abstract.conference.doubleBlind && hasRole(user, 'EXTERNAL_REVIEWER') && !isOwner && !isPrivileged) {
      result = { ...abstract, authors: [], submittedBy: null }
    }
    return ok({ abstract: result })
  }

  // Update DRAFT (owner-only) — used by the author submission form to save edits before submitting.
  const draftUpdMatch = route.match(/^\/abstracts\/([^\/]+)$/)
  if (draftUpdMatch && method === 'PUT') {
    const existing = await prisma.abstract.findUnique({ where: { id: draftUpdMatch[1] } })
    if (!existing) return err('Not found', 404)
    if (existing.submittedById !== user.id && !hasRole(user, 'SYSTEM_ADMIN')) return err('Forbidden', 403)
    if (existing.currentState !== 'DRAFT') return err('This abstract has already been submitted and can no longer be edited from the submission form. Use the Revisions flow instead.', 409)

    const body = await request.json()
    const { title, body: absBody, keywords, themeId, reportType, disclosureStatement, coverLetter, authors, funders, ethicsStatement, conflictOfInterest, tags } = body

    // Enforce the same 20-word title / 300-word body limits used by POST
    if (title !== undefined) {
      const titleWords = (title || '').trim().split(/\s+/).filter(Boolean).length
      if (titleWords > 20) return err(`Title exceeds 20 words (got ${titleWords})`)
    }
    if (absBody !== undefined && absBody) {
      const bodyWords = (absBody || '').trim().split(/\s+/).filter(Boolean).length
      if (bodyWords > 300) return err(`Abstract body exceeds 300 words (got ${bodyWords})`)
    }

    // Replace authors block atomically if provided
    if (Array.isArray(authors)) {
      await prisma.abstractAuthor.deleteMany({ where: { abstractId: draftUpdMatch[1] } })
      await prisma.abstractAuthor.createMany({
        data: authors.map((a, i) => ({
          abstractId: draftUpdMatch[1],
          userId: a.userId || null,
          fullName: a.fullName || '',
          email: a.email || null,
          phone: a.phone || null,
          department: a.department || null,
          affiliation: a.affiliation || null,
          isCorresponding: !!a.isCorresponding,
          orderIndex: a.orderIndex ?? i,
        })),
      })
    }

    // Fields that live on the Abstract row
    const data = {}
    if (title !== undefined) data.title = title
    if (keywords !== undefined) data.keywords = keywords
    if (themeId !== undefined) data.themeId = themeId || null
    if (reportType !== undefined) data.reportType = reportType
    if (disclosureStatement !== undefined) data.disclosureStatement = disclosureStatement

    // Body + coverLetter live on the AbstractVersion. For drafts we mutate the
    // latest (v1) version in place — we do NOT create additional versions until the
    // abstract is formally submitted / revised.
    if (absBody !== undefined || coverLetter !== undefined || title !== undefined || keywords !== undefined) {
      const latest = await prisma.abstractVersion.findFirst({
        where: { abstractId: draftUpdMatch[1] },
        orderBy: { versionNumber: 'desc' },
      })
      const versionData = {}
      if (absBody !== undefined) versionData.body = absBody
      if (coverLetter !== undefined) versionData.coverLetter = coverLetter
      // Keep title + keywords on the version in sync with the abstract row
      if (title !== undefined) versionData.title = title
      if (keywords !== undefined) versionData.keywords = keywords
      if (latest) {
        await prisma.abstractVersion.update({ where: { id: latest.id }, data: versionData })
      } else if (Object.keys(versionData).length) {
        await prisma.abstractVersion.create({
          data: {
            abstractId: draftUpdMatch[1],
            versionNumber: 1,
            title: title || existing.title,
            body: absBody || '',
            keywords: keywords || [],
            coverLetter: coverLetter || null,
            createdById: user.id,
          },
        })
      }
    }

    const updated = await prisma.abstract.update({
      where: { id: draftUpdMatch[1] },
      data,
      include: {
        conference: { select: { id: true, code: true, name: true, doubleBlind: true } },
        theme: true,
        authors: { orderBy: { orderIndex: 'asc' } },
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    })
    await logAudit({ actorId: user.id, action: 'UPDATE_DRAFT', entityType: 'Abstract', entityId: draftUpdMatch[1] })
    return ok({ abstract: updated })
  }

  // Submit
  const submitMatch = route.match(/^\/abstracts\/([^\/]+)\/submit$/)
  if (submitMatch && method === 'POST') {
    const abs = await prisma.abstract.findUnique({ where: { id: submitMatch[1] }, include: { conference: true } })
    if (!abs || abs.submittedById !== user.id) return err('Forbidden', 403)
    const updated = await transitionState(submitMatch[1], 'SUBMITTED', user.id, 'Submitted by author')
    const { notifyUser } = await import('@/lib/workflow')
    // Notify author with acknowledgement email
    await notifyUser({
      userId: user.id,
      templateKey: 'SUBMISSION_RECEIVED',
      ctx: { submissionCode: abs.submissionCode, title: abs.title, conferenceName: abs.conference.name },
      notifTitle: `Submission received: ${abs.submissionCode}`,
      notifBody: 'Your abstract has been received and is under editorial review.',
      notifType: 'SUBMISSION_RECEIVED',
      link: `/abstracts/${abs.id}`,
    })
    // Notify managing editors
    const editors = await prisma.userRole.findMany({ where: { role: 'MANAGING_EDITOR' } })
    for (const e of editors) {
      await createNotification(e.userId, 'SUBMISSION_RECEIVED', `New submission ${abs.submissionCode}`, abs.title, `/abstracts/${abs.id}`)
    }
    return ok({ abstract: updated })
  }

  // Add revision (new version)
  const revMatch = route.match(/^\/abstracts\/([^\/]+)\/versions$/)
  if (revMatch && method === 'POST') {
    const abs = await prisma.abstract.findUnique({ where: { id: revMatch[1] }, include: { versions: true } })
    if (!abs) return err('Not found', 404)
    if (abs.submittedById !== user.id && !hasRole(user, 'SYSTEM_ADMIN')) return err('Forbidden', 403)
    const body = await request.json()
    const nextVer = Math.max(...abs.versions.map(v => v.versionNumber)) + 1
    const v = await prisma.abstractVersion.create({
      data: {
        abstractId: abs.id,
        versionNumber: nextVer,
        title: body.title || abs.title,
        body: body.body || '',
        keywords: body.keywords || [],
        coverLetter: body.coverLetter || null,
        createdById: user.id,
      },
    })
    // If abstract was in revision state, transition to revision_submitted
    if (['MAJOR_REVISION', 'MINOR_REVISION'].includes(abs.currentState)) {
      await transitionState(abs.id, 'REVISION_SUBMITTED', user.id, `Revision v${nextVer} submitted`)
    }
    return ok({ version: v })
  }

  // Transition state
  const transMatch = route.match(/^\/abstracts\/([^\/]+)\/transition$/)
  if (transMatch && method === 'POST') {
    // Chief Editor / Admin / Managing Editor can transition any abstract; committee
    // editors and committee members can transition only abstracts assigned to them.
    let allowed = hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')
    if (!allowed) {
      const assn = await prisma.editorAssignment.findFirst({ where: { abstractId: transMatch[1], editorId: user.id, active: true } })
      if (assn) allowed = true
    }
    if (!allowed) return err('Forbidden — you may only edit abstracts assigned to you.', 403)
    const body = await request.json()
    const updated = await transitionState(transMatch[1], body.newState, user.id, body.comment)
    // Notify author
    const abs = await prisma.abstract.findUnique({ where: { id: transMatch[1] } })
    await createNotification(abs.submittedById, 'STATE_CHANGE', `${abs.submissionCode} → ${body.newState}`, body.comment || '', `/abstracts/${abs.id}`)
    return ok({ abstract: updated })
  }

  // Assign editor
  const assignEdMatch = route.match(/^\/abstracts\/([^\/]+)\/assign-editor$/)
  if (assignEdMatch && method === 'POST') {
    if (!hasRole(user, 'SYSTEM_ADMIN', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    if (!body.editorId) return err('editorId required')
    // Deactivate any prior active assignments so we support seamless reassignment
    await prisma.editorAssignment.updateMany({
      where: { abstractId: assignEdMatch[1], active: true },
      data: { active: false },
    })
    const assignment = await prisma.editorAssignment.create({
      data: { abstractId: assignEdMatch[1], editorId: body.editorId, role: body.role || 'COMMITTEE_EDITOR' },
    })
    const abs = await prisma.abstract.findUnique({ where: { id: assignEdMatch[1] }, include: { conference: true } })
    const { notifyUser } = await import('@/lib/workflow')
    await notifyUser({
      userId: body.editorId,
      templateKey: 'EDITOR_ASSIGNED',
      ctx: { submissionCode: abs.submissionCode, title: abs.title, conferenceName: abs.conference.name },
      notifTitle: 'New editor assignment',
      notifBody: `You have been assigned to ${abs.submissionCode}`,
      notifType: 'ASSIGNMENT',
      link: `/abstracts/${assignEdMatch[1]}`,
    })
    if (abs.currentState === 'SUBMITTED' || abs.currentState === 'TECHNICAL_CHECK') {
      await transitionState(assignEdMatch[1], 'EDITORIAL_ASSIGNMENT', user.id, 'Editor assigned')
    }
    return ok({ assignment })
  }

  // Assign reviewer
  const assignRvMatch = route.match(/^\/abstracts\/([^\/]+)\/assign-reviewer$/)
  if (assignRvMatch && method === 'POST') {
    // Chief Editor / Admin / Managing Editor can invite reviewers to any abstract.
    // Everyone else must be the currently-assigned editor for THIS abstract.
    let allowed = hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')
    if (!allowed) {
      const assn = await prisma.editorAssignment.findFirst({ where: { abstractId: assignRvMatch[1], editorId: user.id, active: true } })
      if (assn) allowed = true
    }
    if (!allowed) return err('Forbidden — you may only invite reviewers for abstracts assigned to you.', 403)
    const body = await request.json()
    // Idempotent invitation: if this reviewer has previously been assigned to the same
    // abstract, reuse the existing row instead of creating a duplicate. This prevents
    // ghost "declined" rows blocking access after re-invitation.
    const existingAsn = await prisma.reviewAssignment.findFirst({
      where: { abstractId: assignRvMatch[1], reviewerId: body.reviewerId },
      orderBy: { assignedAt: 'desc' },
    })
    let assignment
    if (existingAsn) {
      if (existingAsn.invitationStatus === 'ACCEPTED' && existingAsn.completedAt) {
        return err('This reviewer has already submitted a review for this abstract.', 409)
      }
      // Reset the invitation so the reviewer can respond again
      assignment = await prisma.reviewAssignment.update({
        where: { id: existingAsn.id },
        data: {
          invitationStatus: 'PENDING',
          respondedAt: null,
          reviewType: body.reviewType || existingAsn.reviewType,
          dueDate: body.dueDate ? new Date(body.dueDate) : existingAsn.dueDate,
          assignedById: user.id,
          assignedAt: new Date(),
        },
      })
    } else {
      assignment = await prisma.reviewAssignment.create({
        data: {
          abstractId: assignRvMatch[1],
          reviewerId: body.reviewerId,
          assignedById: user.id,
          reviewType: body.reviewType || 'EXTERNAL_REVIEWER',
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
        },
      })
    }
    const abs = await prisma.abstract.findUnique({ where: { id: assignRvMatch[1] }, include: { conference: true, theme: true } })
    const { notifyUser } = await import('@/lib/workflow')
    await notifyUser({
      userId: body.reviewerId,
      templateKey: 'REVIEW_INVITATION',
      ctx: {
        submissionCode: abs.submissionCode, title: abs.title,
        conferenceName: abs.conference.name, themeName: abs.theme?.name,
        dueDate: body.dueDate,
      },
      notifTitle: 'Review invitation',
      notifBody: `You have been invited to review ${abs.submissionCode}`,
      notifType: 'REVIEW_INVITATION',
      link: `/abstracts/${assignRvMatch[1]}`,
    })
    if (['EDITORIAL_ASSIGNMENT'].includes(abs.currentState)) {
      await transitionState(assignRvMatch[1], body.reviewType === 'COMMITTEE_MEMBER' ? 'COMMITTEE_REVIEW' : 'EXTERNAL_PEER_REVIEW', user.id, 'Reviewer assigned')
    }
    return ok({ assignment })
  }

  // Decision
  const decMatch = route.match(/^\/abstracts\/([^\/]+)\/decision$/)
  if (decMatch && method === 'POST') {
    // Chief Editor / Admin / Managing Editor can decide any abstract; committee
    // editors can decide only those assigned to them.
    let allowed = hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')
    if (!allowed) {
      const assn = await prisma.editorAssignment.findFirst({ where: { abstractId: decMatch[1], editorId: user.id, active: true } })
      if (assn) allowed = true
    }
    if (!allowed) return err('Forbidden — you may only decide abstracts assigned to you.', 403)
    const body = await request.json()
    const decision = await prisma.editorialDecision.create({
      data: {
        abstractId: decMatch[1],
        decidedById: user.id,
        decision: body.decision,
        decisionLetter: body.decisionLetter || '',
        presentationType: body.presentationType || null,
        isFinal: !!body.isFinal,
      },
    })
    // Auto-transition
    const stateMap = { ACCEPT: 'ACCEPTED', REJECT: 'REJECTED', MAJOR_REVISION: 'MAJOR_REVISION', MINOR_REVISION: 'MINOR_REVISION', WITHDRAW: 'WITHDRAWN' }
    const newState = stateMap[body.decision]
    if (newState) await transitionState(decMatch[1], newState, user.id, `Decision: ${body.decision}`)
    const abs = await prisma.abstract.findUnique({ where: { id: decMatch[1] }, include: { conference: true } })
    const { notifyUser } = await import('@/lib/workflow')
    let templateKey = 'STATE_CHANGE'
    if (body.decision === 'ACCEPT') templateKey = 'DECISION_ACCEPT'
    else if (body.decision === 'REJECT') templateKey = 'DECISION_REJECT'
    else if (body.decision === 'MAJOR_REVISION' || body.decision === 'MINOR_REVISION') templateKey = 'DECISION_REVISION'
    await notifyUser({
      userId: abs.submittedById,
      templateKey,
      ctx: {
        submissionCode: abs.submissionCode, title: abs.title,
        conferenceName: abs.conference.name,
        decision: body.decision, decisionLetter: body.decisionLetter,
        presentationType: body.presentationType,
        revisionType: body.decision === 'MAJOR_REVISION' ? 'major revision' : 'minor revision',
        newState: newState || abs.currentState,
      },
      notifTitle: `Decision on ${abs.submissionCode}: ${body.decision}`,
      notifBody: body.decisionLetter || '',
      notifType: 'DECISION',
      link: `/abstracts/${abs.id}`,
    })
    return ok({ decision })
  }

  // Messages
  const msgListMatch = route.match(/^\/abstracts\/([^\/]+)\/messages$/)
  if (msgListMatch && method === 'GET') {
    const list = await prisma.message.findMany({
      where: { abstractId: msgListMatch[1] },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
    })
    return ok({ messages: list })
  }
  if (msgListMatch && method === 'POST') {
    const body = await request.json()
    const attachmentIds = body.attachmentIds || []
    const msg = await prisma.message.create({
      data: {
        abstractId: msgListMatch[1],
        senderId: user.id,
        channel: body.channel || 'EDITOR_AUTHOR',
        recipientIds: body.recipientIds || [],
        subject: body.subject || '(no subject)',
        body: body.body || '',
        attachmentIds,
      },
      include: { sender: { select: { firstName: true, lastName: true } } },
    })

    // Load recipient users + abstract for email context
    const recipients = await prisma.user.findMany({
      where: { id: { in: body.recipientIds || [] } },
      select: { id: true, email: true, firstName: true, lastName: true, title: true },
    })
    const abs = await prisma.abstract.findUnique({
      where: { id: msgListMatch[1] },
      include: { conference: true },
    })

    // Load attachments if any
    let attachments = []
    if (attachmentIds.length > 0) {
      const { loadAttachment } = await import('@/lib/email')
      const docs = await prisma.document.findMany({ where: { id: { in: attachmentIds }, isDeleted: false } })
      for (const d of docs) {
        const a = await loadAttachment(d)
        if (a) attachments.push(a)
      }
    }

    // Send email to each recipient (with abstract-code context)
    const { sendEmail } = await import('@/lib/email')
    for (const r of recipients) {
      const emailText = `${body.body}\n\n---\nReference: ${abs?.submissionCode || ''} — ${abs?.title || ''}\nConference: ${abs?.conference?.name || ''}\nSent via SCMS Platform on ${new Date().toLocaleString()}`
      const emailHtml = `<div style="font-family: Arial, sans-serif; max-width: 640px; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #6366f1, #ec4899); color: white; padding: 16px 20px;">
          <div style="font-size: 12px; opacity: 0.9;">${abs?.conference?.name || 'SCMS'}</div>
          <div style="font-size: 18px; font-weight: bold;">${body.subject || 'Editorial Communication'}</div>
        </div>
        <div style="padding: 20px; background: #ffffff; border: 1px solid #e2e8f0;">
          <div style="white-space: pre-wrap; line-height: 1.6;">${(body.body || '').replace(/</g,'&lt;')}</div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <div style="font-size: 12px; color: #64748b;">
            <b>Reference:</b> ${abs?.submissionCode || ''} — ${(abs?.title || '').replace(/</g,'&lt;')}<br />
            <b>Sender:</b> ${user.firstName} ${user.lastName} (${user.email})<br />
            <b>Sent:</b> ${new Date().toLocaleString()}<br />
            ${attachments.length > 0 ? `<b>Attachments:</b> ${attachments.map(a => a.filename).join(', ')}` : ''}
          </div>
        </div>
        <div style="text-align: center; padding: 12px; font-size: 11px; color: #94a3b8; background: #f8fafc; border: 1px solid #e2e8f0; border-top: 0;">
          This message was sent via SCMS. To reply, please log in to the platform.
        </div>
      </div>`
      await sendEmail({
        to: r.email,
        subject: `[${abs?.submissionCode || 'SCMS'}] ${body.subject || 'New editorial message'}`,
        text: emailText,
        html: emailHtml,
        attachments,
      })
    }

    for (const rid of body.recipientIds || []) {
      await createNotification(rid, 'MESSAGE', body.subject || 'New message', 'You have a new message.' + (attachments.length ? ` (${attachments.length} attachment${attachments.length > 1 ? 's' : ''})` : ''), `/abstracts/${msgListMatch[1]}`)
    }
    return ok({ message: msg })
  }

  // Documents (list)
  const docListMatch = route.match(/^\/abstracts\/([^\/]+)\/documents$/)
  if (docListMatch && method === 'GET') {
    const docs = await prisma.document.findMany({
      where: { abstractId: docListMatch[1], isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    })
    return ok({ documents: docs })
  }
  // Upload document (multipart)
  if (docListMatch && method === 'POST') {
    const formData = await request.formData()
    const file = formData.get('file')
    const category = formData.get('category') || 'OTHER'
    if (!file) return err('No file')
    const buf = Buffer.from(await file.arrayBuffer())
    const safeName = `${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const abstractDir = path.join(UPLOAD_DIR, docListMatch[1])
    await fs.mkdir(abstractDir, { recursive: true })
    const filePath = path.join(abstractDir, safeName)
    await fs.writeFile(filePath, buf)
    const doc = await prisma.document.create({
      data: {
        abstractId: docListMatch[1],
        category,
        fileName: file.name,
        storagePath: filePath,
        mimeType: file.type || null,
        sizeBytes: buf.length,
        uploadedById: user.id,
      },
    })
    return ok({ document: doc })
  }

  return null
}

async function handleReviewer(route, method, request) {
  const user = await getCurrentUser(request)
  if (!user) return err('Unauthenticated', 401)

  if (route === '/reviewer/assignments' && method === 'GET') {
    const list = await prisma.reviewAssignment.findMany({
      where: { reviewerId: user.id },
      include: {
        abstract: {
          include: {
            conference: { select: { code: true, name: true, doubleBlind: true } },
            theme: true,
            versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
          },
        },
        report: true,
      },
      orderBy: { assignedAt: 'desc' },
    })
    // Blind author info
    const cleaned = list.map(a => {
      if (a.abstract?.conference?.doubleBlind) {
        return { ...a, abstract: { ...a.abstract, authors: undefined, submittedBy: undefined } }
      }
      return a
    })
    // De-duplicate assignments for the same abstract (defensive — early data seed and
    // re-invitations can produce multiple ReviewAssignment rows per abstract). Keep the
    // best-priority row: ACCEPTED (with report if any) > ACCEPTED > PENDING > DECLINED.
    const priority = (a) => {
      if (a.invitationStatus === 'ACCEPTED' && a.report) return 0
      if (a.invitationStatus === 'ACCEPTED') return 1
      if (a.invitationStatus === 'PENDING') return 2
      return 3 // DECLINED
    }
    const byAbstract = new Map()
    for (const asn of cleaned) {
      const existing = byAbstract.get(asn.abstract?.id)
      if (!existing || priority(asn) < priority(existing)) byAbstract.set(asn.abstract?.id, asn)
    }
    return ok({ assignments: Array.from(byAbstract.values()) })
  }

  // Respond to invitation
  const respMatch = route.match(/^\/reviewer\/assignments\/([^\/]+)\/respond$/)
  if (respMatch && method === 'POST') {
    const body = await request.json()
    // Load the existing assignment to guard against wrong reviewer + surface abstract context
    const existing = await prisma.reviewAssignment.findUnique({
      where: { id: respMatch[1] },
      include: { abstract: { include: { conference: true } } },
    })
    if (!existing || existing.reviewerId !== user.id) return err('Forbidden', 403)
    if (existing.completedAt) return err('This assignment already has a submitted review; the response cannot be changed.', 409)

    const newStatus = body.status === 'ACCEPTED' ? 'ACCEPTED' : 'DECLINED'
    const a = await prisma.reviewAssignment.update({
      where: { id: respMatch[1] },
      data: {
        invitationStatus: newStatus,
        respondedAt: new Date(),
      },
    })
    await logAudit({ actorId: user.id, action: `REVIEWER_${newStatus}`, entityType: 'ReviewAssignment', entityId: respMatch[1] })

    if (newStatus === 'DECLINED') {
      // Notify every editor assigned to the abstract, plus editorial leadership fallbacks
      const abs = existing.abstract
      const editorAssignments = await prisma.editorAssignment.findMany({
        where: { abstractId: abs.id, active: true },
        select: { editorId: true },
      })
      const editorLeads = await prisma.user.findMany({
        where: {
          roles: { some: { role: { in: ['CHIEF_EDITOR', 'MANAGING_EDITOR'] } } },
        },
        select: { id: true, email: true },
      })
      const recipientIds = new Set(editorAssignments.map(e => e.editorId))
      editorLeads.forEach(e => recipientIds.add(e.id))

      const reviewerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
      const notifTitle = `Reviewer declined ${abs.submissionCode}`
      const notifBody = `${reviewerName} has declined to review "${abs.title}".`

      for (const rid of recipientIds) {
        await createNotification(rid, 'MESSAGE', notifTitle, notifBody, `/abstracts/${abs.id}`).catch(() => {})
      }

      // Best-effort email dispatch to the committee editors
      try {
        const { sendEmail } = await import('@/lib/email')
        const { renderEmailHtml } = await import('@/lib/email-templates')
        const subject = `[${abs.conference.code}] Reviewer declined — ${abs.submissionCode}`
        const declineNote = (body.declineReason || body.message || '').toString().trim()
        const bodyText = [
          `Dear Editor,`,
          ``,
          `${reviewerName} (${user.email}) has DECLINED to review the following abstract:`,
          ``,
          `Submission: ${abs.submissionCode}`,
          `Title: ${abs.title}`,
          `Conference: ${abs.conference.name}`,
          declineNote ? `\nReviewer note: ${declineNote}` : '',
          ``,
          `Please reassign the review or invite an alternative peer reviewer at your earliest convenience.`,
        ].filter(Boolean).join('\n')
        const html = renderEmailHtml({ subject, body: bodyText, conferenceName: abs.conference.name })
        // Fetch emails for recipients
        const editorUsers = await prisma.user.findMany({ where: { id: { in: [...recipientIds] } }, select: { email: true } })
        for (const eu of editorUsers) {
          if (eu.email) sendEmail({ to: eu.email, subject, html, text: bodyText }).catch(() => {})
        }
      } catch (e) { /* non-fatal */ }
    }

    return ok({ assignment: a })
  }

  // Submit review
  const subMatch = route.match(/^\/reviewer\/assignments\/([^\/]+)\/submit$/)
  if (subMatch && method === 'POST') {
    const body = await request.json()
    const a = await prisma.reviewAssignment.findUnique({
      where: { id: subMatch[1] },
      include: { abstract: { include: { conference: true } } },
    })
    if (!a || a.reviewerId !== user.id) return err('Forbidden', 403)
    const report = await prisma.reviewReport.create({
      data: {
        assignmentId: subMatch[1],
        reviewerId: user.id,
        originalityScore: body.originalityScore,
        significanceScore: body.significanceScore,
        methodologyScore: body.methodologyScore,
        clarityScore: body.clarityScore,
        overallScore: body.overallScore,
        commentsToAuthor: body.commentsToAuthor || '',
        commentsToEditor: body.commentsToEditor || null,
        recommendation: body.recommendation,
      },
    })
    await prisma.reviewAssignment.update({
      where: { id: subMatch[1] },
      data: { completedAt: new Date() },
    })
    // Notify the assigning committee editor (and, as fallback, all editors assigned
    // to the abstract + editorial leadership) that a new review has arrived.
    const abs = a.abstract
    const reviewerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
    const notifTitle = `New review received on ${abs.submissionCode}`
    const notifBody = `${reviewerName} submitted their peer review with recommendation: ${(body.recommendation || 'N/A').replace(/_/g, ' ')}.`
    const editorAssignments = await prisma.editorAssignment.findMany({
      where: { abstractId: abs.id, active: true },
      select: { editorId: true },
    })
    const editorLeads = await prisma.user.findMany({
      where: { roles: { some: { role: { in: ['CHIEF_EDITOR', 'MANAGING_EDITOR'] } } } },
      select: { id: true, email: true },
    })
    const recipientIds = new Set(editorAssignments.map(e => e.editorId))
    if (a.assignedById) recipientIds.add(a.assignedById)
    editorLeads.forEach(e => recipientIds.add(e.id))
    for (const rid of recipientIds) {
      await createNotification(rid, 'MESSAGE', notifTitle, notifBody, `/abstracts/${abs.id}`).catch(() => {})
    }
    // Best-effort email to the committee editor(s)
    try {
      const { sendEmail } = await import('@/lib/email')
      const { renderEmailHtml } = await import('@/lib/email-templates')
      const subject = `[${abs.conference.code}] Review received — ${abs.submissionCode}`
      const bodyText = [
        `Dear Editor,`,
        ``,
        `${reviewerName} has submitted a peer review for the following abstract:`,
        ``,
        `Submission: ${abs.submissionCode}`,
        `Title: ${abs.title}`,
        `Recommendation: ${(body.recommendation || 'N/A').replace(/_/g, ' ')}`,
        `Overall score: ${body.overallScore ?? '—'}/10`,
        ``,
        `Please log in to view the full report and any attached materials.`,
      ].join('\n')
      const html = renderEmailHtml({ subject, body: bodyText, conferenceName: abs.conference.name })
      const editorUsers = await prisma.user.findMany({ where: { id: { in: [...recipientIds] } }, select: { email: true } })
      for (const eu of editorUsers) {
        if (eu.email) sendEmail({ to: eu.email, subject, html, text: bodyText }).catch(() => {})
      }
    } catch (e) { /* non-fatal */ }
    return ok({ report })
  }

  return null
}

async function handleUsers(route, method, request) {
  const user = await getCurrentUser(request)
  if (!user) return err('Unauthenticated', 401)

  if (route === '/users' && method === 'GET') {
    const url = new URL(request.url)
    const role = url.searchParams.get('role')
    const where = {}
    if (role) where.roles = { some: { role } }
    const users = await prisma.user.findMany({
      where,
      include: { roles: true, institution: true, _count: { select: { reviewAssignments: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return ok({ users: users.map(sanitizeUser) })
  }

  if (route === '/users' && method === 'POST') {
    if (!hasRole(user, 'SYSTEM_ADMIN')) return err('Forbidden', 403)
    const body = await request.json()
    const created = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await hashPassword(body.password || 'password123'),
        firstName: body.firstName, lastName: body.lastName,
        title: body.title, affiliation: body.affiliation, country: body.country,
        specialties: body.specialties || [], keywords: body.keywords || [],
        roles: { create: { role: body.role || 'AUTHOR' } },
      },
      include: { roles: true },
    })
    return ok({ user: sanitizeUser(created) })
  }

  const roleMatch = route.match(/^\/users\/([^\/]+)\/roles$/)
  if (roleMatch && method === 'POST') {
    if (!hasRole(user, 'SYSTEM_ADMIN')) return err('Forbidden', 403)
    const body = await request.json()
    // Prevent duplicate
    const exists = await prisma.userRole.findFirst({ where: { userId: roleMatch[1], role: body.role, conferenceId: null } })
    if (exists) return ok({ role: exists, alreadyExists: true })
    const r = await prisma.userRole.create({ data: { userId: roleMatch[1], role: body.role } }).catch(() => null)
    return ok({ role: r })
  }
  const roleDelMatch = route.match(/^\/users\/([^\/]+)\/roles\/([^\/]+)$/)
  if (roleDelMatch && method === 'DELETE') {
    if (!hasRole(user, 'SYSTEM_ADMIN')) return err('Forbidden', 403)
    await prisma.userRole.deleteMany({ where: { userId: roleDelMatch[1], role: roleDelMatch[2], conferenceId: null } })
    return ok({ ok: true })
  }

  return null
}

async function handleNotifications(route, method, request) {
  const user = await getCurrentUser(request)
  if (!user) return err('Unauthenticated', 401)
  if (route === '/notifications' && method === 'GET') {
    const list = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 })
    return ok({ notifications: list })
  }
  const readMatch = route.match(/^\/notifications\/([^\/]+)\/read$/)
  if (readMatch && method === 'POST') {
    await prisma.notification.update({ where: { id: readMatch[1] }, data: { isRead: true } })
    return ok({ ok: true })
  }
  if (route === '/notifications/read-all' && method === 'POST') {
    await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } })
    return ok({ ok: true })
  }
  return null
}

async function handleAnalytics(route, method, request) {
  const user = await getCurrentUser(request)
  if (!user) return err('Unauthenticated', 401)
  if (route === '/analytics/dashboard' && method === 'GET') {
    const url = new URL(request.url)
    const conferenceId = url.searchParams.get('conferenceId') || undefined
    const where = conferenceId ? { conferenceId } : {}

    const [
      totalUsers, totalAbstracts, byState, byTheme,
      totalReviews, completedReviews, decisions, totalRegs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.abstract.count({ where }),
      prisma.abstract.groupBy({ by: ['currentState'], _count: true, where }),
      prisma.abstract.groupBy({ by: ['themeId'], _count: true, where }),
      prisma.reviewAssignment.count({ where: conferenceId ? { abstract: { conferenceId } } : {} }),
      prisma.reviewAssignment.count({ where: { completedAt: { not: null }, ...(conferenceId ? { abstract: { conferenceId } } : {}) } }),
      prisma.editorialDecision.groupBy({ by: ['decision'], _count: true, where: conferenceId ? { abstract: { conferenceId } } : {} }),
      prisma.registration.count({ where: conferenceId ? { conferenceId } : {} }),
    ])

    const usersByRole = await prisma.userRole.groupBy({ by: ['role'], _count: true })
    const themeMap = {}
    if (byTheme.length) {
      const themes = await prisma.theme.findMany({ where: { id: { in: byTheme.map(x => x.themeId).filter(Boolean) } } })
      themes.forEach(t => { themeMap[t.id] = t.name })
    }
    const themesOut = byTheme.map(x => ({ theme: themeMap[x.themeId] || 'Unassigned', count: x._count }))

    return ok({
      totalUsers, totalAbstracts, totalRegs,
      usersByRole: usersByRole.map(r => ({ role: r.role, count: r._count })),
      abstractsByState: byState.map(x => ({ state: x.currentState, count: x._count })),
      abstractsByTheme: themesOut,
      reviews: { total: totalReviews, completed: completedReviews, pending: totalReviews - completedReviews },
      decisions: decisions.map(d => ({ decision: d.decision, count: d._count })),
    })
  }
  return null
}

async function handleProgramme(route, method, request) {
  const user = await getCurrentUser(request)
  const progMatch = route.match(/^\/programme\/([^\/.]+)$/)
  if (progMatch && method === 'GET') {
    const sessions = await prisma.programmeSession.findMany({
      where: { conferenceId: progMatch[1] },
      include: {
        theme: true,
        items: { include: { abstract: { include: { authors: true } } }, orderBy: { orderIndex: 'asc' } },
      },
      orderBy: { startTime: 'asc' },
    })
    return ok({ sessions })
  }
  if (route === '/sessions' && method === 'POST') {
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const s = await prisma.programmeSession.create({
      data: {
        conferenceId: body.conferenceId, themeId: body.themeId || null,
        title: body.title, room: body.room,
        startTime: new Date(body.startTime), endTime: new Date(body.endTime), chair: body.chair,
      },
    })
    return ok({ session: s })
  }
  const sesMatch = route.match(/^\/sessions\/([^\/]+)$/)
  if (sesMatch && method === 'PUT') {
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const patch = {}
    ;['title', 'room', 'chair', 'themeId'].forEach(k => { if (body[k] !== undefined) patch[k] = body[k] })
    if (body.startTime) patch.startTime = new Date(body.startTime)
    if (body.endTime) patch.endTime = new Date(body.endTime)
    const s = await prisma.programmeSession.update({ where: { id: sesMatch[1] }, data: patch })
    return ok({ session: s })
  }
  if (sesMatch && method === 'DELETE') {
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    await prisma.programmeSession.delete({ where: { id: sesMatch[1] } })
    return ok({ ok: true })
  }
  const itemMatch = route.match(/^\/sessions\/([^\/]+)\/items$/)
  if (itemMatch && method === 'POST') {
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    // ProgrammeItem has @unique on abstractId, so an abstract can only be in one session
    // Delete existing item for this abstract if any
    await prisma.programmeItem.deleteMany({ where: { abstractId: body.abstractId } })
    // Determine orderIndex
    const count = await prisma.programmeItem.count({ where: { sessionId: itemMatch[1] } })
    const item = await prisma.programmeItem.create({
      data: {
        sessionId: itemMatch[1],
        abstractId: body.abstractId,
        orderIndex: body.orderIndex !== undefined ? body.orderIndex : count,
        durationMin: body.durationMin || 15,
      },
      include: { abstract: { include: { authors: true } } },
    })
    return ok({ item })
  }
  const itemIdMatch = route.match(/^\/programme-items\/([^\/]+)$/)
  if (itemIdMatch && method === 'PUT') {
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const patch = {}
    ;['orderIndex', 'durationMin'].forEach(k => { if (body[k] !== undefined) patch[k] = body[k] })
    const item = await prisma.programmeItem.update({ where: { id: itemIdMatch[1] }, data: patch })
    return ok({ item })
  }
  if (itemIdMatch && method === 'DELETE') {
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    await prisma.programmeItem.delete({ where: { id: itemIdMatch[1] } })
    return ok({ ok: true })
  }

  // ---------- Downloads ----------
  const csvMatch = route.match(/^\/programme\/([^\/]+)\.csv$/)
  if (csvMatch && method === 'GET') {
    if (!user) return err('Unauthenticated', 401)
    const sessions = await prisma.programmeSession.findMany({
      where: { conferenceId: csvMatch[1] },
      include: { items: { include: { abstract: { include: { authors: true } } }, orderBy: { orderIndex: 'asc' } } },
      orderBy: { startTime: 'asc' },
    })
    const rows = [['Session', 'Day', 'Start', 'End', 'Room', 'Chair', 'Order', 'Duration', 'Abstract Code', 'Title', 'Authors']]
    sessions.forEach(s => {
      const day = new Date(s.startTime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      if (s.items.length === 0) rows.push([s.title, day, new Date(s.startTime).toISOString(), new Date(s.endTime).toISOString(), s.room || '', s.chair || '', '', '', '', '', ''])
      s.items.forEach((it, idx) => {
        rows.push([
          s.title, day, new Date(s.startTime).toISOString(), new Date(s.endTime).toISOString(),
          s.room || '', s.chair || '', idx + 1, it.durationMin || 15,
          it.abstract?.submissionCode || '', it.abstract?.title || '',
          (it.abstract?.authors || []).map(a => a.fullName).join('; '),
        ])
      })
    })
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    return new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="programme.csv"` } })
  }

  const pdfMatch = route.match(/^\/programme\/([^\/]+)\.pdf$/)
  if (pdfMatch && method === 'GET') {
    if (!user) return err('Unauthenticated', 401)
    const conference = await prisma.conference.findUnique({ where: { id: pdfMatch[1] } })
    if (!conference) return err('Conference not found', 404)
    const sessions = await prisma.programmeSession.findMany({
      where: { conferenceId: pdfMatch[1] },
      include: { items: { include: { abstract: { include: { authors: true } } }, orderBy: { orderIndex: 'asc' } } },
      orderBy: { startTime: 'asc' },
    })
    const { generateProgrammePDF } = await import('@/lib/pdf')
    const buf = await generateProgrammePDF({ conference, sessions })
    return new NextResponse(buf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${conference.code || 'conference'}-programme.pdf"` } })
  }

  return null
}

async function handleAudit(route, method, request) {
  if (route === '/audit' && method === 'GET') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN')) return err('Forbidden', 403)
    const list = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' }, take: 200,
      include: { actor: { select: { firstName: true, lastName: true, email: true } } },
    })
    return ok({ logs: list })
  }
  return null
}

async function handleDocumentDownload(route, method, request) {
  const dlMatch = route.match(/^\/documents\/([^\/]+)\/download$/)
  if (dlMatch && method === 'GET') {
    const user = await getCurrentUser(request)
    if (!user) return err('Unauthenticated', 401)
    const doc = await prisma.document.findUnique({ where: { id: dlMatch[1] }, include: { abstract: true } })
    if (!doc || doc.isDeleted) return err('Not found', 404)
    const buf = await fs.readFile(doc.storagePath)
    const res = new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${doc.fileName}"`,
      },
    })
    return res
  }
  return null
}

// ============ CONFERENCE TEMPLATES (Powerpoint / Poster) ============
async function handleTemplates(route, method, request) {
  // Public: list templates for a conference (only accepted authors can download in practice)
  const listMatch = route.match(/^\/conferences\/([^\/]+)\/templates$/)
  if (listMatch && method === 'GET') {
    const list = await prisma.conferenceTemplate.findMany({
      where: { conferenceId: listMatch[1] },
      orderBy: { createdAt: 'desc' },
    })
    return ok({ templates: list })
  }
  if (listMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const formData = await request.formData()
    const file = formData.get('file')
    const type = formData.get('type') || 'OTHER'
    if (!file) return err('No file')
    if (file.size > 25 * 1024 * 1024) return err('File exceeds 25 MB limit')
    const buf = Buffer.from(await file.arrayBuffer())
    const safeName = `tpl_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const dir = path.join(UPLOAD_DIR, 'templates', listMatch[1])
    await fs.mkdir(dir, { recursive: true })
    const filePath = path.join(dir, safeName)
    await fs.writeFile(filePath, buf)
    const t = await prisma.conferenceTemplate.create({
      data: {
        conferenceId: listMatch[1], type, fileName: file.name, storagePath: filePath,
        mimeType: file.type || null, sizeBytes: buf.length, uploadedById: user.id,
      },
    })
    return ok({ template: t })
  }
  const dlMatch = route.match(/^\/templates\/([^\/]+)\/download$/)
  if (dlMatch && method === 'GET') {
    const user = await getCurrentUser(request)
    if (!user) return err('Unauthenticated', 401)
    const t = await prisma.conferenceTemplate.findUnique({ where: { id: dlMatch[1] } })
    if (!t) return err('Not found', 404)
    // Authors of accepted abstracts, editors, admin can download
    const isPrivileged = hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR', 'COMMITTEE_EDITOR', 'COMMITTEE_MEMBER')
    if (!isPrivileged) {
      const acceptedAbs = await prisma.abstract.findFirst({
        where: {
          conferenceId: t.conferenceId,
          submittedById: user.id,
          currentState: { in: ['ACCEPTED', 'ORAL', 'POSTER', 'PRESENTATION_UPLOAD', 'PRESENTATION_REVIEW', 'PROGRAMME_SCHEDULING', 'FINAL_ACCEPTANCE', 'PUBLISHED'] },
        },
      })
      if (!acceptedAbs) return err('Only authors of accepted abstracts can download templates.', 403)
    }
    const buf = await fs.readFile(t.storagePath)
    return new NextResponse(buf, { status: 200, headers: { 'Content-Type': t.mimeType || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${t.fileName}"` } })
  }
  const delMatch = route.match(/^\/templates\/([^\/]+)$/)
  if (delMatch && method === 'DELETE') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    await prisma.conferenceTemplate.delete({ where: { id: delMatch[1] } })
    return ok({ ok: true })
  }
  return null
}

// ============ PASSWORD RESET ============
async function handlePasswordReset(route, method, request) {
  if (route === '/auth/forgot-password' && method === 'POST') {
    const { email } = await request.json()
    if (!email) return err('Email required')
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      })
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
      const resetUrl = `${baseUrl}/?resetToken=${token}`
      const { sendEmail } = await import('@/lib/email')
      const { renderEmailHtml } = await import('@/lib/email-templates')
      const subject = 'SCMS — Password reset request'
      const body = `Dear ${user.firstName},\n\nA password reset was requested for your SCMS account. If this was you, please click the link below to set a new password. The link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, you may safely ignore this email.\n\nRegards,\nSCMS Editorial Office`
      const html = renderEmailHtml({ subject, body, conferenceName: 'SCMS' })
      await sendEmail({ to: user.email, subject, text: body, html })
    }
    // Always return success (don't reveal whether email exists)
    return ok({ ok: true, message: 'If that email is registered, a reset link has been sent.' })
  }

  if (route === '/auth/reset-password' && method === 'POST') {
    const { token, newPassword } = await request.json()
    if (!token || !newPassword) return err('Token and new password required')
    if (newPassword.length < 6) return err('Password must be at least 6 characters')
    const t = await prisma.passwordResetToken.findUnique({ where: { token } })
    if (!t || t.usedAt || t.expiresAt < new Date()) return err('Invalid or expired token', 400)
    await prisma.user.update({
      where: { id: t.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    })
    await prisma.passwordResetToken.update({ where: { id: t.id }, data: { usedAt: new Date() } })
    return ok({ ok: true, message: 'Password reset. You can now sign in.' })
  }

  return null
}

// ============ TECHNICAL SCORING ============
async function handleTechnicalScore(route, method, request) {
  if (!route.match(/^\/abstracts\/[^\/]+\/scores$/)) return null
  const user = await getCurrentUser(request)
  if (!user) return err('Unauthenticated', 401)

  const listMatch = route.match(/^\/abstracts\/([^\/]+)\/scores$/)
  if (listMatch && method === 'GET') {
    const scores = await prisma.technicalScore.findMany({
      where: { abstractId: listMatch[1] },
      include: { }
    })
    // Include scorer details
    const scorerIds = [...new Set(scores.map(s => s.scorerId))]
    const scorers = await prisma.user.findMany({ where: { id: { in: scorerIds } }, select: { id: true, firstName: true, lastName: true } })
    const scorerMap = Object.fromEntries(scorers.map(s => [s.id, s]))
    const withScorers = scores.map(s => ({ ...s, scorer: scorerMap[s.scorerId] }))
    // Compute averages
    const n = withScorers.length
    const avg = n ? {
      originality: withScorers.reduce((a, s) => a + s.originality, 0) / n,
      methodology: withScorers.reduce((a, s) => a + s.methodology, 0) / n,
      relevance: withScorers.reduce((a, s) => a + s.relevance, 0) / n,
      language: withScorers.reduce((a, s) => a + s.language, 0) / n,
      themeAlignment: withScorers.reduce((a, s) => a + s.themeAlignment, 0) / n,
    } : null
    const overall = avg ? (avg.originality + avg.methodology + avg.relevance + avg.language + avg.themeAlignment) / 5 : null
    return ok({ scores: withScorers, average: avg, overall })
  }
  if (listMatch && method === 'POST') {
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR', 'COMMITTEE_EDITOR', 'COMMITTEE_MEMBER')) return err('Only editors can score.', 403)
    const body = await request.json()
    const fields = ['originality', 'methodology', 'relevance', 'language', 'themeAlignment']
    for (const f of fields) {
      const v = body[f]
      if (typeof v !== 'number' || v < 1 || v > 10) return err(`Field "${f}" must be a number between 1 and 10.`)
    }
    const score = await prisma.technicalScore.upsert({
      where: { abstractId_scorerId: { abstractId: listMatch[1], scorerId: user.id } },
      update: {
        originality: body.originality, methodology: body.methodology, relevance: body.relevance,
        language: body.language, themeAlignment: body.themeAlignment, comments: body.comments || null,
      },
      create: {
        abstractId: listMatch[1], scorerId: user.id,
        originality: body.originality, methodology: body.methodology, relevance: body.relevance,
        language: body.language, themeAlignment: body.themeAlignment, comments: body.comments || null,
      },
    })
    // Auto-tick "Technical Check" — once any committee/editor saves a technical score
    // the abstract is deemed to have passed the technical review stage.
    try {
      const abs = await prisma.abstract.findUnique({ where: { id: listMatch[1] }, select: { currentState: true } })
      if (abs && (abs.currentState === 'SUBMITTED' || abs.currentState === 'TECHNICAL_CHECK')) {
        await transitionState(listMatch[1], 'EDITORIAL_ASSIGNMENT', user.id, 'Technical check auto-completed on score save')
      }
    } catch (e) { /* non-fatal */ }
    return ok({ score })
  }
  return null
}

// ============ EDITORS' / LOGISTICS ANNOUNCEMENT BOARD ============
async function handleAnnouncements(route, method, request) {
  if (route !== '/announcements') return null
  const user = await getCurrentUser(request)
  if (!user) return err('Unauthenticated', 401)

  // Channel is chosen via ?channel= (defaults to EDITORIAL)
  const url = new URL(request.url)
  const channel = (url.searchParams.get('channel') || 'EDITORIAL').toUpperCase()
  const validChannels = ['EDITORIAL', 'LOGISTICS']
  if (!validChannels.includes(channel)) return err('Invalid channel', 400)

  const editorialRoles = ['SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR', 'COMMITTEE_EDITOR', 'COMMITTEE_MEMBER']
  const logisticsRoles = ['SYSTEM_ADMIN', 'CHIEF_LOGISTICS', 'COMMITTEE_LOGISTICS']
  const allowedRoles = channel === 'LOGISTICS' ? logisticsRoles : editorialRoles
  if (!hasRole(user, ...allowedRoles)) return err(`Only ${channel === 'LOGISTICS' ? 'logistics committee' : 'editors'} may access this channel`, 403)

  if (route === '/announcements' && method === 'GET') {
    const list = await prisma.editorAnnouncement.findMany({
      where: { channel },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })
    const authorIds = [...new Set(list.map(a => a.authorId))]
    const authors = await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, firstName: true, lastName: true, roles: { select: { role: true } } } })
    const map = Object.fromEntries(authors.map(a => [a.id, a]))
    return ok({ announcements: list.map(a => ({ ...a, author: map[a.authorId] })) })
  }
  if (route === '/announcements' && method === 'POST') {
    const { body: msgBody } = await request.json()
    if (!msgBody || !msgBody.trim()) return err('Body required')
    const a = await prisma.editorAnnouncement.create({ data: { authorId: user.id, body: msgBody.trim(), channel } })
    return ok({ announcement: a })
  }
  return null
}

// ============ REVIEWER INVITATIONS ============
async function handleReviewerInvitations(route, method, request) {
  if (route === '/reviewer-invitations' && method === 'POST') {
    const user = await getCurrentUser(request)
    const body = await request.json().catch(() => ({}))
    // Chief Editor / Admin / Managing Editor can invite reviewers to any abstract.
    // Everyone else (including COMMITTEE_EDITOR, COMMITTEE_MEMBER) must be the currently-assigned editor for THIS abstract.
    let allowed = hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')
    if (!allowed && body.abstractId) {
      const assn = await prisma.editorAssignment.findFirst({
        where: { abstractId: body.abstractId, editorId: user.id, active: true },
      })
      if (assn) allowed = true
    }
    if (!allowed) return err('Forbidden — you may only invite reviewers for abstracts assigned to you.', 403)
    if (!body.email) return err('Email required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return err('Enter a valid email address', 400)
    const token = crypto.randomBytes(24).toString('hex')
    const inv = await prisma.reviewerInvitation.create({
      data: {
        email: body.email.trim().toLowerCase(),
        fullName: body.fullName || null,
        specialty: body.specialty || null,
        message: body.message || null,
        abstractId: body.abstractId || null,
        invitedById: user.id,
        token,
      },
    })
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    const registerUrl = `${baseUrl}/?reviewerInvite=${token}`
    const conf = await prisma.conference.findFirst({ where: { isFeatured: true } }) || await prisma.conference.findFirst({ orderBy: { createdAt: 'desc' } })
    const confName = conf?.name || 'the Scientific Conference'
    const { sendEmail } = await import('@/lib/email')
    const { renderEmailHtml } = await import('@/lib/email-templates')
    const subject = `Invitation to Review — ${confName}`
    const inviteBody = `Dear ${body.fullName || 'Colleague'},

On behalf of the editorial committee of ${confName}, we would like to warmly invite you to serve as a peer reviewer for our upcoming conference.

Your expertise${body.specialty ? ` in ${body.specialty}` : ''} would be a tremendous asset to our review process. As a peer reviewer, you would evaluate abstracts within your area of specialty and provide constructive feedback to the authors and editorial committee.

${body.message ? body.message + '\n\n' : ''}To accept this invitation, please visit our platform and register as a reviewer using the following link:

${registerUrl}

Your registration will only take a few minutes. Once complete, our editors will be able to assign abstracts to you based on your specialty and availability.

We sincerely appreciate your consideration and hope you will accept this invitation to contribute to the scientific rigour of ${confName}.

With warm regards,
${user.firstName} ${user.lastName}
${confName} Editorial Committee`
    const html = renderEmailHtml({ subject, body: inviteBody, conferenceName: confName })
    // Send the invitation email and PROPAGATE the delivery result to the client.
    // Previously we ignored the return value and always reported success even when
    // Resend/SendGrid rejected the send.
    let emailResult = { sent: false, reason: 'not-attempted' }
    try {
      emailResult = await sendEmail({ to: body.email, subject, text: inviteBody, html })
    } catch (e) {
      emailResult = { sent: false, error: e.message }
    }
    if (!emailResult.sent) {
      console.error('[reviewer-invitations] email delivery failed:', emailResult)
      return err(
        `Invitation record was created but the email could not be delivered: ${emailResult.error || emailResult.reason || 'unknown error'}. Please check the email service configuration (EMAIL_PROVIDER / RESEND_API_KEY / verified sending domain).`,
        502,
      )
    }
    return ok({ invitation: inv, registerUrl, delivery: emailResult })
  }

  if (route === '/reviewer-invitations' && method === 'GET') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR', 'COMMITTEE_EDITOR', 'COMMITTEE_MEMBER')) return err('Forbidden', 403)
    const list = await prisma.reviewerInvitation.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
    return ok({ invitations: list })
  }

  // Public: verify token
  const verifyMatch = route.match(/^\/reviewer-invitations\/verify\/([^\/]+)$/)
  if (verifyMatch && method === 'GET') {
    const inv = await prisma.reviewerInvitation.findUnique({ where: { token: verifyMatch[1] } })
    if (!inv) return err('Invalid invitation link', 404)
    return ok({ invitation: { email: inv.email, fullName: inv.fullName, specialty: inv.specialty, respondedAt: inv.respondedAt } })
  }

  return null
}
// ============ CONFERENCE BOOK ============
async function handleConferenceBook(route, method, request) {
  const cfgMatch = route.match(/^\/conferences\/([^\/]+)\/book-config$/)
  if (cfgMatch && method === 'GET') {
    const user = await getCurrentUser(request)
    // Reading is allowed for any editorial-side role (Committee Editors get a read-only view in the UI)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR', 'COMMITTEE_EDITOR', 'COMMITTEE_MEMBER')) return err('Forbidden', 403)
    let book = await prisma.conferenceBook.findUnique({ where: { conferenceId: cfgMatch[1] } })
    if (!book) {
      book = await prisma.conferenceBook.create({
        data: {
          conferenceId: cfgMatch[1],
          sections: [
            { key: 'chiefGuest', label: 'Message from the Chief Guest', enabled: true },
            { key: 'chair', label: 'Message from the Conference Chair', enabled: true },
            { key: 'foreword', label: 'Foreword', enabled: true },
            { key: 'programme', label: 'Conference Programme', enabled: true },
            { key: 'abstracts', label: 'Accepted Abstracts', enabled: true },
            { key: 'sponsors', label: 'Sponsors & Exhibitors', enabled: true },
            { key: 'acknowledgements', label: 'Acknowledgements', enabled: true },
          ],
        },
      })
    }
    return ok({ book })
  }
  if (cfgMatch && method === 'PUT') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const allowed = ['coverTitle', 'coverSubtitle', 'chiefGuestName', 'chiefGuestTitle', 'chiefGuestMessage',
      'chairName', 'chairTitle', 'chairMessage', 'foreword', 'acknowledgements', 'sections']
    const patch = {}
    allowed.forEach(k => { if (body[k] !== undefined) patch[k] = body[k] })
    const book = await prisma.conferenceBook.upsert({
      where: { conferenceId: cfgMatch[1] },
      update: patch,
      create: { conferenceId: cfgMatch[1], ...patch },
    })
    await logAudit({ actorId: user.id, action: 'UPDATE_BOOK_CONFIG', entityType: 'ConferenceBook', entityId: book.id })
    return ok({ book })
  }

  const pdfMatch = route.match(/^\/conferences\/([^\/]+)\/book\.pdf$/)
  if (pdfMatch && method === 'GET') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const conferenceId = pdfMatch[1]
    const conference = await prisma.conference.findUnique({ where: { id: conferenceId } })
    if (!conference) return err('Conference not found', 404)
    const book = await prisma.conferenceBook.findUnique({ where: { conferenceId } })
    const abstracts = await prisma.abstract.findMany({
      where: { conferenceId, currentState: { in: ['ACCEPTED', 'PUBLISHED', 'ORAL', 'POSTER', 'FINAL_ACCEPTANCE', 'PROGRAMME_SCHEDULING'] } },
      include: {
        authors: { orderBy: { orderIndex: 'asc' } },
        theme: true,
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
      orderBy: { submissionCode: 'asc' },
    })
    const sessions = await prisma.programmeSession.findMany({
      where: { conferenceId },
      include: { items: { include: { abstract: true }, orderBy: { orderIndex: 'asc' } } },
      orderBy: { startTime: 'asc' },
    })
    const booths = await prisma.exhibitionBooth.findMany({
      where: { conferenceId, isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    })
    const { generateConferenceBookPDF } = await import('@/lib/pdf')
    const buf = await generateConferenceBookPDF({ conference, book, abstracts, sessions, booths })
    await logAudit({ actorId: user.id, action: 'GENERATE_CONFERENCE_BOOK', entityType: 'Conference', entityId: conferenceId })
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${conference.code || 'conference'}-book.pdf"`,
      },
    })
  }
  return null
}

// ============ FEEDBACK SURVEYS ============
async function handleSurveys(route, method, request) {
  // Public GET/POST via response token
  const publicGet = route.match(/^\/public\/survey-response\/([^\/]+)$/)
  if (publicGet && method === 'GET') {
    const resp = await prisma.feedbackResponse.findUnique({
      where: { token: publicGet[1] },
      include: { survey: { include: { conference: { select: { name: true, code: true, subtitle: true, theme: true } } } } },
    })
    if (!resp) return err('Invalid survey link', 404)
    return ok({
      response: { id: resp.id, submittedAt: resp.submittedAt, answers: resp.answers, email: resp.email },
      survey: {
        id: resp.survey.id, title: resp.survey.title, description: resp.survey.description,
        questions: resp.survey.questions, dayNumber: resp.survey.dayNumber, isPublished: resp.survey.isPublished,
        conference: resp.survey.conference,
      },
    })
  }
  if (publicGet && method === 'POST') {
    const resp = await prisma.feedbackResponse.findUnique({ where: { token: publicGet[1] } })
    if (!resp) return err('Invalid survey link', 404)
    if (resp.submittedAt) return err('You have already submitted this survey. Thank you!', 409)
    const body = await request.json()
    const updated = await prisma.feedbackResponse.update({
      where: { id: resp.id },
      data: { answers: body.answers || {}, submittedAt: new Date() },
    })
    return ok({ response: updated })
  }

  // Admin routes below - require auth
  const listMatch = route.match(/^\/conferences\/([^\/]+)\/surveys$/)
  if (listMatch && method === 'GET') {
    const user = await getCurrentUser(request)
    // Reading is allowed for any editorial role (Committee Editors get a read-only view in the UI)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR', 'COMMITTEE_EDITOR', 'COMMITTEE_MEMBER')) return err('Forbidden', 403)
    const surveys = await prisma.feedbackSurvey.findMany({
      where: { conferenceId: listMatch[1] },
      include: { _count: { select: { responses: true } } },
      orderBy: [{ dayNumber: 'asc' }, { createdAt: 'desc' }],
    })
    // Attach submitted count
    const withStats = await Promise.all(surveys.map(async s => {
      const submitted = await prisma.feedbackResponse.count({ where: { surveyId: s.id, NOT: { submittedAt: null } } })
      return { ...s, invitedCount: s._count.responses, submittedCount: submitted }
    }))
    return ok({ surveys: withStats })
  }
  if (listMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    if (!body.title) return err('Title is required')
    const questions = Array.isArray(body.questions) ? body.questions : []
    if (questions.length === 0) return err('At least one question is required')
    if (questions.length > 10) return err('Maximum 10 questions per survey')
    const survey = await prisma.feedbackSurvey.create({
      data: {
        conferenceId: listMatch[1],
        dayNumber: body.dayNumber || null,
        title: body.title,
        description: body.description || null,
        questions,
      },
    })
    await logAudit({ actorId: user.id, action: 'CREATE_SURVEY', entityType: 'FeedbackSurvey', entityId: survey.id })
    return ok({ survey })
  }

  const oneMatch = route.match(/^\/surveys\/([^\/]+)$/)
  if (oneMatch && method === 'GET') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const survey = await prisma.feedbackSurvey.findUnique({ where: { id: oneMatch[1] } })
    if (!survey) return err('Not found', 404)
    return ok({ survey })
  }
  if (oneMatch && method === 'PUT') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const patch = {}
    ;['title', 'description', 'dayNumber', 'questions', 'isPublished'].forEach(k => { if (body[k] !== undefined) patch[k] = body[k] })
    if (patch.questions && patch.questions.length > 10) return err('Maximum 10 questions per survey')
    const survey = await prisma.feedbackSurvey.update({ where: { id: oneMatch[1] }, data: patch })
    return ok({ survey })
  }
  if (oneMatch && method === 'DELETE') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    await prisma.feedbackSurvey.delete({ where: { id: oneMatch[1] } })
    return ok({ ok: true })
  }

  // Send TEST — sends only to the admin's own email
  const testMatch = route.match(/^\/surveys\/([^\/]+)\/send-test$/)
  if (testMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const survey = await prisma.feedbackSurvey.findUnique({ where: { id: testMatch[1] }, include: { conference: true } })
    if (!survey) return err('Survey not found', 404)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    // Reuse or create a test response for this admin
    let resp = await prisma.feedbackResponse.findFirst({ where: { surveyId: survey.id, userId: user.id } })
    if (!resp) {
      resp = await prisma.feedbackResponse.create({
        data: { surveyId: survey.id, userId: user.id, email: user.email, token: crypto.randomBytes(24).toString('hex') },
      })
    }
    const url = `${baseUrl}/?survey=${resp.token}`
    const subject = `[TEST] ${survey.dayNumber ? `Day ${survey.dayNumber} · ` : ''}${survey.title}`
    const bodyText = `Dear ${user.firstName || 'Admin'},

This is a TEST send of the survey "${survey.title}" so you can preview it before dispatching to delegates.

${survey.description ? survey.description + '\n\n' : ''}Preview link: ${url}

If the email arrives as expected, use "Send to all" to dispatch to registered delegates.

Editorial Committee`
    const { sendEmail } = await import('@/lib/email')
    const { renderEmailHtml } = await import('@/lib/email-templates')
    try {
      await sendEmail({
        to: user.email,
        subject,
        text: bodyText,
        html: renderEmailHtml({ subject, body: bodyText, conferenceName: survey.conference.name }),
      })
      return ok({ email: user.email, previewLink: url })
    } catch (e) {
      return err('Test email failed: ' + e.message, 500)
    }
  }

  const sendMatch = route.match(/^\/surveys\/([^\/]+)\/send$/)
  if (sendMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const survey = await prisma.feedbackSurvey.findUnique({
      where: { id: sendMatch[1] },
      include: { conference: true },
    })
    if (!survey) return err('Survey not found', 404)
    // Gather all registrants for this conference
    const regs = await prisma.registration.findMany({
      where: { conferenceId: survey.conferenceId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    })
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    const { sendEmail } = await import('@/lib/email')
    const { renderEmailHtml } = await import('@/lib/email-templates')
    let created = 0, sent = 0, failed = 0
    for (const r of regs) {
      const email = r.user?.email
      if (!email) continue
      // Reuse token if already exists for this survey/user
      let resp = await prisma.feedbackResponse.findFirst({ where: { surveyId: survey.id, userId: r.userId } })
      if (!resp) {
        const token = crypto.randomBytes(24).toString('hex')
        resp = await prisma.feedbackResponse.create({
          data: { surveyId: survey.id, userId: r.userId, email, token },
        })
        created++
      }
      const url = `${baseUrl}/?survey=${resp.token}`
      const subject = `${survey.dayNumber ? `Day ${survey.dayNumber} · ` : ''}${survey.title} — Feedback Requested`
      const greet = `Dear ${r.user?.firstName || 'Delegate'},`
      const bodyText = `${greet}

Thank you for participating in ${survey.conference.name}. Your feedback is invaluable to us and helps us continually improve the conference experience.

${survey.description ? survey.description + '\n\n' : ''}Please take a moment to complete this short survey (10 questions or fewer):

${url}

Your responses are anonymous and will be used purely for internal analysis.

With warm regards,
${survey.conference.name} Editorial Committee`
      try {
        await sendEmail({
          to: email,
          subject,
          text: bodyText,
          html: renderEmailHtml({ subject, body: bodyText, conferenceName: survey.conference.name }),
        })
        sent++
      } catch (e) {
        failed++
      }
    }
    await prisma.feedbackSurvey.update({ where: { id: survey.id }, data: { sentAt: new Date(), isPublished: true } })
    await logAudit({ actorId: user.id, action: 'SEND_SURVEY', entityType: 'FeedbackSurvey', entityId: survey.id, metadata: { created, sent, failed } })
    return ok({ created, sent, failed, total: regs.length })
  }

  const analyticsMatch = route.match(/^\/surveys\/([^\/]+)\/analytics$/)
  if (analyticsMatch && method === 'GET') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const survey = await prisma.feedbackSurvey.findUnique({ where: { id: analyticsMatch[1] } })
    if (!survey) return err('Not found', 404)
    const responses = await prisma.feedbackResponse.findMany({
      where: { surveyId: survey.id, NOT: { submittedAt: null } },
      orderBy: { submittedAt: 'desc' },
    })
    const invited = await prisma.feedbackResponse.count({ where: { surveyId: survey.id } })
    // Aggregate per question
    const questions = survey.questions || []
    const perQuestion = questions.map(q => {
      const values = responses.map(r => (r.answers || {})[q.id]).filter(v => v !== undefined && v !== null && v !== '')
      const stat = { questionId: q.id, label: q.label, type: q.type, count: values.length }
      if (q.type === 'RATING') {
        const nums = values.map(v => Number(v)).filter(n => !isNaN(n))
        stat.average = nums.length > 0 ? (nums.reduce((s, n) => s + n, 0) / nums.length) : 0
        const dist = {}
        nums.forEach(n => { dist[n] = (dist[n] || 0) + 1 })
        stat.distribution = dist
      } else if (q.type === 'MCQ' || q.type === 'YESNO') {
        const dist = {}
        values.forEach(v => { dist[v] = (dist[v] || 0) + 1 })
        stat.distribution = dist
      } else {
        stat.textResponses = values.slice(0, 50)
      }
      return stat
    })
    return ok({
      survey,
      totals: { invited, submitted: responses.length, responseRate: invited > 0 ? (responses.length / invited) : 0 },
      perQuestion,
      recent: responses.slice(0, 20).map(r => ({ id: r.id, submittedAt: r.submittedAt, email: r.email })),
    })
  }

  return null
}

// ============ LIVE CONFERENCE (LiveKit) ============
async function handleLiveConference(route, method, request) {
  // Toggle live status
  const liveMatch = route.match(/^\/conferences\/([^\/]+)\/live$/)
  if (liveMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json().catch(() => ({}))
    const conf = await prisma.conference.update({
      where: { id: liveMatch[1] },
      data: { isLive: !!body.isLive },
    })
    await logAudit({ actorId: user.id, action: body.isLive ? 'START_LIVE' : 'STOP_LIVE', entityType: 'Conference', entityId: liveMatch[1] })
    return ok({ conference: conf })
  }
  // Public status check (no auth) — so page can decide offline vs online
  const statusMatch = route.match(/^\/conferences\/([^\/]+)\/live-status$/)
  if (statusMatch && method === 'GET') {
    const conf = await prisma.conference.findUnique({
      where: { id: statusMatch[1] },
      select: { id: true, name: true, isLive: true },
    })
    if (!conf) return err('Not found', 404)
    return ok({ isLive: !!conf.isLive, name: conf.name })
  }
  // Token mint
  if (route === '/livekit/token' && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!user) return err('Unauthenticated', 401)
    const body = await request.json()
    if (!body.conferenceId) return err('conferenceId required')
    const conf = await prisma.conference.findUnique({ where: { id: body.conferenceId } })
    if (!conf) return err('Conference not found', 404)
    const isHost = hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')
    // Viewers may not join if offline
    if (!isHost && !conf.isLive) return err('Conference is offline', 409)
    const roomName = `conference-${conf.id}`
    try {
      const { AccessToken } = await import('livekit-server-sdk')
      const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
        identity: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        ttl: '2h',
      })
      at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: isHost,
        canSubscribe: true,
        canPublishData: true,
      })
      const token = await at.toJwt()
      return ok({
        token, url: process.env.LIVEKIT_URL, room: roomName,
        role: isHost ? 'host' : 'viewer',
        identity: user.id,
        displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      })
    } catch (e) {
      return err('Token mint failed: ' + e.message, 500)
    }
  }
  return null
}

// ============ EXHIBITION BOOTHS ============
async function handleBooths(route, method, request) {
  const listMatch = route.match(/^\/conferences\/([^\/]+)\/booths$/)
  if (listMatch && method === 'GET') {
    const list = await prisma.exhibitionBooth.findMany({ where: { conferenceId: listMatch[1], isActive: true }, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] })
    return ok({ booths: list })
  }
  if (listMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    if (!body.sponsorName) return err('sponsorName required')
    const b = await prisma.exhibitionBooth.create({
      data: {
        conferenceId: listMatch[1], sponsorName: body.sponsorName, companyType: body.companyType || null,
        products: body.products || null, message: body.message || null,
        websiteUrl: body.websiteUrl || null, contactEmail: body.contactEmail || null,
        contactPhone: body.contactPhone || null, otherLinks: body.otherLinks || null,
        displayOrder: body.displayOrder || 0,
      },
    })
    return ok({ booth: b })
  }
  const oneMatch = route.match(/^\/booths\/([^\/]+)$/)
  if (oneMatch && method === 'PUT') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const b = await prisma.exhibitionBooth.update({ where: { id: oneMatch[1] }, data: body })
    return ok({ booth: b })
  }
  if (oneMatch && method === 'DELETE') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    await prisma.exhibitionBooth.delete({ where: { id: oneMatch[1] } })
    return ok({ ok: true })
  }
  const imgMatch = route.match(/^\/booths\/([^\/]+)\/(banner|logo)$/)
  if (imgMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR')) return err('Forbidden', 403)
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return err('No file')
    if (file.size > 5 * 1024 * 1024) return err('Image too large (5MB max)')
    const buf = Buffer.from(await file.arrayBuffer())
    const safeName = `${imgMatch[2]}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const dir = path.join(UPLOAD_DIR, 'booths', imgMatch[1])
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, safeName), buf)
    const publicPath = `/api/uploads/booths/${imgMatch[1]}/${safeName}`
    const patch = imgMatch[2] === 'banner' ? { bannerPath: publicPath } : { logoPath: publicPath }
    const b = await prisma.exhibitionBooth.update({ where: { id: imgMatch[1] }, data: patch })
    return ok({ booth: b, imagePath: publicPath })
  }
  return null
}

// ============ SPONSORSHIP REQUESTS ============
// Sponsors submit sponsorship requests; Chief Logistics (and Admin) review them.
async function handleSponsorshipRequests(route, method, request) {
  // Public sponsorship tiers & pricing (DB-backed so Admin / Chief Logistics can edit)
  if (route === '/sponsorship-tiers' && method === 'GET') {
    let tiers = await prisma.sponsorshipTier.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    })
    // Seed the four defaults on first ever read so the site never renders empty
    if (tiers.length === 0) {
      const defaults = [
        { key: 'PLATINUM', label: 'Platinum Sponsor', price: '20,000', currency: 'USD', displayOrder: 1, benefits: ['Primary logo on stage & website', 'Keynote slot (30 min)', 'Premium booth (5x3m)', '10 delegate passes', 'Full-page ad in book'] },
        { key: 'GOLD',     label: 'Gold Sponsor',     price: '12,000', currency: 'USD', displayOrder: 2, benefits: ['Logo on stage & website', 'Speaking slot (15 min)', 'Standard booth (3x3m)', '6 delegate passes', 'Half-page ad in book'] },
        { key: 'SILVER',   label: 'Silver Sponsor',   price: '6,000',  currency: 'USD', displayOrder: 3, benefits: ['Logo on website & book', 'Shared booth (2x2m)', '3 delegate passes', 'Quarter-page ad'] },
        { key: 'BRONZE',   label: 'Bronze Sponsor',   price: '2,500',  currency: 'USD', displayOrder: 4, benefits: ['Logo on website', '1 delegate pass', 'Listing in the book'] },
      ]
      for (const d of defaults) await prisma.sponsorshipTier.create({ data: d })
      tiers = await prisma.sponsorshipTier.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }] })
    }
    return ok({ tiers })
  }

  // CRUD for sponsorship tiers — Admin / Chief Logistics only
  if (route === '/sponsorship-tiers' && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'CHIEF_LOGISTICS')) return err('Forbidden', 403)
    const body = await request.json()
    if (!body.key || !body.label || !body.price) return err('key, label and price are required', 400)
    const created = await prisma.sponsorshipTier.create({
      data: {
        key: body.key.toUpperCase(),
        label: body.label,
        price: body.price,
        currency: (body.currency || 'USD').toUpperCase(),
        benefits: body.benefits || [],
        displayOrder: body.displayOrder ?? 100,
        isActive: body.isActive !== false,
      },
    })
    return ok({ tier: created })
  }

  const tierMatch = route.match(/^\/sponsorship-tiers\/([^\/]+)$/)
  if (tierMatch && method === 'PUT') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'CHIEF_LOGISTICS')) return err('Forbidden', 403)
    const body = await request.json()
    const updated = await prisma.sponsorshipTier.update({
      where: { id: tierMatch[1] },
      data: {
        ...(body.key !== undefined      ? { key: body.key.toUpperCase() } : {}),
        ...(body.label !== undefined    ? { label: body.label } : {}),
        ...(body.price !== undefined    ? { price: body.price } : {}),
        ...(body.currency !== undefined ? { currency: body.currency.toUpperCase() } : {}),
        ...(body.benefits !== undefined ? { benefits: body.benefits } : {}),
        ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    })
    return ok({ tier: updated })
  }
  if (tierMatch && method === 'DELETE') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'CHIEF_LOGISTICS')) return err('Forbidden', 403)
    await prisma.sponsorshipTier.delete({ where: { id: tierMatch[1] } })
    return ok({ ok: true })
  }

  const listMatch = route.match(/^\/sponsorship-requests$/)
  if (listMatch && method === 'POST') {
    // Anyone authenticated can submit a sponsorship request (typically INDUSTRY_PARTNER)
    const user = await getCurrentUser(request)
    if (!user) return err('Unauthenticated', 401)
    const body = await request.json()
    if (!body.conferenceId) return err('conferenceId required')
    if (!body.companyName) return err('Company name required')
    const created = await prisma.sponsorshipRequest.create({
      data: {
        conferenceId: body.conferenceId,
        requesterId: user.id,
        companyName: body.companyName,
        companyType: body.companyType || null,
        industry: body.industry || null,
        companyAddress: body.companyAddress || null,
        websiteUrl: body.websiteUrl || null,
        contactEmail: body.contactEmail || user.email,
        contactPhone: body.contactPhone || null,
        products: body.products || null,
        sponsorTier: body.sponsorTier || null,
        virtualBoothRequested: !!body.virtualBoothRequested,
        physicalBoothRequested: !!body.physicalBoothRequested,
        message: body.message || null,
      },
    })
    // Notify all Chief Logistics + Admin about the new sponsorship request
    const logisticsChiefs = await prisma.user.findMany({
      where: { roles: { some: { role: { in: ['CHIEF_LOGISTICS', 'SYSTEM_ADMIN'] } } } },
      select: { id: true, email: true, firstName: true },
    })
    for (const c of logisticsChiefs) {
      await prisma.notification.create({
        data: {
          userId: c.id, type: 'GENERIC',
          title: `New sponsorship request from ${body.companyName}`,
          body: `${user.firstName} ${user.lastName} has requested to sponsor the conference (${body.sponsorTier || 'unspecified tier'}).`,
          link: '/logistics',
        },
      })
    }
    // Fire-and-forget email notifications (best-effort)
    try {
      const conf = await prisma.conference.findUnique({ where: { id: body.conferenceId } })
      const confName = conf?.name || 'the Scientific Conference'
      const { sendEmail } = await import('@/lib/email')
      const { renderEmailHtml } = await import('@/lib/email-templates')
      // 1. Confirmation email to the sponsor
      const sponsorSubject = `Thank you for your sponsorship interest — ${confName}`
      const sponsorBody = `Dear ${user.firstName || 'Partner'},

Thank you for choosing to partner with ${confName}. We have received your sponsorship request for ${body.companyName}${body.sponsorTier ? ` (${body.sponsorTier} tier)` : ''} and truly appreciate your interest in supporting our conference.

The Chief Logistics team has been notified and will review your request. You can expect to hear from them within a few working days with next steps and any additional details required.

Sponsorship details submitted:
  • Company: ${body.companyName}
  • Preferred tier: ${body.sponsorTier || 'To be discussed'}
  • Booth requested: ${body.virtualBoothRequested ? 'Virtual' : ''}${body.virtualBoothRequested && body.physicalBoothRequested ? ' + ' : ''}${body.physicalBoothRequested ? 'Physical' : ''}${!body.virtualBoothRequested && !body.physicalBoothRequested ? 'None specified' : ''}

If you have any additional information to share in the meantime, please reply to this email.

With gratitude,
${confName} Logistics Committee`
      const sponsorHtml = renderEmailHtml({ subject: sponsorSubject, body: sponsorBody, conferenceName: confName })
      sendEmail({ to: (body.contactEmail || user.email), subject: sponsorSubject, text: sponsorBody, html: sponsorHtml }).catch(() => {})

      // 2. Copy to every Chief Logistics + Admin
      const chiefSubject = `New sponsorship request — ${body.companyName} — ${confName}`
      const chiefBody = `A new sponsorship request has just been submitted for ${confName}.

Requested by: ${user.firstName} ${user.lastName} (${user.email})
Company: ${body.companyName}${body.companyType ? ' — ' + body.companyType : ''}
Industry: ${body.industry || '—'}
Preferred tier: ${body.sponsorTier || '—'}
Booth requested: ${body.virtualBoothRequested ? 'Virtual' : ''}${body.virtualBoothRequested && body.physicalBoothRequested ? ' + ' : ''}${body.physicalBoothRequested ? 'Physical' : ''}${!body.virtualBoothRequested && !body.physicalBoothRequested ? 'None specified' : ''}
Contact email: ${body.contactEmail || user.email}
Contact phone: ${body.contactPhone || '—'}
Website: ${body.websiteUrl || '—'}

Message from sponsor:
${body.message || '(no message)'}

Review and respond in the Logistics Boardroom.`
      const chiefHtml = renderEmailHtml({ subject: chiefSubject, body: chiefBody, conferenceName: confName })
      for (const c of logisticsChiefs) {
        if (c.email) sendEmail({ to: c.email, subject: chiefSubject, text: chiefBody, html: chiefHtml }).catch(() => {})
      }
    } catch (e) { /* email failures should not block */ }
    return ok({ request: created })
  }

  if (listMatch && method === 'GET') {
    const user = await getCurrentUser(request)
    if (!user) return err('Unauthenticated', 401)
    const isLogistics = hasRole(user, 'SYSTEM_ADMIN', 'CHIEF_LOGISTICS', 'COMMITTEE_LOGISTICS')
    const url = new URL(request.url)
    const conferenceId = url.searchParams.get('conferenceId')
    const where = {}
    if (conferenceId) where.conferenceId = conferenceId
    if (!isLogistics) where.requesterId = user.id
    const list = await prisma.sponsorshipRequest.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 200,
    })
    const requesterIds = [...new Set(list.map(r => r.requesterId))]
    const requesters = await prisma.user.findMany({
      where: { id: { in: requesterIds } },
      select: { id: true, firstName: true, lastName: true, email: true, affiliation: true },
    })
    const map = Object.fromEntries(requesters.map(u => [u.id, u]))
    return ok({ requests: list.map(r => ({ ...r, requester: map[r.requesterId] })) })
  }

  const oneMatch = route.match(/^\/sponsorship-requests\/([^\/]+)$/)
  if (oneMatch && method === 'PUT') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'CHIEF_LOGISTICS', 'COMMITTEE_LOGISTICS')) return err('Forbidden', 403)
    const body = await request.json()
    const req = await prisma.sponsorshipRequest.findUnique({ where: { id: oneMatch[1] } })
    if (!req) return err('Not found', 404)
    const updated = await prisma.sponsorshipRequest.update({
      where: { id: oneMatch[1] },
      data: {
        status: body.status || req.status,
        reviewNotes: body.reviewNotes ?? req.reviewNotes,
        reviewedById: user.id,
      },
    })
    // Notify requester about decision
    if (body.status && body.status !== req.status) {
      await prisma.notification.create({
        data: {
          userId: req.requesterId, type: 'GENERIC',
          title: `Sponsorship request ${body.status.toLowerCase()}`,
          body: `Your sponsorship request for ${req.companyName} has been ${body.status.toLowerCase()}${body.reviewNotes ? ': ' + body.reviewNotes : '.'}`,
        },
      })
    }
    return ok({ request: updated })
  }

  return null
}

// ============ LOGISTICS COMMITTEE ============
async function handleLogistics(route, method, request) {
  if (route === '/logistics/members' && method === 'GET') {
    const user = await getCurrentUser(request)
    if (!user) return err('Unauthenticated', 401)
    const members = await prisma.user.findMany({
      where: { roles: { some: { role: { in: ['CHIEF_LOGISTICS', 'COMMITTEE_LOGISTICS'] } } } },
      select: { id: true, firstName: true, lastName: true, email: true, title: true, affiliation: true, country: true, roles: { select: { role: true } } },
      orderBy: [{ lastName: 'asc' }],
    })
    // Sort so Chief Logistics comes first
    members.sort((a, b) => {
      const aChief = a.roles.some(r => r.role === 'CHIEF_LOGISTICS') ? 0 : 1
      const bChief = b.roles.some(r => r.role === 'CHIEF_LOGISTICS') ? 0 : 1
      return aChief - bChief
    })
    return ok({ members })
  }
  return null
}

// ============ ATTENDEE REGISTRATION TOGGLE ============
async function handleAttendeeRegistrationToggle(route, method, request) {
  const m = route.match(/^\/conferences\/([^\/]+)\/attendee-registration$/)
  if (!m || method !== 'PUT') return null
  const user = await getCurrentUser(request)
  if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'CHIEF_EDITOR', 'CHIEF_LOGISTICS')) return err('Forbidden', 403)
  const body = await request.json()
  const newVal = !!body.open
  const conf = await prisma.conference.update({
    where: { id: m[1] },
    data: { attendeeRegistrationOpen: newVal },
  })
  // Broadcast on toggle ON: notify every user (except the actor) that attendee registration is open
  if (newVal) {
    const allUsers = await prisma.user.findMany({ select: { id: true, email: true, firstName: true } })
    for (const u of allUsers) {
      await prisma.notification.create({
        data: {
          userId: u.id, type: 'GENERIC',
          title: `Attendee registration is now open for ${conf.name}`,
          body: `Attendee registration for ${conf.name} is now open. Log in to register your attendance (in-person or virtual).`,
          link: '/conferences',
        },
      })
    }
    // Optional email broadcast (best-effort, non-blocking).
    // Throttled to stay within Resend's 10 req/sec rate limit — batches of 8 with a
    // 1.1s pause between batches. Runs asynchronously so the API response is not held up.
    try {
      const { sendEmail } = await import('@/lib/email')
      const { renderEmailHtml } = await import('@/lib/email-templates')
      const subject = `Attendee registration open — ${conf.name}`
      const bodyText = `Attendee registration for ${conf.name} is now open. Please log in to complete your registration.`
      const html = renderEmailHtml({ subject, body: bodyText, conferenceName: conf.name })
      const BATCH = 8
      const PAUSE_MS = 1100
      ;(async () => {
        for (let i = 0; i < allUsers.length; i += BATCH) {
          const slice = allUsers.slice(i, i + BATCH).filter(u => u.email)
          await Promise.all(slice.map(u => sendEmail({ to: u.email, subject, html, text: bodyText }).catch(() => {})))
          if (i + BATCH < allUsers.length) await new Promise(r => setTimeout(r, PAUSE_MS))
        }
      })().catch(() => {})
    } catch (e) { /* non-fatal */ }
  }
  return ok({ conference: conf })
}

async function router(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method
  try {
    let r = null
    if (route === '/' || route === '/root') return ok({ ok: true, service: 'SCMS API', version: '1.0.0' })
    if (route === '/state-transitions' && method === 'GET') return ok({ transitions: STATE_TRANSITIONS })
    r = await handleUploadServe(route, method, request); if (r) return r
    r = await handleAuth(route, method, request); if (r) return r
    r = await handlePasswordReset(route, method, request); if (r) return r
    r = await handleConferences(route, method, request); if (r) return r
    r = await handleTemplates(route, method, request); if (r) return r
    r = await handleBooths(route, method, request); if (r) return r
    r = await handleLiveConference(route, method, request); if (r) return r
    r = await handleConferenceBook(route, method, request); if (r) return r
    r = await handleSurveys(route, method, request); if (r) return r
    r = await handleAbstracts(route, method, request); if (r) return r
    r = await handleTechnicalScore(route, method, request); if (r) return r
    r = await handleAnnouncements(route, method, request); if (r) return r
    r = await handleReviewerInvitations(route, method, request); if (r) return r
    r = await handleBooths(route, method, request); if (r) return r
    r = await handleSponsorshipRequests(route, method, request); if (r) return r
    r = await handleLogistics(route, method, request); if (r) return r
    r = await handleAttendeeRegistrationToggle(route, method, request); if (r) return r
    r = await handleReviewer(route, method, request); if (r) return r
    r = await handleUsers(route, method, request); if (r) return r
    r = await handleNotifications(route, method, request); if (r) return r
    r = await handleAnalytics(route, method, request); if (r) return r
    r = await handleProgramme(route, method, request); if (r) return r
    r = await handleAudit(route, method, request); if (r) return r
    r = await handleDocumentDownload(route, method, request); if (r) return r
    return err(`Route ${route} not found`, 404)
  } catch (e) {
    console.error('API Error', e)
    // Return concise error messages (avoid leaking stack traces)
    let msg = (e && e.message) ? String(e.message) : 'Internal server error'
    if (e && e.code === 'P2002') msg = 'A record with that value already exists.'
    else if (e && e.code === 'P2025') msg = 'Record not found.'
    else if (e && e.code === 'P2003') msg = 'Referenced item does not exist.'
    else if (msg.includes("Can't reach database")) msg = 'Database temporarily unavailable. Please try again.'
    else if (msg.includes('Unknown argument')) {
      const m = msg.match(/Unknown argument `([^`]+)`/)
      msg = m ? `Server schema mismatch on field "${m[1]}". Please contact support.` : 'Server schema mismatch. Please contact support.'
    } else if (msg.length > 300) {
      // Prisma verbose errors: get the first meaningful line
      const line = msg.split('\n').map(s => s.trim()).find(s => s && !s.startsWith('?') && !s.startsWith('{') && s.length < 200)
      msg = line || 'Server error. Please try again or contact support.'
    }
    if (!msg || !msg.trim()) msg = 'Server error. Please try again or contact support.'
    return err(msg, 500)
  }
}

export const GET = router
export const POST = router
export const PUT = router
export const DELETE = router
export const PATCH = router
