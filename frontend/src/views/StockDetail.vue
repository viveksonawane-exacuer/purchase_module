<template>
  <div class="sd-root" @keydown.esc.stop="close">
    <div class="sd-overlay" @click="close" />
    <aside ref="panel" class="sd-panel" role="dialog" aria-modal="true" :aria-label="`Stock detail for ${itemCode}`" tabindex="-1">
      <!-- ============ Header ============ -->
      <header class="sd-head">
        <div class="sd-top">
          <div class="breadcrumbs">
            <router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" />
            <router-link :to="parentPath">{{ parentPath === '/reorder' ? 'Reorder' : 'Inventory' }}</router-link><Icon name="ChevronRight" :size="12" />
            <span>Stock Detail</span>
          </div>
          <div class="spacer" />
          <div v-if="nav && navIndex > -1" class="sd-pager">
            <span class="muted">{{ navIndex + 1 }} / {{ nav.items.value.length }}</span>
            <button class="btn btn-transparent btn-icon btn-sm" title="Previous item (K)" :disabled="navIndex <= 0" @click="step(-1)"><Icon name="ChevronLeft" :size="16" /></button>
            <button class="btn btn-transparent btn-icon btn-sm" title="Next item (J)" :disabled="navIndex >= nav.items.value.length - 1" @click="step(1)"><Icon name="ChevronRight" :size="16" /></button>
          </div>
          <a class="btn btn-transparent btn-icon btn-sm" :href="`/app/item/${encodeURIComponent(itemCode)}`" target="_blank" title="Open item in ERP Desk"><Icon name="ExternalLink" :size="16" /></a>
          <button class="btn btn-transparent btn-icon btn-sm" title="Close (Esc)" @click="close"><Icon name="X" :size="18" /></button>
        </div>

        <div class="sd-title">
          <button v-if="images.length" type="button" class="sd-avatar img zoomable" :title="`View ${images.length} image(s)`" @click="openViewer(0)">
            <img :src="images[0]" alt="" />
            <span class="zoom-ico"><Icon name="Eye" :size="16" /></span>
            <span v-if="images.length > 1" class="more-badge">+{{ images.length - 1 }}</span>
          </button>
          <span v-else class="sd-avatar"><Icon name="Package" :size="24" /></span>
          <div class="sd-name">
            <div class="row wrap" style="gap: 0.5rem">
              <h2 class="ell">{{ item?.item_name || itemCode }}</h2>
              <span v-if="data" class="status" :class="health.tone">{{ health.label }}</span>
              <span v-if="item?.disabled" class="status negative">Disabled</span>
            </div>
            <div class="muted sd-meta">
              <span class="mono-chip">{{ itemCode }}</span>
              <template v-if="item?.item_group"><span class="dot" />{{ item.item_group }}</template>
              <template v-if="item?.stock_uom"><span class="dot" />{{ item.stock_uom }}</template>
              <template v-if="item?.brand"><span class="dot" />{{ item.brand }}</template>
            </div>
          </div>
        </div>

        <div class="sd-kpis">
          <div v-for="(k, i) in kpis" :key="k.label" class="sd-kpi spot" :class="k.tone" :style="{ '--i': i }">
            <span class="k"><Icon :name="k.icon" :size="14" /> {{ k.label }}</span>
            <span class="v">
              <template v-if="data"><AnimatedNumber :value="k.value" :format="k.fmt" /></template>
              <span v-else class="skeleton" style="display: inline-block; width: 4rem; height: 1.25rem" />
            </span>
            <small v-if="k.sub" class="muted">{{ k.sub }}</small>
          </div>
        </div>

        <nav class="sd-tabs" role="tablist">
          <button v-for="t in tabs" :key="t.id" role="tab" :aria-selected="tab === t.id" :class="{ on: tab === t.id }" @click="tab = t.id">
            <Icon :name="t.icon" :size="15" /> {{ t.label }}<span v-if="t.count" class="count">{{ t.count }}</span>
          </button>
          <span class="sd-ink" :style="ink" />
        </nav>
      </header>

      <!-- ============ Body ============ -->
      <div ref="body" class="sd-body" :class="{ busy: loading && data }">
        <div v-if="!data" class="sd-sk">
          <div class="skeleton" style="height: 12rem" />
          <div class="skeleton" style="height: 8rem" />
          <div class="skeleton" style="height: 10rem" />
        </div>

        <Transition v-else name="sd-tab" mode="out-in">
          <!-- Overview -->
          <div v-if="tab === 'overview'" key="overview" class="sd-stack">
            <section class="card sd-card">
              <div class="card-header">
                <h3>Stock Movement</h3><span class="sub">Last {{ data.trend.length }} months</span>
                <div class="spacer" />
                <span class="legend"><i class="in" /> Inbound</span>
                <span class="legend"><i class="out" /> Outbound</span>
              </div>
              <div class="card-body">
                <div class="flow-chart" @mouseleave="hover = -1">
                  <svg :viewBox="`0 0 ${CW} ${CH}`" preserveAspectRatio="none" role="img" aria-label="Monthly inbound and outbound quantity">
                    <line v-for="t in [0.25, 0.5, 0.75, 1]" :key="t" :x1="0" :x2="CW" :y1="cy(t * trendMax)" :y2="cy(t * trendMax)" class="grid" />
                    <g v-for="(d, i) in data.trend" :key="i" :class="{ dim: hover > -1 && hover !== i }">
                      <rect :x="cx(i) - bw - 2" :y="cy(d.in)" :width="bw" :height="CH - 22 - cy(d.in)" rx="3" class="b-in" :style="{ animationDelay: i * 50 + 'ms' }" />
                      <rect :x="cx(i) + 2" :y="cy(d.out)" :width="bw" :height="CH - 22 - cy(d.out)" rx="3" class="b-out" :style="{ animationDelay: i * 50 + 30 + 'ms' }" />
                      <rect :x="cx(i) - cstep / 2" y="0" :width="cstep" :height="CH" fill="transparent" @mouseenter="hover = i" />
                      <text :x="cx(i)" :y="CH - 6" text-anchor="middle" class="axis">{{ d.label }}</text>
                    </g>
                    <line x1="0" :x2="CW" :y1="CH - 22" :y2="CH - 22" class="base" />
                  </svg>
                  <div v-if="hover > -1" class="tip" :style="{ left: (cx(hover) / CW) * 100 + '%' }">
                    <small>{{ data.trend[hover].label }}</small>
                    <span><i class="in" /> In <b>{{ fmtNum(data.trend[hover].in) }}</b></span>
                    <span><i class="out" /> Out <b>{{ fmtNum(data.trend[hover].out) }}</b></span>
                  </div>
                </div>
                <div class="flow-sum">
                  <div><span class="muted">Total in</span><b class="pos">+{{ fmtNum(sumIn) }}</b></div>
                  <div><span class="muted">Total out</span><b class="neg">−{{ fmtNum(sumOut) }}</b></div>
                  <div><span class="muted">Net</span><b>{{ sumIn - sumOut >= 0 ? '+' : '−' }}{{ fmtNum(Math.abs(sumIn - sumOut)) }}</b></div>
                  <div><span class="muted">Avg. monthly use</span><b>{{ fmtNum(sumOut / (data.trend.length || 1)) }}</b></div>
                </div>
              </div>
            </section>

            <div class="sd-grid2">
              <section class="card sd-card">
                <div class="card-header"><h3>By Warehouse</h3><span class="sub">On-hand quantity</span></div>
                <div class="card-body">
                  <RankBars :rows="whRows" :money="false" />
                </div>
              </section>
              <section class="card sd-card">
                <div class="card-header"><h3>Item Details</h3></div>
                <div class="card-body">
                  <dl class="sd-facts">
                    <template v-for="f in facts" :key="f.k"><dt>{{ f.k }}</dt><dd>{{ f.v || '—' }}</dd></template>
                  </dl>
                </div>
              </section>
            </div>

            <section v-if="images.length" class="card sd-card">
              <div class="card-header"><h3>Images</h3><span class="sub">{{ images.length }} image(s) · click to view</span></div>
              <div class="card-body gallery">
                <button v-for="(u, i) in images" :key="u" type="button" class="g-thumb" :style="{ '--i': i }" @click="openViewer(i)">
                  <img :src="u" alt="" loading="lazy" />
                  <span class="g-zoom"><Icon name="Eye" :size="16" /></span>
                </button>
              </div>
            </section>

            <section v-if="plainDesc && plainDesc !== item.item_name" class="card sd-card">
              <div class="card-header"><h3>Description</h3></div>
              <div class="card-body sd-desc">{{ plainDesc }}</div>
            </section>
          </div>

          <!-- Warehouses -->
          <div v-else-if="tab === 'warehouses'" key="warehouses" class="sd-stack">
            <section class="card sd-card">
              <div class="table-wrap">
                <table class="tbl">
                  <thead>
                    <tr><th>Warehouse</th><th class="num">On Hand</th><th class="num">Reserved</th><th class="num">On Order</th><th class="num">Projected</th><th>vs. Reorder Level</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="b in data.bins" :key="b.warehouse">
                      <td><div class="title">{{ b.warehouse }}</div><div class="muted">{{ fmtMoney(b.stock_value) }}</div></td>
                      <td class="num"><b>{{ fmtNum(b.actual_qty) }}</b></td>
                      <td class="num">{{ fmtNum(b.reserved_qty) }}</td>
                      <td class="num">{{ fmtNum(b.ordered_qty) }}</td>
                      <td class="num" :class="{ neg: b.projected_qty < (b.reorder_level || 0.0001) }">{{ fmtNum(b.projected_qty) }}</td>
                      <td style="min-width: 10rem">
                        <template v-if="b.reorder_level">
                          <div class="progress" :class="b.projected_qty < b.reorder_level ? 'critical' : 'positive'">
                            <span :style="{ width: Math.max(2, Math.min(100, (100 * b.projected_qty) / (b.reorder_level * 2))) + '%' }" />
                          </div>
                          <small class="muted">Reorder at {{ fmtNum(b.reorder_level) }} · qty {{ fmtNum(b.reorder_qty) }}</small>
                        </template>
                        <small v-else class="muted">No reorder rule</small>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="!data.bins.length" class="empty"><Icon name="Warehouse" /><div>This item has no stock in any warehouse.</div></div>
              </div>
            </section>
          </div>

          <!-- Movements -->
          <div v-else-if="tab === 'movements'" key="movements" class="sd-stack">
            <section class="card sd-card">
              <div class="card-header"><h3>Recent Transactions</h3><span class="sub">Latest {{ data.ledger.length }} stock ledger entries</span></div>
              <ol v-if="data.ledger.length" class="mv">
                <li v-for="(e, i) in data.ledger" :key="i" :style="{ '--i': i }">
                  <span class="mv-ico" :class="e.actual_qty >= 0 ? 'in' : 'out'"><Icon :name="e.actual_qty >= 0 ? 'ArrowDownLeft' : 'ArrowUpRight'" :size="16" /></span>
                  <div class="mv-main">
                    <div class="row wrap" style="gap: 0.375rem">
                      <component :is="voucherLink(e).to ? 'router-link' : 'a'" v-bind="voucherLink(e)" class="mv-doc">{{ e.voucher_no }}</component>
                      <span class="muted">{{ e.voucher_type }}</span>
                    </div>
                    <small class="muted">{{ e.warehouse }} · {{ fmtDate(e.posting_date) }} {{ String(e.posting_time || '').slice(0, 5) }}</small>
                  </div>
                  <div class="mv-qty">
                    <b :class="e.actual_qty >= 0 ? 'pos' : 'neg'">{{ e.actual_qty >= 0 ? '+' : '−' }}{{ fmtNum(Math.abs(e.actual_qty)) }}</b>
                    <small class="muted">Balance {{ fmtNum(e.qty_after_transaction) }}</small>
                  </div>
                </li>
              </ol>
              <div v-else class="empty"><Icon name="History" /><div>No stock transactions recorded yet.</div></div>
            </section>
          </div>

          <!-- Purchasing -->
          <div v-else key="purchasing" class="sd-stack">
            <section class="card sd-card">
              <div class="card-header"><h3>Open Purchase Orders</h3><span class="sub">{{ fmtNum(pendingQty) }} {{ item.stock_uom }} still to receive</span></div>
              <div class="table-wrap">
                <table class="tbl">
                  <thead><tr><th>Order</th><th>Expected</th><th class="num">Ordered</th><th>Received</th><th class="num">Rate</th></tr></thead>
                  <tbody>
                    <tr v-for="p in data.open_pos" :key="p.name + p.warehouse" class="clickable" @click="$router.push(`/po/${encodeURIComponent(p.name)}`)">
                      <td><div class="title">{{ p.name }}</div><div class="muted">{{ p.supplier_name || p.supplier }}</div></td>
                      <td :class="{ neg: isLate(p.schedule_date) }">{{ fmtDate(p.schedule_date) }}<div v-if="isLate(p.schedule_date)" class="muted">Late</div></td>
                      <td class="num">{{ fmtNum(p.qty) }}</td>
                      <td style="min-width: 7rem"><Progress :value="(100 * p.received_qty) / (p.qty || 1)" /></td>
                      <td class="num">{{ fmtMoney(p.rate, p.currency) }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="!data.open_pos.length" class="empty"><Icon name="Truck" /><div>No open purchase orders for this item.</div></div>
              </div>
            </section>
            <section class="card sd-card">
              <div class="card-header"><h3>Supplier Price History</h3><span class="sub">Most recent purchase per supplier</span></div>
              <div class="table-wrap">
                <table class="tbl">
                  <thead><tr><th>Supplier</th><th>Last Ordered</th><th class="num">Orders</th><th class="num">Total Qty</th><th class="num">Last Rate</th></tr></thead>
                  <tbody>
                    <tr v-for="s in data.suppliers" :key="s.supplier">
                      <td>
                        <div class="row" style="gap: 0.625rem">
                          <span class="sup-av">{{ initials(s.supplier_name || s.supplier) }}</span>
                          <span class="title">{{ s.supplier_name || s.supplier }}</span>
                          <span v-if="s.last_rate === bestRate" class="status positive">Best</span>
                        </div>
                      </td>
                      <td>{{ fmtDate(s.last_date) }}</td>
                      <td class="num">{{ s.orders }}</td>
                      <td class="num">{{ fmtNum(s.qty) }}</td>
                      <td class="num"><b>{{ fmtMoney(s.last_rate, s.currency) }}</b></td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="!data.suppliers.length" class="empty"><Icon name="Building2" /><div>This item has not been purchased yet.</div></div>
              </div>
            </section>
          </div>
        </Transition>
      </div>

      <ImageViewer :open="viewer.open" :images="images" :start="viewer.start" :title="item?.item_name || itemCode" @close="viewer.open = false" />

      <!-- ============ Action bar ============ -->
      <footer class="action-bar in-panel">
        <span class="ab-msg hide-sm">
          <kbd>Esc</kbd> close <span class="sep" /> <kbd>J</kbd><kbd>K</kbd> next / previous
        </span>
        <div class="spacer" />
        <button class="btn btn-ghost" @click="close">Close</button>
        <router-link :to="replenishLink" class="btn btn-emphasized"><Icon name="FilePlus2" /> Create Requisition</router-link>
      </footer>
    </aside>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import AnimatedNumber from '../components/AnimatedNumber.vue'
import Icon from '../components/Icon.vue'
import ImageViewer from '../components/ImageViewer.vue'
import Progress from '../components/Progress.vue'
import RankBars from '../components/RankBars.vue'
import { BY_DOCTYPE } from '../config'
import { fmtCompact, fmtDate, fmtMoney, fmtNum, state } from '../store'

const props = defineProps({ item: String })
const router = useRouter()
const nav = inject('stockNav', null) // { items: Ref<string[]>, go(code) } from Inventory

const itemCode = computed(() => decodeURIComponent(props.item))
const parentPath = computed(() => router.currentRoute.value.matched[0]?.path || '/inventory')
const data = ref(null)
const loading = ref(false)
const tab = ref('overview')
const hover = ref(-1)
const panel = ref(null)
const body = ref(null)
const item = computed(() => data.value?.item)
const images = computed(() => data.value?.images || (item.value?.image ? [item.value.image] : []))
const viewer = reactive({ open: false, start: 0 })
function openViewer(i) {
  viewer.start = i
  viewer.open = true
}
const t = computed(() => data.value?.totals || {})

const health = computed(() => {
  const x = t.value
  if (x.actual_qty <= 0) return { tone: 'negative', label: 'Out of stock' }
  if (x.projected_qty < 0) return { tone: 'negative', label: 'Shortage' }
  if (x.below_reorder) return { tone: 'critical', label: 'Below reorder level' }
  return { tone: 'positive', label: 'In stock' }
})
const kpis = computed(() => [
  { label: 'On Hand', icon: 'Boxes', value: t.value.actual_qty || 0, fmt: (v) => fmtNum(v), sub: `${t.value.warehouses || 0} warehouse(s)` },
  { label: 'Projected', icon: 'Gauge', value: t.value.projected_qty || 0, fmt: (v) => fmtNum(v), tone: t.value.projected_qty < 0 ? 'neg' : '', sub: 'After open demand & supply' },
  { label: 'On Order', icon: 'Truck', value: t.value.ordered_qty || 0, fmt: (v) => fmtNum(v), sub: `${data.value?.open_pos.length || 0} open PO(s)` },
  { label: 'Reserved', icon: 'Lock', value: t.value.reserved_qty || 0, fmt: (v) => fmtNum(v), sub: `${fmtNum(t.value.indented_qty || 0)} requested` },
  { label: 'Stock Value', icon: 'CircleDollarSign', value: t.value.stock_value || 0, fmt: (v) => fmtCompact(v), sub: `@ ${fmtMoney(t.value.valuation_rate || 0)}` },
])
const tabs = computed(() => [
  { id: 'overview', label: 'Overview', icon: 'BarChart3' },
  { id: 'warehouses', label: 'Warehouses', icon: 'Warehouse', count: data.value?.bins.length },
  { id: 'movements', label: 'Movements', icon: 'History', count: data.value?.ledger.length },
  { id: 'purchasing', label: 'Purchasing', icon: 'ShoppingCart', count: data.value?.open_pos.length },
])

// animated tab underline
const ink = ref({})
async function placeInk() {
  await nextTick()
  const b = panel.value?.querySelector('.sd-tabs button.on')
  if (b) ink.value = { width: `${b.offsetWidth - 16}px`, transform: `translateX(${b.offsetLeft + 8}px)` }
}
watch([tab, data], placeInk)

// movement chart
const CW = 600
const CH = 180
const trendMax = computed(() => Math.max(1, ...(data.value?.trend || []).flatMap((d) => [d.in, d.out])) * 1.1)
const cstep = computed(() => CW / Math.max(1, data.value?.trend.length || 1))
const bw = computed(() => Math.min(26, cstep.value * 0.28))
const cx = (i) => cstep.value * i + cstep.value / 2
const cy = (v) => 6 + (CH - 28) * (1 - v / trendMax.value)
const sumIn = computed(() => (data.value?.trend || []).reduce((a, d) => a + d.in, 0))
const sumOut = computed(() => (data.value?.trend || []).reduce((a, d) => a + d.out, 0))

const whRows = computed(() => (data.value?.bins || []).filter((b) => b.actual_qty > 0).map((b) => ({ label: b.warehouse, value: b.actual_qty })))
const plainDesc = computed(() => String(item.value?.description || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
const facts = computed(() => {
  const i = item.value || {}
  return [
    { k: 'Item Group', v: i.item_group },
    { k: 'Brand', v: i.brand },
    { k: 'Stock UoM', v: i.stock_uom },
    { k: 'Valuation Rate', v: fmtMoney(t.value.valuation_rate || i.valuation_rate) },
    { k: 'Last Purchase Rate', v: i.last_purchase_rate ? fmtMoney(i.last_purchase_rate) : '' },
    { k: 'Safety Stock', v: i.safety_stock ? fmtNum(i.safety_stock) : '' },
    { k: 'Lead Time', v: i.lead_time_days ? `${i.lead_time_days} day(s)` : '' },
    { k: 'Min. Order Qty', v: i.min_order_qty ? fmtNum(i.min_order_qty) : '' },
  ]
})
const pendingQty = computed(() => (data.value?.open_pos || []).reduce((a, p) => a + (p.qty - p.received_qty), 0))
const bestRate = computed(() => {
  const r = (data.value?.suppliers || []).map((s) => s.last_rate).filter((x) => x > 0)
  return r.length > 1 ? Math.min(...r) : null
})
const replenishLink = computed(() => {
  const low = (data.value?.bins || []).find((b) => b.reorder_level && b.projected_qty < b.reorder_level)
  const b = low || data.value?.bins[0]
  const q = new URLSearchParams({ item: itemCode.value, qty: String(low ? low.reorder_qty || low.reorder_level : 1) })
  if (b?.warehouse) q.set('warehouse', b.warehouse)
  return `/pr/new?${q}`
})

const initials = (s) => (s || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
const isLate = (d) => d && new Date(d) < new Date(new Date().toDateString())
function voucherLink(e) {
  const m = BY_DOCTYPE[e.voucher_type]
  if (m) return { to: `/${m.key}/${encodeURIComponent(e.voucher_no)}` }
  return { href: `/app/${e.voucher_type.toLowerCase().replace(/ /g, '-')}/${encodeURIComponent(e.voucher_no)}`, target: '_blank' }
}

async function load() {
  loading.value = true
  const code = itemCode.value
  try {
    const r = await api.itemStock(code)
    if (code === itemCode.value) data.value = r
  } catch {
    if (!data.value) close()
  } finally {
    loading.value = false
  }
}

const navIndex = computed(() => (nav ? nav.items.value.indexOf(itemCode.value) : -1))
function step(d) {
  const n = nav?.items.value[navIndex.value + d]
  if (n) nav.go(n)
}
function close() {
  const r = router.currentRoute.value
  router.push({ path: r.matched[0]?.path || '/inventory', query: r.query })
}
function onKey(e) {
  if (state.dialog || viewer.open || e.ctrlKey || e.metaKey || e.altKey) return
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return
  const k = e.key.toLowerCase()
  if (k === 'escape') close()
  else if (k === 'j') step(1)
  else if (k === 'k') step(-1)
  else return
  e.preventDefault()
}

watch(itemCode, () => {
  body.value?.scrollTo({ top: 0 })
  load()
})
let prevOverflow = ''
onMounted(() => {
  load()
  addEventListener('keydown', onKey)
  prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  panel.value?.focus({ preventScroll: true })
  addEventListener('resize', placeInk)
})
onBeforeUnmount(() => {
  removeEventListener('keydown', onKey)
  removeEventListener('resize', placeInk)
  document.body.style.overflow = prevOverflow
})
</script>

<style scoped>
.sd-root { position: fixed; inset: 0; z-index: 120; display: flex; justify-content: flex-end; }
.sd-overlay { position: absolute; inset: 0; background: rgba(15, 23, 32, 0.42); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); }
.sd-panel {
  position: relative; display: flex; flex-direction: column; outline: none;
  width: min(56rem, 100vw); height: 100%;
  background: var(--bg); box-shadow: -24px 0 48px -12px rgba(15, 23, 32, 0.35);
  border-left: 1px solid var(--border-soft);
}

/* ---- header ---- */
.sd-head { flex: none; background: var(--surface); background-image: var(--hero-grad); border-bottom: 1px solid var(--border-soft); padding: 0.75rem 1.5rem 0; }
.sd-top { display: flex; align-items: center; gap: 0.25rem; }
.sd-top .breadcrumbs { margin: 0; }
.sd-pager { display: flex; align-items: center; gap: 0.125rem; margin-right: 0.25rem; }
.sd-pager .muted { font-size: 0.75rem; margin-right: 0.25rem; font-variant-numeric: tabular-nums; }
.sd-title { display: flex; gap: 0.875rem; align-items: center; margin: 0.75rem 0 1rem; }
.sd-avatar { width: 3.25rem; height: 3.25rem; border-radius: 0.875rem; flex: none; display: grid; place-items: center; overflow: hidden; color: #fff; background: linear-gradient(135deg, var(--brand), #7858ff); box-shadow: 0 6px 16px -6px color-mix(in srgb, var(--brand) 60%, transparent); }
.sd-avatar.img { background: var(--surface-2); }
.sd-avatar img { width: 100%; height: 100%; object-fit: cover; }
.sd-avatar.zoomable { position: relative; padding: 0; border: 1px solid var(--border-soft); cursor: pointer; overflow: hidden; transition: transform 0.2s var(--spring), box-shadow 0.2s; }
.sd-avatar.zoomable:hover { transform: scale(1.06); box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.35); }
.zoom-ico { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0, 0, 0, 0.4); color: #fff; opacity: 0; transition: opacity 0.2s; }
.sd-avatar.zoomable:hover .zoom-ico { opacity: 1; }
.more-badge { position: absolute; right: 2px; bottom: 2px; padding: 0 0.3125rem; border-radius: 0.375rem; background: rgba(0, 0, 0, 0.65); color: #fff; font-size: 0.625rem; font-weight: 700; }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr)); gap: 0.625rem; }
.g-thumb { position: relative; aspect-ratio: 1; padding: 0.375rem; border: 1px solid var(--border-soft); border-radius: 0.75rem; background: #fff; cursor: pointer; overflow: hidden; animation: sd-in-x 0.4s var(--ease) both; animation-delay: calc(var(--i) * 40ms); transition: border-color 0.15s, box-shadow 0.2s; }
.g-thumb img { width: 100%; height: 100%; object-fit: contain; transition: transform 0.35s var(--ease); }
.g-thumb:hover { border-color: var(--brand); box-shadow: var(--shadow-2); }
.g-thumb:hover img { transform: scale(1.08); }
.g-zoom { position: absolute; right: 0.375rem; bottom: 0.375rem; width: 1.875rem; height: 1.875rem; border-radius: 50%; display: grid; place-items: center; background: var(--surface); color: var(--brand); box-shadow: var(--shadow-1); opacity: 0; transform: scale(0.8); transition: opacity 0.2s, transform 0.2s var(--spring); }
.g-thumb:hover .g-zoom { opacity: 1; transform: none; }
.sd-name { min-width: 0; flex: 1; }
.sd-name h2 { font-size: 1.375rem; max-width: 100%; }
.sd-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem; font-size: 0.8125rem; }
.mono-chip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem; padding: 0.0625rem 0.4375rem; border-radius: 0.375rem; background: var(--neutral-bg); color: var(--text); }
.dot { width: 3px; height: 3px; border-radius: 50%; background: var(--text-3); }

.sd-kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.625rem; }
@media (max-width: 760px) { .sd-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.sd-kpi {
  overflow: hidden; display: flex; flex-direction: column; gap: 0.125rem; padding: 0.75rem 0.875rem;
  border-radius: 0.75rem; background: var(--surface); border: 1px solid var(--border-soft);
  animation: sd-in-x 0.5s var(--ease) both; animation-delay: calc(140ms + var(--i) * 45ms);
}
.sd-kpi .k { display: flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; font-weight: 600; color: var(--text-2); }
.sd-kpi .k svg { color: var(--brand); }
.sd-kpi .v { font-size: 1.25rem; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.sd-kpi small { font-size: 0.6875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sd-kpi.neg .v { color: var(--negative); }

.sd-tabs { position: relative; display: flex; gap: 0.25rem; margin-top: 0.875rem; overflow-x: auto; scrollbar-width: none; }
.sd-tabs::-webkit-scrollbar { display: none; }
.sd-tabs button {
  display: inline-flex; align-items: center; gap: 0.375rem; height: 2.75rem; padding: 0 0.875rem;
  border: 0; background: none; color: var(--text-2); font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap; border-radius: 0.5rem 0.5rem 0 0;
  transition: color var(--dur-1);
}
.sd-tabs button:hover { color: var(--text); background: color-mix(in srgb, var(--surface-hover) 60%, transparent); }
.sd-tabs button.on { color: var(--brand); }
.sd-tabs .count { padding: 0 0.375rem; border-radius: 1rem; background: var(--neutral-bg); font-size: 0.6875rem; color: var(--text-2); }
.sd-tabs button.on .count { background: var(--brand-soft); color: var(--brand); }
.sd-ink { position: absolute; left: 0; bottom: 0; height: 3px; border-radius: 3px 3px 0 0; background: var(--brand); transition: transform 0.35s var(--ease), width 0.35s var(--ease); }

/* ---- body ---- */
.sd-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 1.25rem 1.5rem 1.5rem; transition: opacity 0.2s; }
.sd-body.busy { opacity: 0.55; pointer-events: none; }
.sd-sk, .sd-stack { display: flex; flex-direction: column; gap: 1rem; }
.sd-stack > * { animation: sd-in-x 0.45s var(--ease) both; }
.sd-stack > *:nth-child(2) { animation-delay: 60ms; }
.sd-stack > *:nth-child(3) { animation-delay: 120ms; }
.sd-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.sd-grid2 > * { animation: inherit; }
@media (max-width: 760px) { .sd-grid2 { grid-template-columns: 1fr; } }
.sd-card { border: 1px solid var(--border-soft); box-shadow: none; }
.sd-card .table-wrap { max-height: none; }

.legend { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; color: var(--text-2); }
i.in, i.out { display: inline-block; width: 0.625rem; height: 0.625rem; border-radius: 3px; background: var(--positive); }
i.out { background: var(--critical); }
.flow-chart { position: relative; }
.flow-chart svg { width: 100%; height: 180px; display: block; overflow: visible; }
.flow-chart .grid { stroke: var(--grid); stroke-dasharray: 3 4; }
.flow-chart .base { stroke: var(--border); }
.flow-chart .axis { fill: var(--text-2); font-size: 11px; font-family: var(--font); }
.flow-chart g { transition: opacity 0.15s; }
.flow-chart g.dim { opacity: 0.35; }
.b-in, .b-out { transform-box: fill-box; transform-origin: bottom; animation: bar-up 0.7s var(--ease) both; }
.b-in { fill: var(--positive); }
.b-out { fill: var(--critical); }
@keyframes bar-up { from { transform: scaleY(0); } }
.tip {
  position: absolute; top: 0; transform: translate(-50%, -105%); pointer-events: none; white-space: nowrap;
  display: flex; flex-direction: column; gap: 0.125rem; padding: 0.5rem 0.75rem; font-size: 0.8125rem;
  background: var(--surface); border: 1px solid var(--border-soft); border-radius: 0.5rem; box-shadow: var(--shadow-2);
  animation: fade-in 0.15s both;
}
.tip span { display: flex; align-items: center; gap: 0.375rem; }
.tip b { margin-left: auto; padding-left: 0.75rem; font-variant-numeric: tabular-nums; }
.flow-sum { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-soft); }
@media (max-width: 560px) { .flow-sum { grid-template-columns: repeat(2, 1fr); } }
.flow-sum div { display: flex; flex-direction: column; font-size: 0.75rem; }
.flow-sum b { font-size: 1rem; font-variant-numeric: tabular-nums; }
.pos { color: var(--positive); }
.neg { color: var(--negative) !important; }

.sd-facts { display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem; margin: 0; font-size: 0.875rem; }
.sd-facts dt { color: var(--text-2); }
.sd-facts dd { margin: 0; font-weight: 600; text-align: right; word-break: break-word; }
.sd-desc { color: var(--text-2); line-height: 1.55; }

.mv { list-style: none; margin: 0; padding: 0.25rem 0.5rem 0.5rem; }
.mv li {
  display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 0.5rem; border-radius: 0.5rem;
  animation: sd-in-x 0.4s var(--ease) both; animation-delay: calc(min(var(--i), 12) * 25ms);
}
.mv li + li { border-top: 1px solid var(--border-soft); }
.mv li:hover { background: var(--surface-hover); }
.mv-ico { width: 2.25rem; height: 2.25rem; border-radius: 0.625rem; flex: none; display: grid; place-items: center; }
.mv-ico.in { background: var(--positive-bg); color: var(--positive); }
.mv-ico.out { background: var(--critical-bg); color: var(--critical-text); }
.mv-main { flex: 1; min-width: 0; }
.mv-doc { font-weight: 600; }
.mv-qty { display: flex; flex-direction: column; align-items: flex-end; font-variant-numeric: tabular-nums; }
.mv-qty b { font-size: 1rem; }

.sup-av { width: 1.75rem; height: 1.75rem; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 0.6875rem; font-weight: 700; color: #fff; background: linear-gradient(135deg, #0070f2, #00a99d); }
.ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.action-bar.in-panel { flex: none; }
.sep { display: inline-block; width: 1px; height: 0.875rem; margin: 0 0.5rem; background: var(--border); vertical-align: middle; }

/* tab content: slides in from the left, fades out to the right */
.sd-tab-enter-active { transition: opacity 0.28s var(--ease), transform 0.36s var(--ease); }
.sd-tab-leave-active { transition: opacity 0.14s linear, transform 0.14s linear; }
.sd-tab-enter-from { opacity: 0; transform: translateX(-18px); }
.sd-tab-leave-to { opacity: 0; transform: translateX(10px); }

@keyframes sd-in-x { from { opacity: 0; transform: translateX(-14px); } }

@media (max-width: 720px) {
  .sd-head { padding: 0.625rem 1rem 0; }
  .sd-body { padding: 1rem; }
  .sd-pager .muted, .hide-sm { display: none; }
}
</style>

<style>
/* drawer enter/leave (applied by <Transition name="drawer"> in Inventory.vue) */
.drawer-enter-active .sd-overlay, .drawer-leave-active .sd-overlay { transition: opacity 0.4s var(--ease); }
.drawer-enter-active .sd-panel { transition: transform 0.55s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s var(--ease); }
.drawer-leave-active .sd-panel { transition: transform 0.32s cubic-bezier(0.4, 0, 1, 1), opacity 0.32s; }
.drawer-enter-from .sd-overlay, .drawer-leave-to .sd-overlay { opacity: 0; }
.drawer-enter-from .sd-panel, .drawer-leave-to .sd-panel { transform: translateX(100%); opacity: 0.6; }
</style>
