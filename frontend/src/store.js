import { reactive } from 'vue'

export const state = reactive({
  boot: null,
  theme: 'light',
  toasts: [],
  dialog: null,
  sideCollapsed: false,
  pending: 0,
})

let tid = 0
export function toast(message, type = 'success', timeout = 4000) {
  const id = ++tid
  state.toasts.push({ id, message, type })
  setTimeout(() => {
    const i = state.toasts.findIndex((t) => t.id === id)
    if (i > -1) state.toasts.splice(i, 1)
  }, timeout)
}

/** Fiori MessageBox. Resolves with input value (or true) on confirm, null on cancel. */
export function confirmBox({ title, message, confirmText = 'Confirm', type = 'emphasized', input = null }) {
  return new Promise((resolve) => {
    state.dialog = { title, message, confirmText, type, input, value: '', resolve }
  })
}

const KEY = 'procure.theme'
export function setTheme(t) {
  state.theme = t
  document.documentElement.dataset.theme = t
  try {
    localStorage.setItem(KEY, t)
  } catch {}
}
export function initTheme() {
  let t = null
  try {
    t = localStorage.getItem(KEY)
  } catch {}
  if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  setTheme(t)
}

export function fmtMoney(v, currency) {
  const c = currency || state.boot?.currency || 'INR'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(v || 0)
  } catch {
    return `${c} ${(v || 0).toFixed(2)}`
  }
}
export function fmtCompact(v, currency) {
  const c = currency || state.boot?.currency || 'INR'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: c,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v || 0)
  } catch {
    return String(v)
  }
}
export function fmtNum(v, d = 2) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(v || 0)
}
export function fmtDate(v) {
  if (!v) return ''
  const d = new Date(String(v).replace(' ', 'T'))
  if (isNaN(d)) return v
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}
export function timeAgo(v) {
  const d = new Date(String(v).replace(' ', 'T'))
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`
  return fmtDate(v)
}
export function today() {
  return new Date().toISOString().slice(0, 10)
}
export function addDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function statusTone(status, docstatus) {
  const s = (status || '').toLowerCase()
  if (docstatus === 2 || /cancel|stopped|rejected|expired/.test(s)) return 'negative'
  if (docstatus === 0 || s === 'draft') return ''
  if (/overdue|hold|pending|partially|to receive|to bill|unpaid|to pay/.test(s)) return 'critical'
  if (/completed|paid|ordered|received|closed|submitted|delivered|transferred|issued|quoted|billed/.test(s))
    return s === 'closed' ? '' : 'positive'
  return 'info'
}
