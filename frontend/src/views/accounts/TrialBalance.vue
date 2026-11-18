<template>
  <div class="page fin">
    <FinHeader title="Trial Balance" icon="Sigma" :period="period">
      <template #actions>
        <button class="btn btn-transparent" :disabled="!data" @click="exportCsv"><Icon name="Download" /> <span class="hide-sm">Export</span></button>
      </template>
      <template #guide>
        <p>The <b>trial balance</b> lists every account with its balance at the start of the period, what was debited and credited during it, and the balance at the end. Because every posting has an equal debit and credit, <b>total debits always equal total credits</b>; if they do not, something is wrong in the books.</p>
        <ul>
          <li><b>Opening</b> = balance before the From date (plus opening entries). Income &amp; expense accounts open at zero each fiscal year.</li>
          <li><b>Period</b> = debits and credits posted between the two dates. <b>Closing</b> = Opening + Debit − Credit.</li>
          <li>Group rows show the net of the accounts under them; totals at the bottom add up ledgers only.</li>
        </ul>
      </template>
      <template #filters>
        <RangeFilter v-model:from="from" v-model:to="to" @change="load" />
        <label class="tgl"><input v-model="showZero" type="checkbox" class="cbx" @change="load" /> Show zero-balance accounts</label>
      </template>
    </FinHeader>

    <div class="kpis">
      <div class="kpi" :class="data ? (data.balanced ? 'good' : 'bad') : ''">
        <span class="k">Books check</span>
        <span class="v"><span v-if="data" class="check" :class="data.balanced ? 'ok' : 'bad'"><Icon :name="data.balanced ? 'CheckCircle2' : 'TriangleAlert'" :size="14" /> {{ data.balanced ? 'Debits = Credits' : 'Out of balance' }}</span><template v-else>–</template></span>
        <span class="s">{{ data ? `Difference ${amt(data.total.closing_debit - data.total.closing_credit, { blankZero: false })}` : '' }}</span>
      </div>
      <div class="kpi"><span class="k">Debits in period</span><span class="v">{{ data ? fmtCompact(data.total.debit) : '–' }}</span><span class="s">{{ data ? money(data.total.debit) : '' }}</span></div>
      <div class="kpi"><span class="k">Credits in period</span><span class="v">{{ data ? fmtCompact(data.total.credit) : '–' }}</span><span class="s">{{ data ? money(data.total.credit) : '' }}</span></div>
      <div class="kpi"><span class="k">Closing debit total</span><span class="v">{{ data ? fmtCompact(data.total.closing_debit) : '–' }}</span><span class="s">equals closing credit total</span></div>
      <div class="kpi"><span class="k">Accounts listed</span><span class="v">{{ data ? data.rows.filter((r) => !r.is_group).length : '–' }}</span><span class="s">ledgers with a balance or movement</span></div>
    </div>

    <section class="card sec">
      <div class="toolbar">
        <div class="mini-search"><Icon name="Search" :size="14" /><input v-model="q" class="input compact" placeholder="Filter accounts…" /></div>
        <div class="spacer" />
        <span class="muted" style="font-size: 0.75rem">Hierarchy level</span>
        <div class="segmented sm">
          <button v-for="l in [1, 2, 3, 99]" :key="l" :class="{ on: tree.level === l && !q }" :disabled="!!q" @click="tree.setLevel(l)">{{ l === 99 ? 'All' : l }}</button>
        </div>
      </div>
      <TreeTable :rows="rows" :columns="columns" :bands="bands" :tree="q ? openTree : tree" :drill="(r) => glRoute(r.account, from, to)" :loading="!data" @select="(r) => !r.is_group && $router.push(glRoute(r.account, from, to))">
        <template #foot>
          <tr v-if="data" class="total">
            <td class="acc-col">Total</td>
            <td v-for="c in columns" :key="c.key" class="num">{{ amt(data.total[c.key]) }}</td>
          </tr>
        </template>
      </TreeTable>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { fmtCompact, fmtDate, state } from '../../store'
import FinHeader from './FinHeader.vue'
import RangeFilter from './RangeFilter.vue'
import TreeTable from './TreeTable.vue'
import { amt, downloadCsv, finApi, glRoute, loadContext, money, useTree } from './fin'

const columns = [
  { key: 'opening_debit', label: 'Debit' },
  { key: 'opening_credit', label: 'Credit', cls: 'sep' },
  { key: 'debit', label: 'Debit' },
  { key: 'credit', label: 'Credit', cls: 'sep' },
  { key: 'closing_debit', label: 'Debit' },
  { key: 'closing_credit', label: 'Credit' },
]
const bands = [
  { label: 'Opening balance', span: 2 },
  { label: 'Movement in period', span: 2 },
  { label: 'Closing balance', span: 2 },
]
const from = ref('')
const to = ref('')
const showZero = ref(false)
const data = ref(null)
const q = ref('')
const tree = useTree(3)
const openTree = useTree(99)
const period = computed(() => (from.value ? `${fmtDate(from.value)} – ${fmtDate(to.value)}` : ''))

async function load() {
  const ctx = await loadContext()
  if (!from.value) {
    from.value = ctx.fy_start
    to.value = ctx.today
  }
  data.value = await finApi.trialBalance({ from_date: from.value, to_date: to.value, show_zero: showZero.value ? 1 : 0 })
}
onMounted(load)
watch(() => state.boot?.company, () => ((from.value = ''), load()))

const rows = computed(() => {
  const r = data.value?.rows || []
  const s = q.value.trim().toLowerCase()
  if (!s) return r
  const by = Object.fromEntries(r.map((x) => [x.account, x]))
  const keep = new Set()
  for (const x of r)
    if (`${x.account_number || ''} ${x.account_name}`.toLowerCase().includes(s)) {
      let p = x
      while (p && !keep.has(p.account)) (keep.add(p.account), (p = by[p.parent]))
    }
  return r.filter((x) => keep.has(x.account))
})

function exportCsv() {
  downloadCsv(
    `trial-balance-${from.value}-${to.value}.csv`,
    ['Account', 'Group', 'Opening Dr', 'Opening Cr', 'Debit', 'Credit', 'Closing Dr', 'Closing Cr'],
    data.value.rows.map((r) => [r.account, r.is_group ? 'Yes' : 'No', ...columns.map((c) => r[c.key])]),
  )
}
</script>

<style scoped>
@import './fin.css';
.tgl { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; height: 2.25rem; cursor: pointer; }
:deep(td.sep), :deep(th.sep) { border-right: 1px solid var(--border-soft); }
</style>
