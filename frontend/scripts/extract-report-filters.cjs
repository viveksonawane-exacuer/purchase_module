// Evaluate ERPNext report scripts against a stub `frappe` to read their filter definitions.
// Usage (from frontend/):  npm run report-filters
// Re-run after upgrading ERPNext; writes src/reports.generated.json.
const fs = require('fs'), vm = require('vm')
const DATE = '__DATE__'
const any = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? () => any() : any()), apply: () => any() })
const path = require('path')
const ERP = path.resolve(__dirname, '../../../erpnext/erpnext')
const files = require('../src/report-list.json').map((r) => {
  const slug = r.toLowerCase().replace(/[- ]/g, '_')
  for (const mod of ['buying', 'stock', 'accounts', 'selling', 'manufacturing']) {
    const f = path.join(ERP, mod, 'report', slug, slug + '.js')
    if (fs.existsSync(f)) return f
  }
  console.error('missing report script', r)
}).filter(Boolean)
const out = {}
for (const f of files) {
  const reports = {}
  const frappe = new Proxy({
    query_reports: reports,
    _: (s) => s, __: (s) => s,
    require: (a, cb) => cb && cb(),
    provide: () => {},
    datetime: new Proxy({}, { get: (t, k) => (...a) => `${DATE}:${String(k)}:${a.map((x) => (typeof x === 'string' || typeof x === 'number' ? x : '')).join(',')}` }),
    defaults: { get_user_default: (k) => `__DEFAULT__:${k}`, get_default: (k) => `__DEFAULT__:${k}`, get_global_default: (k) => `__DEFAULT__:${k}` },
    boot: any(), session: any(), user: any(), sys_defaults: any(),
  }, { get: (t, k) => (k in t ? t[k] : any()) })
  const ctx = { frappe, __: (s) => s, erpnext: any(), $: any(), cur_page: any(), console, window: {}, moment: any() }
  ctx.window = ctx
  try { vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { timeout: 2000 }) } catch (e) { console.error('ERR', f, e.message) }
  for (const [name, r] of Object.entries(reports)) {
    const filters = (r.filters || []).map((x) => {
      const o = {}
      for (const k of ['fieldname', 'label', 'fieldtype', 'options', 'default', 'reqd', 'depends_on']) {
        let v = x[k]
        if (typeof v === 'function' || (v && typeof v === 'object' && !Array.isArray(v))) v = undefined
        if (Array.isArray(v)) v = v.join('\n')
        if (v !== undefined && v !== '') o[k] = v
      }
      if (typeof x.get_query === 'function' || typeof x.get_data === 'function') o.dynamic = true
      return o
    }).filter((x) => x.fieldname)
    out[name] = filters
  }
}
fs.writeFileSync(path.resolve(__dirname, '../src/reports.generated.json'), JSON.stringify(out, null, 1) + '\n')
console.log('wrote filters for', Object.keys(out).length, 'reports')
