// Central helper: role display, state colors, formatting
export const ROLE_LABELS = {
  SYSTEM_ADMIN: 'System Administrator',
  MANAGING_EDITOR: 'Managing Editor',
  COMMITTEE_MEMBER: 'Committee Editor',
  CHIEF_EDITOR: 'Chief Editor',
  COMMITTEE_EDITOR: 'Committee Editor',
  CHIEF_LOGISTICS: 'Chief Logistics',
  COMMITTEE_LOGISTICS: 'Committee Logistics',
  EXTERNAL_REVIEWER: 'Peer Reviewer',
  AUTHOR: 'Author',
  ATTENDEE: 'Attendee',
  GUEST: 'Guest',
  INDUSTRY_PARTNER: 'Sponsor / Industry Partner',
}

// Convert a Date | ISO-string into an ordinal-day format such as "18th March 2027".
// Returns the fallback string when input is falsy or invalid.
export function formatDate(input, fallback = '—') {
  if (!input) return fallback
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return fallback
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'long' })
  const year = d.getFullYear()
  const j = day % 10, k = day % 100
  const suffix = (k >= 11 && k <= 13) ? 'th'
    : j === 1 ? 'st'
    : j === 2 ? 'nd'
    : j === 3 ? 'rd'
    : 'th'
  return `${day}${suffix} ${month} ${year}`
}

// Convenience: "18th March 2027 – 19th March 2027" (or single date if end is falsy/same).
export function formatDateRange(start, end, fallback = '—') {
  if (!start) return fallback
  const startStr = formatDate(start, fallback)
  if (!end) return startStr
  const endStr = formatDate(end, fallback)
  if (startStr === endStr) return startStr
  return `${startStr} – ${endStr}`
}

export const STATE_COLORS = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-300',
  TECHNICAL_CHECK: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  RETURNED_FOR_FORMATTING: 'bg-amber-100 text-amber-800 border-amber-300',
  RESUBMITTED: 'bg-blue-100 text-blue-800 border-blue-300',
  EDITORIAL_ASSIGNMENT: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  COMMITTEE_REVIEW: 'bg-purple-100 text-purple-800 border-purple-300',
  EXTERNAL_PEER_REVIEW: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
  REVIEWS_COMPLETED: 'bg-teal-100 text-teal-800 border-teal-300',
  EDITORIAL_DECISION: 'bg-orange-100 text-orange-800 border-orange-300',
  MAJOR_REVISION: 'bg-rose-100 text-rose-800 border-rose-300',
  MINOR_REVISION: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  REVISION_SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-300',
  RE_REVIEW: 'bg-purple-100 text-purple-800 border-purple-300',
  FINAL_DECISION: 'bg-orange-100 text-orange-800 border-orange-300',
  ACCEPTED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  REJECTED: 'bg-red-100 text-red-800 border-red-300',
  WITHDRAWN: 'bg-neutral-200 text-neutral-700 border-neutral-300',
  ORAL: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  POSTER: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PRESENTATION_UPLOAD: 'bg-sky-100 text-sky-800 border-sky-300',
  PRESENTATION_REVIEW: 'bg-sky-100 text-sky-800 border-sky-300',
  PROGRAMME_SCHEDULING: 'bg-teal-100 text-teal-800 border-teal-300',
  FINAL_ACCEPTANCE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PUBLISHED: 'bg-green-100 text-green-800 border-green-300',
  ARCHIVED: 'bg-neutral-200 text-neutral-700 border-neutral-300',
}

export function stateLabel(s) {
  if (!s) return '—'
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

export const TIMELINE_STAGES = [
  { key: 'EDITORIAL_ASSIGNMENT', label: 'Editorial Assignment' },
  { key: 'TECHNICAL_CHECK', label: 'Technical Check' },
  { key: 'RETURNED_FOR_FORMATTING', label: 'Returned for Formatting' },
  { key: 'COMMITTEE_REVIEW', label: 'Committee Review' },
  { key: 'EXTERNAL_PEER_REVIEW', label: 'External Peer Review' },
  { key: 'REVIEWS_COMPLETED', label: 'Reviews Complete' },
  { key: 'MAJOR_REVISION', label: 'Revision Requested', altKeys: ['MINOR_REVISION'] },
  { key: 'REVISION_SUBMITTED', label: 'Revision Received' },
  { key: 'ACCEPTED', label: 'Accepted', altKeys: ['REJECTED'] },
  { key: 'PRESENTATION_UPLOAD', label: 'Presentation Uploaded' },
  { key: 'PROGRAMME_SCHEDULING', label: 'Scheduled' },
  { key: 'PUBLISHED', label: 'Conference Complete', altKeys: ['ARCHIVED'] },
]
