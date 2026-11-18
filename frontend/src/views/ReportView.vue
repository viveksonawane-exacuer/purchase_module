<template>
  <div class="page rv">
    <div class="dyn-header">
      <div class="breadcrumbs">
        <router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" />
        <router-link :to="`/reports?group=${info.group || ''}`">Reports</router-link><Icon name="ChevronRight" :size="12" />
        {{ name }}
      </div>
      <div class="row wrap">
        <span class="hd-ico"><Icon :name="info.icon || 'BarChart3'" :size="20" /></span>
        <div style="min-width: 0">
          <h1 class="page-title">{{ name }}</h1>
          <div class="muted row wrap" style="gap: 0.5rem; font-size: 0.8125rem">
            <span>{{ info.desc }}</span>
          </div>
        </div>
        <div class="spacer" />
        <a class="btn btn-transparent" :href="`/app/query-report/${encodeURIComponent(name)}`" target="_blank" title="Open in ERP Desk"><Icon name="ExternalLink" /> <span class="hide-sm">Desk</span></a>
        <button class="btn btn-transparent" :disabled="!rows.length" @click="exportCsv"><Icon name="Download" /> <span class="hide-sm">Export</span></button>
        <button class="btn btn-emphasized" :disabled="loading" @click="run"><Icon name="RefreshCw" :class="{ spin: loading }" /> {{ loading ? 'Running…' : 'Run Report' }}</button>
      </div>

      <!-- Filters -->
      <div v-if="ready" class="filters">
        <div v-for="f in primary" :key="f.fieldname" class="field">
          <label :class="{ req: f.reqd }">{{ f.label }}</label>
          <DocField :df="f" :model-value="values[f.fieldname]" :doc="values" @update:model-value="setFilter(f, $event)" @select="onSelectFilter" />
        </div>
        <div class="f-actions">
          <button v-if="advanced.length" class="btn btn-transparent btn-sm" @click="more = !more">
            <Icon name="SlidersHorizontal" :size="14" /> {{ more ? 'Fewer filters' : `More filters (${advanced.length})` }}<span v-if="advancedSet" class="count">{{ advancedSet }}</span>
          </button>
          <button class="btn btn-transparent btn-sm" @click="reset">Reset</button>
        </div>
        <div class="more-wrap" :class="{ open: more }">
          <div class="more-inner">
            <div v-for="f in advanced" :key="f.fieldname" class="field">
              <label>{{ f.label }}</label>
              <DocField :df="f" :model-value="values[f.fieldname]" :doc="values" @update:model-value="setFilter(f, $event)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="strip-err"><Icon name="TriangleAlert" :size="16" /> <span>{{ error }}</span></div>

    <!-- Summary -->
    <div v-if="summary.length" class="sum-row">
      <div v-for="(s, i) in summary" :key="i" class="sum-card spot" :class="s.indicator" :style="{ '--i': i }">
        <span class="k">{{ s.label }}</span>
        <span class="v"><AnimatedNumber v-if="typeof s.value === 'number'" :value="s.value" :format="s.fmt" /><template v-else>{{ s.value }}</template></span>
      </div>
    </div>

    <!-- Chart -->
    <section v-if="res?.chart?.data?.labels?.length" class="card sec">
      <div class="card-header"><h3>{{ res.chart.title || 'Chart' }}</h3><div class="spacer" /><button class="btn btn-sm btn-transparent" @click="showChart = !showChart">{{ showChart ? 'Hide' : 'Show' }}</button></div>
      <div v-if="showChart" class="card-body"><ReportChart :chart="res.chart" /></div>
    </section>

    <!-- Data -->
    <section class="card sec">
      <div class="toolbar">
        <b>{{ loading && !res ? 'Running report…' : `${fmtNum(filtered.length, 0)} row(s)` }}</b>
        <span v-if="res?.message" class="muted ell">· {{ plain(res.message) }}</span>
        <div class="spacer" />
        <div class="mini-search">
          <Icon name="Search" :size="14" />
          <input v-model="q" class="input compact" placeholder="Search in results…" />
        </div>
        <div class="menu-wrap">
          <button class="btn btn-sm btn-transparent btn-icon" title="Columns" @click="colMenu = !colMenu"><Icon name="Settings2" /></button>
          <div v-if="colMenu" class="popover" @mouseleave="colMenu = false">
            <div class="muted pop-title">COLUMNS</div>
            <label v-for="c in cols" :key="c.fieldname" class="pop-item"><input type="checkbox" class="cbx" :checked="!hidden.has(c.fieldname)" @change="toggleCol(c.fieldname)" /> {{ c.label }}</label>
          </div>
        </div>
      </div>
      <div class="table-wrap rv-table" :class="{ busy: loading && res }">
        <table class="tbl">
          <thead>
            <tr>
              <th v-for="c in visibleCols" :key="c.fieldname" class="sortable" :class="{ num: isNum(c) }" :style="{ minWidth: Math.min(c.width || 120, 260) + 'px' }" @click="sortBy(c)">
                {{ c.label }}
                <Icon v-if="sort.key === c.fieldname" name="ChevronDown" :size="12" :style="{ transform: sort.dir > 0 ? 'rotate(180deg)' : '' }" />
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading && !res"><tr v-for="i in 8" :key="i"><td :colspan="visibleCols.length || 6"><div class="skeleton" style="height: 1.125rem" /></td></tr></template>
            <tr v-for="(r, i) in paged" :key="i" class="clickable" :class="{ total: r.__total, grp: r.indent === 0 && hasIndent, active: detail === r }" @click="detail = r">
              <td v-for="(c, ci) in visibleCols" :key="c.fieldname" :class="{ num: isNum(c), neg: isNum(c) && +r[c.fieldname] < 0 }" :style="ci === 0 && r.indent ? { paddingLeft: 0.75 + r.indent * 1.25 + 'rem' } : null">
                <router-link v-if="linkOf(c, r)" :to="linkOf(c, r)" @click.stop>{{ r[c.fieldname] }}</router-link>
                <template v-else>{{ cell(c, r) }}</template>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="res && !filtered.length" class="empty"><Icon name="Table2" /><div>No data for these filters.</div></div>
        <div v-if="!res && !loading && ready" class="empty"><Icon name="BarChart3" /><div>Set the filters and click <b>Run Report</b>.</div></div>
      </div>
      <div v-if="filtered.length > limit" class="more"><button class="btn btn-transparent" @click="limit += 200">Show more <span class="muted">[{{ limit }} / {{ filtered.length }}]</span></button></div>
    </section>

    <!-- Row detail drawer -->
    <Teleport to="body">
      <Transition name="rv-drawer">
        <div v-if="detail" class="rv-d" @click.self="detail = null" @keydown.esc="detail = null">
          <aside class="rv-panel" role="dialog" aria-label="Row details">
            <header>
              <div style="min-width: 0">
                <small class="muted">{{ name }} · row details</small>
                <h3 class="ell">{{ detailTitle }}</h3>
              </div>
              <div class="spacer" />
              <button class="btn btn-transparent btn-icon btn-sm" :disabled="detailIndex <= 0" title="Previous row" @click="stepDetail(-1)"><Icon name="ChevronLeft" :size="16" /></button>
              <button class="btn btn-transparent btn-icon btn-sm" :disabled="detailIndex >= filtered.length - 1" title="Next row" @click="stepDetail(1)"><Icon name="ChevronRight" :size="16" /></button>
              <button class="btn btn-transparent btn-icon btn-sm" title="Close" @click="detail = null"><Icon name="X" :size="18" /></button>
            </header>
            <dl class="rv-dl">
              <template v-for="c in cols" :key="c.fieldname">
                <template v-if="detail[c.fieldname] !== undefined && detail[c.fieldname] !== null && detail[c.fieldname] !== ''">
                  <dt>{{ c.label }}</dt>
                  <dd :class="{ num: isNum(c) }">
                    <router-link v-if="linkOf(c, detail)" :to="linkOf(c, detail)">{{ detail[c.fieldname] }}</router-link>
                    <a v-else-if="deskLink(c, detail)" :href="deskLink(c, detail)" target="_blank">{{ detail[c.fieldname] }} <Icon name="ExternalLink" :size="12" /></a>
                    <template v-else>{{ cell(c, detail) }}</template>
                  </dd>
                </template>
              </template>
            </dl>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { rowMatches } from '../search'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { api } from '../api'
import AnimatedNumber from '../components/AnimatedNumber.vue'
import DocField from '../components/DocField.vue'
import Icon from '../components/Icon.vue'
import ReportChart from '../components/ReportChart.vue'
import { BY_DOCTYPE, REPORT_BY_SLUG, REPORTS } from '../config'
import { fmtCompact, fmtDate, fmtMoney, fmtNum, state, toast } from '../store'
import FILTERS from '../reports.generated.json'

const props = defineProps({ report: String })
const name = computed(() => REPORT_BY_SLUG[props.report] || props.report)
const info = computed(() => REPORTS[name.value] || {})
const values = reactive({})
const ready = ref(false)
const more = ref(false)
const res = ref(null)
const loading = ref(false)
const error = ref('')
const q = ref('')
const sort = reactive({ key: null, dir: 1 })
const limit = ref(200)
const detail = ref(null)
const showChart = ref(true)
const colMenu = ref(false)
const hidden = ref(new Set())
let defaults = null

// MultiSelectList filters are shown as a single link picker
const MULTI_DOCTYPE = { warehouse: 'Warehouse', item_code: 'Item', account: 'Account', cost_center: 'Cost Center', project: 'Project', brand: 'Brand', supplier: 'Supplier', supplier_quotation: 'Supplier Quotation', name: 'Purchase Order', party: 'Supplier' }
const filterDefs = computed(() =>
  (FILTERS[name.value] || []).map((f) => {
    const df = { ...f }
    if (f.fieldtype === 'MultiSelectList') {
      df.fieldtype = MULTI_DOCTYPE[f.fieldname] || f.options ? 'Link' : 'Data'
      df.options = f.options && f.options !== 'select' ? f.options : MULTI_DOCTYPE[f.fieldname]
      df.multi = true
      if (!df.options) df.fieldtype = 'Data'
    }
    if (f.fieldtype === 'Autocomplete') {
      df.fieldtype = f.fieldname === 'party_type' ? 'Select' : 'Data'
      if (f.fieldname === 'party_type') df.options = '\nSupplier\nCustomer\nEmployee'
    }
    if (df.fieldtype === 'Link' && df.options && df.options !== 'Company' && ['Warehouse', 'Account', 'Cost Center', 'Project'].includes(df.options)) df.link_filters = { company: '$company' }
    return df
  }),
)
const primary = computed(() => {
  const defs = filterDefs.value
  const req = defs.filter((f) => f.reqd)
  const rest = defs.filter((f) => !f.reqd && f.fieldtype !== 'Check')
  return [...req, ...rest].slice(0, Math.max(5, req.length)).sort((a, b) => defs.indexOf(a) - defs.indexOf(b))
})
const advanced = computed(() => filterDefs.value.filter((f) => !primary.value.includes(f)))
const advancedSet = computed(() => advanced.value.filter((f) => values[f.fieldname] && values[f.fieldname] !== defaultFor(f)).length)

// ---- defaults (decoded from the Desk report script) ----
function iso(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
function defaultFor(f) {
  let d = f.default
  if (f.fieldname === 'fiscal_year') return defaults?.fiscal_year
  if (d === undefined || d === null) {
    if (f.fieldtype === 'Date' && FILTERS[name.value]?.some((x) => x.fieldname === 'fiscal_year')) return f.fieldname === 'from_date' ? defaults?.year_start : f.fieldname === 'to_date' ? defaults?.year_end : undefined
    if (f.fieldtype === 'Date' && (f.reqd || name.value === 'Purchase Analytics')) return f.fieldname === 'from_date' ? defaults?.year_start : f.fieldname === 'to_date' ? iso(new Date()) : undefined
    return undefined
  }
  d = String(d)
  if (d.startsWith('__DEFAULT__')) return /company/i.test(d) ? state.boot?.company : undefined
  if (d.startsWith('__DATE__')) {
    const now = new Date()
    if (d.includes('add_months')) {
      const n = parseInt(d.split(',').pop(), 10) || -1
      const x = new Date(now)
      x.setMonth(x.getMonth() + n)
      return iso(x)
    }
    if (d.includes('add_days')) {
      const x = new Date(now)
      x.setDate(x.getDate() + (parseInt(d.split(',').pop(), 10) || 0))
      return iso(x)
    }
    if (d.includes('month_start')) return iso(new Date(now.getFullYear(), now.getMonth(), 1))
    if (d.includes('year_start')) return defaults?.year_start || iso(new Date(now.getFullYear(), 0, 1))
    return iso(now)
  }
  if (f.fieldtype === 'Check') return +d || 0
  if (f.fieldtype === 'Select' && d === 'select') return undefined
  return d
}
function reset() {
  for (const k of Object.keys(values)) delete values[k]
  for (const f of filterDefs.value) {
    const v = defaultFor(f)
    if (v !== undefined) values[f.fieldname] = v
  }
  for (const f of filterDefs.value) if (f.fieldtype === 'Select' && values[f.fieldname] === undefined && f.reqd) values[f.fieldname] = String(f.options || '').split('\n').filter(Boolean)[0]
}
function setFilter(f, v) {
  values[f.fieldname] = v
}
function onSelectFilter() {
  /* link picked: user still clicks Run, like Desk with auto-refresh off */
}

// ---- run ----
async function run() {
  const missing = filterDefs.value.filter((f) => f.reqd && (values[f.fieldname] === undefined || values[f.fieldname] === ''))
  if (missing.length) return toast(`${missing[0].label} is required`, 'error')
  const filters = {}
  for (const f of filterDefs.value) {
    const v = values[f.fieldname]
    if (v === undefined || v === '' || v === null) continue
    filters[f.fieldname] = f.multi ? [v] : v
  }
  loading.value = true
  error.value = ''
  try {
    res.value = await api.runReport(name.value, filters)
    limit.value = 200
    detail.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// ---- columns & rows ----
function normCol(c, i) {
  if (typeof c === 'string') {
    const [label, type = 'Data', width] = c.split(':')
    const [fieldtype, options] = type.split('/')
    return { label, fieldname: `c${i}`, fieldtype: fieldtype || 'Data', options, width: +width || 120 }
  }
  return { ...c, fieldname: c.fieldname || c.id || `c${i}`, fieldtype: c.fieldtype || 'Data', label: c.label || c.fieldname }
}
const cols = computed(() => (res.value?.columns || []).map(normCol))
const visibleCols = computed(() => cols.value.filter((c) => !hidden.value.has(c.fieldname)))
const hasIndent = computed(() => rows.value.some((r) => r.indent > 0))
const rows = computed(() => {
  const data = res.value?.result || []
  const out = data.map((r) => (Array.isArray(r) ? Object.fromEntries(cols.value.map((c, i) => [c.fieldname, r[i]])) : r))
  if (res.value?.add_total_row && out.length) {
    const last = out[out.length - 1]
    out[out.length - 1] = { ...last, __total: true }
  }
  return out
})
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  let r = rows.value
  if (s) r = r.filter((x) => x.__total || rowMatches(x, s, cols.value.map((c) => c.fieldname)))
  if (sort.key) {
    const k = sort.key
    const body = r.filter((x) => !x.__total)
    const tot = r.filter((x) => x.__total)
    body.sort((a, b) => {
      const x = a[k]
      const y = b[k]
      if (typeof x === 'number' || typeof y === 'number') return ((+x || 0) - (+y || 0)) * sort.dir
      return String(x ?? '').localeCompare(String(y ?? '')) * sort.dir
    })
    r = [...body, ...tot]
  }
  return r
})
const paged = computed(() => filtered.value.slice(0, limit.value))
function sortBy(c) {
  if (sort.key === c.fieldname) sort.dir = -sort.dir
  else Object.assign(sort, { key: c.fieldname, dir: isNum(c) ? -1 : 1 })
}
function toggleCol(f) {
  const s = new Set(hidden.value)
  s.has(f) ? s.delete(f) : s.add(f)
  hidden.value = s
}

const isNum = (c) => ['Currency', 'Float', 'Int', 'Percent'].includes(c.fieldtype)
const plain = (s) => String(s || '').replace(/<[^>]+>/g, ' ').trim()
function cell(c, r) {
  const v = r[c.fieldname]
  if (v === undefined || v === null || v === '') return ''
  switch (c.fieldtype) {
    case 'Currency': return fmtMoney(+v, (c.options && r[c.options]) || (/^[A-Z]{3}$/.test(c.options || '') ? c.options : undefined) || r.currency)
    case 'Float': return fmtNum(+v, c.precision ? +c.precision : 2)
    case 'Int': return fmtNum(+v, 0)
    case 'Percent': return `${fmtNum(+v)}%`
    case 'Date': return fmtDate(v)
    case 'Check': return v ? 'Yes' : 'No'
    default: return plain(v)
  }
}
function linkDoctype(c, r) {
  if (c.fieldtype === 'Link') return c.options
  if (c.fieldtype === 'Dynamic Link') return r[c.options]
  return null
}
function linkOf(c, r) {
  const dt = linkDoctype(c, r)
  const m = dt && BY_DOCTYPE[dt]
  return m && r[c.fieldname] ? `/${m.key}/${encodeURIComponent(r[c.fieldname])}` : null
}
function deskLink(c, r) {
  const dt = linkDoctype(c, r)
  return dt && r[c.fieldname] ? `/app/${dt.toLowerCase().replace(/ /g, '-')}/${encodeURIComponent(r[c.fieldname])}` : null
}

// ---- summary cards: the report's own summary, else row count + key totals ----
const summary = computed(() => {
  if (!res.value) return []
  const rs = res.value.report_summary || []
  if (rs.length)
    return rs.slice(0, 6).map((s) => ({
      label: s.label,
      value: typeof s.value === 'number' ? s.value : s.value,
      fmt: s.datatype === 'Currency' ? (v) => fmtCompact(v, s.currency) : (v) => fmtNum(v),
      indicator: (s.indicator || '').toLowerCase(),
    }))
  const body = rows.value.filter((r) => !r.__total && !(r.indent > 0))
  const out = [{ label: 'Rows', value: body.length, fmt: (v) => fmtNum(v, 0) }]
  for (const c of cols.value.filter((x) => x.fieldtype === 'Currency').slice(0, 3)) {
    const total = rows.value.find((r) => r.__total)?.[c.fieldname] ?? body.reduce((a, r) => a + (+r[c.fieldname] || 0), 0)
    out.push({ label: c.label, value: +total || 0, fmt: (v) => fmtCompact(v) })
  }
  return out
})

// ---- row detail ----
const detailIndex = computed(() => filtered.value.indexOf(detail.value))
const detailTitle = computed(() => {
  const r = detail.value
  if (!r) return ''
  const c = cols.value.find((x) => ['Link', 'Dynamic Link', 'Data'].includes(x.fieldtype) && r[x.fieldname])
  return c ? plain(r[c.fieldname]) : `Row ${detailIndex.value + 1}`
})
function stepDetail(d) {
  const n = filtered.value[detailIndex.value + d]
  if (n) detail.value = n
}

function exportCsv() {
  const c = visibleCols.value
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [c.map((x) => esc(x.label)).join(','), ...filtered.value.map((r) => c.map((x) => esc(isNum(x) ? r[x.fieldname] : plain(r[x.fieldname]))).join(','))]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  a.download = `${props.report}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}
function onKey(e) {
  if (e.key === 'Escape' && detail.value) detail.value = null
}

async function init() {
  ready.value = false
  res.value = null
  error.value = ''
  hidden.value = new Set()
  Object.assign(sort, { key: null, dir: 1 })
  defaults = defaults || (await api.reportDefaults().catch(() => ({})))
  reset()
  ready.value = true
  run()
}
watch(() => props.report, init)
onMounted(() => {
  init()
  addEventListener('keydown', onKey)
})
onBeforeUnmount(() => removeEventListener('keydown', onKey))
</script>

<style scoped>
.rv { max-width: 1600px; margin: 0 auto; }
.hd-ico { width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--brand), var(--brand-2)); }
.spin { animation: vh-spin 0.8s linear infinite; }
.filters { display: grid; grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr)); gap: 0.875rem 1rem; margin-top: 1.25rem; align-items: end; }
.f-actions { display: flex; gap: 0.25rem; align-items: center; justify-content: flex-end; grid-column: -2 / -1; }
.f-actions .count { margin-left: 0.25rem; padding: 0 0.375rem; border-radius: 1rem; background: var(--brand); color: var(--brand-text); font-size: 0.6875rem; }
.more-wrap { grid-column: 1 / -1; display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.32s var(--ease); }
.more-wrap.open { grid-template-rows: 1fr; }
.more-inner { overflow: hidden; display: grid; grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr)); gap: 0.875rem 1rem; align-items: end; }
.more-wrap.open .more-inner { padding-top: 0.25rem; overflow: visible; }

.strip-err { display: flex; align-items: center; gap: 0.625rem; padding: 0.75rem 1rem; margin-bottom: 1rem; border-radius: 0.625rem; background: var(--negative-bg); color: var(--negative); border: 1px solid color-mix(in srgb, var(--negative) 30%, transparent); }
.sum-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
.sum-card { overflow: hidden; display: flex; flex-direction: column; gap: 0.25rem; padding: 0.875rem 1rem; border-radius: var(--radius); background: var(--surface); border: 1px solid var(--border-soft); border-left: 3px solid var(--brand); animation: fade-up 0.35s var(--ease) both; animation-delay: calc(var(--i) * 50ms); }
.sum-card.green { border-left-color: var(--positive); }
.sum-card.red { border-left-color: var(--negative); }
.sum-card.orange { border-left-color: var(--critical); }
.sum-card .k { font-size: 0.75rem; font-weight: 600; color: var(--text-2); }
.sum-card .v { font-size: 1.375rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.sec { margin-bottom: 1rem; border: 1px solid var(--border-soft); box-shadow: none; overflow: visible; }
.toolbar { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-soft); flex-wrap: wrap; }
.ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 30rem; }
.mini-search { position: relative; width: 15rem; }
.mini-search svg { position: absolute; left: 0.5rem; top: 50%; transform: translateY(-50%); color: var(--text-3); }
.mini-search .input { padding-left: 1.75rem; }
.menu-wrap { position: relative; }
.popover { position: absolute; right: 0; top: calc(100% + 0.25rem); z-index: 50; min-width: 15rem; max-height: 22rem; overflow: auto; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-3); padding: 0.375rem; }
.pop-title { padding: 0.375rem 0.625rem; font-size: 0.75rem; font-weight: 700; }
.pop-item { width: 100%; display: flex; gap: 0.5rem; align-items: center; padding: 0.4375rem 0.625rem; border-radius: 0.375rem; cursor: pointer; }
.pop-item:hover { background: var(--surface-hover); }
.rv-table { max-height: calc(100vh - 14rem); transition: opacity 0.2s; }
.rv-table.busy { opacity: 0.5; }
.rv-table td { white-space: nowrap; max-width: 22rem; overflow: hidden; text-overflow: ellipsis; }
.rv-table tr.total td { font-weight: 700; background: var(--surface-2); border-top: 2px solid var(--border); position: sticky; bottom: 0; }
.rv-table tr.grp td { font-weight: 700; }
.rv-table td.neg { color: var(--negative); }
.more { display: flex; justify-content: center; padding: 0.5rem; border-top: 1px solid var(--border-soft); }

/* row detail drawer */
.rv-d { position: fixed; inset: 0; z-index: 120; background: rgba(15, 23, 32, 0.35); display: flex; justify-content: flex-end; }
.rv-panel { width: min(30rem, 100vw); height: 100%; overflow-y: auto; background: var(--surface); box-shadow: -24px 0 48px -12px rgba(15, 23, 32, 0.35); }
.rv-panel header { position: sticky; top: 0; display: flex; align-items: center; gap: 0.25rem; padding: 1rem 1.25rem; background: var(--surface); background-image: var(--hero-grad); border-bottom: 1px solid var(--border-soft); }
.rv-panel h3 { font-size: 1.125rem; }
.rv-dl { display: grid; grid-template-columns: minmax(8rem, 40%) 1fr; margin: 0; padding: 0.5rem 1.25rem 1.5rem; }
.rv-dl dt, .rv-dl dd { padding: 0.625rem 0; border-bottom: 1px solid var(--border-soft); margin: 0; animation: rv-in 0.3s var(--ease) both; }
.rv-dl dt { color: var(--text-2); font-size: 0.8125rem; padding-right: 1rem; }
.rv-dl dd { font-weight: 600; word-break: break-word; }
.rv-dl dd.num { font-variant-numeric: tabular-nums; }
@keyframes rv-in { from { opacity: 0; transform: translateX(-8px); } }
.rv-drawer-enter-active, .rv-drawer-leave-active { transition: background 0.3s var(--ease); }
.rv-drawer-enter-active .rv-panel { transition: transform 0.45s cubic-bezier(0.32, 0.72, 0, 1); }
.rv-drawer-leave-active .rv-panel { transition: transform 0.25s ease-in; }
.rv-drawer-enter-from, .rv-drawer-leave-to { background: transparent; }
.rv-drawer-enter-from .rv-panel, .rv-drawer-leave-to .rv-panel { transform: translateX(100%); }
@media (max-width: 560px) { .hide-sm { display: none; } .mini-search { width: 100%; } }
</style>
