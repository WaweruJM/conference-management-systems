// ─────────────────────────────────────────────────────────────────────────────
// Kenya Army ranks — full names + shorthand
// Used by:
//   • the registration form (autocomplete list)
//   • name-tag / certificate PDF generators (shorthand conversion)
// ─────────────────────────────────────────────────────────────────────────────

// Ordered from lowest → highest (junior to senior). Order is significant for
// the autocomplete list so users see private → general as they scroll.
export const KDF_ARMY_RANKS = [
  // Enlisted / other ranks
  { full: 'Private',              short: 'Pte' },
  { full: 'Lance Corporal',       short: 'LCpl' },
  { full: 'Corporal',             short: 'Cpl' },
  { full: 'Sergeant',             short: 'Sgt' },
  { full: 'Staff Sergeant',       short: 'SSgt' },
  { full: 'Warrant Officer II',   short: 'WO2' },
  { full: 'Warrant Officer I',    short: 'WO1' },
  { full: 'Senior Warrant Officer', short: 'SWO' },

  // Junior officers
  { full: 'Second Lieutenant',    short: '2Lt' },
  { full: 'Lieutenant',           short: 'Lt' },
  { full: 'Captain',              short: 'Capt' },

  // Field officers
  { full: 'Major',                short: 'Maj' },
  { full: 'Lieutenant Colonel',   short: 'Lt Col' },
  { full: 'Colonel',              short: 'Col' },

  // General officers
  { full: 'Brigadier',            short: 'Brig' },
  { full: 'Major General',        short: 'Maj Gen' },
  { full: 'Lieutenant General',   short: 'Lt Gen' },
  { full: 'General',              short: 'Gen' },
]

// O(1) lookup map — full name → shorthand (case-insensitive)
const _shortMap = KDF_ARMY_RANKS.reduce((acc, r) => {
  acc[r.full.toLowerCase()] = r.short
  // Common alternate spellings / abbreviations users might type
  acc[r.short.toLowerCase()] = r.short
  return acc
}, {})

/**
 * Convert a full rank string to its shorthand.
 * Returns the input unchanged if it doesn't match a known KDF rank
 * (defensive — supports civilian titles like "Dr." falling through).
 *
 * Examples:
 *   abbreviateRank('Major')                 → 'Maj'
 *   abbreviateRank('Lieutenant Colonel')    → 'Lt Col'
 *   abbreviateRank('maj')                   → 'Maj'
 *   abbreviateRank('Consultant Physician')  → 'Consultant Physician' (unchanged)
 *   abbreviateRank(null)                    → ''
 */
export function abbreviateRank(input) {
  if (!input || typeof input !== 'string') return ''
  const trimmed = input.trim()
  if (!trimmed) return ''
  return _shortMap[trimmed.toLowerCase()] || trimmed
}

/**
 * True if the given rank string matches a known KDF Army rank
 * (indicates the person selected "In service" at registration).
 */
export function isKdfRank(input) {
  if (!input || typeof input !== 'string') return false
  return !!_shortMap[input.trim().toLowerCase()]
}

// Flat string array — convenient for HTML <datalist> options
export const KDF_ARMY_RANK_NAMES = KDF_ARMY_RANKS.map(r => r.full)
