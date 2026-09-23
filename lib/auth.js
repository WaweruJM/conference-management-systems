import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import prisma from './prisma'

// SECURITY: JWT_SECRET must be set. In production we refuse to boot with a
// weak/default value — this prevents accidentally shipping with a predictable
// signing key. In dev only we allow a warning + strong random secret at
// process start to keep local flows working.
//
// IMPORTANT: The validation is deferred to first *use* rather than executed at
// module-import time. Next.js's `next build` step evaluates every server module
// during "Collecting page data" — running the check at the top level would abort
// the build in any environment that hasn't injected the runtime secret yet
// (e.g. Cloud Build / GitHub Actions). Throwing at first sign/verify still
// prevents the app from serving requests without a valid secret at runtime.
let _JWT_SECRET_CACHE = null
function _getJwtSecret() {
  if (_JWT_SECRET_CACHE) return _JWT_SECRET_CACHE
  const v = process.env.JWT_SECRET
  if (v && v.length >= 32 && v !== 'dev_secret' && v !== 'changeme') {
    _JWT_SECRET_CACHE = v
    return v
  }
  // Recognise Next.js build phase — never throw here, only at request-time use.
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
  if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
    throw new Error('SECURITY: JWT_SECRET is missing or too weak (min 32 chars, not dev_secret/changeme). Refusing to serve requests.')
  }
  // Dev fallback / build phase: warn but generate an ephemeral secret so
  // module evaluation succeeds. Restarting the server invalidates existing
  // tokens (fine in dev, forces re-login).
  const dev = 'dev-' + Buffer.from(String(Date.now()) + Math.random()).toString('base64')
  if (!isBuildPhase) {
    console.warn('⚠  JWT_SECRET is not set or too weak; using an ephemeral dev secret. Set JWT_SECRET in .env (>=32 chars) before production.')
  }
  _JWT_SECRET_CACHE = dev
  return dev
}

const JWT_LIFETIME = process.env.JWT_LIFETIME || '7d'

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 12)
}

export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash)
}

export function signToken(payload) {
  return jwt.sign(payload, _getJwtSecret(), { expiresIn: JWT_LIFETIME })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, _getJwtSecret())
  } catch (e) {
    return null
  }
}

export async function getCurrentUser(request) {
  let token = null
  const authHeader = request?.headers?.get?.('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }
  if (!token) {
    try {
      const c = await cookies()
      token = c.get('scms_token')?.value
    } catch {}
  }
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload?.userId) return null
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { roles: true, institution: true },
  })
  return user
}

export function hasRole(user, ...roles) {
  if (!user) return false
  return user.roles.some(r => roles.includes(r.role))
}

export async function logAudit({ actorId, action, entityType, entityId, metadata }) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, entityType, entityId, metadata: metadata || {} },
    })
  } catch (e) {
    console.error('audit failed', e)
  }
}

