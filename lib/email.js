// Email delivery abstraction. Supports Resend, SendGrid, SMTP.
// Gracefully no-ops (with server log) if no provider is configured.
import fs from 'fs/promises'
import path from 'path'

const PROVIDER = process.env.EMAIL_PROVIDER || 'none' // 'resend' | 'sendgrid' | 'smtp' | 'none'
const FROM = process.env.EMAIL_FROM || 'SCMS <noreply@scms.local>'
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'SCMS Editorial Office'

async function sendViaResend({ to, subject, text, html, attachments }) {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY not configured')
  const payload = {
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    text: text || undefined,
    html: html || undefined,
    attachments: (attachments || []).map(a => ({
      filename: a.filename,
      content: a.contentBase64, // Resend expects base64 string
    })),
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error('Resend error: ' + (data.message || res.status))
  return data
}

async function sendViaSendGrid({ to, subject, text, html, attachments }) {
  const key = process.env.SENDGRID_API_KEY
  if (!key) throw new Error('SENDGRID_API_KEY not configured')
  const payload = {
    personalizations: [{ to: (Array.isArray(to) ? to : [to]).map(e => ({ email: e })) }],
    from: { email: (FROM.match(/<([^>]+)>/) || [null, FROM])[1], name: FROM_NAME },
    subject,
    content: [
      text ? { type: 'text/plain', value: text } : null,
      html ? { type: 'text/html', value: html } : null,
    ].filter(Boolean),
    attachments: (attachments || []).map(a => ({
      filename: a.filename,
      content: a.contentBase64,
      type: a.mimeType || 'application/octet-stream',
      disposition: 'attachment',
    })),
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('SendGrid error: HTTP ' + res.status)
  return { ok: true }
}

export async function sendEmail({ to, subject, text, html, attachments = [] }) {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.log('[email] skipped: no recipients')
    return { sent: false, reason: 'no recipients' }
  }

  const provider = PROVIDER.toLowerCase()
  if (provider === 'resend') {
    try {
      const result = await sendViaResend({ to, subject, text, html, attachments })
      console.log('[email] resend ok →', to, subject)
      return { sent: true, provider: 'resend', id: result.id }
    } catch (e) {
      console.error('[email] resend failed:', e.message)
      return { sent: false, error: e.message }
    }
  }
  if (provider === 'sendgrid') {
    try {
      await sendViaSendGrid({ to, subject, text, html, attachments })
      console.log('[email] sendgrid ok →', to, subject)
      return { sent: true, provider: 'sendgrid' }
    } catch (e) {
      console.error('[email] sendgrid failed:', e.message)
      return { sent: false, error: e.message }
    }
  }

  // No provider configured — log the intent
  console.log(`[email] NOT SENT (no provider configured). To=${to} Subject=${subject}`)
  return { sent: false, reason: 'no-provider' }
}

// Helper: read a document from disk and encode as base64 for email attachment
export async function loadAttachment(doc) {
  try {
    const buf = await fs.readFile(doc.storagePath)
    return {
      filename: doc.fileName,
      mimeType: doc.mimeType || 'application/octet-stream',
      contentBase64: buf.toString('base64'),
    }
  } catch (e) {
    console.error('[email] attachment load failed', doc.fileName, e.message)
    return null
  }
}
