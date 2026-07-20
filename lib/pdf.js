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
