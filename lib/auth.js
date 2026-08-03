import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import prisma from './prisma'

// SECURITY: JWT_SECRET must be set. In production we refuse to boot with a
// weak/default value — this prevents accidentally shipping with a predictable
// signing key. In dev only we allow a warning + strong random secret at
// process start to keep local flows working.
const JWT_SECRET = (() => {
  const v = process.env.JWT_SECRET
  if (v && v.length >= 32 && v !== 'dev_secret' && v !== 'changeme') return v
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY: JWT_SECRET is missing or too weak (min 32 chars, not dev_secret/changeme). Refusing to start.')
  }
  // Dev fallback: warn but generate an ephemeral secret so tokens are still
  // signed. Restarting the server will invalidate all existing tokens (fine
  // in dev, forces re-login).
  const dev = 'dev-' + Buffer.from(String(Date.now()) + Math.random()).toString('base64')
  console.warn('⚠  JWT_SECRET is not set or too weak; using an ephemeral dev secret. Set JWT_SECRET in .env (>=32 chars) before production.')
  return dev
})()

const JWT_LIFETIME = process.env.JWT_LIFETIME || '7d'

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 12)
}

export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash)
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_LIFETIME })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
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

