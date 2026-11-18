<template>
  <div class="page fin">
    <FinHeader title="Profit and Loss" icon="TrendingUp" :period="period">
      <template #actions>
        <button class="btn btn-transparent" :disabled="!data" @click="exportCsv"><Icon name="Download" /> <span class="hide-sm">Export</span></button>
      </template>
      <template #guide>
        <p>The <b>profit and loss statement</b> (income statement) shows how the company performed <b>over a period</b>: what it earned, what it spent to earn it, and what was left.</p>
        <ul>
          <li><b>Revenue</b> = sales and services billed (direct income). <b>Cost of sales</b> = direct costs such as the cost of goods sold out of stock.</li>
          <li><b>Gross profit</b> = revenue − cost of sales; the <b>gross margin</b> shows how much of every rupee of sales is left after direct costs.</li>
          <li><b>Operating expenses</b> are the running costs (salaries, rent, utilities, depreciation, interest). <b>Net profit</b> = all income − all expenses.</li>
          <li>Expenses are shown as positive numbers; a loss shows in brackets. Click any ledger to see the postings behind it.</li>
        </ul>
      </template>
      <template #filters>
        <RangeFilter v-model:from="from" v-model:to="to" @change="load" />
        <div class="field">
          <label>Columns</label>
          <div class="segmented">
            <button v-for="p in ['Monthly', 'Quarterly', 'Total']" :key="p" :class="{ on: per === p }" @click="(per = p), load()">{{ p }}</button>
          </div>
        </div>
      </template>
    </FinHeader>

    <div class="kpis">
      <div class="kpi"><span class="k">Revenue</span><span class="v">{{ s ? fmtCompact(s.revenue.total) : '–' }}</span><span class="s">{{ s ? `incl. other income ${fmtCompact(s.other_income.total)}` : '' }}</span></div>
      <div class="kpi warn"><span class="k">Cost of sales</span><span class="v">{{ s ? fmtCompact(s.cogs.total) : '–' }}</span><span class="s">{{ s ? pct(s.cogs.total / s.direct_income.total) + ' of revenue' : '' }}</span></div>
      <div class="kpi" :class="s && s.gross_profit.total < 0 ? 'bad' : 'good'"><span class="k">Gross profit</span><span class="v">{{ s ? fmtCompact(s.gross_profit.total) : '–' }}</span><span class="s">{{ s ? 'Gross margin ' + pct(s.gross_profit.total / s.direct_income.total) : '' }}</span></div>
      <div class="kpi warn"><span class="k">Operating expenses</span><span class="v">{{ s ? fmtCompact(s.opex.total) : '–' }}</span><span class="s">{{ s ? pct(s.opex.total / s.revenue.total) + ' of revenue' : '' }}</span></div>
      <div class="kpi" :class="s && s.net_profit.total < 0 ? 'bad' : 'good'"><span class="k">Net {{ s && s.net_profit.total < 0 ? 'loss' : 'profit' }}</span><span class="v">{{ s ? fmtCompact(s.net_profit.total) : '–' }}</span><span class="s">{{ s ? 'Net margin ' + pct(s.net_profit.total / s.revenue.total) : '' }}</span></div>
    </div>

    <section v-if="data?.periods.length" class="card sec">
      <div class="toolbar"><h3>Revenue, expenses and net profit</h3><span class="muted" style="font-size: 0.8125rem">by {{ per === 'Monthly' ? 'month' : 'quarter' }}</span></div>
      <div class="card-body" style="padding-top: 0.75rem">
        <FinChart
          :labels="data.periods.map((p) => p.label.replace(' 20', ' ’'))"
          :series="[
            { name: 'Revenue', values: keys.map((k) => s.revenue[k]), color: 'var(--chart)' },
            { name: 'Expenses', values: keys.map((k) => s.cogs[k] + s.opex[k]), color: 'var(--chart-2)' },
            { name: 'Net profit', values: keys.map((k) => s.net_profit[k]), color: 'var(--chart-ink)', type: 'line' },
          ]"
          :height="230"
          label="Revenue, expenses and net profit by period"
        />
      </div>
    </section>

    <!-- structured statement -->
    <section class="card sec">
      <div class="toolbar"><h3>Statement</h3><span class="muted" style="font-size: 0.8125rem">Summary view</span></div>
      <div class="table-wrap">
        <table class="tbl fin-tbl stmt">
          <thead>
            <tr><th class="acc-col">Line item</th><th v-for="p in data?.periods || []" :key="p.key" class="num">{{ p.label }}</th><th class="num">Total</th><th class="num">% of revenue</th></tr>
          </thead>
          <tbody v-if="s">
            <tr v-for="l in lines" :key="l.label" :class="l.cls">
              <td class="acc-col"><span :style="{ paddingLeft: (l.indent || 0) + 'rem' }">{{ l.op ? l.op + ' ' : '' }}{{ l.label }}</span></td>
              <td v-for="k in [...keys, 'total']" :key="k" class="num" :class="{ neg: l.v[k] < 0 }">{{ amt(l.v[k]) }}</td>
              <td class="num muted">{{ pct(l.v.total / s.revenue.total) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!s" class="sk"><div v-for="i in 6" :key="i" class="skeleton" /></div>
      </div>
    </section>

    <div class="tree-l">
      <span class="muted" style="font-size: 0.75rem">Detail level</span>
      <div class="segmented sm">
        <button v-for="l in [2, 3, 99]" :key="l" :class="{ on: tree.level === l }" @click="tree.setLevel(l)">{{ l === 99 ? 'All' : l }}</button>
      </div>
    </div>
    <section class="card sec">
      <div class="toolbar"><h3>Income</h3><span class="muted">Credit balances · what was earned</span></div>
      <TreeTable :rows="data?.income || []" :columns="columns" :tree="tree" :drill="drill" :loading="!data" @select="go">
        <template #foot><tr v-if="s" class="total"><td class="acc-col">Total Income</td><td v-for="c in columns" :key="c.key" class="num">{{ c.key === 'share' ? '100.0%' : amt(s.revenue[c.key]) }}</td></tr></template>
        <template #cell-share="{ row }"><span class="muted">{{ pct(row.total / s.revenue.total) }}</span></template>
      </TreeTable>
    </section>
    <section class="card sec">
      <div class="toolbar"><h3>Expenses</h3><span class="muted">Debit balances · what was spent</span></div>
      <TreeTable :rows="data?.expense || []" :columns="columns" :tree="tree" :drill="drill" :loading="!data" @select="go">
        <template #foot><tr v-if="s" class="total"><td class="acc-col">Total Expenses</td><td v-for="c in columns" :key="c.key" class="num">{{ c.key === 'share' ? pct((s.cogs.total + s.opex.total) / s.revenue.total) : amt(s.cogs[c.key] + s.opex[c.key]) }}</td></tr></template>
        <template #cell-share="{ row }"><span class="muted">{{ pct(row.total / s.revenue.total) }}</span></template>
      </TreeTable>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../../components/Icon.vue'
import { fmtCompact, fmtDate, state } from '../../store'
import FinChart from './FinChart.vue'
import FinHeader from './FinHeader.vue'
import RangeFilter from './RangeFilter.vue'
import TreeTable from './TreeTable.vue'
import { amt, downloadCsv, finApi, glRoute, loadContext, pct, useTree } from './fin'

const router = useRouter()
const from = ref('')
const to = ref('')
const per = ref('Monthly')
const data = ref(null)
const tree = useTree(3)
const s = computed(() => data.value?.summary)
const keys = computed(() => (data.value?.periods || []).map((p) => p.key))
const period = computed(() => (from.value ? `${fmtDate(from.value)} – ${fmtDate(to.value)}` : ''))
const columns = computed(() => [
  ...(data.value?.periods || []).map((p) => ({ key: p.key, label: p.label })),
  { key: 'total', label: 'Total' },
  { key: 'share', label: '% of rev.', plain: true },
])

const lines = computed(() => {
  const v = s.value
  const sub = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] - b[k]]))
  return [
    { label: 'Revenue from operations', v: v.direct_income },
    { label: 'Cost of sales', v: v.cogs, op: '−', indent: 0.75 },
    { label: 'Gross profit', v: v.gross_profit, cls: 'subtotal' },
    { label: 'Other income', v: v.other_income, op: '+', indent: 0.75 },
    { label: 'Operating expenses', v: v.opex, op: '−', indent: 0.75 },
    { label: 'Total expenses', v: Object.fromEntries(Object.keys(v.cogs).map((k) => [k, v.cogs[k] + v.opex[k]])), cls: 'muted-row' },
    { label: v.net_profit.total < 0 ? 'Net loss for the period' : 'Net profit for the period', v: v.net_profit, cls: 'total' },
    { label: 'Operating profit (EBIT proxy)', v: sub(v.gross_profit, v.opex), cls: 'muted-row' },
  ]
})

async function load() {
  const ctx = await loadContext()
  if (!from.value) {
    from.value = ctx.fy_start
    to.value = ctx.today
  }
  data.value = await finApi.profitLoss({ from_date: from.value, to_date: to.value, periodicity: per.value })
}
onMounted(load)
watch(() => state.boot?.company, () => ((from.value = ''), load()))

const drill = (r) => glRoute(r.account, from.value, to.value)
const go = (r) => !r.is_group && router.push(drill(r))

function exportCsv() {
  const ks = [...keys.value, 'total']
  const head = ['Section', 'Account', 'Level', ...(data.value.periods || []).map((p) => p.label), 'Total']
  const rows = [...data.value.income, ...data.value.expense].map((r) => [r.root_type, r.account_name, r.depth, ...ks.map((k) => r[k])])
  rows.push([], ...lines.value.map((l) => ['Summary', l.label, '', ...ks.map((k) => l.v[k])]))
  downloadCsv(`profit-and-loss-${from.value}-${to.value}.csv`, head, rows)
}
</script>

<style scoped>
@import './fin.css';
.tree-l { display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.fin-tbl { font-size: 0.8125rem; }
.fin-tbl td { padding: 0.5rem 0.75rem; white-space: nowrap; }
.fin-tbl .num { min-width: 7.5rem; }
.stmt .acc-col { position: sticky; left: 0; background: inherit; min-width: 16rem; z-index: 1; }
.stmt thead .acc-col { background: var(--surface-2); z-index: 2; }
.stmt tbody tr { background: var(--surface); }
.stmt tr.subtotal td { font-weight: 700; background: color-mix(in srgb, var(--brand) 5%, var(--surface)); }
.stmt tr.total td { font-weight: 800; background: var(--surface-2); border-top: 2px solid var(--text-3); border-bottom: 3px double var(--text-3); }
.stmt tr.muted-row td { color: var(--text-2); font-style: italic; }
.sk { padding: 1rem; display: grid; gap: 0.5rem; }
.sk .skeleton { height: 1.125rem; }
</style>
