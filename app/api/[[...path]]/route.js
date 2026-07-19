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
    const { email, password, firstName, lastName, title, affiliation, country, role } = body
    if (!email || !password || !firstName || !lastName) return err('Missing required fields')
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return err('Email already registered', 409)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        firstName, lastName, title, affiliation, country,
        roles: { create: { role: role || 'AUTHOR' } },
      },
      include: { roles: true },
    })
    const token = signToken({ userId: user.id })
    const c = await cookies(); c.set('scms_token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60*60*24*30 })
    await logAudit({ actorId: user.id, action: 'REGISTER', entityType: 'User', entityId: user.id })
    return ok({ user: sanitizeUser(user), token })
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
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const theme = await prisma.theme.create({
      data: { conferenceId: themeMatch[1], name: body.name, description: body.description, keywords: body.keywords || [] },
    })
    return ok({ theme })
  }

  const regMatch = route.match(/^\/conferences\/([^\/]+)\/register$/)
  if (regMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!user) return err('Unauthenticated', 401)
    const body = await request.json().catch(() => ({}))
    const reg = await prisma.registration.upsert({
      where: { conferenceId_userId: { conferenceId: regMatch[1], userId: user.id } },
      update: {},
      create: { conferenceId: regMatch[1], userId: user.id, type: body.type || 'STANDARD' },
    })
    return ok({ registration: reg })
  }

  // Hero image upload (admin only, multipart)
  const heroMatch = route.match(/^\/conferences\/([^\/]+)\/hero-images$/)
  if (heroMatch && method === 'POST') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR')) return err('Forbidden', 403)
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return err('No file')
    if (file.size > 5 * 1024 * 1024) return err('Image too large (max 5 MB)')
    const buf = Buffer.from(await file.arrayBuffer())
    const safeName = `hero_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const dir = path.join(UPLOAD_DIR, 'hero', heroMatch[1])
    await fs.mkdir(dir, { recursive: true })
    const filePath = path.join(dir, safeName)
    await fs.writeFile(filePath, buf)
    const publicPath = `/api/uploads/hero/${heroMatch[1]}/${safeName}`
    const conf = await prisma.conference.update({
      where: { id: heroMatch[1] },
      data: { heroImages: { push: publicPath } },
    })
    return ok({ conference: conf, imagePath: publicPath })
  }
  if (heroMatch && method === 'DELETE') {
    const user = await getCurrentUser(request)
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const conf = await prisma.conference.findUnique({ where: { id: heroMatch[1] } })
    const filtered = (conf.heroImages || []).filter(p => p !== body.imagePath)
    const updated = await prisma.conference.update({ where: { id: heroMatch[1] }, data: { heroImages: filtered } })
    return ok({ conference: updated })
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
  const user = await getCurrentUser(request)
  if (!user) return err('Unauthenticated', 401)

  // LIST
  if (route === '/abstracts' && method === 'GET') {
    const url = new URL(request.url)
    const conferenceId = url.searchParams.get('conferenceId')
    const state = url.searchParams.get('state')
    const scope = url.searchParams.get('scope') // 'mine' | 'assigned' | 'all'
    const where = {}
    if (conferenceId) where.conferenceId = conferenceId
    if (state) where.currentState = state
    if (scope === 'mine') where.submittedById = user.id
    if (scope === 'assigned') {
      // editor or reviewer assignments
      if (hasRole(user, 'EXTERNAL_REVIEWER', 'COMMITTEE_MEMBER')) {
        where.reviewAssignments = { some: { reviewerId: user.id } }
      } else if (hasRole(user, 'SECTION_EDITOR', 'MANAGING_EDITOR')) {
        where.editorAssignments = { some: { editorId: user.id, active: true } }
      }
    }
    // authors see only their own by default
    if (!scope && !hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'SECTION_EDITOR', 'COMMITTEE_MEMBER', 'EXTERNAL_REVIEWER')) {
      where.submittedById = user.id
    }
    const list = await prisma.abstract.findMany({
      where,
      include: {
        conference: { select: { id: true, code: true, name: true, doubleBlind: true } },
        theme: true,
        authors: true,
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        _count: { select: { reviewAssignments: true, messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
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
    const isAssigned = abstract.reviewAssignments.some(r => r.reviewerId === user.id) || abstract.editorAssignments.some(e => e.editorId === user.id)
    const isPrivileged = hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR')
    if (!isOwner && !isAssigned && !isPrivileged && !hasRole(user, 'SECTION_EDITOR', 'COMMITTEE_MEMBER')) {
      return err('Forbidden', 403)
    }
    // Double-blind: hide author identity from reviewers if enabled
    let result = abstract
    if (abstract.conference.doubleBlind && hasRole(user, 'EXTERNAL_REVIEWER') && !isOwner && !isPrivileged) {
      result = { ...abstract, authors: [], submittedBy: null }
    }
    return ok({ abstract: result })
  }

  // Submit
  const submitMatch = route.match(/^\/abstracts\/([^\/]+)\/submit$/)
  if (submitMatch && method === 'POST') {
    const abs = await prisma.abstract.findUnique({ where: { id: submitMatch[1] } })
    if (!abs || abs.submittedById !== user.id) return err('Forbidden', 403)
    const updated = await transitionState(submitMatch[1], 'SUBMITTED', user.id, 'Submitted by author')
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
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'SECTION_EDITOR')) return err('Forbidden', 403)
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
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const assignment = await prisma.editorAssignment.create({
      data: { abstractId: assignEdMatch[1], editorId: body.editorId, role: body.role || 'SECTION_EDITOR' },
    })
    await createNotification(body.editorId, 'ASSIGNMENT', 'New editor assignment', 'You have been assigned as editor.', `/abstracts/${assignEdMatch[1]}`)
    const abs = await prisma.abstract.findUnique({ where: { id: assignEdMatch[1] } })
    if (abs.currentState === 'SUBMITTED' || abs.currentState === 'TECHNICAL_CHECK') {
      await transitionState(assignEdMatch[1], 'EDITORIAL_ASSIGNMENT', user.id, 'Editor assigned')
    }
    return ok({ assignment })
  }

  // Assign reviewer
  const assignRvMatch = route.match(/^\/abstracts\/([^\/]+)\/assign-reviewer$/)
  if (assignRvMatch && method === 'POST') {
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'SECTION_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const assignment = await prisma.reviewAssignment.create({
      data: {
        abstractId: assignRvMatch[1],
        reviewerId: body.reviewerId,
        assignedById: user.id,
        reviewType: body.reviewType || 'EXTERNAL_REVIEWER',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    })
    await createNotification(body.reviewerId, 'REVIEW_INVITATION', 'Review invitation', 'You have been invited to review.', `/abstracts/${assignRvMatch[1]}`)
    const abs = await prisma.abstract.findUnique({ where: { id: assignRvMatch[1] } })
    if (['EDITORIAL_ASSIGNMENT'].includes(abs.currentState)) {
      await transitionState(assignRvMatch[1], body.reviewType === 'COMMITTEE_MEMBER' ? 'COMMITTEE_REVIEW' : 'EXTERNAL_PEER_REVIEW', user.id, 'Reviewer assigned')
    }
    return ok({ assignment })
  }

  // Decision
  const decMatch = route.match(/^\/abstracts\/([^\/]+)\/decision$/)
  if (decMatch && method === 'POST') {
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR', 'SECTION_EDITOR')) return err('Forbidden', 403)
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
    const abs = await prisma.abstract.findUnique({ where: { id: decMatch[1] } })
    await createNotification(abs.submittedById, 'DECISION', `Decision on ${abs.submissionCode}: ${body.decision}`, body.decisionLetter || '', `/abstracts/${abs.id}`)
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
    const msg = await prisma.message.create({
      data: {
        abstractId: msgListMatch[1],
        senderId: user.id,
        channel: body.channel || 'EDITOR_AUTHOR',
        recipientIds: body.recipientIds || [],
        subject: body.subject || '(no subject)',
        body: body.body || '',
      },
      include: { sender: { select: { firstName: true, lastName: true } } },
    })
    for (const rid of body.recipientIds || []) {
      await createNotification(rid, 'MESSAGE', body.subject || 'New message', 'You have a new message.', `/abstracts/${msgListMatch[1]}`)
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
    return ok({ assignments: cleaned })
  }

  // Respond to invitation
  const respMatch = route.match(/^\/reviewer\/assignments\/([^\/]+)\/respond$/)
  if (respMatch && method === 'POST') {
    const body = await request.json()
    const a = await prisma.reviewAssignment.update({
      where: { id: respMatch[1] },
      data: { invitationStatus: body.status, respondedAt: new Date() },
    })
    return ok({ assignment: a })
  }

  // Submit review
  const subMatch = route.match(/^\/reviewer\/assignments\/([^\/]+)\/submit$/)
  if (subMatch && method === 'POST') {
    const body = await request.json()
    const a = await prisma.reviewAssignment.findUnique({ where: { id: subMatch[1] } })
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
    const r = await prisma.userRole.create({ data: { userId: roleMatch[1], role: body.role } }).catch(() => null)
    return ok({ role: r })
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
  const progMatch = route.match(/^\/programme\/([^\/]+)$/)
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
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR')) return err('Forbidden', 403)
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
  const itemMatch = route.match(/^\/sessions\/([^\/]+)\/items$/)
  if (itemMatch && method === 'POST') {
    if (!hasRole(user, 'SYSTEM_ADMIN', 'MANAGING_EDITOR')) return err('Forbidden', 403)
    const body = await request.json()
    const item = await prisma.programmeItem.create({
      data: {
        sessionId: itemMatch[1],
        abstractId: body.abstractId,
        orderIndex: body.orderIndex || 0,
        durationMin: body.durationMin || 15,
      },
    })
    return ok({ item })
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

// ============ ROUTER ============
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
    r = await handleConferences(route, method, request); if (r) return r
    r = await handleAbstracts(route, method, request); if (r) return r
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
    return err(e.message || 'Internal server error', 500)
  }
}

export const GET = router
export const POST = router
export const PUT = router
export const DELETE = router
export const PATCH = router
