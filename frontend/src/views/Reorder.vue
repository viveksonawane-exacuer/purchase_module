<template>
  <div class="page page-narrow">
    <div class="dyn-header">
      <div class="breadcrumbs"><router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" /> <router-link to="/inventory">Stock</router-link><Icon name="ChevronRight" :size="12" /> Reorder</div>
      <div class="row wrap">
        <span class="hd-ico"><Icon name="TriangleAlert" :size="20" /></span>
        <div>
          <h1 class="page-title">Reorder &amp; Replenishment</h1>
          <div class="muted row wrap" style="gap: 0.5rem; font-size: 0.8125rem">
            <span class="dt-chip" title="Reorder rules are set per warehouse on the Item (Item Reorder)"><Icon name="Layers" :size="12" /> Item Reorder</span>
            <span>Items whose projected quantity is below the reorder level</span>
          </div>
        </div>
        <div class="spacer" />
        <button class="btn btn-transparent" :disabled="loading" @click="load"><Icon name="RefreshCw" :class="{ spin: loading }" /> Refresh</button>
        <router-link to="/inventory" class="btn"><Icon name="Warehouse" /> Stock Overview</router-link>
      </div>

      <div class="kpis">
        <div v-for="(k, i) in kpis" :key="k.label" class="kpi spot" :class="k.tone" :style="{ '--i': i }">
          <span class="ico"><Icon :name="k.icon" :size="18" /></span>
          <div>
            <div class="k">{{ k.label }}</div>
            <div class="v"><AnimatedNumber v-if="rows" :value="k.value" :format="k.fmt" /><span v-else class="skeleton" style="display: inline-block; width: 3rem; height: 1.25rem" /></div>
          </div>
        </div>
      </div>

      <div class="filterbar">
        <div class="field search-field">
          <label>Item</label>
          <div class="search-box"><Icon name="Search" :size="15" /><input v-model="q" class="input" placeholder="Item code or name…" /></div>
        </div>
        <div class="field"><label>Warehouse</label><LinkInput v-model="warehouse" doctype="Warehouse" :filters="{ company: state.boot?.company, is_group: 0 }" /></div>
        <div class="field"><label>Urgency</label><SelectInput v-model="urgency" :options="['', 'Out of stock', 'Below reorder']" placeholder="All" /></div>
        <label class="toggle">
          <input v-model="hideRequested" type="checkbox" class="cbx" />
          <span>Hide lines already requested / on order</span>
        </label>
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <b>{{ shown.length }} line(s) to replenish</b>
        <span v-if="selected.size" class="muted">· {{ selected.size }} selected</span>
        <div class="spacer" />
        <button class="btn btn-sm btn-transparent" :disabled="!shown.length" @click="selectAll(true)">Select all</button>
        <button v-if="selected.size" class="btn btn-sm btn-transparent" @click="selectAll(false)">Clear</button>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th class="chk"><input type="checkbox" class="cbx" :checked="allSel" aria-label="Select all" @change="selectAll(!allSel)" /></th>
              <th>Item</th>
              <th>Warehouse</th>
              <th class="num">On Hand</th>
              <th class="num">Projected</th>
              <th class="num">Reorder Level</th>
              <th>Stock vs Level</th>
              <th class="num">In Pipeline</th>
              <th class="num">Order Qty</th>
              <th class="num">Est. Value</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <template v-if="!rows"><tr v-for="i in 6" :key="i"><td colspan="11"><div class="skeleton" style="height: 1.5rem" /></td></tr></template>
            <tr v-for="r in shown" :key="key(r)" :class="{ selected: selected.has(key(r)) }">
              <td class="chk"><input type="checkbox" class="cbx" :checked="selected.has(key(r))" @change="toggle(r)" /></td>
              <td>
                <div class="it" role="button" tabindex="0" @click="openItem(r)" @keydown.enter="openItem(r)">
                  <span class="thumb"><img v-if="r.image" :src="r.image" alt="" /><Icon v-else name="Package" :size="16" /></span>
                  <div style="min-width: 0">
                    <div class="title link">{{ r.item_name }}</div>
                    <div class="muted">{{ r.item_code }}<template v-if="r.supplier"> · {{ r.supplier }}</template></div>
                  </div>
                </div>
              </td>
              <td>{{ r.warehouse }}<div v-if="r.material_request_type !== 'Purchase'" class="muted">{{ r.material_request_type }}</div></td>
              <td class="num">{{ fmtNum(r.actual_qty) }} <small class="muted">{{ r.uom }}</small></td>
              <td class="num" :class="r.projected_qty <= 0 ? 'neg' : 'warn'"><b>{{ fmtNum(r.projected_qty) }}</b></td>
              <td class="num">{{ fmtNum(r.reorder_level) }}</td>
              <td style="min-width: 9rem">
                <div class="progress" :class="r.urgency === 'critical' ? '' : 'critical'"><span :style="{ width: Math.max(2, Math.min(100, (100 * Math.max(0, r.projected_qty)) / (r.reorder_level || 1))) + '%', background: r.urgency === 'critical' ? 'var(--negative)' : '' }" /></div>
                <span class="status" :class="r.urgency === 'critical' ? 'negative' : 'critical'" style="margin-top: 0.25rem">{{ r.urgency === 'critical' ? 'Out of stock' : `Short ${fmtNum(r.shortfall)}` }}</span>
              </td>
              <td class="num">
                <template v-if="r.ordered_qty || r.indented_qty">
                  <div v-if="r.indented_qty" title="Requested (open Material Requests)">{{ fmtNum(r.indented_qty) }} <small class="muted">req.</small></div>
                  <div v-if="r.ordered_qty" title="On open Purchase Orders">{{ fmtNum(r.ordered_qty) }} <small class="muted">PO</small></div>
                </template>
                <span v-else class="muted">—</span>
              </td>
              <td class="num" style="min-width: 7.5rem"><input v-model.number="qty[key(r)]" class="input compact mono qty" type="number" min="0" step="any" @focus="selected.add(key(r))" /></td>
              <td class="num">{{ r.rate ? fmtMoney((+qty[key(r)] || 0) * r.rate) : '—' }}</td>
              <td><button class="btn btn-sm" :disabled="busy" @click="create([r])"><Icon name="FilePlus2" /> Request</button></td>
            </tr>
          </tbody>
        </table>
        <div v-if="rows && !shown.length" class="empty">
          <Icon name="CheckCircle2" />
          <div style="font-weight: 600; color: var(--text)">{{ rows.length ? 'Nothing matches these filters' : 'All items are above their reorder level' }}</div>
          <div>Reorder levels are defined per warehouse on each Item (Inventory → Auto Re-order).</div>
        </div>
      </div>
    </div>

    <!-- bulk action bar -->
    <Transition name="ab">
      <footer v-if="selected.size" class="action-bar reorder-bar">
        <span class="ab-msg"><b>{{ selected.size }}</b> line(s) · {{ fmtNum(selTotalQty) }} units · est. <b>{{ fmtMoney(selValue) }}</b></span>
        <div class="spacer" />
        <button class="btn btn-ghost" @click="selectAll(false)">Clear</button>
        <button class="btn btn-emphasized" :disabled="busy" @click="create(selRows)"><span v-if="busy" class="btn-spin" /><Icon v-else name="FilePlus2" /> Create Material Request</button>
      </footer>
    </Transition>

    <!-- stock detail drawer (child route /reorder/:item) -->
    <router-view v-slot="{ Component }">
      <Transition name="drawer" :duration="{ enter: 550, leave: 320 }" appear>
        <component :is="Component" v-if="Component" />
      </Transition>
    </router-view>
  </div>
</template>

<script setup>
import { computed, onMounted, provide, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import AnimatedNumber from '../components/AnimatedNumber.vue'
import Icon from '../components/Icon.vue'
import LinkInput from '../components/LinkInput.vue'
import SelectInput from '../components/SelectInput.vue'
import { confirmBox, fmtCompact, fmtMoney, fmtNum, state, toast } from '../store'

const router = useRouter()
const rows = ref(null)
const loading = ref(false)
const busy = ref(false)
const q = ref('')
const warehouse = ref('')
const urgency = ref('')
const hideRequested = ref(false)
const selected = reactive(new Set())
const qty = reactive({})
const key = (r) => `${r.item_code}::${r.warehouse}`

const shown = computed(() => {
  const s = q.value.trim().toLowerCase()
  return (rows.value || []).filter(
    (r) =>
      (!s || `${r.item_code} ${r.item_name}`.toLowerCase().includes(s)) &&
      (!warehouse.value || r.warehouse === warehouse.value) &&
      (!urgency.value || (urgency.value === 'Out of stock') === (r.urgency === 'critical')) &&
      !(hideRequested.value && (r.ordered_qty > 0 || r.indented_qty > 0)),
  )
})
const allSel = computed(() => shown.value.length > 0 && shown.value.every((r) => selected.has(key(r))))
const selRows = computed(() => (rows.value || []).filter((r) => selected.has(key(r))))
const selTotalQty = computed(() => selRows.value.reduce((a, r) => a + (+qty[key(r)] || 0), 0))
const selValue = computed(() => selRows.value.reduce((a, r) => a + (+qty[key(r)] || 0) * (r.rate || 0), 0))
const kpis = computed(() => {
  const r = rows.value || []
  return [
    { label: 'Lines below reorder', icon: 'TriangleAlert', value: r.length, tone: 'warn' },
    { label: 'Out of stock', icon: 'XCircle', value: r.filter((x) => x.urgency === 'critical').length, tone: 'neg' },
    { label: 'Warehouses affected', icon: 'Warehouse', value: new Set(r.map((x) => x.warehouse)).size },
    { label: 'Est. replenishment value', icon: 'CircleDollarSign', value: r.reduce((a, x) => a + (x.suggested_qty || 0) * (x.rate || 0), 0), fmt: (v) => fmtCompact(v) },
  ]
})

function toggle(r) {
  const k = key(r)
  selected.has(k) ? selected.delete(k) : selected.add(k)
}
function selectAll(on) {
  if (!on) return selected.clear()
  shown.value.forEach((r) => selected.add(key(r)))
}
function openItem(r) {
  router.push(`/reorder/${encodeURIComponent(r.item_code)}`)
}
provide('stockNav', {
  items: computed(() => [...new Set(shown.value.map((r) => r.item_code))]),
  go: (code) => router.push(`/reorder/${encodeURIComponent(code)}`),
})

async function create(list) {
  const lines = list.map((r) => ({ item_code: r.item_code, warehouse: r.warehouse, qty: +qty[key(r)] || 0, material_request_type: r.material_request_type })).filter((l) => l.qty > 0)
  if (!lines.length) return toast('Enter an order quantity first', 'error')
  if (lines.length > 1) {
    const ok = await confirmBox({ title: 'Create Material Request', message: `Create a draft Material Request for ${lines.length} line(s)? You can review it before submitting.`, confirmText: 'Create Draft' })
    if (!ok) return
  }
  busy.value = true
  try {
    const r = await api.createReorderRequests(lines)
    const names = r.created.map((c) => c.name)
    toast(`Draft ${names.join(', ')} created`)
    selected.clear()
    if (names.length === 1) router.push(`/pr/${encodeURIComponent(names[0])}/edit`)
    else router.push('/pr?tab=1')
  } catch { /* toast shown */ } finally {
    busy.value = false
  }
}

async function load() {
  loading.value = true
  try {
    const r = await api.reorderOverview()
    for (const x of r.rows) if (qty[key(x)] === undefined) qty[key(x)] = x.suggested_qty
    rows.value = r.rows
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<style scoped>
.hd-ico { width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, #e76500, #d6336c); }
.spin { animation: vh-spin 0.8s linear infinite; }
.kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0.75rem; margin: 1.25rem 0 1rem; }
.kpi { overflow: hidden; display: flex; gap: 0.75rem; align-items: center; padding: 0.875rem 1rem; border-radius: var(--radius); background: var(--surface); border: 1px solid var(--border-soft); animation: fade-up 0.35s var(--ease) both; animation-delay: calc(var(--i) * 50ms); }
.kpi .ico { width: 2.5rem; height: 2.5rem; border-radius: 0.625rem; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand); }
.kpi.warn .ico { background: var(--critical-bg); color: var(--critical-text); }
.kpi.neg .ico { background: var(--negative-bg); color: var(--negative); }
.kpi .k { font-size: 0.8125rem; color: var(--text-2); }
.kpi .v { font-size: 1.375rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.filterbar { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0.75rem 1rem; align-items: end; }
.search-box { position: relative; }
.search-box svg { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-3); }
.search-box .input { padding-left: 2.25rem; }
.toggle { display: flex; align-items: center; gap: 0.5rem; height: 2.5rem; font-size: 0.875rem; color: var(--text-2); cursor: pointer; }
.toolbar { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-soft); flex-wrap: wrap; }
.it { display: flex; align-items: center; gap: 0.625rem; cursor: pointer; }
.it:hover .link { color: var(--link); text-decoration: underline; }
.thumb { width: 2.25rem; height: 2.25rem; flex: none; border-radius: 0.5rem; overflow: hidden; display: grid; place-items: center; background: var(--surface-2); border: 1px solid var(--border-soft); color: var(--text-3); }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.neg { color: var(--negative); }
.warn { color: var(--critical-text); }
.qty { width: 6.5rem; margin-left: auto; text-align: right; }
.btn-spin { display: inline-block; width: 0.875rem; height: 0.875rem; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: vh-spin 0.7s linear infinite; }
.reorder-bar { position: sticky; bottom: 1rem; z-index: 40; margin-top: 1rem; border: 1px solid var(--border-soft); border-radius: 0.875rem; box-shadow: 0 12px 32px -12px rgba(16, 24, 40, 0.3); }
.ab-enter-active { transition: opacity 0.25s var(--ease), transform 0.35s var(--spring); }
.ab-leave-active { transition: opacity 0.15s, transform 0.15s; }
.ab-enter-from, .ab-leave-to { opacity: 0; transform: translateY(20px); }
</style>
