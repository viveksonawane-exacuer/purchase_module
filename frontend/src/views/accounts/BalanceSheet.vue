<template>
  <div class="page fin">
    <FinHeader title="Balance Sheet" icon="Scale" :period="`As on ${fmtDate(asOn)} vs ${fmtDate(cmp)}`">
      <template #actions>
        <button class="btn btn-transparent" :disabled="!data" @click="exportCsv"><Icon name="Download" /> <span class="hide-sm">Export</span></button>
      </template>
      <template #guide>
        <p>The <b>balance sheet</b> is a snapshot of what the company <b>owns</b> (assets) and how it is <b>financed</b> (liabilities owed to others, plus the owners' equity) on one date. The two sides must always be equal: <b>Assets = Liabilities + Equity</b>.</p>
        <ul>
          <li><b>Current</b> items turn into cash (or fall due) within a year; <b>working capital</b> = current assets − current liabilities, and the <b>current ratio</b> above 1.5 is usually considered healthy.</li>
          <li><b>Profit for the period</b> is this year's income minus expenses that has not yet been closed into reserves. It belongs to the owners, so it sits with equity.</li>
          <li>The comparison column shows the same balances on an earlier date, so you can see what changed.</li>
        </ul>
      </template>
      <template #filters>
        <div class="field"><label>As on</label><input v-model="asOn" type="date" class="input" @change="load" /></div>
        <div class="field">
          <label>Compare with</label>
          <div class="segmented">
            <button v-for="c in cmpPresets" :key="c.key" :class="{ on: cmpKey === c.key }" @click="setCmp(c)">{{ c.label }}</button>
          </div>
        </div>
        <div v-if="cmpKey === 'custom'" class="field"><label>Comparison date</label><input v-model="cmp" type="date" class="input" @change="load" /></div>
      </template>
    </FinHeader>

    <div class="kpis">
      <div class="kpi"><span class="k">Total assets</span><span class="v">{{ d ? fmtCompact(d.totals.assets.current) : '–' }}</span><span class="s"><Delta v-if="d" :a="d.totals.assets.current" :b="d.totals.assets.previous" /></span></div>
      <div class="kpi warn"><span class="k">Liabilities (excl. capital)</span><span class="v">{{ d ? fmtCompact(d.totals.liabilities_equity.current - d.ratios.equity) : '–' }}</span><span class="s">Owed to lenders, suppliers, tax</span></div>
      <div class="kpi good"><span class="k">Owners' equity</span><span class="v">{{ d ? fmtCompact(d.ratios.equity) : '–' }}</span><span class="s">Capital + reserves + profit</span></div>
      <div class="kpi" :class="d && d.ratios.working_capital < 0 ? 'bad' : ''"><span class="k">Working capital</span><span class="v">{{ d ? fmtCompact(d.ratios.working_capital) : '–' }}</span><span class="s">Current assets − current liabilities</span></div>
      <div class="kpi" :class="ratioCls"><span class="k">Current ratio</span><span class="v">{{ d?.ratios.current_ratio ? d.ratios.current_ratio.toFixed(2) + '×' : '–' }}</span><span class="s">{{ ratioText }}</span></div>
      <div class="kpi" :class="d && d.difference ? 'bad' : 'good'">
        <span class="k">Balance check</span>
        <span class="v"><span v-if="d" class="check" :class="d.difference ? 'bad' : 'ok'"><Icon :name="d.difference ? 'TriangleAlert' : 'CheckCircle2'" :size="14" /> {{ d.difference ? 'Difference ' + amt(d.difference) : 'Balanced' }}</span><template v-else>–</template></span>
        <span class="s">Assets = Liabilities + Equity</span>
      </div>
    </div>

    <section v-if="d" class="card sec comp">
      <div class="toolbar"><h3>Composition</h3><span class="muted" style="font-size: 0.8125rem">How assets are funded, as on {{ fmtDate(asOn) }}</span></div>
      <div class="comp-body">
        <div v-for="side in composition" :key="side.title" class="comp-side">
          <div class="comp-h"><b>{{ side.title }}</b><span class="mono">{{ money(side.total) }}</span></div>
          <div class="stack" role="img" :aria-label="side.title + ' composition'">
            <span v-for="(p, i) in side.parts" :key="p.name" :style="{ width: p.pct + '%', background: PAL[i % PAL.length] }" :title="`${p.name}: ${money(p.value)} (${p.pct.toFixed(1)}%)`" />
          </div>
          <ul class="comp-lg">
            <li v-for="(p, i) in side.parts" :key="p.name"><i :style="{ background: PAL[i % PAL.length] }" /><span>{{ p.name }}</span><b class="mono">{{ fmtCompact(p.value) }}</b><small class="muted">{{ p.pct.toFixed(1) }}%</small></li>
          </ul>
        </div>
      </div>
    </section>

    <div class="tree-l">
      <div class="segmented sm">
        <button v-for="l in [1, 2, 3, 99]" :key="l" :class="{ on: tree.level === l }" @click="tree.setLevel(l)">{{ l === 99 ? 'All levels' : 'Level ' + l }}</button>
      </div>
    </div>

    <section class="card sec">
      <div class="toolbar"><h3>Assets</h3><span class="muted">What the company owns</span></div>
      <TreeTable :rows="d?.assets || []" :columns="columns" :tree="tree" :drill="drill" :loading="!d" @select="go">
        <template #cell-pct="{ row }"><Pct :row="row" /></template>
        <template #foot>
          <tr v-if="d" class="total"><td class="acc-col">Total Assets</td><td class="num">{{ amt(d.totals.assets.current) }}</td><td class="num">{{ amt(d.totals.assets.previous) }}</td><td class="num">{{ amt(d.totals.assets.current - d.totals.assets.previous) }}</td><td class="num"><Pct :row="{ current: d.totals.assets.current, previous: d.totals.assets.previous }" /></td></tr>
        </template>
      </TreeTable>
    </section>

    <section class="card sec">
      <div class="toolbar"><h3>Liabilities &amp; Equity</h3><span class="muted">How the assets are financed</span></div>
      <TreeTable :rows="leRows" :columns="columns" :tree="tree" :drill="drill" :loading="!d" @select="go">
        <template #badge="{ row }"><span v-if="row.synthetic" class="chip">Unclosed P&amp;L</span></template>
        <template #cell-pct="{ row }"><Pct :row="row" /></template>
        <template #foot>
          <tr v-if="d" class="total"><td class="acc-col">Total Liabilities &amp; Equity</td><td class="num">{{ amt(d.totals.liabilities_equity.current) }}</td><td class="num">{{ amt(d.totals.liabilities_equity.previous) }}</td><td class="num">{{ amt(d.totals.liabilities_equity.current - d.totals.liabilities_equity.previous) }}</td><td class="num"><Pct :row="{ current: d.totals.liabilities_equity.current, previous: d.totals.liabilities_equity.previous }" /></td></tr>
        </template>
      </TreeTable>
    </section>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../../components/Icon.vue'
import { fmtCompact, fmtDate, state } from '../../store'
import FinHeader from './FinHeader.vue'
import TreeTable from './TreeTable.vue'
import { amt, downloadCsv, finApi, glRoute, iso, loadContext, monthEnd, money, useTree } from './fin'

const router = useRouter()
// validated categorical order (blue, orange, aqua, yellow, magenta, green)
const PAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6']
const Pct = defineComponent({
  props: { row: Object },
  setup: (p) => () => {
    const { current: a, previous: b } = p.row
    if (!b || Math.abs(b) < 0.005) return h('span', { class: 'z' }, Math.abs(a) > 0.005 ? 'new' : '–')
    const v = ((a - b) / Math.abs(b)) * 100
    return h('span', { class: Math.abs(v) < 0.05 ? 'z' : '' }, `${v > 0 ? '+' : ''}${v.toFixed(1)}%`)
  },
})
const Delta = defineComponent({
  props: { a: Number, b: Number },
  setup: (p) => () => {
    const d = p.a - p.b
    return h('span', {}, `${d >= 0 ? '▲' : '▼'} ${fmtCompact(Math.abs(d))} vs comparison`)
  },
})

const asOn = ref('')
const cmp = ref('')
const cmpKey = ref('pm')
const data = ref(null)
const d = computed(() => data.value)
const tree = useTree(3)

const columns = computed(() => [
  { key: 'current', label: fmtDate(asOn.value) || 'Current' },
  { key: 'previous', label: fmtDate(cmp.value) || 'Comparison' },
  { key: 'change', label: 'Change' },
  { key: 'pct', label: 'Change %', plain: true },
])
const cmpPresets = computed(() => [
  { key: 'pm', label: 'Previous month-end', date: monthEnd(-1, new Date(asOn.value || Date.now())) },
  { key: 'py', label: 'Last fiscal year-end', date: prevFyEnd() },
  { key: 'custom', label: 'Custom date' },
])
function prevFyEnd() {
  const s = fyStart.value
  if (!s) return null
  const x = new Date(s)
  x.setDate(x.getDate() - 1)
  return iso(x)
}
const fyStart = ref(null)
function setCmp(c) {
  cmpKey.value = c.key
  if (c.date) {
    cmp.value = c.date
    load()
  }
}

async function load() {
  const ctx = await loadContext()
  fyStart.value = ctx.fy_start
  if (!asOn.value) asOn.value = ctx.today
  if (!cmp.value || cmpKey.value === 'pm') cmp.value = monthEnd(-1, new Date(asOn.value))
  data.value = await finApi.balanceSheet({ as_on: asOn.value, compare_to: cmp.value })
}
onMounted(load)
watch(() => state.boot?.company, () => ((asOn.value = ''), load()))

const leRows = computed(() => {
  if (!d.value) return []
  const p = d.value.profit
  const pl = {
    account: '__pl', account_name: 'Profit / (loss) for the period', depth: 1, is_group: 0, synthetic: true,
    root_type: 'Equity', current: p.current, previous: p.previous, change: p.change,
  }
  // place it right after the capital / equity block (India CoA keeps capital under liabilities)
  const rows = [...d.value.liabilities, ...d.value.equity]
  const cap = rows.findIndex((r) => r.depth === 1 && /capital/i.test(r.account_name))
  if (cap < 0) return [...rows, pl]
  let end = cap + 1
  while (end < rows.length && rows[end].depth > 1) end++
  rows.splice(end, 0, pl)
  return rows
})

const drill = (r) => (r.synthetic ? null : glRoute(r.account, fyStart.value, asOn.value))
function go(r) {
  if (r.synthetic) router.push('/accounts/profit-loss')
  else if (!r.is_group) router.push(glRoute(r.account, fyStart.value, asOn.value))
}

const composition = computed(() => {
  if (!d.value) return []
  const parts = (rows, extra = []) => {
    const top = rows.filter((r) => r.depth === 1).map((r) => ({ name: r.account_name, value: r.current }))
    const all = [...top, ...extra].filter((p) => p.value > 0.5).sort((a, b) => b.value - a.value)
    const total = all.reduce((s, p) => s + p.value, 0) || 1
    return { parts: all.map((p) => ({ ...p, pct: (p.value / total) * 100 })), total }
  }
  const a = parts(d.value.assets)
  const l = parts([...d.value.liabilities, ...d.value.equity], d.value.profit.current > 0 ? [{ name: 'Profit for the period', value: d.value.profit.current }] : [])
  return [
    { title: 'Assets', ...a },
    { title: 'Liabilities & Equity', ...l },
  ]
})

const ratioCls = computed(() => {
  const r = d.value?.ratios.current_ratio
  return r == null ? '' : r >= 1.5 ? 'good' : r >= 1 ? 'warn' : 'bad'
})
const ratioText = computed(() => {
  const r = d.value?.ratios.current_ratio
  return r == null ? 'No current liabilities' : r >= 1.5 ? 'Healthy liquidity' : r >= 1 ? 'Adequate, watch closely' : 'Short-term obligations exceed assets'
})

function exportCsv() {
  const rows = [...d.value.assets, ...leRows.value]
  downloadCsv(`balance-sheet-${asOn.value}.csv`, ['Section', 'Account', 'Level', asOn.value, cmp.value, 'Change'], rows.map((r) => [r.root_type, r.account_name, r.depth, r.current, r.previous, r.change]))
}
</script>

<style scoped>
@import './fin.css';
.tree-l { display: flex; justify-content: flex-end; margin-bottom: 0.5rem; }
.chip { padding: 0 0.4rem; border-radius: 1rem; font-size: 0.6875rem; font-weight: 600; background: var(--info-bg); color: var(--info); white-space: nowrap; }
.comp-body { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; padding: 1rem; }
@media (max-width: 900px) { .comp-body { grid-template-columns: 1fr; } }
.comp-h { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.875rem; }
.stack { display: flex; gap: 2px; height: 1.25rem; border-radius: 4px; overflow: hidden; background: var(--neutral-bg); }
.stack span { min-width: 2px; transition: width 0.5s var(--ease); }
.comp-lg { list-style: none; margin: 0.75rem 0 0; padding: 0; display: grid; gap: 0.25rem; font-size: 0.8125rem; }
.comp-lg li { display: grid; grid-template-columns: 0.625rem 1fr auto 3.5rem; gap: 0.5rem; align-items: center; }
.comp-lg i { width: 0.625rem; height: 0.625rem; border-radius: 2px; }
.comp-lg small { text-align: right; }
</style>
