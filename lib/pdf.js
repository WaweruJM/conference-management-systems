// PDF generation helpers using pdfkit
import PDFDocument from 'pdfkit'

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
