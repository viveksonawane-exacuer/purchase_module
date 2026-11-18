<template>
  <div class="page fin">
    <FinHeader title="Cash Flow Statement" icon="Wallet" :period="period">
      <template #actions>
        <button class="btn btn-transparent" :disabled="!data" @click="exportCsv"><Icon name="Download" /> <span class="hide-sm">Export</span></button>
      </template>
      <template #guide>
        <p>The <b>cash flow statement</b> explains <b>why the cash and bank balance changed</b> over the period. Profit is not the same as cash: a sale on credit is profit today but cash only when the customer pays.</p>
        <ul>
          <li><b>Operating activities</b> start from net profit, add back non-cash costs such as depreciation, then adjust for working capital. More money stuck in receivables or stock <i>reduces</i> cash; more owed to suppliers <i>keeps</i> cash in the business.</li>
          <li><b>Investing activities</b> are purchases or sales of long-term assets (machinery, equipment, investments).</li>
          <li><b>Financing activities</b> are money from or to owners and lenders: share capital, loans taken or repaid.</li>
          <li>Opening cash + the three sections = closing cash. The check badge confirms the statement reconciles to the cash &amp; bank ledgers. Amounts in brackets are cash going out.</li>
        </ul>
      </template>
      <template #filters>
        <RangeFilter v-model:from="from" v-model:to="to" @change="load" />
      </template>
    </FinHeader>

    <div class="kpis">
      <div class="kpi"><span class="k">Opening cash &amp; bank</span><span class="v">{{ d ? fmtCompact(d.opening_cash) : '–' }}</span><span class="s">{{ d ? 'on ' + fmtDate(d.from_date) : '' }}</span></div>
      <div v-for="sec in d?.sections || []" :key="sec.key" class="kpi" :class="sec.total < 0 ? 'warn' : 'good'">
        <span class="k">{{ sec.title }}</span><span class="v">{{ fmtCompact(sec.total) }}</span><span class="s">{{ sec.total < 0 ? 'net cash used' : 'net cash generated' }}</span>
      </div>
      <div class="kpi"><span class="k">Closing cash &amp; bank</span><span class="v">{{ d ? fmtCompact(d.closing_cash) : '–' }}</span>
        <span class="s"><span v-if="d" class="check" :class="d.difference ? 'bad' : 'ok'"><Icon :name="d.difference ? 'TriangleAlert' : 'CheckCircle2'" :size="12" /> {{ d.difference ? 'Unreconciled ' + amt(d.difference) : 'Reconciled to ledgers' }}</span></span>
      </div>
    </div>

    <div v-if="d" class="grid2">
      <section class="card sec">
        <div class="toolbar"><h3>Cash bridge</h3><span class="muted" style="font-size: 0.8125rem">Opening to closing cash</span></div>
        <div class="card-body wf-body">
          <div class="legend"><span><i style="background: var(--chart)" />Cash in</span><span><i style="background: var(--chart-2)" />Cash out</span><span><i style="background: var(--text-3)" />Balance</span></div>
          <svg :viewBox="`0 0 ${WW} ${WH}`" class="wf" role="img" aria-label="Cash bridge from opening to closing balance" @mouseleave="wfHover = -1">
            <line v-for="t in wfTicks" :key="t" :x1="40" :x2="WW" :y1="wy(t)" :y2="wy(t)" class="grid" />
            <text v-for="t in wfTicks" :key="'t' + t" :x="36" :y="wy(t) + 4" class="axis" text-anchor="end">{{ fmtCompact(t) }}</text>
            <g v-for="(b, i) in bridge" :key="b.label" @mouseenter="wfHover = i">
              <rect :x="wx(i) - wbw / 2" :y="Math.min(wy(b.start), wy(b.end))" :width="wbw" :height="Math.max(1, Math.abs(wy(b.start) - wy(b.end)))" rx="3" :style="{ fill: b.color }" :class="{ dim: wfHover > -1 && wfHover !== i }" class="wbar" />
              <line v-if="i < bridge.length - 1" :x1="wx(i) + wbw / 2" :x2="wx(i + 1) - wbw / 2" :y1="wy(b.end)" :y2="wy(b.end)" class="conn" />
              <text :x="wx(i)" :y="Math.min(wy(b.start), wy(b.end)) - 6" class="val" text-anchor="middle">{{ (b.delta && b.value > 0 ? '+' : '') + fmtCompact(b.value) }}</text>
              <text :x="wx(i)" :y="WH - 6" class="axis" text-anchor="middle">{{ b.short }}</text>
            </g>
          </svg>
        </div>
      </section>
      <section class="card sec">
        <div class="toolbar"><h3>Monthly cash movement</h3><span class="muted" style="font-size: 0.8125rem">Cash &amp; bank accounts</span></div>
        <div class="card-body" style="padding-top: 0.75rem">
          <FinChart
            v-if="d.monthly.length"
            :labels="d.monthly.map((m) => m.label)"
            :series="[
              { name: 'Cash in', values: d.monthly.map((m) => m.inflow), color: 'var(--chart)' },
              { name: 'Cash out', values: d.monthly.map((m) => m.outflow), color: 'var(--chart-2)' },
              { name: 'Closing balance', values: d.monthly.map((m) => m.closing), color: 'var(--chart-ink)', type: 'line' },
            ]"
            :height="210"
            label="Monthly cash in, cash out and closing balance"
          />
          <div v-else class="empty">No cash movement in this period.</div>
        </div>
      </section>
    </div>

    <section class="card sec">
      <div class="toolbar"><h3>Statement (indirect method)</h3><div class="spacer" /><button class="btn btn-sm btn-transparent" @click="toggleAll">{{ allOpen ? 'Hide account detail' : 'Show account detail' }}</button></div>
      <div class="table-wrap">
        <table class="tbl cf">
          <thead><tr><th>Particulars</th><th class="num">Amount</th></tr></thead>
          <tbody v-if="d">
            <template v-for="sec in d.sections" :key="sec.key">
              <tr class="sec-h"><td colspan="2"><span class="sec-ico" :class="sec.key"><Icon :name="ICON[sec.key]" :size="14" /></span>{{ sec.title }}</td></tr>
              <template v-for="l in sec.lines" :key="l.label">
                <tr class="ln" :class="{ clickable: l.accounts.length, prof: l.profit }" @click="l.accounts.length && toggle(sec.key + l.label)">
                  <td>
                    <Icon v-if="l.accounts.length" name="ChevronRight" :size="13" class="chev" :class="{ rot: open.has(sec.key + l.label) }" />
                    <span v-else class="chev-pad" />
                    {{ l.label }}
                    <router-link v-if="l.profit" to="/accounts/profit-loss" class="mini-link" @click.stop>view P&amp;L</router-link>
                  </td>
                  <td class="num" :class="{ neg: l.amount < 0 }">{{ amt(l.amount) }}</td>
                </tr>
                <template v-if="open.has(sec.key + l.label)">
                  <tr v-for="a in l.accounts" :key="a.account" class="acc-ln clickable" @click="$router.push(glRoute(a.account, from, to))">
                    <td>{{ a.account_name }} <Icon name="ArrowUpRight" :size="12" class="go" /></td>
                    <td class="num" :class="{ neg: a.amount < 0 }">{{ amt(a.amount) }}</td>
                  </tr>
                </template>
              </template>
              <tr class="subtotal"><td>Net cash {{ sec.total < 0 ? 'used in' : 'from' }} {{ sec.title.toLowerCase() }}</td><td class="num" :class="{ neg: sec.total < 0 }">{{ amt(sec.total) }}</td></tr>
            </template>
            <tr class="sum"><td>Net increase / (decrease) in cash</td><td class="num" :class="{ neg: d.net_change < 0 }">{{ amt(d.net_change) }}</td></tr>
            <tr class="sum"><td>Cash &amp; bank at the beginning ({{ fmtDate(d.from_date) }})</td><td class="num">{{ amt(d.opening_cash) }}</td></tr>
            <tr class="total"><td>Cash &amp; bank at the end ({{ fmtDate(d.to_date) }})</td><td class="num">{{ amt(d.closing_cash) }}</td></tr>
          </tbody>
        </table>
        <div v-if="!d" class="sk"><div v-for="i in 8" :key="i" class="skeleton" /></div>
      </div>
    </section>

    <section v-if="d" class="card sec">
      <div class="toolbar"><h3>Cash &amp; bank accounts</h3></div>
      <div class="table-wrap">
        <table class="tbl cf">
          <thead><tr><th>Account</th><th>Type</th><th class="num">Opening</th><th class="num">Received</th><th class="num">Paid</th><th class="num">Closing</th></tr></thead>
          <tbody>
            <tr v-for="c in d.cash_accounts" :key="c.account" class="clickable" @click="$router.push(glRoute(c.account, from, to))">
              <td class="title">{{ c.account_name }}</td><td class="muted">{{ c.account_type }}</td>
              <td class="num">{{ amt(c.opening) }}</td><td class="num">{{ amt(c.inflow) }}</td><td class="num">{{ amt(c.outflow) }}</td>
              <td class="num" :class="{ neg: c.closing < 0 }"><b>{{ amt(c.closing) }}</b></td>
            </tr>
            <tr class="total">
              <td colspan="2">Total</td>
              <td class="num">{{ amt(sum('opening')) }}</td><td class="num">{{ amt(sum('inflow')) }}</td><td class="num">{{ amt(sum('outflow')) }}</td><td class="num">{{ amt(sum('closing')) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { fmtCompact, fmtDate, state } from '../../store'
import FinChart from './FinChart.vue'
import FinHeader from './FinHeader.vue'
import RangeFilter from './RangeFilter.vue'
import { amt, downloadCsv, finApi, glRoute, loadContext } from './fin'

const ICON = { operating: 'Workflow', investing: 'Building2', financing: 'Landmark' }
const from = ref('')
const to = ref('')
const data = ref(null)
const d = computed(() => data.value)
const open = reactive(new Set())
const period = computed(() => (from.value ? `${fmtDate(from.value)} – ${fmtDate(to.value)}` : ''))

async function load() {
  const ctx = await loadContext()
  if (!from.value) {
    from.value = ctx.fy_start
    to.value = ctx.today
  }
  data.value = await finApi.cashFlow({ from_date: from.value, to_date: to.value })
}
onMounted(load)
watch(() => state.boot?.company, () => ((from.value = ''), load()))

const toggle = (k) => (open.has(k) ? open.delete(k) : open.add(k))
const allKeys = computed(() => (d.value?.sections || []).flatMap((s) => s.lines.filter((l) => l.accounts.length).map((l) => s.key + l.label)))
const allOpen = computed(() => allKeys.value.length && allKeys.value.every((k) => open.has(k)))
function toggleAll() {
  const v = !allOpen.value
  open.clear()
  if (v) allKeys.value.forEach((k) => open.add(k))
}
const sum = (k) => (d.value?.cash_accounts || []).reduce((s, c) => s + c[k], 0)

// ---- waterfall
const WW = 560
const WH = 230
const bridge = computed(() => {
  if (!d.value) return []
  let run = d.value.opening_cash
  const out = [{ label: 'Opening cash', short: 'Opening', start: 0, end: run, value: run, color: 'var(--text-3)' }]
  for (const s of d.value.sections) {
    out.push({ label: s.title, short: s.title.split(' ')[0], start: run, end: run + s.total, value: s.total, delta: true, color: s.total >= 0 ? 'var(--chart)' : 'var(--chart-2)' })
    run += s.total
  }
  out.push({ label: 'Closing cash', short: 'Closing', start: 0, end: d.value.closing_cash, value: d.value.closing_cash, color: 'var(--text-3)' })
  return out
})
const wfMax = computed(() => Math.max(1, ...bridge.value.flatMap((b) => [b.start, b.end])) * 1.12)
const wfMin = computed(() => Math.min(0, ...bridge.value.flatMap((b) => [b.start, b.end])))
const wfTicks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => wfMin.value + (wfMax.value - wfMin.value) * f).map((t) => Math.round(t / 1000) * 1000))
const wfHover = ref(-1)
const wstep = computed(() => (WW - 48) / Math.max(1, bridge.value.length))
const wbw = computed(() => Math.min(56, wstep.value * 0.55))
const wx = (i) => 48 + wstep.value * i + wstep.value / 2
const wy = (v) => 18 + (WH - 24 - 18) * (1 - (v - wfMin.value) / (wfMax.value - wfMin.value))

function exportCsv() {
  const rows = []
  for (const s of d.value.sections) {
    rows.push([s.title, ''])
    for (const l of s.lines) {
      rows.push(['  ' + l.label, l.amount])
      for (const a of l.accounts) rows.push(['    ' + a.account_name, a.amount])
    }
    rows.push([`Net cash from ${s.title.toLowerCase()}`, s.total])
  }
  rows.push(['Net change in cash', d.value.net_change], ['Opening cash', d.value.opening_cash], ['Closing cash', d.value.closing_cash])
  downloadCsv(`cash-flow-${from.value}-${to.value}.csv`, ['Particulars', 'Amount'], rows)
}
</script>

<style scoped>
@import './fin.css';
.wf-body { padding-top: 0.75rem; }
.legend { display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-2); margin-bottom: 0.25rem; }
.legend span { display: inline-flex; align-items: center; gap: 0.375rem; }
.legend i { width: 0.625rem; height: 0.625rem; border-radius: 2px; display: inline-block; }
.wf { width: 100%; height: 230px; display: block; overflow: visible; }
.grid { stroke: var(--grid); }
.axis { fill: var(--text-2); font-size: 11px; font-family: var(--font); }
.val { fill: var(--text); font-size: 11px; font-weight: 700; font-family: var(--font); }
.conn { stroke: var(--text-3); stroke-dasharray: 3 3; }
.wbar { transition: opacity 0.15s; }
.wbar.dim { opacity: 0.4; }
.cf { font-size: 0.8125rem; }
.cf td { padding: 0.5rem 0.75rem; }
.cf .num { min-width: 9rem; font-variant-numeric: tabular-nums; }
.sec-h td { background: var(--surface-2); font-weight: 800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; border-top: 1px solid var(--border); }
.sec-ico { display: inline-grid; place-items: center; width: 1.375rem; height: 1.375rem; border-radius: 0.375rem; margin-right: 0.5rem; vertical-align: middle; background: var(--brand-soft); color: var(--brand); }
.ln td:first-child { padding-left: 1.25rem; }
.ln.prof td { font-weight: 600; }
.chev { vertical-align: -2px; margin-right: 0.25rem; color: var(--text-3); transition: transform 0.2s var(--ease); }
.chev.rot { transform: rotate(90deg); }
.chev-pad { display: inline-block; width: 13px; margin-right: 0.25rem; }
.acc-ln td { color: var(--text-2); font-size: 0.78rem; padding-top: 0.3rem; padding-bottom: 0.3rem; }
.acc-ln td:first-child { padding-left: 3rem; }
.go { color: var(--link); opacity: 0; }
.acc-ln:hover .go { opacity: 1; }
.mini-link { margin-left: 0.5rem; font-size: 0.75rem; font-weight: 400; }
tr.subtotal td { font-weight: 700; background: color-mix(in srgb, var(--brand) 5%, var(--surface)); }
tr.sum td { font-weight: 600; }
tr.total td { font-weight: 800; background: var(--surface-2); border-top: 2px solid var(--text-3); border-bottom: 3px double var(--text-3); }
.sk { padding: 1rem; display: grid; gap: 0.5rem; }
.sk .skeleton { height: 1.125rem; }
</style>
