// ─────────────────────────────────────────────────────────────────────────────
// Word (.docx) generator for ACCEPTED abstracts.
//
// Layout (matches formal medical journal style requested for the conference book):
//
//   TITLE OF THE ABSTRACT IN CAPITAL LETTERS AND BOLD
//
//   Author One¹*, Author Two², Author Three¹
//   ¹ Affiliation One
//   ² Affiliation Two
//   *Corresponding author: author.one@example.org
//
//   BACKGROUND
//   ...body text...
//
//   METHODOLOGY
//   ...
//
// Uses the `docx` library (added to package.json as v2 dep).
// ─────────────────────────────────────────────────────────────────────────────

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat,
} from 'docx'

// Deterministic superscript numeral (¹ ² ³ …) — falls back to ordinary digits above 9.
const SUPS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']
function sup(n) {
  return String(n).split('').map(d => SUPS[parseInt(d, 10)] ?? d).join('')
}

// Turn the stored body (with ALL-CAPS headings) back into a structured sequence
// of paragraphs so we can emit each subsection under a bold heading.
function splitBodyBySections(body) {
  if (!body || !body.trim()) return []
  // Match all-caps heading lines that stand alone
  const lines = String(body).split(/\r?\n/)
  const out = []
  let currentHeading = ''
  let currentText = []
  const flush = () => {
    if (currentHeading || currentText.length) {
      out.push({ heading: currentHeading, body: currentText.join('\n').trim() })
    }
    currentHeading = ''
    currentText = []
  }
  for (const raw of lines) {
    const t = raw.trim()
    // Heading heuristic: all uppercase (allow spaces, slashes, "&", up to 60 chars)
    if (t && /^[A-Z0-9][A-Z0-9 &/\-.]{2,60}$/.test(t) && t === t.toUpperCase()) {
      flush()
      currentHeading = t
    } else {
      currentText.push(raw)
    }
  }
  flush()
  return out
}

/**
 * Build a docx Buffer for the given abstract record.
 *
 * @param {object} abstract   Prisma Abstract (with `authors` include)
 * @param {object} conference Prisma Conference row (for header — optional)
 * @returns {Promise<Buffer>}
 */
export async function generateAbstractDocx(abstract, conference = {}) {
  const authors = (abstract.authors || []).slice().sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
  )

  // Unique-affiliation numbering
  const affiliationMap = new Map() // affiliation string → number
  authors.forEach(a => {
    const aff = (a.affiliation || '').trim()
    if (aff && !affiliationMap.has(aff)) affiliationMap.set(aff, affiliationMap.size + 1)
  })

  // Author byline: "Doe J¹*, Smith K²"
  const authorRuns = []
  authors.forEach((a, i) => {
    if (i > 0) authorRuns.push(new TextRun({ text: ', ' }))
    const affNum = affiliationMap.get((a.affiliation || '').trim())
    const isPrincipal = i === 0
    authorRuns.push(new TextRun({ text: a.fullName || '' }))
    if (affNum) authorRuns.push(new TextRun({ text: sup(affNum), superScript: true }))
    if (isPrincipal) authorRuns.push(new TextRun({ text: '*', superScript: true, bold: true }))
  })

  const children = []

  // Optional discreet conference header
  if (conference.name) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: conference.name, italics: true, color: '4B5563', size: 18 })],
    }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '' })] }))
  }

  // Submission code (small, muted, right-aligned)
  if (abstract.submissionCode) {
    children.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: abstract.submissionCode, italics: true, color: '6B7280', size: 18 })],
    }))
  }

  // Title (ALL CAPS, bold)
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [new TextRun({
      text: (abstract.title || '').toUpperCase(),
      bold: true, size: 32,
    })],
  }))

  // Authors byline
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: authorRuns,
  }))

  // Affiliation list (each on its own line, superscript numeral + affiliation text)
  for (const [aff, num] of affiliationMap.entries()) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: sup(num), superScript: true }),
        new TextRun({ text: ' ' + aff, italics: true, size: 20 }),
      ],
    }))
  }

  // Corresponding author line
  const corresponding = authors.find(a => a.isCorresponding) || authors[0]
  if (corresponding?.email) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 240 },
      children: [
        new TextRun({ text: '*Corresponding author: ', bold: true, size: 20 }),
        new TextRun({ text: corresponding.email, size: 20 }),
      ],
    }))
  }

  // Keywords (small italic line under the byline block)
  if (abstract.keywords && abstract.keywords.length) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text: 'Keywords: ', bold: true, italics: true, size: 20 }),
        new TextRun({ text: abstract.keywords.join(', '), italics: true, size: 20 }),
      ],
    }))
  }

  // Body — each ALL-CAPS heading becomes a bold subsection heading; paragraphs
  // in-between are rendered as body prose.
  const latestBody = abstract.latestBody || abstract.body || ''
  const sections = splitBodyBySections(latestBody)
  if (sections.length === 0 && latestBody) {
    children.push(new Paragraph({ children: [new TextRun({ text: latestBody, size: 22 })] }))
  } else {
    for (const s of sections) {
      if (s.heading) {
        children.push(new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: s.heading, bold: true, size: 22 })],
        }))
      }
      // Split body into paragraphs on blank lines
      const paras = s.body.split(/\n\s*\n/).filter(Boolean)
      for (const p of paras) {
        children.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 100 },
          children: [new TextRun({ text: p.replace(/\n/g, ' '), size: 22 })],
        }))
      }
    }
  }

  // Disclosure statement (small print, if present)
  if (abstract.disclosureStatement) {
    children.push(new Paragraph({
      spacing: { before: 240 },
      children: [new TextRun({ text: 'Disclosure Statement', bold: true, italics: true, size: 20 })],
    }))
    children.push(new Paragraph({
      children: [new TextRun({ text: abstract.disclosureStatement, italics: true, size: 20 })],
    }))
  }

  const doc = new Document({
    creator: 'SCMS',
    title: abstract.title || 'Abstract',
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children,
    }],
  })

  return Packer.toBuffer(doc)
}
