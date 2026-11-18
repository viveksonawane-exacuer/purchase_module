<template>
  <div class="fcl" :class="{ two: hasDetail && !full, full: hasDetail && full }">
    <!-- ============ Begin column: List Report ============ -->
    <div class="fcl-col list-col">
      <div class="page" :class="{ compact: hasDetail }">
        <div class="dyn-header lr-header">
          <div class="breadcrumbs"><router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" /> {{ m.title }}</div>
          <div class="row wrap" style="gap: 0.75rem">
            <h1 class="page-title">{{ m.title }}</h1>
            <span class="dt-chip" title="DocType in ERPNext Desk"><Icon name="Layers" :size="12" /> {{ m.doctype }}</span>
            <div class="variant">
              <button class="btn btn-transparent btn-sm" @click="variantMenu = !variantMenu">
                {{ currentVariant || 'Standard' }}<span v-if="dirty">*</span>
                <Icon name="ChevronDown" :size="14" />
              </button>
              <div v-if="variantMenu" class="popover" @mouseleave="variantMenu = false">
                <div class="muted" style="padding: 0.375rem 0.625rem; font-size: 0.75rem; font-weight: 700">MY VIEWS</div>
                <button class="pop-item" @click="applyVariant(null)"><Icon name="Star" :size="14" /> Standard</button>
                <button v-for="v in variants" :key="v.name" class="pop-item" @click="applyVariant(v)">
                  <Icon name="Eye" :size="14" /> {{ v.name }}
                  <span class="spacer" />
                  <Icon name="X" :size="14" class="del" @click.stop="deleteVariant(v)" />
                </button>
                <hr />
                <button class="pop-item" @click="saveVariant"><Icon name="Save" :size="14" /> Save current view as…</button>
              </div>
            </div>
            <div class="spacer" />
            <router-link :to="`/insights/${m.key}`" class="btn btn-transparent" title="Analytics for this document type"><Icon name="TrendingUp" /> <span class="hide-sm">Dashboard</span></router-link>
            <router-link v-if="!m.form?.noCreate && can.create" :to="`/${m.key}/new`" class="btn btn-emphasized">
              <Icon name="Plus" /> Create {{ m.short }}
            </router-link>
            <button class="btn btn-transparent btn-icon" :title="showFilters ? 'Hide filter bar' : 'Show filter bar'" @click="showFilters = !showFilters">
              <Icon name="SlidersHorizontal" />
            </button>
          </div>

          <!-- Filter bar -->
          <div v-show="showFilters && !hasDetail" class="filterbar">
            <div class="field search-field">
              <label>Search</label>
              <div class="search-box">
                <Icon name="Search" :size="15" />
                <input v-model="search" class="input" :placeholder="`${m.short} number…`" @keydown.enter="reload" />
              </div>
            </div>
            <div v-for="f in m.filters" :key="f.field" class="field">
              <label>{{ f.label }}</label>
              <FieldInput :f="f" v-model="filterValues[f.field]" @select="reload" />
            </div>
            <div class="row fb-actions">
              <button class="btn btn-emphasized" @click="reload">Go</button>
              <button class="btn btn-transparent" @click="clearFilters">Clear</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="tabs" style="padding: 0 0.75rem">
            <button v-for="(t, i) in m.quickTabs" :key="t.label" :class="{ on: tab === i }" @click="setTab(i)">
              {{ t.label }}<span v-if="counts[i] !== undefined" class="count">{{ counts[i] }}</span>
            </button>
          </div>

          <div class="toolbar">
            <b>{{ m.title }} ({{ total }})</b>
            <span v-if="selected.size" class="muted">· {{ selected.size }} selected</span>
            <div class="spacer" />
            <button v-if="selectedDrafts.length && can.submit" class="btn btn-sm btn-emphasized" @click="massSubmit">
              <Icon name="Check" /> Submit ({{ selectedDrafts.length }})
            </button>
            <button class="btn btn-sm btn-transparent" title="Export to CSV" @click="exportCsv"><Icon name="Download" /> <span class="hide-sm">Export</span></button>
            <div class="menu-wrap">
              <button class="btn btn-sm btn-transparent btn-icon" title="Table settings" @click="colMenu = !colMenu"><Icon name="Settings2" /></button>
              <div v-if="colMenu" class="popover" @mouseleave="colMenu = false">
                <div class="muted" style="padding: 0.375rem 0.625rem; font-size: 0.75rem; font-weight: 700">COLUMNS</div>
                <label v-for="c in m.columns" :key="c.field" class="pop-item">
                  <input type="checkbox" class="cbx" :checked="!hidden.has(c.field)" :disabled="c.type === 'title'" @change="toggleCol(c.field)" />
                  {{ c.label }}
                </label>
              </div>
            </div>
            <button class="btn btn-sm btn-transparent btn-icon" title="Refresh" @click="reload"><Icon name="RefreshCw" /></button>
          </div>

          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th class="chk"><input type="checkbox" class="cbx" :checked="allSelected" aria-label="Select all" @change="toggleAll" /></th>
                  <th v-for="c in visibleCols" :key="c.field" class="sortable" :class="{ num: c.type === 'money' }" @click="sortBy(c.field)">
                    {{ c.label }}
                    <Icon v-if="sort.field === c.field" :name="sort.dir === 'asc' ? 'ChevronDown' : 'ChevronDown'" :size="12" :style="{ transform: sort.dir === 'asc' ? 'rotate(180deg)' : '' }" />
                  </th>
                  <th class="nav" />
                </tr>
              </thead>
              <tbody>
                <template v-if="loading && !rows.length">
                  <tr v-for="i in 6" :key="i"><td :colspan="visibleCols.length + 2"><div class="skeleton" style="height: 1.25rem" /></td></tr>
                </template>
                <tr
                  v-for="r in rows"
                  :key="r.name"
                  class="clickable"
                  :class="{ selected: selected.has(r.name), active: activeName === r.name }"
                  @click="open(r)"
                >
                  <td class="chk" @click.stop><input type="checkbox" class="cbx" :checked="selected.has(r.name)" @change="toggle(r.name)" /></td>
                  <td v-for="c in visibleCols" :key="c.field" :class="{ num: c.type === 'money' }">
                    <CellValue :col="c" :row="r" />
                  </td>
                  <td class="nav"><Icon name="ChevronRight" :size="16" /></td>
                </tr>
              </tbody>
            </table>
            <div v-if="!loading && !rows.length" class="empty">
              <Icon :name="m.icon" />
              <div style="font-weight: 600; color: var(--text)">No {{ m.title.toLowerCase() }} found</div>
              <div>Try adjusting filters, or create a new one.</div>
            </div>
          </div>
          <div v-if="rows.length < total" class="more">
            <button class="btn btn-transparent" :disabled="loading" @click="loadMore">More <span class="muted">[{{ rows.length }} / {{ total }}]</span></button>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ Mid column: Object Page ============ -->
    <div v-if="hasDetail" class="fcl-col detail-col">
      <router-view v-slot="{ Component }">
        <Transition name="detail" appear>
          <component :is="Component" :key="route.params.name" in-fcl :full="full" @changed="reload" @toggle-full="toggleFull" @close="closeDetail" />
        </Transition>
      </router-view>
    </div>
  </div>
</template>

<script setup>
import { computed, provide, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import CellValue from '../components/CellValue.vue'
import FieldInput from '../components/FieldInput.vue'
import Icon from '../components/Icon.vue'
import { MODULES } from '../config'
import { confirmBox, state, toast } from '../store'

const props = defineProps({ module: String })
const route = useRoute()
const router = useRouter()
const m = computed(() => MODULES[props.module])
const can = computed(() => state.boot?.can?.[m.value.doctype] || {})

const rows = ref([])
const total = ref(0)
const counts = ref({})
const loading = ref(false)
const search = ref('')
const filterValues = reactive({})
const tab = ref(+route.query.tab || 0)
const sort = reactive({ field: 'modified', dir: 'desc' })
const selected = ref(new Set())
const showFilters = ref(innerWidth > 720)
const variantMenu = ref(false)
const colMenu = ref(false)
const PAGE = 25

const hasDetail = computed(() => !!route.params.name)
const activeName = computed(() => route.params.name && decodeURIComponent(route.params.name))
const full = computed(() => route.query.full === '1')

// --- per-viewer persisted settings (columns, variants) ---
const store = (k, v) => { try { v === undefined ? null : localStorage.setItem(`procure.${m.value.key}.${k}`, JSON.stringify(v)) } catch {} }
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(`procure.${m.value.key}.${k}`)) ?? d } catch { return d } }
const hidden = ref(new Set(load('hidden', [])))
const variants = ref(load('variants', []))
const currentVariant = ref(null)
const dirty = ref(false)

const visibleCols = computed(() => {
  const cols = m.value.columns.filter((c) => !hidden.value.has(c.field))
  if (hasDetail.value && !full.value) return cols.filter((c) => ['title', 'status'].includes(c.type) || c.field === m.value.columns[1].field)
  return cols
})
function toggleCol(f) {
  const s = new Set(hidden.value)
  s.has(f) ? s.delete(f) : s.add(f)
  hidden.value = s
  store('hidden', [...s])
}

function buildFilters(tabIndex = tab.value) {
  const f = [...(m.value.baseFilters || []), ...(m.value.quickTabs[tabIndex]?.filters || [])]
  if (state.boot?.company && !m.value.noCompany) f.push(['company', '=', state.boot.company])
  for (const def of m.value.filters) {
    const v = filterValues[def.field]
    if (v === undefined || v === '' || v === null) continue
    f.push([def.field, def.op || '=', v])
  }
  if (search.value.trim()) f.push(['name', 'like', `%${search.value.trim()}%`])
  return f
}
const fields = computed(() => {
  const s = new Set(['name', 'docstatus', ...(m.value.noStatus ? [] : ['status']), 'modified', ...m.value.columns.map((c) => c.field)])
  if (m.value.noStatus) s.delete('status')
  if (m.value.hasCurrency) s.add('currency')
  return [...s]
})

async function fetchRows(start = 0) {
  loading.value = true
  try {
    const filters = buildFilters()
    const [data, count] = await Promise.all([
      api.getList(m.value.doctype, { fields: fields.value, filters, order_by: `${sort.field} ${sort.dir}`, start, limit: PAGE }),
      start ? Promise.resolve(total.value) : api.getCount(m.value.doctype, filters),
    ])
    rows.value = start ? [...rows.value, ...data] : data
    total.value = count
  } finally {
    loading.value = false
  }
}
async function fetchCounts() {
  const out = {}
  await Promise.all(
    m.value.quickTabs.map(async (_, i) => {
      out[i] = await api.getCount(m.value.doctype, buildFilters(i)).catch(() => undefined)
    }),
  )
  counts.value = out
}
function reload() {
  selected.value = new Set()
  dirty.value = !!currentVariant.value
  fetchRows(0)
  fetchCounts()
}
const loadMore = () => fetchRows(rows.value.length)
function setTab(i) {
  tab.value = i
  router.replace({ query: { ...route.query, tab: i || undefined } })
  fetchRows(0)
}
function sortBy(f) {
  if (sort.field === f) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc'
  else Object.assign(sort, { field: f, dir: 'desc' })
  fetchRows(0)
}
function clearFilters() {
  for (const k of Object.keys(filterValues)) filterValues[k] = ''
  search.value = ''
  reload()
}

// --- variants ---
function saveVariant() {
  variantMenu.value = false
  confirmBox({ title: 'Save View', message: 'Saves the current filters, tab and sort order.', input: 'View name', confirmText: 'Save' }).then((name) => {
    if (!name || name === true) return
    const v = { name, filters: { ...filterValues }, search: search.value, tab: tab.value, sort: { ...sort } }
    variants.value = [...variants.value.filter((x) => x.name !== name), v]
    store('variants', variants.value)
    currentVariant.value = name
    dirty.value = false
    toast(`View "${name}" saved`)
  })
}
function applyVariant(v) {
  variantMenu.value = false
  for (const k of Object.keys(filterValues)) filterValues[k] = ''
  if (v) {
    Object.assign(filterValues, v.filters)
    search.value = v.search || ''
    tab.value = v.tab || 0
    Object.assign(sort, v.sort)
  } else {
    search.value = ''
    tab.value = 0
    Object.assign(sort, { field: 'modified', dir: 'desc' })
  }
  currentVariant.value = v?.name || null
  reload()
  dirty.value = false
}
function deleteVariant(v) {
  variants.value = variants.value.filter((x) => x.name !== v.name)
  store('variants', variants.value)
  if (currentVariant.value === v.name) currentVariant.value = null
}

// --- selection & mass actions ---
const allSelected = computed(() => rows.value.length && rows.value.every((r) => selected.value.has(r.name)))
function toggle(n) {
  const s = new Set(selected.value)
  s.has(n) ? s.delete(n) : s.add(n)
  selected.value = s
}
function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(rows.value.map((r) => r.name))
}
const selectedDrafts = computed(() => rows.value.filter((r) => selected.value.has(r.name) && r.docstatus === 0))
async function massSubmit() {
  const list = selectedDrafts.value
  const ok = await confirmBox({ title: 'Submit Documents', message: `Submit ${list.length} draft ${m.value.title.toLowerCase()}?`, confirmText: 'Submit' })
  if (!ok) return
  let done = 0
  for (const r of list) {
    try {
      await api.runAction(m.value.doctype, r.name, 'submit')
      done++
    } catch { /* error toast shown by api */ }
  }
  if (done) toast(`${done} of ${list.length} submitted`)
  reload()
}
function exportCsv() {
  const cols = visibleCols.value
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [cols.map((c) => esc(c.label)).join(','), ...rows.value.map((r) => cols.map((c) => esc(r[c.field])).join(','))]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  a.download = `${m.value.key}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

// --- FCL navigation ---
function open(r) {
  router.push({ path: `/${m.value.key}/${encodeURIComponent(r.name)}`, query: { tab: route.query.tab } })
}
function toggleFull() {
  router.replace({ query: { ...route.query, full: full.value ? undefined : '1' } })
}
// prev/next navigation for the object page; loads the next page of rows when needed
provide('docNav', {
  names: computed(() => rows.value.map((r) => r.name)),
  go: async (name) => {
    open({ name })
    const i = rows.value.findIndex((r) => r.name === name)
    if (i >= rows.value.length - 2 && rows.value.length < total.value) loadMore()
  },
})
function closeDetail() {
  router.push({ path: `/${m.value.key}`, query: { tab: route.query.tab } })
}

watch(
  () => props.module,
  () => {
    tab.value = +route.query.tab || 0
    for (const k of Object.keys(filterValues)) delete filterValues[k]
    // deep links like /po?supplier=X pre-fill the filter bar
    for (const f of m.value.filters) if (route.query[f.field]) filterValues[f.field] = route.query[f.field]
    hidden.value = new Set(load('hidden', []))
    variants.value = load('variants', [])
    currentVariant.value = null
    reload()
  },
  { immediate: true },
)
</script>

<style scoped>
.fcl { display: flex; min-height: calc(100vh - var(--shell-h)); }
/* split / full mode: each column is its own scroll container (no shared window scroll) */
.fcl.two, .fcl.full { height: calc(100vh - var(--shell-h)); min-height: 0; overflow: hidden; }
.fcl.two .fcl-col, .fcl.full .fcl-col { overflow-y: auto; overscroll-behavior: contain; scroll-behavior: auto; }
.fcl.two .list-col .page { padding-bottom: 2rem; }
.fcl.two .lr-header { position: sticky; top: 0; z-index: 5; }
.fcl-col { min-width: 0; }
.list-col { flex: 1; }
.fcl.two .list-col { flex: 0 0 34%; max-width: 34rem; border-right: 1px solid var(--border-soft); }
.fcl.two .detail-col { flex: 1; }
.fcl.full .list-col { display: none; }
.fcl.full .detail-col { flex: 1; }
.page.compact { padding: 1rem; }
.page.compact :deep(.tbl .title) { white-space: nowrap; }
.page.compact :deep(.tbl td) { padding: 0.625rem 0.5rem; }
.page.compact .filterbar { grid-template-columns: 1fr; }
@media (max-width: 1100px) {
  .fcl.two .list-col { display: none; }
}
.lr-header { padding-bottom: 1rem; }
.filterbar {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
  gap: 0.75rem 1rem; margin-top: 1rem; align-items: end;
}
.search-box { position: relative; }
.search-box svg { position: absolute; left: 0.625rem; top: 50%; transform: translateY(-50%); color: var(--text-3); }
.search-box .input { padding-left: 2rem; }
.fb-actions { justify-content: flex-end; }
.toolbar { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-soft); flex-wrap: wrap; }
.more { display: flex; justify-content: center; padding: 0.5rem; border-top: 1px solid var(--border-soft); }
.variant, .menu-wrap { position: relative; }
.popover {
  position: absolute; left: 0; top: calc(100% + 0.25rem); z-index: 50; min-width: 15rem;
  background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-3); padding: 0.375rem;
}
.menu-wrap .popover { left: auto; right: 0; }
.popover hr { border: 0; border-top: 1px solid var(--border-soft); margin: 0.25rem 0; }
.pop-item {
  width: 100%; display: flex; gap: 0.5rem; align-items: center; padding: 0.5rem 0.625rem;
  border: 0; background: none; color: var(--text); font: inherit; border-radius: 0.375rem; cursor: pointer; text-align: left;
}
.pop-item:hover { background: var(--surface-hover); }
.del { color: var(--text-3); }
.dt-chip { display: inline-flex; align-items: center; gap: 0.3125rem; height: 1.5rem; padding: 0 0.5rem; border-radius: 0.375rem; background: var(--neutral-bg); color: var(--text-2); font-size: 0.75rem; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.del:hover { color: var(--negative); }
@media (max-width: 560px) { .hide-sm { display: none; } }
</style>
