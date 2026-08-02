// PDF generation helpers using pdfkit
import PDFDocument from 'pdfkit'
import { PDFDocument as PDFLibDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs/promises'
import path from 'path'

export function generateNameTagsPDF(delegates, conferenceInfo) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 20 })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // A4 = 595 x 842 points. 8 tags per page = 2 cols x 4 rows
    const pageW = 595, pageH = 842, m = 20
    const tagW = (pageW - m * 2) / 2, tagH = (pageH - m * 2) / 4

    delegates.forEach((d, i) => {
      const idx = i % 8
      if (idx === 0 && i > 0) doc.addPage()
      const col = idx % 2, row = Math.floor(idx / 2)
      const x = m + col * tagW, y = m + row * tagH

      // Border with rounded corners
      doc.roundedRect(x + 4, y + 4, tagW - 8, tagH - 8, 8).lineWidth(1).stroke('#6366f1')

      // Top: conference title (indigo bar)
      doc.rect(x + 4, y + 4, tagW - 8, 26).fill('#6366f1')
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
         .text((conferenceInfo.name || 'Conference').toUpperCase(), x + 4, y + 12, { width: tagW - 8, align: 'center' })

      // Middle: prefix, name, rank
      const prefix = d.prefix || ''
      const fullName = d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim()
      const rank = d.rank || ''
      const affiliation = d.affiliation || ''

      doc.fillColor('#111827').font('Helvetica').fontSize(11)
         .text(prefix, x + 4, y + 42, { width: tagW - 8, align: 'center' })
      doc.font('Helvetica-Bold').fontSize(16)
         .text(fullName, x + 4, y + 58, { width: tagW - 8, align: 'center' })
      doc.font('Helvetica').fontSize(10).fillColor('#374151')
         .text(rank, x + 4, y + 82, { width: tagW - 8, align: 'center' })
      doc.fontSize(9).fillColor('#6b7280')
         .text(affiliation, x + 4, y + 98, { width: tagW - 8, align: 'center' })

      // Bottom: conference theme (thin indigo bar)
      doc.rect(x + 4, y + tagH - 30, tagW - 8, 22).fill('#f5f3ff')
      doc.fillColor('#6366f1').font('Helvetica-Oblique').fontSize(8)
         .text(`"${conferenceInfo.theme || conferenceInfo.subtitle || ''}"`, x + 6, y + tagH - 24, { width: tagW - 12, align: 'center' })
    })

    doc.end()
  })
}

export function generateCertificatePDF({ recipient, conference, kind }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 842, H = 595

    // Outer decorative border
    doc.rect(20, 20, W - 40, H - 40).lineWidth(3).stroke('#6366f1')
    doc.rect(30, 30, W - 60, H - 60).lineWidth(1).stroke('#a5b4fc')

    // Top: conference title
    doc.fillColor('#6366f1').font('Helvetica-Bold').fontSize(14)
       .text((conference.name || '').toUpperCase(), 60, 60, { width: W - 120, align: 'center' })
    doc.fontSize(10).fillColor('#64748b').font('Helvetica')
       .text(`${conference.venue || ''}${conference.city ? ' · ' + conference.city : ''}${conference.startDate ? ' · ' + new Date(conference.startDate).toLocaleDateString() : ''}`, 60, 82, { width: W - 120, align: 'center' })

    // Certificate title
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(36)
       .text(kind === 'PRESENTATION' ? 'Certificate of Presentation' : 'Certificate of Attendance', 60, 140, { width: W - 120, align: 'center' })

    // "This is to certify that"
    doc.fillColor('#475569').font('Helvetica-Oblique').fontSize(14)
       .text('This is to certify that', 60, 220, { width: W - 120, align: 'center' })

    // Recipient name
    const displayName = [recipient.prefix, recipient.fullName || `${recipient.firstName || ''} ${recipient.lastName || ''}`].filter(Boolean).join(' ')
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(30)
       .text(displayName, 60, 250, { width: W - 120, align: 'center' })

    // Description
    const description = kind === 'PRESENTATION'
      ? `has presented "${recipient.abstractTitle || 'a paper'}" at the above conference.`
      : recipient.mode === 'VIRTUAL'
        ? 'has attended the above conference virtually.'
        : 'has attended the above conference in person.'
    doc.fillColor('#334155').font('Helvetica').fontSize(14)
       .text(description, 80, 300, { width: W - 160, align: 'center' })

    // Rank / Affiliation
    if (recipient.rank || recipient.affiliation) {
      doc.fillColor('#64748b').fontSize(12)
         .text(`${recipient.rank || ''}${recipient.rank && recipient.affiliation ? ' · ' : ''}${recipient.affiliation || ''}`, 60, 340, { width: W - 120, align: 'center' })
    }

    // Theme
    doc.fillColor('#6366f1').font('Helvetica-Oblique').fontSize(11)
       .text(`"${conference.theme || conference.subtitle || ''}"`, 60, 400, { width: W - 120, align: 'center' })

    // Signature lines
    doc.moveTo(120, H - 100).lineTo(320, H - 100).lineWidth(1).stroke('#334155')
    doc.moveTo(W - 320, H - 100).lineTo(W - 120, H - 100).stroke('#334155')
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(10)
       .text('Chief Editor', 120, H - 92, { width: 200, align: 'center' })
       .text('Conference Chair', W - 320, H - 92, { width: 200, align: 'center' })
    doc.font('Helvetica').fontSize(8).fillColor('#64748b')
       .text(`Issued: ${new Date().toLocaleDateString()}`, 60, H - 60, { width: W - 120, align: 'center' })

    doc.end()
  })
}

// ============ CONFERENCE BOOK PDF ============
export function generateConferenceBookPDF({ conference, book, abstracts = [], sessions = [], booths = [] }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60, bufferPages: true, autoFirstPage: false })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 595, H = 842
    const indigo = '#4f46e5', slate = '#334155', muted = '#64748b', accent = '#f5f3ff', gold = '#b45309'

    const heading = (text, size = 22, color = indigo) => {
      doc.moveDown(0.6)
      doc.fillColor(color).font('Helvetica-Bold').fontSize(size).text(text, { align: 'left' })
      const y = doc.y + 2
      doc.moveTo(60, y).lineTo(W - 60, y).lineWidth(1).stroke(indigo)
      doc.moveDown(0.6)
    }
    const paragraph = (text, opts = {}) => {
      if (!text) return
      doc.fillColor(slate).font('Helvetica').fontSize(11).text(String(text), { align: 'justify', lineGap: 3, ...opts })
      doc.moveDown(0.4)
    }
    const bigSpacer = () => doc.moveDown(1.2)
    const addPage = () => doc.addPage({ size: 'A4', margin: 60 })
    const enabledMap = {}
    ;(book?.sections || []).forEach(s => { enabledMap[s.key] = !!s.enabled })
    const isEnabled = (k) => book?.sections ? enabledMap[k] !== false : true

    // ---------- COVER PAGE ----------
    addPage()
    doc.rect(0, 0, W, 320).fill(indigo)
    doc.rect(0, 320, W, 30).fill('#a78bfa')
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(30)
      .text(book?.coverTitle || conference?.name || 'Conference Book', 60, 100, { width: W - 120, align: 'center' })
    if (book?.coverSubtitle || conference?.subtitle) {
      doc.font('Helvetica-Oblique').fontSize(14).fillColor('#e0e7ff')
        .text(book?.coverSubtitle || conference?.subtitle, 60, 160, { width: W - 120, align: 'center' })
    }
    doc.font('Helvetica').fontSize(12).fillColor('#c7d2fe')
    const dateStr = conference?.startDate ? new Date(conference.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
    const endStr = conference?.endDate ? new Date(conference.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
    const dateLine = dateStr ? (endStr && endStr !== dateStr ? `${dateStr} — ${endStr}` : dateStr) : ''
    if (dateLine) doc.text(dateLine, 60, 210, { width: W - 120, align: 'center' })
    const venueLine = [conference?.venue, conference?.city, conference?.country].filter(Boolean).join(' · ')
    if (venueLine) doc.text(venueLine, 60, 232, { width: W - 120, align: 'center' })
    doc.rect(0, H - 60, W, 60).fill('#0f172a')
    doc.fillColor('#f1f5f9').font('Helvetica-Bold').fontSize(11)
      .text(`Official Conference Book · ${conference?.code || ''}`, 60, H - 42, { width: W - 120, align: 'center' })
    doc.font('Helvetica').fontSize(9).fillColor('#94a3b8')
      .text(`Issued ${new Date().toLocaleDateString('en-GB')}`, 60, H - 26, { width: W - 120, align: 'center' })

    // ---------- TABLE OF CONTENTS ----------
    addPage()
    heading('Table of Contents')
    const toc = []
    if (isEnabled('chiefGuest') && book?.chiefGuestMessage) toc.push('Message from the Chief Guest')
    if (isEnabled('chair') && book?.chairMessage) toc.push('Message from the Conference Chair')
    if (isEnabled('foreword') && book?.foreword) toc.push('Foreword')
    if (isEnabled('programme')) toc.push('Conference Programme')
    if (isEnabled('abstracts')) toc.push('Accepted Abstracts')
    if (isEnabled('sponsors') && booths.length > 0) toc.push('Sponsors & Exhibitors')
    if (isEnabled('acknowledgements') && book?.acknowledgements) toc.push('Acknowledgements')
    toc.forEach((t, i) => {
      doc.fillColor(slate).font('Helvetica').fontSize(13)
        .text(`${i + 1}.  ${t}`, { paragraphGap: 6 })
    })

    // ---------- CHIEF GUEST ----------
    if (isEnabled('chiefGuest') && book?.chiefGuestMessage) {
      addPage()
      heading('Message from the Chief Guest')
      if (book.chiefGuestName) {
        doc.font('Helvetica-Bold').fontSize(14).fillColor(slate).text(book.chiefGuestName)
        if (book.chiefGuestTitle) doc.font('Helvetica-Oblique').fontSize(11).fillColor(muted).text(book.chiefGuestTitle)
        bigSpacer()
      }
      paragraph(book.chiefGuestMessage)
    }

    // ---------- CHAIR ----------
    if (isEnabled('chair') && book?.chairMessage) {
      addPage()
      heading('Message from the Conference Chair')
      if (book.chairName) {
        doc.font('Helvetica-Bold').fontSize(14).fillColor(slate).text(book.chairName)
        if (book.chairTitle) doc.font('Helvetica-Oblique').fontSize(11).fillColor(muted).text(book.chairTitle)
        bigSpacer()
      }
      paragraph(book.chairMessage)
    }

    // ---------- FOREWORD ----------
    if (isEnabled('foreword') && book?.foreword) {
      addPage()
      heading('Foreword')
      paragraph(book.foreword)
    }

    // ---------- PROGRAMME ----------
    if (isEnabled('programme')) {
      addPage()
      heading('Conference Programme')
      if (sessions.length === 0) {
        doc.fillColor(muted).font('Helvetica-Oblique').fontSize(11).text('The programme will be finalised closer to the conference.')
      } else {
        sessions.forEach(s => {
          const startD = new Date(s.startTime)
          const endD = new Date(s.endTime)
          doc.fillColor(indigo).font('Helvetica-Bold').fontSize(13).text(s.title || 'Untitled Session')
          doc.fillColor(muted).font('Helvetica').fontSize(10)
            .text(`${startD.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${startD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${endD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${s.room ? ' · ' + s.room : ''}${s.chair ? ' · Chair: ' + s.chair : ''}`)
          if (s.items && s.items.length > 0) {
            s.items.forEach((it, i) => {
              const a = it.abstract
              if (!a) return
              doc.fillColor(slate).font('Helvetica').fontSize(10)
                .text(`   ${i + 1}.  ${a.title || 'Untitled'} (${a.submissionCode || ''})`, { lineGap: 1 })
            })
          }
          doc.moveDown(0.6)
        })
      }
    }

    // ---------- ABSTRACTS ----------
    if (isEnabled('abstracts')) {
      addPage()
      heading('Accepted Abstracts')
      if (abstracts.length === 0) {
        doc.fillColor(muted).font('Helvetica-Oblique').fontSize(11).text('No accepted abstracts yet.')
      } else {
        abstracts.forEach((a, i) => {
          if (i > 0) doc.moveDown(1)
          const startY = doc.y
          doc.rect(60, startY, W - 120, 22).fill(accent)
          doc.fillColor(indigo).font('Helvetica-Bold').fontSize(10)
            .text(`${a.submissionCode || ''}${a.presentationType && a.presentationType !== 'UNDECIDED' ? ' · ' + a.presentationType : ''}${a.theme?.name ? ' · ' + a.theme.name : ''}`, 66, startY + 6, { width: W - 132 })
          doc.y = startY + 30
          doc.fillColor(slate).font('Helvetica-Bold').fontSize(13).text(a.title || 'Untitled')
          const authorLine = (a.authors || []).map(au => `${au.fullName}${au.isCorresponding ? '*' : ''}`).join(', ')
          if (authorLine) doc.fillColor(muted).font('Helvetica-Oblique').fontSize(10).text(authorLine)
          const affLine = [...new Set((a.authors || []).map(au => au.affiliation).filter(Boolean))].join('; ')
          if (affLine) doc.fillColor(muted).font('Helvetica').fontSize(9).text(affLine)
          doc.moveDown(0.3)
          const latestVersion = a.versions && a.versions.length > 0 ? a.versions[0] : null
          const body = latestVersion?.body || ''
          if (body) {
            const trunc = body.length > 2500 ? body.slice(0, 2500) + '…' : body
            doc.fillColor(slate).font('Helvetica').fontSize(10).text(trunc, { align: 'justify', lineGap: 2 })
          }
          if (a.keywords && a.keywords.length > 0) {
            doc.moveDown(0.2)
            doc.fillColor(muted).font('Helvetica-Oblique').fontSize(9).text('Keywords: ' + a.keywords.join(', '))
          }
        })
      }
    }

    // ---------- SPONSORS ----------
    if (isEnabled('sponsors') && booths.length > 0) {
      addPage()
      heading('Sponsors & Exhibitors', 22, gold)
      booths.forEach((b, i) => {
        if (i > 0) doc.moveDown(0.6)
        const startY = doc.y
        doc.rect(60, startY, W - 120, 26).fill('#fef3c7')
        doc.fillColor(gold).font('Helvetica-Bold').fontSize(14)
          .text(b.sponsorName || 'Sponsor', 66, startY + 6, { width: W - 132 })
        doc.y = startY + 34
        if (b.companyType) doc.fillColor(muted).font('Helvetica-Oblique').fontSize(10).text(b.companyType)
        if (b.message) { doc.moveDown(0.2); doc.fillColor(slate).font('Helvetica').fontSize(10).text(b.message, { align: 'justify' }) }
        if (b.products) { doc.moveDown(0.2); doc.fillColor(slate).font('Helvetica').fontSize(10).text('Products / Services: ' + b.products) }
        const contactBits = [b.websiteUrl, b.contactEmail, b.contactPhone].filter(Boolean).join(' · ')
        if (contactBits) { doc.moveDown(0.2); doc.fillColor(indigo).font('Helvetica').fontSize(9).text(contactBits) }
      })
    }

    // ---------- ACKNOWLEDGEMENTS ----------
    if (isEnabled('acknowledgements') && book?.acknowledgements) {
      addPage()
      heading('Acknowledgements')
      paragraph(book.acknowledgements)
    }

    // ---------- PAGE NUMBERS ----------
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      if (i === range.start) continue
      const bottomY = H - 40
      doc.fillColor(muted).font('Helvetica').fontSize(9)
        .text(`${conference?.name || ''} · ${conference?.code || ''}`, 60, bottomY, { width: (W - 120) / 2, align: 'left', lineBreak: false })
      doc.text(`Page ${i - range.start} of ${range.count - 1}`, W / 2, bottomY, { width: (W - 120) / 2, align: 'right', lineBreak: false })
    }

    doc.end()
  })
}

// ============ PROGRAMME PDF ============
export function generateProgrammePDF({ conference, sessions = [] }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, autoFirstPage: true })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 595, H = 842
    const indigo = '#4f46e5', slate = '#334155', muted = '#64748b', softBg = '#f5f3ff'

    // Header banner
    doc.rect(0, 0, W, 90).fill(indigo)
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('CONFERENCE PROGRAMME', 50, 24, { width: W - 100 })
    doc.font('Helvetica').fontSize(11).fillColor('#e0e7ff').text(conference?.name || '', 50, 50, { width: W - 100 })
    const dateStr = conference?.startDate ? new Date(conference.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
    const endStr = conference?.endDate ? new Date(conference.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
    const dateLine = dateStr ? (endStr && endStr !== dateStr ? `${dateStr} — ${endStr}` : dateStr) : ''
    doc.fontSize(9).text(`${conference?.code || ''}${dateLine ? '  ·  ' + dateLine : ''}${conference?.venue ? '  ·  ' + conference.venue : ''}`, 50, 68, { width: W - 100 })

    doc.y = 110

    if (sessions.length === 0) {
      doc.fillColor(muted).font('Helvetica-Oblique').fontSize(11)
        .text('The programme will be finalised closer to the conference.', 50, doc.y, { width: W - 100, align: 'center' })
      doc.end()
      return
    }

    // Group sessions by day
    const dayGroups = {}
    sessions.forEach(s => {
      const d = new Date(s.startTime)
      const key = d.toISOString().slice(0, 10)
      if (!dayGroups[key]) dayGroups[key] = { date: d, sessions: [] }
      dayGroups[key].sessions.push(s)
    })
    const days = Object.entries(dayGroups).sort(([a], [b]) => a.localeCompare(b))

    days.forEach(([key, group], di) => {
      if (di > 0) doc.addPage()
      if (doc.y > H - 200) doc.addPage()

      // Day title bar
      doc.rect(50, doc.y, W - 100, 32).fill(softBg)
      doc.fillColor(indigo).font('Helvetica-Bold').fontSize(15)
        .text(group.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), 60, doc.y + 8, { width: W - 120 })
      doc.y += 42

      group.sessions.forEach(s => {
        // Session header
        if (doc.y > H - 100) doc.addPage()
        const startD = new Date(s.startTime)
        const endD = new Date(s.endTime)
        const timeLine = `${startD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${endD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

        // Time column
        doc.fillColor(indigo).font('Helvetica-Bold').fontSize(11).text(timeLine, 50, doc.y, { width: 100 })
        // Title & meta
        doc.fillColor(slate).font('Helvetica-Bold').fontSize(12).text(s.title || 'Session', 160, doc.y, { width: W - 210 })
        let metaY = doc.y
        const meta = [s.room && `Room: ${s.room}`, s.chair && `Chair: ${s.chair}`, s.theme?.name && `Theme: ${s.theme.name}`].filter(Boolean).join('  ·  ')
        if (meta) {
          doc.fillColor(muted).font('Helvetica-Oblique').fontSize(9).text(meta, 160, metaY, { width: W - 210 })
        }
        doc.moveDown(0.4)

        // Items
        if (s.items && s.items.length > 0) {
          s.items.forEach((it, ii) => {
            if (doc.y > H - 60) doc.addPage()
            const a = it.abstract
            if (!a) return
            doc.fillColor(muted).font('Helvetica').fontSize(9).text(`${it.durationMin || 15} min`, 160, doc.y, { width: 45, continued: true })
            doc.fillColor(slate).font('Helvetica-Bold').fontSize(10).text(`  ${a.submissionCode || ''}  `, { continued: true })
            doc.font('Helvetica').text(a.title || 'Untitled', { width: W - 210 - 45 })
            const authors = (a.authors || []).map(au => au.fullName).join(', ')
            if (authors) {
              doc.fillColor(muted).font('Helvetica-Oblique').fontSize(8).text(authors, 205, doc.y, { width: W - 255 })
            }
            doc.moveDown(0.2)
          })
        }

        // Separator
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(50, doc.y + 4).lineTo(W - 50, doc.y + 4).stroke()
        doc.moveDown(0.6)
      })
    })

    // Page numbers
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      const bottomY = H - 30
      doc.fillColor(muted).font('Helvetica').fontSize(8)
        .text(`${conference?.name || ''} · Programme`, 50, bottomY, { width: (W - 100) / 2, align: 'left', lineBreak: false })
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, W / 2, bottomY, { width: (W - 100) / 2, align: 'right', lineBreak: false })
    }

    doc.end()
  })
}

// ============ MERGED CONFERENCE PRESENTATION PDF ============
// Builds a single PDF combining, in programme order:
//   • Conference cover page
//   • For each session: a session divider page
//   • For each item in the sequence:
//       - "talk"    → cover (title + author photo + bio + time slot) + attached PDF slides
//       - "sponsor" → cover (title + sponsor logo + description + speaker bio + time slot)
//       - "break"   → single break slide (Tea/Lunch/etc + duration + time)
// Returns { pdfBytes: Uint8Array, slideIndex, totalPages }
export async function generateMergedConferencePDF({ conference, sequence = [], uploadDir = '/app/uploads' }) {
  const pdf = await PDFLibDocument.create()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvB = await pdf.embedFont(StandardFonts.HelveticaBold)
  const helvO = await pdf.embedFont(StandardFonts.HelveticaOblique)

  const indigo = rgb(0.31, 0.28, 0.9)
  const slate = rgb(0.20, 0.25, 0.33)
  const muted = rgb(0.42, 0.45, 0.50)
  const white = rgb(1, 1, 1)
  const soft = rgb(0.96, 0.95, 1)
  const paleIndigo = rgb(0.87, 0.9, 1)
  const amber = rgb(0.98, 0.71, 0.11)
  const rose = rgb(0.96, 0.42, 0.53)
  const emerald = rgb(0.20, 0.72, 0.51)

  const W = 595, H = 842 // A4 portrait

  const wrap = (page, text, opts) => {
    const { x, y, size, font, color, maxWidth, lineHeight = size + 4, maxLines = 999 } = opts
    const words = String(text || '').split(/\s+/).filter(Boolean)
    let line = '', cy = y, lines = 0
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      const width = font.widthOfTextAtSize(test, size)
      if (width > maxWidth && line) {
        page.drawText(line, { x, y: cy, size, font, color })
        cy -= lineHeight
        lines++
        if (lines >= maxLines - 1) { line = w + '…'; break }
        line = w
      } else {
        line = test
      }
    }
    if (line) page.drawText(line, { x, y: cy, size, font, color })
    return cy
  }

  const fmtDateRange = (a, b) => {
    if (!a) return ''
    const s = new Date(a).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    if (!b) return s
    const e = new Date(b).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    return s === e ? s : `${s} — ${e}`
  }
  const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const fmtDay = (d) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  const resolveUploadPath = (publicPath) => {
    if (!publicPath) return null
    const rel = publicPath.replace(/^\/api\/uploads\//, '')
    if (rel === publicPath) return null
    return path.join(uploadDir, rel)
  }

  // Compute a running clock so items without explicit startTime cascade from the
  // previous item's finish time. Anchor: conference.startDate 09:00 local, or now.
  const anchor = conference?.startDate ? new Date(conference.startDate) : new Date()
  anchor.setHours(9, 0, 0, 0)
  let clock = anchor
  const withTimes = sequence.map(it => {
    const dur = Math.max(1, Number(it.durationMin) || 15)
    let start = it.startTime ? new Date(it.startTime) : new Date(clock)
    if (isNaN(start.getTime())) start = new Date(clock)
    const end = new Date(start.getTime() + dur * 60_000)
    clock = end
    return { ...it, _start: start, _end: end, _durationMin: dur }
  })

  const totalTalks = withTimes.filter(i => i.type === 'talk').length
  const totalSponsors = withTimes.filter(i => i.type === 'sponsor').length
  const totalBreaks = withTimes.filter(i => i.type === 'break').length

  // ---------- CONFERENCE COVER ----------
  {
    const p = pdf.addPage([W, H])
    p.drawRectangle({ x: 0, y: H - 340, width: W, height: 340, color: indigo })
    p.drawRectangle({ x: 0, y: H - 360, width: W, height: 20, color: rgb(0.66, 0.55, 0.98) })
    p.drawText('OFFICIAL CONFERENCE PRESENTATION', { x: 60, y: H - 90, size: 11, font: helvB, color: paleIndigo })
    wrap(p, conference?.name || 'Conference', { x: 60, y: H - 140, size: 26, font: helvB, color: white, maxWidth: W - 120, lineHeight: 32, maxLines: 3 })
    if (conference?.subtitle) {
      p.drawText(String(conference.subtitle).slice(0, 90), { x: 60, y: H - 230, size: 13, font: helvO, color: paleIndigo, maxWidth: W - 120 })
    }
    const dr = fmtDateRange(conference?.startDate, conference?.endDate)
    if (dr) p.drawText(dr, { x: 60, y: H - 265, size: 12, font: helv, color: paleIndigo })
    const venue = [conference?.venue, conference?.city, conference?.country].filter(Boolean).join(' · ')
    if (venue) p.drawText(venue.slice(0, 100), { x: 60, y: H - 285, size: 11, font: helv, color: paleIndigo })

    p.drawText(`Presentations: ${totalTalks}`, { x: 60, y: 140, size: 11, font: helvB, color: slate })
    p.drawText(`Sponsor talks: ${totalSponsors}`, { x: 60, y: 120, size: 11, font: helvB, color: slate })
    p.drawText(`Scheduled breaks: ${totalBreaks}`, { x: 60, y: 100, size: 11, font: helvB, color: slate })
    p.drawText(`Generated ${new Date().toLocaleString('en-GB')}`, { x: 60, y: 60, size: 9, font: helv, color: muted })
    p.drawText(conference?.code || '', { x: W - 100, y: 60, size: 9, font: helvB, color: muted })
  }

  const slideIndex = []
  let lastSessionId = null
  let talkNo = 0

  const drawSessionDivider = (sessionTitle, timeLine) => {
    const sp = pdf.addPage([W, H])
    sp.drawRectangle({ x: 0, y: H / 2 - 100, width: W, height: 200, color: soft })
    sp.drawRectangle({ x: 60, y: H / 2 + 80, width: 60, height: 4, color: indigo })
    sp.drawText('SESSION', { x: 60, y: H / 2 + 55, size: 11, font: helvB, color: indigo })
    wrap(sp, sessionTitle || 'Untitled Session', { x: 60, y: H / 2 + 20, size: 22, font: helvB, color: slate, maxWidth: W - 120, lineHeight: 26, maxLines: 3 })
    sp.drawText(timeLine, { x: 60, y: H / 2 - 60, size: 12, font: helv, color: muted })
  }

  for (const it of withTimes) {
    if (it.type === 'talk') {
      const a = it.abstract
      if (!a) continue

      // Insert a session divider when session changes.
      if (it.sessionId && it.sessionId !== lastSessionId) {
        drawSessionDivider(it.sessionTitle, `${fmtDay(it._start)} · ${fmtTime(it._start)}`)
        lastSessionId = it.sessionId
      }

      talkNo++
      const startPage = pdf.getPageCount()

      // ---------- TALK COVER PAGE ----------
      const cp = pdf.addPage([W, H])
      cp.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: indigo })
      cp.drawText(a.submissionCode || '', { x: 40, y: H - 40, size: 12, font: helvB, color: white })
      cp.drawText(fmtDay(it._start), { x: W - 220, y: H - 40, size: 10, font: helv, color: white })
      cp.drawText(`${fmtTime(it._start)} – ${fmtTime(it._end)}`, { x: W - 220, y: H - 58, size: 9, font: helv, color: paleIndigo })
      if (a.presentationType && a.presentationType !== 'UNDECIDED') {
        cp.drawText(String(a.presentationType), { x: W - 220, y: H - 76, size: 9, font: helvB, color: paleIndigo })
      }

      wrap(cp, a.title || 'Untitled', { x: 40, y: H - 130, size: 20, font: helvB, color: slate, maxWidth: W - 80, lineHeight: 24, maxLines: 4 })

      let bioX = 40
      const photoPath = resolveUploadPath(a.authorPhotoPath)
      if (photoPath) {
        try {
          const bytes = await fs.readFile(photoPath)
          let img
          const ext = photoPath.toLowerCase()
          if (ext.endsWith('.png')) img = await pdf.embedPng(bytes)
          else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) img = await pdf.embedJpg(bytes)
          if (img) {
            const dims = img.scaleToFit(150, 200)
            cp.drawImage(img, { x: 40, y: H - 460, width: dims.width, height: dims.height })
            bioX = 40 + dims.width + 24
          }
        } catch { /* ignore missing photo */ }
      }

      const authors = (a.authors || []).map(au => `${au.fullName}${au.isCorresponding ? '*' : ''}`).filter(Boolean).join(', ')
      const affiliations = [...new Set((a.authors || []).map(au => au.affiliation).filter(Boolean))].join(', ')
      let cy = H - 260
      if (authors) { wrap(cp, authors, { x: bioX, y: cy, size: 13, font: helvB, color: slate, maxWidth: W - bioX - 40, lineHeight: 16, maxLines: 3 }); cy -= 46 }
      if (affiliations) { wrap(cp, affiliations, { x: bioX, y: cy, size: 10, font: helvO, color: muted, maxWidth: W - bioX - 40, lineHeight: 13, maxLines: 3 }); cy -= 32 }

      if (a.biography) {
        cp.drawText('BIOGRAPHY', { x: bioX, y: cy, size: 9, font: helvB, color: indigo })
        cy -= 16
        wrap(cp, a.biography, { x: bioX, y: cy, size: 10, font: helv, color: slate, maxWidth: W - bioX - 40, lineHeight: 13, maxLines: 16 })
      }

      cp.drawRectangle({ x: 0, y: 0, width: W, height: 40, color: soft })
      cp.drawText(String(conference?.name || '').slice(0, 60), { x: 40, y: 15, size: 9, font: helv, color: muted, maxWidth: W - 200 })
      cp.drawText(`Talk ${talkNo} of ${totalTalks}`, { x: W - 160, y: 15, size: 9, font: helvB, color: indigo })

      // ---------- ATTACH PRESENTATION PDF ----------
      const presPath = resolveUploadPath(a.presentationPath)
      let attached = 0
      if (presPath && presPath.toLowerCase().endsWith('.pdf')) {
        try {
          const bytes = await fs.readFile(presPath)
          const src = await PDFLibDocument.load(bytes, { ignoreEncryption: true })
          const copied = await pdf.copyPages(src, src.getPageIndices())
          copied.forEach(pg => pdf.addPage(pg))
          attached = copied.length
        } catch {
          const fp = pdf.addPage([W, H])
          fp.drawText('Slides could not be loaded from the uploaded PDF.', { x: 60, y: H / 2, size: 12, font: helvO, color: muted, maxWidth: W - 120 })
          attached = 1
        }
      } else if (presPath) {
        const fp = pdf.addPage([W, H])
        fp.drawText('PowerPoint slide deck attached separately.', { x: 60, y: H / 2 + 30, size: 15, font: helvB, color: slate, maxWidth: W - 120 })
        fp.drawText('The presenter will share their screen live during the session.', { x: 60, y: H / 2 + 5, size: 11, font: helv, color: muted, maxWidth: W - 120 })
        fp.drawText('To include slides in this merged PDF, please upload as PDF format.', { x: 60, y: H / 2 - 15, size: 10, font: helvO, color: muted, maxWidth: W - 120 })
        attached = 1
      } else {
        const fp = pdf.addPage([W, H])
        fp.drawText('No presentation slides uploaded for this talk yet.', { x: 60, y: H / 2, size: 12, font: helvO, color: muted, maxWidth: W - 120 })
        attached = 1
      }

      const endPage = pdf.getPageCount() - 1
      slideIndex.push({
        itemId: it.id,
        type: 'talk',
        abstractId: a.id,
        submissionCode: a.submissionCode || '',
        title: a.title || 'Untitled',
        authors,
        sessionId: it.sessionId || null,
        sessionTitle: it.sessionTitle || '',
        startTime: it._start.toISOString(),
        endTime: it._end.toISOString(),
        presentationType: a.presentationType || 'UNDECIDED',
        coverPage: startPage + 1,
        firstSlidePage: startPage + 2,
        endPage: endPage + 1,
        slideCount: attached,
      })
    }

    else if (it.type === 'sponsor') {
      const startPage = pdf.getPageCount()
      const b = it.booth
      const sponsorName = it.sponsorName || b?.sponsorName || 'Sponsor'
      const cp = pdf.addPage([W, H])
      // Header band
      cp.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: amber })
      cp.drawText('SPONSOR TALK', { x: 40, y: H - 40, size: 12, font: helvB, color: white })
      cp.drawText(fmtDay(it._start), { x: W - 220, y: H - 40, size: 10, font: helv, color: white })
      cp.drawText(`${fmtTime(it._start)} – ${fmtTime(it._end)} · ${it._durationMin} min`, { x: W - 220, y: H - 58, size: 9, font: helv, color: white })

      // Sponsor logo (from booth) top-right of body
      let bodyX = 40
      const logoPath = resolveUploadPath(b?.logoPath)
      if (logoPath) {
        try {
          const bytes = await fs.readFile(logoPath)
          let img
          if (logoPath.toLowerCase().endsWith('.png')) img = await pdf.embedPng(bytes)
          else img = await pdf.embedJpg(bytes)
          if (img) {
            const dims = img.scaleToFit(140, 140)
            cp.drawImage(img, { x: W - 40 - dims.width, y: H - 250, width: dims.width, height: dims.height })
          }
        } catch { /* ignore */ }
      }

      // Sponsor name badge
      wrap(cp, sponsorName, { x: 40, y: H - 130, size: 18, font: helvB, color: amber, maxWidth: W - 220, lineHeight: 22, maxLines: 2 })

      // Talk title
      wrap(cp, it.title || 'Sponsor talk', { x: 40, y: H - 180, size: 22, font: helvB, color: slate, maxWidth: W - 220, lineHeight: 26, maxLines: 3 })

      // Speaker
      if (it.speakerName) {
        cp.drawText('Speaker', { x: 40, y: H - 270, size: 9, font: helvB, color: amber })
        wrap(cp, it.speakerName, { x: 40, y: H - 288, size: 13, font: helvB, color: slate, maxWidth: W - 80, lineHeight: 16, maxLines: 2 })
      }

      // Description
      let dy = H - 340
      if (it.description) {
        cp.drawText('ABOUT THIS TALK', { x: 40, y: dy, size: 9, font: helvB, color: amber })
        dy -= 16
        dy = wrap(cp, it.description, { x: 40, y: dy, size: 10, font: helv, color: slate, maxWidth: W - 80, lineHeight: 13, maxLines: 8 })
        dy -= 20
      }

      // Speaker bio
      if (it.speakerBio) {
        cp.drawText('SPEAKER BIOGRAPHY', { x: 40, y: dy, size: 9, font: helvB, color: amber })
        dy -= 16
        wrap(cp, it.speakerBio, { x: 40, y: dy, size: 10, font: helv, color: slate, maxWidth: W - 80, lineHeight: 13, maxLines: 12 })
      }

      // Footer
      cp.drawRectangle({ x: 0, y: 0, width: W, height: 40, color: soft })
      cp.drawText(String(conference?.name || '').slice(0, 60), { x: 40, y: 15, size: 9, font: helv, color: muted })
      cp.drawText('SPONSORED', { x: W - 100, y: 15, size: 9, font: helvB, color: amber })

      slideIndex.push({
        itemId: it.id,
        type: 'sponsor',
        title: it.title || 'Sponsor talk',
        sponsorName,
        speakerName: it.speakerName || '',
        startTime: it._start.toISOString(),
        endTime: it._end.toISOString(),
        coverPage: startPage + 1,
        firstSlidePage: startPage + 1,
        endPage: pdf.getPageCount(),
        slideCount: 1,
      })
    }

    else if (it.type === 'break') {
      const startPage = pdf.getPageCount()
      const bp = pdf.addPage([W, H])
      const kind = String(it.kind || 'tea').toLowerCase()
      const isLunch = kind === 'lunch'
      const isCoffee = kind === 'coffee' || kind === 'tea'
      const bg = isLunch ? rose : (isCoffee ? emerald : muted)
      bp.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg })
      const emojiLabel = isLunch ? 'LUNCH BREAK' : (kind === 'tea' ? 'TEA BREAK' : (kind === 'coffee' ? 'COFFEE BREAK' : (kind === 'networking' ? 'NETWORKING BREAK' : 'BREAK')))
      // Big centred heading
      const label = String(it.title || emojiLabel).toUpperCase()
      const labelWidth = helvB.widthOfTextAtSize(label, 40)
      bp.drawText(label, { x: Math.max(30, (W - labelWidth) / 2), y: H / 2 + 20, size: 40, font: helvB, color: white })
      const sub = `${fmtTime(it._start)} – ${fmtTime(it._end)}  ·  ${it._durationMin} min`
      const subW = helv.widthOfTextAtSize(sub, 16)
      bp.drawText(sub, { x: (W - subW) / 2, y: H / 2 - 40, size: 16, font: helv, color: white })
      bp.drawText('Please return to the auditorium in time for the next session.', {
        x: 60, y: 60, size: 10, font: helvO, color: white, maxWidth: W - 120,
      })
      slideIndex.push({
        itemId: it.id,
        type: 'break',
        kind,
        title: label,
        startTime: it._start.toISOString(),
        endTime: it._end.toISOString(),
        coverPage: startPage + 1,
        firstSlidePage: startPage + 1,
        endPage: pdf.getPageCount(),
        slideCount: 1,
      })
    }
  }

  const pdfBytes = await pdf.save()
  return { pdfBytes, slideIndex, totalPages: pdf.getPageCount() }
}
