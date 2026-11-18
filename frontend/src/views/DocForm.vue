<template>
  <div class="page page-narrow">
    <div class="dyn-header">
      <div class="breadcrumbs">
        <router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" />
        <router-link :to="`/${m.key}`">{{ m.title }}</router-link><Icon name="ChevronRight" :size="12" />
        {{ isNew ? 'New' : docLabel }}
      </div>
      <div class="row wrap">
        <button class="btn btn-transparent btn-icon back" title="Back" @click="cancel"><Icon name="ArrowLeft" /></button>
        <span class="hd-ico"><Icon :name="m.icon" :size="20" /></span>
        <h1 class="page-title">{{ isNew ? `New ${m.singular}` : `Edit ${docLabel}` }}</h1>
        <span class="status">{{ isNew ? 'Not Saved' : 'Draft' }}</span>
        <span v-if="previewing" class="sync"><span class="btn-spin" /> Updating…</span>
        <div class="spacer" />
        <span v-if="doc.company" class="co-chip" title="Company"><Icon name="Building2" :size="14" /> {{ doc.company }}</span>
      </div>

      <!-- where this document sits in the standard procure-to-pay flow -->
      <ol v-if="flowIndex > -1" class="p2p">
        <li v-for="(s, i) in P2P" :key="s.doctype" :class="{ done: i < flowIndex, cur: i === flowIndex }">
          <span class="dot">{{ i < flowIndex ? '✓' : i + 1 }}</span><span class="lbl">{{ s.label }}</span>
        </li>
      </ol>
    </div>

    <div v-if="!meta" class="sk-stack">
      <div class="skeleton" style="height: 3rem" />
      <div class="skeleton" style="height: 14rem" />
      <div class="skeleton" style="height: 18rem" />
    </div>

    <template v-else>
      <DynamicForm ref="form" :meta="meta" :doc="doc" :show-errors="showErrors" :errors="errors" @change="onChange" @link="onLink" @row-add="onRowAdd" />

      <section v-if="hasTotals" class="card totals-card">
        <div class="t-row"><span>Total Quantity</span><b>{{ fmtNum(doc.total_qty) }}</b></div>
        <div class="t-row"><span>Net Total</span><b>{{ fmtMoney(doc.net_total ?? doc.total, doc.currency) }}</b></div>
        <div v-if="doc.total_taxes_and_charges" class="t-row"><span>Taxes &amp; Charges</span><b>{{ fmtMoney(doc.total_taxes_and_charges, doc.currency) }}</b></div>
        <div v-if="doc.discount_amount" class="t-row"><span>Discount</span><b>− {{ fmtMoney(doc.discount_amount, doc.currency) }}</b></div>
        <div class="t-row grand"><span>Grand Total</span><b>{{ fmtMoney(doc.grand_total, doc.currency) }}</b></div>
        <div v-if="doc.rounded_total && doc.rounded_total !== doc.grand_total" class="t-row"><span>Rounded Total</span><b>{{ fmtMoney(doc.rounded_total, doc.currency) }}</b></div>
      </section>
    </template>

    <!-- Sticky action bar: status on the left, Cancel · Save · Submit on the right -->
    <footer class="action-bar form-bar" :class="{ ok: !errors.length }">
      <button class="ab-status" :title="errors.map((e) => e.label).join('\n')" @click="errors.length && revealErrors()">
        <svg class="ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="15" class="track" />
          <circle cx="18" cy="18" r="15" class="fill" :style="{ strokeDashoffset: 94.25 * (1 - progress) }" />
        </svg>
        <Icon :name="errors.length ? 'TriangleAlert' : 'Check'" :size="13" class="ring-ico" />
        <span class="ab-text">
          <b>{{ errors.length ? errors[0].label : 'All set — ready to save' }}</b>
          <small class="muted">{{ errors.length > 1 ? `+${errors.length - 1} more to fix · click to review` : errors.length ? 'Click to jump to the field' : `${requiredCount} required field(s) complete` }}</small>
        </span>
      </button>
      <div class="spacer" />
      <span class="hide-sm muted kb"><kbd>Ctrl</kbd><kbd>S</kbd> save</span>
      <button class="btn btn-ghost" :disabled="!!busy" @click="cancel">Cancel</button>
      <span class="ab-divider hide-sm" />
      <button class="btn" :class="{ 'btn-emphasized': !meta?.is_submittable }" :disabled="!!busy || !meta" @click="save(0)">
        <span v-if="busy === 'draft'" class="btn-spin" /><Icon v-else name="Save" /> {{ meta?.is_submittable ? 'Save Draft' : 'Save' }}
      </button>
      <button v-if="meta?.is_submittable" class="btn btn-emphasized" :disabled="!!busy" @click="save(1)">
        <span v-if="busy === 'submit'" class="btn-spin" /><Icon v-else name="Check" /> Save &amp; Submit
      </button>
    </footer>
  </div>
</template>

<script setup>
import { confirmSubmitWithDates } from '../requiredBy'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import DynamicForm from '../components/DynamicForm.vue'
import Icon from '../components/Icon.vue'
import { applyDefaults, applyFetch, flatFields, isBlankRow, mergePreview, resetTouched, validate } from '../components/formLogic'
import { MODULES, P2P } from '../config'
import { confirmBox, fmtMoney, fmtNum, state, toast } from '../store'

const props = defineProps({ module: String, name: String })
const route = useRoute()
const router = useRouter()
const m = computed(() => MODULES[props.module])
const isNew = computed(() => !props.name)
const docLabel = computed(() => decodeURIComponent(props.name || ''))
const meta = ref(null)
const doc = reactive({})
const busy = ref('')
const previewing = ref(false)
const showErrors = ref(false)
const form = ref(null)
const flowIndex = computed(() => P2P.findIndex((s) => s.doctype === m.value.doctype))

const fields = computed(() => flatFields(meta.value))
const tableFields = computed(() => fields.value.filter((f) => f.fieldtype === 'Table'))
const errors = computed(() => (meta.value ? validate(meta.value, doc) : []))
const requiredCount = computed(() => fields.value.filter((f) => f.reqd).length)
const progress = computed(() => {
  const n = requiredCount.value + tableFields.value.filter((t) => t.reqd).length
  return n ? Math.max(0, (n - errors.value.length) / n) : 1
})
const hasTotals = computed(() => fields.value.some((f) => f.fieldname === 'grand_total') && (doc.items || []).some((i) => i.item_code))

// header value -> child column, as Desk's form scripts do
const PROPAGATE = { set_warehouse: 'warehouse', schedule_date: 'schedule_date', from_warehouse: 's_warehouse', to_warehouse: 't_warehouse', cost_center: 'cost_center', project: 'project' }

// ---------- events from the form ----------
function onChange(e) {
  if (!e.table && e.df && PROPAGATE[e.df.fieldname]) {
    for (const t of tableFields.value) for (const r of doc[t.fieldname] || []) if (e.df.fieldname in PROPAGATE && t.options && meta.value.children[t.options]?.fields.some((f) => f.fieldname === PROPAGATE[e.df.fieldname])) r[PROPAGATE[e.df.fieldname]] = e.value
  }
  schedulePreview()
}
async function onLink(e) {
  if (e.table) {
    const cfields = meta.value.children[e.table.options]?.fields || []
    if (e.df.fieldname === 'item_code' && e.row.item_code) {
      resetTouched(e.row, ['item_code', 'qty', 'warehouse', 's_warehouse', 't_warehouse', 'schedule_date'])
      api.itemDetails(e.row.item_code, doc.supplier, e.row.warehouse || doc.set_warehouse).then((d) => {
        if (e.row.item_code !== d.item_code) return
        e.row._stock = d.stock_qty
        for (const [k, v] of [['item_name', d.item_name], ['uom', d.uom], ['stock_uom', d.stock_uom], ['description', d.description]]) if (!e.row[k] && cfields.some((f) => f.fieldname === k)) e.row[k] = v
        if (!e.row.conversion_factor && cfields.some((f) => f.fieldname === 'conversion_factor')) e.row.conversion_factor = 1
        if (!e.row.rate && d.rate && cfields.some((f) => f.fieldname === 'rate')) e.row.rate = d.rate
        schedulePreview(150)
      }).catch(() => {})
      // keep one empty row ready, like Desk's grid
      const rows = doc[e.table.fieldname]
      if (rows[rows.length - 1] === e.row) form.value?.grids[e.table.fieldname]?.add()
    }
    await applyFetch(cfields, e.row, e.df, e.value)
  } else {
    await applyFetch(fields.value, doc, e.df, e.value)
  }
  schedulePreview(150)
}
function onRowAdd({ table, row }) {
  const cfields = meta.value.children[table.options]?.fields || []
  for (const [h, c] of Object.entries(PROPAGATE)) if (doc[h] && !row[c] && cfields.some((f) => f.fieldname === c)) row[c] = doc[h]
}

// ---------- live server recalculation (Desk's client triggers) ----------
let pt
let seq = 0
function schedulePreview(delay = 600) {
  clearTimeout(pt)
  pt = setTimeout(runPreview, delay)
}
async function runPreview() {
  if (busy.value || !meta.value) return
  const my = ++seq
  previewing.value = true
  try {
    const res = await api.formPreview(payload())
    if (my === seq && !busy.value) mergePreview(meta.value, doc, res)
  } catch { /* preview is best-effort */ } finally {
    if (my === seq) previewing.value = false
  }
}

function payload() {
  const p = JSON.parse(JSON.stringify(doc))
  p.doctype = m.value.doctype
  for (const t of tableFields.value) {
    const cm = meta.value.children[t.options]
    if (!Array.isArray(p[t.fieldname])) continue
    p[t.fieldname] = p[t.fieldname].filter((r) => !isBlankRow(r, cm)).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_'))))
  }
  return p
}

// ---------- validation & save ----------
async function revealErrors() {
  showErrors.value = true
  const first = errors.value[0]
  if (!first) return
  form.value?.reveal(first.field)
  await nextTick()
  const el = document.querySelector(`[data-field="${first.field}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el?.querySelector('input, button, textarea')?.focus({ preventScroll: true })
}
async function save(submit) {
  if (errors.value.length) {
    toast(errors.value[0].label, 'error', 3000)
    return revealErrors()
  }
  if (submit) {
    const warned = await confirmSubmitWithDates(m.value.doctype, payload(), `this ${m.value.singular}`)
    if (warned === false) return
    if (warned === null) {
      const ok = await confirmBox({ title: `Submit ${m.value.singular}`, message: 'Submitted documents are posted and can no longer be edited.', confirmText: 'Submit' })
      if (!ok) return
    }
  }
  clearTimeout(pt)
  busy.value = submit ? 'submit' : 'draft'
  try {
    const r = await api.saveDocument(payload(), submit)
    toast(submit ? `${r.name} submitted` : r.message)
    router.replace(`/${m.value.key}/${encodeURIComponent(r.name)}`)
  } catch {
    /* toast already shown */
  } finally {
    busy.value = ''
  }
}
function cancel() {
  if (window.history.state?.back) router.back()
  else router.push(isNew.value ? `/${m.value.key}` : `/${m.value.key}/${props.name}`)
}
function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    if (!busy.value) save(0)
  }
}

// ---------- load ----------
const metaCache = new Map()
async function loadMeta(dt) {
  if (!metaCache.has(dt)) metaCache.set(dt, api.formMeta(dt))
  try {
    return await metaCache.get(dt)
  } catch (e) {
    metaCache.delete(dt)
    throw e
  }
}
onMounted(async () => {
  addEventListener('keydown', onKey)
  const mt = await loadMeta(m.value.doctype)
  if (props.name) {
    const r = await api.getDocument(m.value.doctype, decodeURIComponent(props.name))
    if (r.doc.docstatus !== 0) {
      toast('Only drafts can be edited', 'info')
      return router.replace(`/${m.value.key}/${props.name}`)
    }
    let k = 0
    Object.assign(doc, r.doc)
    for (const t of flatFields(mt).filter((f) => f.fieldtype === 'Table')) doc[t.fieldname] = (r.doc[t.fieldname] || []).map((x) => ({ ...x, _k: `e${++k}` }))
  } else {
    Object.assign(doc, { doctype: m.value.doctype, company: state.boot?.company })
    applyDefaults(flatFields(mt), doc)
    Object.assign(doc, m.value.form?.defaults?.() || {})
    // prefill from the query string, e.g. /pr/new?item=X&qty=10&warehouse=Y (Inventory "replenish")
    for (const [k, v] of Object.entries(route.query)) if (flatFields(mt).some((f) => f.fieldname === k)) doc[k] = v
    if (route.query.warehouse && flatFields(mt).some((f) => f.fieldname === 'set_warehouse')) doc.set_warehouse = route.query.warehouse
  }
  meta.value = mt
  await nextTick()
  // start with an item line for new documents (prefilled when coming from Inventory)
  const grid = form.value?.grids.items
  if (isNew.value && grid && !(doc.items || []).length) {
    const row = grid.add(route.query.item ? { item_code: route.query.item, qty: +route.query.qty || 1, ...(route.query.warehouse ? { warehouse: route.query.warehouse } : {}) } : {})
    if (row.item_code) onLink({ table: tableFields.value.find((t) => t.fieldname === 'items'), row, df: { fieldname: 'item_code', options: 'Item' }, value: row.item_code })
  }
  schedulePreview(50)
})
onBeforeUnmount(() => {
  removeEventListener('keydown', onKey)
  clearTimeout(pt)
})
</script>

<style scoped>
.back { margin-left: -0.5rem; }
.hd-ico { width: 2.25rem; height: 2.25rem; border-radius: 0.625rem; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand); }
.co-chip { display: inline-flex; align-items: center; gap: 0.375rem; height: 1.75rem; padding: 0 0.625rem; border-radius: 1rem; background: var(--neutral-bg); color: var(--text-2); font-size: 0.8125rem; font-weight: 600; }
.dt-chip { display: inline-flex; align-items: center; gap: 0.3125rem; height: 1.5rem; padding: 0 0.5rem; border-radius: 0.375rem; background: var(--neutral-bg); color: var(--text-2); font-size: 0.75rem; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.sync { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; color: var(--text-2); animation: fade-in 0.2s both; }
.sk-stack { display: flex; flex-direction: column; gap: 1rem; }

.p2p { display: flex; list-style: none; margin: 1rem 0 0; padding: 0; overflow-x: auto; scrollbar-width: none; }
.p2p li { position: relative; display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: max-content; padding-right: 1.5rem; color: var(--text-3); font-size: 0.8125rem; font-weight: 600; }
.p2p li:not(:last-child)::after { content: ''; flex: 1; min-width: 1rem; height: 2px; margin-left: 0.25rem; border-radius: 2px; background: var(--border-soft); }
.p2p li.done::after { background: var(--positive); }
.p2p .dot { width: 1.5rem; height: 1.5rem; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 0.6875rem; background: var(--neutral-bg); color: var(--text-2); }
.p2p li.done { color: var(--text-2); }
.p2p li.done .dot { background: var(--positive); color: #fff; }
.p2p li.cur { color: var(--brand); }
.p2p li.cur .dot { background: var(--brand); color: #fff; box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 20%, transparent); }

.totals-card { margin-top: 1rem; margin-left: auto; width: min(26rem, 100%); padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; border: 1px solid var(--border-soft); animation: fade-up 0.3s var(--ease) both; }
.t-row { display: flex; justify-content: space-between; gap: 1rem; color: var(--text-2); }
.t-row b { color: var(--text); font-variant-numeric: tabular-nums; }
.t-row.grand { border-top: 1px solid var(--border-soft); padding-top: 0.625rem; margin-top: 0.25rem; font-size: 1.125rem; color: var(--text); }

/* sticky action bar */
.form-bar {
  position: sticky; bottom: 1rem; z-index: 40; margin-top: 1.5rem;
  border: 1px solid var(--border-soft); border-radius: 0.875rem;
  box-shadow: 0 12px 32px -12px rgba(16, 24, 40, 0.3), 0 2px 6px -2px rgba(16, 24, 40, 0.08);
  animation: bar-up 0.5s var(--spring) both;
}
@keyframes bar-up { from { opacity: 0; transform: translateY(24px); } }
.ab-status { position: relative; display: flex; align-items: center; gap: 0.75rem; min-width: 0; padding: 0.25rem 0.5rem 0.25rem 0.25rem; border: 0; border-radius: 0.625rem; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ab-status:hover { background: var(--surface-hover); }
.form-bar.ok .ab-status { cursor: default; }
.form-bar.ok .ab-status:hover { background: none; }
.ring { width: 2.25rem; height: 2.25rem; flex: none; transform: rotate(-90deg); }
.ring circle { fill: none; stroke-width: 3.5; }
.ring .track { stroke: var(--neutral-bg); }
.ring .fill { stroke: var(--critical); stroke-linecap: round; stroke-dasharray: 94.25; transition: stroke-dashoffset 0.5s var(--ease), stroke 0.3s; }
.form-bar.ok .ring .fill { stroke: var(--positive); }
.ring-ico { position: absolute; left: calc(0.25rem + 1.125rem); top: 50%; transform: translate(-50%, -50%); color: var(--critical); }
.form-bar.ok .ring-ico { color: var(--positive); }
.ab-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.ab-text b { font-size: 0.875rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ab-text small { font-size: 0.75rem; }
.kb { font-size: 0.75rem; display: inline-flex; gap: 0.25rem; align-items: center; margin-right: 0.5rem; }
.btn-spin { display: inline-block; width: 0.875rem; height: 0.875rem; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: vh-spin 0.7s linear infinite; }
@media (max-width: 720px) {
  .form-bar { flex-wrap: wrap; bottom: 0.5rem; }
  .form-bar .spacer { flex-basis: 100%; height: 0; }
  .form-bar .btn { flex: 1; }
  .hide-sm { display: none; }
}
</style>
