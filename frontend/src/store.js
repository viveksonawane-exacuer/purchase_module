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
export function confirmBox({ title, message, confirmText = 'Confirm', type = 'emphasized', input = null, inputType = 'textarea', value = '', min = null, details = null }) {
  return new Promise((resolve) => {
    state.dialog = { title, message, confirmText, type, input, inputType, value, min, details, resolve }
  })
}

const KEY = 'procure.theme'
const ACCENT_KEY = 'procure.accent'
export function setTheme(t) {
  state.theme = t
  document.documentElement.dataset.theme = t
  try {
    localStorage.setItem(KEY, t)
  } catch {}
  applyAccent()
}
export function initTheme() {
  let t = null
  let a = null
  try {
    t = localStorage.getItem(KEY)
    a = localStorage.getItem(ACCENT_KEY)
  } catch {}
  if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  if (a && /^#[0-9a-f]{6}$/i.test(a)) state.accent = a.toLowerCase()
  setTheme(t)
}

// ---- accent colour -------------------------------------------------------
// The whole brand palette (buttons, links, focus, selection, charts, hero glow) is derived
// from one accent colour per light/dark mode, with contrast kept readable. High Contrast
// keeps its fixed accessible palette.
export const DEFAULT_ACCENT = '#0070f2'
export const ACCENTS = [
  { name: 'Horizon Blue', hex: '#0070f2' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Green', hex: '#15803d' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Slate', hex: '#475569' },
]
state.accent = DEFAULT_ACCENT

export function setAccent(hex) {
  state.accent = (hex || DEFAULT_ACCENT).toLowerCase()
  try {
    state.accent === DEFAULT_ACCENT ? localStorage.removeItem(ACCENT_KEY) : localStorage.setItem(ACCENT_KEY, state.accent)
  } catch {}
  applyAccent()
}

const VARS = ['--brand', '--brand-2', '--brand-hover', '--brand-soft', '--brand-text', '--link', '--focus', '--surface-select',
  '--chart', '--chart-muted', '--tile-grad', '--hero-grad']
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const mix = (a, b, t) => hex(rgb(a).map((v, i) => v * (1 - t) + rgb(b)[i] * t)) // t = share of b
function lum(h) {
  const [r, g, b] = rgb(h).map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
function toward(c, target, bg, ratio) {
  // nudge c toward target (black/white) until it reaches `ratio` contrast against bg
  for (let t = 0; t <= 1; t += 0.04) {
    const x = mix(c, target, t)
    if (contrast(x, bg) >= ratio) return x
  }
  return target
}
function hueShift(h, deg) {
  let [r, g, b] = rgb(h).map((v) => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  let hh = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    hh = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    hh /= 6
  }
  hh = (hh + deg / 360 + 1) % 1
  const f = (n) => {
    const k = (n + hh * 12) % 12
    const a = s * Math.min(l, 1 - l)
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))
  }
  return hex([f(0), f(8), f(4)])
}

export function applyAccent() {
  const st = document.documentElement.style
  const a = state.accent
  VARS.forEach((v) => st.removeProperty(v))
  if (state.theme === 'hcb' || !a || a === DEFAULT_ACCENT) return // built-in palettes
  const W = '#ffffff', K = '#000000'
  const v = {}
  if (state.theme === 'dark') {
    const S = '#1d232a', BG = '#12171c'
    const brand = toward(a, W, S, 4.5)
    v['--brand'] = brand
    v['--brand-2'] = toward(hueShift(a, 40), W, S, 3)
    v['--brand-hover'] = mix(brand, W, 0.18)
    v['--brand-soft'] = mix(S, a, 0.22)
    v['--brand-text'] = contrast(brand, BG) >= 4.5 ? BG : W
    v['--link'] = brand
    v['--focus'] = mix(brand, W, 0.45)
    v['--surface-select'] = mix(S, a, 0.28)
    v['--chart'] = brand
    v['--chart-muted'] = mix(S, a, 0.38)
    v['--tile-grad'] = `linear-gradient(135deg, ${S} 0%, ${S} 60%, ${mix(S, a, 0.14)} 100%)`
    v['--hero-grad'] = `radial-gradient(1200px 300px at 10% -40%, ${mix(BG, a, 0.32)} 0%, transparent 60%), radial-gradient(900px 260px at 90% -60%, ${mix(BG, v['--brand-2'], 0.22)} 0%, transparent 55%)`
  } else {
    // mid/dark accents carry white text (deepened just enough for 4.5:1); very light ones carry dark text
    const whiteText = contrast(a, W) >= 2.5
    const brand = whiteText ? toward(a, K, W, 4.5) : a
    v['--brand'] = brand
    v['--brand-2'] = hueShift(a, 40)
    v['--brand-hover'] = mix(brand, K, 0.1)
    v['--brand-soft'] = mix(W, a, 0.08)
    v['--brand-text'] = whiteText ? W : '#1d2d3e'
    v['--link'] = toward(a, K, W, 4.5)
    v['--focus'] = toward(a, K, W, 7)
    v['--surface-select'] = mix(W, a, 0.1)
    v['--chart'] = brand
    v['--chart-muted'] = mix(W, a, 0.3)
    v['--tile-grad'] = `linear-gradient(135deg, ${W} 0%, ${W} 60%, ${mix(W, a, 0.06)} 100%)`
    v['--hero-grad'] = `radial-gradient(1200px 300px at 10% -40%, ${mix(W, a, 0.2)} 0%, transparent 60%), radial-gradient(900px 260px at 90% -60%, ${mix(W, v['--brand-2'], 0.14)} 0%, transparent 55%)`
  }
  for (const [k, val] of Object.entries(v)) st.setProperty(k, val)
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
