// Universal search helpers shared by every search box in the portal.

// Column types (config.js) that hold searchable text vs numbers
export const TEXT_TYPES = new Set([undefined, 'title', 'data', 'link', 'select', 'status', 'text', 'user'])
export const NUM_TYPES = new Set(['money', 'number', 'percent'])

// Server-side: Frappe `or_filters` matching a term against the document number, every
// text-like column of a module, its extra `searchFields`, and numeric columns when the
// term is a number.
export function moduleOrFilters(m, term) {
  const q = (term || '').trim()
  if (!q) return []
  const text = new Set(['name', ...m.columns.filter((c) => TEXT_TYPES.has(c.type)).map((c) => c.field), ...(m.searchFields || [])])
  if (m.noStatus) text.delete('status')
  const out = [...text].map((f) => [f, 'like', `%${q}%`])
  const n = Number(q.replace(/,/g, ''))
  if (!Number.isNaN(n)) for (const c of m.columns) if (NUM_TYPES.has(c.type)) out.push([c.field, '=', n])
  return out
}

// Human-readable list of what a module's search covers (tooltip)
export function moduleSearchHint(m) {
  const labels = m.columns.filter((c) => TEXT_TYPES.has(c.type) || NUM_TYPES.has(c.type)).map((c) => c.label)
  if (!m.columns.some((c) => c.field === 'name')) labels.unshift(`${m.singular} number`)
  return `Searches: ${[...new Set(labels)].join(', ')}`
}

// Client-side: true when every word of `term` appears somewhere in the row's values
// (any field, any order, case-insensitive; numbers match with or without separators).
export function rowMatches(row, term, fields) {
  const words = (term || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const vals = (fields ? fields.map((f) => row?.[f]) : Object.values(row || {})).filter(
    (v) => v !== null && v !== undefined && typeof v !== 'object',
  )
  const hay = vals
    .map((v) => (typeof v === 'number' ? `${v} ${v.toLocaleString('en-IN')} ${v.toLocaleString('en-US')}` : String(v)))
    .join(' \u0001 ')
    .toLowerCase()
  return words.every((w) => hay.includes(w))
}
