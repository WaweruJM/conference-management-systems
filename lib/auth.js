import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import prisma from './prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10)
}

export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash)
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
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
