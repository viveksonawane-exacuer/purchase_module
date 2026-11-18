// Desk form semantics for the meta-driven portal forms:
// depends_on evaluation, defaults, validation, fetch_from and merging server previews.
import { api } from '../api'
import { state, today } from '../store'

export const NUMERIC = new Set(['Int', 'Float', 'Currency', 'Percent', 'Rating', 'Duration'])
export const TEXTAREA = new Set(['Small Text', 'Text', 'Long Text', 'Code', 'Text Editor', 'HTML Editor', 'Markdown Editor', 'JSON'])
// fields Desk never lets users type into
const SYSTEM = new Set(['name', 'owner', 'creation', 'modified', 'modified_by', 'idx', 'parent', 'parentfield', 'parenttype', 'docstatus', 'doctype', '__islocal', '__unsaved', 'amended_from'])

export const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)

// ---- depends_on: "fieldname", "eval:doc.x && doc.y > 0", "fn:..." (unsupported -> shown) ----
const helpers = {
  in_list: (list, v) => (list || []).includes(v),
  cint: (v) => parseInt(v, 10) || 0,
  flt: (v) => parseFloat(v) || 0,
  cstr: (v) => (v == null ? '' : String(v)),
  is_null: (v) => v === null || v === undefined || v === '',
}
const frappeStub = {
  session: { get user() { return state.boot?.user } },
  user: { has_role: (r) => (state.boot?.roles || []).includes(r) },
  boot: { sysdefaults: {} },
  datetime: { get_today: today, nowdate: today },
  defaults: { get_user_default: (k) => (k?.toLowerCase() === 'company' ? state.boot?.company : undefined) },
  meta: { has_field: () => true },
}
const cache = new Map()
export function evalDepends(expr, doc, parent) {
  if (!expr) return true
  expr = String(expr).trim()
  if (expr.startsWith('eval:')) {
    let fn = cache.get(expr)
    if (!fn) {
      try {
        // eslint-disable-next-line no-new-func
        fn = new Function('doc', 'parent', 'frappe', 'erpnext', 'in_list', 'cint', 'flt', 'cstr', 'is_null', `return (${expr.slice(5)});`)
      } catch {
        fn = () => true
      }
      cache.set(expr, fn)
    }
    try {
      return !!fn(doc || {}, parent || {}, frappeStub, {}, helpers.in_list, helpers.cint, helpers.flt, helpers.cstr, helpers.is_null)
    } catch {
      return true
    }
  }
  if (expr.startsWith('fn:')) return true
  return !isEmpty(doc?.[expr])
}

export const isVisible = (df, doc, parent) => evalDepends(df.depends_on, doc, parent)
export const isRequired = (df, doc, parent) => !!df.reqd || (df.mandatory_depends_on ? evalDepends(df.mandatory_depends_on, doc, parent) : false)
export const isReadOnly = (df, doc, parent) => !!df.read_only || (df.read_only_depends_on ? evalDepends(df.read_only_depends_on, doc, parent) : false)

// ---- defaults ----
export function defaultValue(df) {
  const d = df.default
  if (d === undefined || d === null || d === '') return df.fieldtype === 'Check' ? 0 : undefined
  const s = String(d)
  if (/^today$/i.test(s)) return today()
  if (/^now$/i.test(s)) return df.fieldtype === 'Datetime' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : new Date().toTimeString().slice(0, 8)
  if (s === '__user') return state.boot?.user
  if (s.startsWith(':')) return s.slice(1).toLowerCase() === 'company' ? state.boot?.company : undefined
  if (NUMERIC.has(df.fieldtype) || df.fieldtype === 'Check') return +s || 0
  if (df.fieldtype === 'Select' && !(df.options || '').split('\n').includes(s)) return undefined
  return s
}
export function applyDefaults(fields, doc) {
  for (const df of fields) {
    if (df.fieldtype === 'Table' || !isEmpty(doc[df.fieldname])) continue
    const v = defaultValue(df)
    if (v !== undefined) doc[df.fieldname] = v
  }
  // Selects with no default fall back to their first option, like Desk
  for (const df of fields) {
    if (df.fieldtype === 'Select' && isEmpty(doc[df.fieldname])) {
      const first = (df.options || '').split('\n')[0]
      if (first) doc[df.fieldname] = first
    }
  }
  return doc
}

// ---- helpers over the layout ----
export function flatFields(meta) {
  const out = []
  for (const t of meta?.tabs || []) for (const s of t.sections) for (const c of s.columns) for (const f of c) out.push({ ...f, _tab: t.fieldname, _section: s })
  return out
}

/** Missing mandatory values (visible fields only), header and child rows. */
export function validate(meta, doc, ignoreTables = new Set()) {
  const errs = []
  for (const df of flatFields(meta)) {
    if (!isVisible(df, doc) || !evalDepends(df._section.depends_on, doc)) continue
    if (df.fieldtype === 'Table') {
      if (ignoreTables.has(df.fieldname)) continue
      const rows = doc[df.fieldname] || []
      if (df.reqd && !rows.length) errs.push({ field: df.fieldname, tab: df._tab, label: `${df.label}: add at least one row` })
      const cm = meta.children?.[df.options]
      rows.forEach((r, i) => {
        if (isBlankRow(r, cm)) return
        for (const cf of cm?.fields || []) {
          if (isRequired(cf, r, doc) && isVisible(cf, r, doc) && isEmpty(r[cf.fieldname]) && cf.fieldtype !== 'Table')
            errs.push({ field: df.fieldname, tab: df._tab, row: i, label: `${df.label} row ${i + 1}: ${cf.label} is required` })
        }
      })
      continue
    }
    if (isRequired(df, doc) && isEmpty(doc[df.fieldname]) && !isReadOnly(df, doc)) errs.push({ field: df.fieldname, tab: df._tab, label: `${df.label} is required` })
  }
  return errs
}

/** A row the user never touched (only defaults) is ignored, like Desk's empty grid rows. */
export function isBlankRow(r, cm) {
  const key = cm?.list_view?.[0]
  if (key && isEmpty(r[key])) return true
  return false
}

// ---- fetch_from (e.g. supplier -> supplier_name) ----
export async function applyFetch(fields, target, df, value) {
  const deps = fields.filter((f) => f.fetch_from && f.fetch_from.split('.')[0] === df.fieldname)
  if (!deps.length) return
  if (!value) {
    deps.forEach((f) => !f.fetch_if_empty && (target[f.fieldname] = NUMERIC.has(f.fieldtype) ? 0 : ''))
    return
  }
  const src = [...new Set(deps.map((f) => f.fetch_from.split('.')[1]))]
  const vals = (await api.fetchValues(df.options, value, src).catch(() => null)) || {}
  if (target[df.fieldname] !== value) return // changed meanwhile
  for (const f of deps) {
    const v = vals[f.fetch_from.split('.')[1]]
    if (v === undefined) continue
    if (f.fetch_if_empty && !isEmpty(target[f.fieldname])) continue
    target[f.fieldname] = v
  }
}

// fields the user typed into, per doc / row object (user input always wins over the server)
const touched = new WeakMap()
export function markTouched(obj, field) {
  if (!touched.has(obj)) touched.set(obj, new Set())
  touched.get(obj).add(field)
}
export function resetTouched(obj, keep = []) {
  const t = touched.get(obj)
  if (t) for (const f of [...t]) if (!keep.includes(f)) t.delete(f)
}
const isTouched = (obj, f) => !!touched.get(obj)?.has(f)

/** Merge a server preview into the local doc: fill empty values and refresh calculated
 *  (read-only) fields; never overwrite what the user typed. */
export function mergePreview(meta, doc, res) {
  if (!res) return
  const byName = Object.fromEntries(flatFields(meta).map((f) => [f.fieldname, f]))
  mergeInto(byName, doc, res, (df) => {
    const cm = meta.children?.[df.options]
    const childBy = Object.fromEntries((cm?.fields || []).map((f) => [f.fieldname, f]))
    const local = doc[df.fieldname] || []
    const remote = res[df.fieldname] || []
    if (!local.length && remote.length && df.fieldname !== 'items') {
      // server added rows (e.g. taxes from a template)
      doc[df.fieldname] = remote.map((r) => clean(r))
      return
    }
    local.forEach((row, i) => remote[i] && mergeInto(childBy, row, remote[i]))
  })
}
function clean(r) {
  const o = {}
  for (const [k, v] of Object.entries(r)) if (!SYSTEM.has(k) || k === 'name') o[k] = v
  delete o.name
  return o
}
function mergeInto(byName, target, src, onTable) {
  for (const [k, v] of Object.entries(src)) {
    if (SYSTEM.has(k) || k.startsWith('_')) continue
    const df = byName[k]
    if (!df) continue
    if (df.fieldtype === 'Table') {
      onTable?.(df)
      continue
    }
    if (Array.isArray(v) || (v && typeof v === 'object')) continue
    if ((df.read_only || !isTouched(target, k)) && target[k] !== v) target[k] = v
  }
}
