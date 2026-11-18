<template>
  <div class="page fin">
    <FinHeader title="Chart of Accounts" icon="ListTree" :period="`Balances as on ${fmtDate(asOn)}`">
      <template #actions>
        <a class="btn btn-transparent" href="/app/account/view/tree" target="_blank" title="Edit the tree in ERP Desk"><Icon name="ExternalLink" /> <span class="hide-sm">Desk</span></a>
        <button class="btn btn-transparent" :disabled="!data" @click="exportCsv"><Icon name="Download" /> <span class="hide-sm">Export</span></button>
      </template>
      <template #guide>
        <p>The <b>chart of accounts</b> is the list of every ledger the company posts to, arranged as a tree. <b>Groups</b> (bold, with an arrow) only add up the accounts below them; <b>ledgers</b> receive the actual postings.</p>
        <ul>
          <li><b>Asset &amp; Expense</b> accounts normally carry a <b>Dr</b> (debit) balance; <b>Liability, Equity &amp; Income</b> accounts normally carry a <b>Cr</b> (credit) balance.</li>
          <li><b>Balance Sheet</b> accounts (assets, liabilities, equity) carry their balance forward forever; <b>Profit &amp; Loss</b> accounts (income, expenses) start again each fiscal year.</li>
          <li>Click a row to see its details and latest postings; the <Icon name="ArrowUpRight" :size="12" /> icon opens its line items in the General Ledger.</li>
        </ul>
      </template>
      <template #filters>
        <div class="field"><label>Balances as on</label><input v-model="asOn" type="date" class="input" @change="load" /></div>
        <div class="field">
          <label>Account class</label>
          <div class="segmented">
            <button v-for="r in ROOTS" :key="r.key" :class="{ on: root === r.key }" @click="root = r.key">{{ r.label }}</button>
          </div>
        </div>
      </template>
    </FinHeader>

    <div class="kpis">
      <div v-for="(k, i) in kpis" :key="k.label" class="kpi" :style="{ '--i': i }">
        <span class="k">{{ k.label }}</span>
        <span class="v">{{ k.value }}</span>
        <span class="s">{{ k.sub }}</span>
      </div>
    </div>

    <div class="layout" :class="{ withside: sel }">
      <section class="card sec">
        <div class="toolbar">
          <div class="mini-search"><Icon name="Search" :size="14" /><input v-model="q" class="input compact" placeholder="Search by name or number…" /></div>
          <div class="spacer" />
          <span class="muted lvl-l">Hierarchy level</span>
          <div class="segmented sm">
            <button v-for="l in [1, 2, 3, 99]" :key="l" :class="{ on: tree.level === l && !q }" :disabled="!!q" @click="tree.setLevel(l)">{{ l === 99 ? 'All' : l }}</button>
          </div>
        </div>
        <TreeTable
          :rows="rows"
          :columns="columns"
          :tree="q ? openTree : tree"
          :drill="(r) => glRoute(r.account, fin.ctx?.fy_start, asOn)"
          :selected="sel?.account"
          :loading="!data"
          empty-text="No accounts match."
          @select="pick"
        >
          <template #badge="{ row }">
            <span v-if="row.account_type" class="chip">{{ row.account_type }}</span>
            <span v-if="row.frozen" class="chip warn" title="Frozen: no new postings allowed"><Icon name="Lock" :size="10" /> Frozen</span>
            <span v-if="row.disabled" class="chip">Disabled</span>
          </template>
          <template #cell-balance="{ row }"><span :class="sideCls(row)">{{ drcr(row.balance) }}</span></template>
          <template #cell-report_type="{ row }"><span class="muted">{{ row.report_type === 'Balance Sheet' ? 'Balance Sheet' : 'P&L' }}</span></template>
          <template #cell-entries="{ row }"><span class="muted">{{ row.entries || '–' }}</span></template>
        </TreeTable>
      </section>

      <Transition name="side">
        <aside v-if="sel" class="card side">
          <header>
            <div style="min-width: 0">
              <small class="muted">{{ sel.is_group ? 'Account group' : 'Ledger account' }} · {{ sel.root_type }}</small>
              <h3>{{ sel.account_number ? sel.account_number + ' · ' : '' }}{{ sel.account_name }}</h3>
            </div>
            <div class="spacer" />
            <button class="btn btn-transparent btn-icon btn-sm" title="Close" @click="sel = null"><Icon name="X" :size="18" /></button>
          </header>
          <div class="bal-hero">
            <span class="muted">Balance as on {{ fmtDate(asOn) }}</span>
            <b :class="sideCls(sel)">{{ drcr(sel.balance) }}</b>
            <span class="muted s">Debits {{ amt(sel.debit) }} · Credits {{ amt(sel.credit) }}</span>
          </div>
          <dl class="facts-dl">
            <dt>Parent group</dt><dd>{{ detail?.parent_account || '—' }}</dd>
            <dt>Statement</dt><dd>{{ sel.report_type }}</dd>
            <dt>Account type</dt><dd>{{ sel.account_type || '—' }}</dd>
            <dt>Normal balance</dt><dd>{{ ['Asset', 'Expense'].includes(sel.root_type) ? 'Debit' : 'Credit' }}</dd>
            <dt>Currency</dt><dd>{{ sel.currency || fin.ctx?.currency }}</dd>
            <dt>Postings</dt><dd>{{ sel.entries }}<span v-if="sel.last_posting" class="muted"> · last {{ fmtDate(sel.last_posting) }}</span></dd>
          </dl>
          <div v-if="detail?.monthly?.length" class="mini">
            <div class="mini-h">Monthly movement</div>
            <FinChart :labels="detail.monthly.map((m) => mLabel(m.m))" :series="[{ name: 'Debits', values: detail.monthly.map((m) => m.dr), color: 'var(--chart)' }, { name: 'Credits', values: detail.monthly.map((m) => m.cr), color: 'var(--chart-2)' }]" :height="150" label="Monthly debits and credits" />
          </div>
          <div class="mini">
            <div class="mini-h">Latest postings</div>
            <div v-if="!detail" class="skeleton" style="height: 4rem" />
            <div v-else-if="!detail.recent.length" class="muted s">No postings yet.</div>
            <div v-for="e in detail?.recent || []" :key="e.voucher_no + e.debit + e.credit" class="pst">
              <div>
                <VoucherLink :type="e.voucher_type" :name="e.voucher_no" />
                <small class="muted">{{ fmtDate(e.posting_date) }} · {{ e.voucher_type }}{{ e.party ? ' · ' + e.party : '' }}</small>
              </div>
              <b class="mono" :class="e.debit ? '' : 'cr'">{{ e.debit ? amt(e.debit) + ' Dr' : amt(e.credit) + ' Cr' }}</b>
            </div>
          </div>
          <div class="side-act">
            <router-link class="btn btn-emphasized" :to="glRoute(sel.account, fin.ctx?.fy_start, asOn)"><Icon name="BookOpen" /> General Ledger</router-link>
            <a class="btn" :href="`/app/account/${encodeURIComponent(sel.account)}`" target="_blank"><Icon name="ExternalLink" /> Desk</a>
          </div>
        </aside>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { fmtCompact, fmtDate, state } from '../../store'
import FinChart from './FinChart.vue'
import FinHeader from './FinHeader.vue'
import TreeTable from './TreeTable.vue'
import VoucherLink from './VoucherLink.vue'
import { amt, downloadCsv, drcr, fin, finApi, glRoute, loadContext, useTree } from './fin'

const ROOTS = [
  { key: '', label: 'All' },
  { key: 'Asset', label: 'Assets' },
  { key: 'Liability', label: 'Liabilities' },
  { key: 'Equity', label: 'Equity' },
  { key: 'Income', label: 'Income' },
  { key: 'Expense', label: 'Expenses' },
]
const columns = [
  { key: 'report_type', label: 'Statement', plain: true },
  { key: 'entries', label: 'Postings', plain: true },
  { key: 'debit', label: 'Total Debit' },
  { key: 'credit', label: 'Total Credit' },
  { key: 'balance', label: 'Balance', plain: true },
]
const asOn = ref(new Date().toISOString().slice(0, 10))
const data = ref(null)
const q = ref('')
const root = ref('')
const sel = ref(null)
const detail = ref(null)
const tree = useTree(3)
const openTree = useTree(99)

async function load() {
  await loadContext()
  data.value = await finApi.coa(asOn.value)
  if (sel.value) sel.value = data.value.rows.find((r) => r.account === sel.value.account) || null
}
onMounted(load)
watch(() => state.boot?.company, () => ((sel.value = null), load()))

const rows = computed(() => {
  let r = data.value?.rows || []
  if (root.value) r = r.filter((x) => x.root_type === root.value)
  const s = q.value.trim().toLowerCase()
  if (!s) return r
  // keep matches plus every ancestor so the tree stays readable
  const by = Object.fromEntries(r.map((x) => [x.account, x]))
  const keep = new Set()
  for (const x of r) {
    if (`${x.account_number || ''} ${x.account_name} ${x.account_type || ''}`.toLowerCase().includes(s)) {
      let p = x
      while (p && !keep.has(p.account)) {
        keep.add(p.account)
        p = by[p.parent]
      }
    }
  }
  return r.filter((x) => keep.has(x.account))
})

const kpis = computed(() => {
  const st = data.value?.stats
  if (!st) return [1, 2, 3, 4, 5].map((i) => ({ label: '…', value: '–', sub: '' }))
  const b = st.by_root
  return [
    { label: 'Accounts', value: st.total, sub: `${st.groups} groups · ${st.ledgers} ledgers` },
    { label: 'Ledgers in use', value: st.used, sub: `${st.ledgers - st.used} without postings` },
    { label: 'Assets', value: fmtCompact(b.Asset || 0), sub: 'Debit balance' },
    { label: 'Liabilities & Equity', value: fmtCompact(-(b.Liability || 0) - (b.Equity || 0)), sub: 'Credit balance' },
    { label: 'Net result (P&L)', value: fmtCompact(-(b.Income || 0) - (b.Expense || 0)), sub: 'Income − expenses, unclosed' },
  ]
})

function sideCls(r) {
  const normalDr = ['Asset', 'Expense'].includes(r.root_type)
  if (Math.abs(r.balance) < 0.005) return 'z'
  return (r.balance > 0) === normalDr ? '' : 'contra'
}
const mLabel = (m) => new Date(m + '-01').toLocaleDateString(undefined, { month: 'short' })

async function pick(r) {
  sel.value = r
  detail.value = null
  const d = await finApi.accountDetail(r.account)
  if (sel.value?.account === r.account) detail.value = d
}

function exportCsv() {
  downloadCsv(
    `chart-of-accounts-${asOn.value}.csv`,
    ['Account Number', 'Account', 'Parent', 'Group', 'Root Type', 'Account Type', 'Debit', 'Credit', 'Balance (Dr+/Cr-)'],
    rows.value.map((r) => [r.account_number, r.account_name, r.parent, r.is_group ? 'Yes' : 'No', r.root_type, r.account_type, r.debit, r.credit, r.balance]),
  )
}
</script>

<style scoped>
@import './fin.css';
.layout { display: grid; grid-template-columns: 1fr; gap: 1rem; align-items: start; }
.layout.withside { grid-template-columns: minmax(0, 1fr) 24rem; }
@media (max-width: 1100px) { .layout.withside { grid-template-columns: 1fr; } }
.lvl-l { font-size: 0.75rem; }
.chip { display: inline-flex; align-items: center; gap: 0.2rem; padding: 0 0.4rem; border-radius: 1rem; font-size: 0.6875rem; font-weight: 600; background: var(--neutral-bg); color: var(--text-2); white-space: nowrap; }
.chip.warn { background: var(--critical-bg); color: var(--critical-text); }
.contra { color: var(--critical-text); }
.side { position: sticky; top: calc(var(--shell-h) + 1rem); padding: 1rem; border: 1px solid var(--border-soft); box-shadow: none; max-height: calc(100vh - var(--shell-h) - 2rem); overflow: auto; }
.side header { display: flex; align-items: flex-start; gap: 0.5rem; }
.side h3 { font-size: 1.0625rem; margin-top: 0.125rem; }
.bal-hero { display: flex; flex-direction: column; gap: 0.125rem; margin: 1rem 0; padding: 0.875rem 1rem; border-radius: 0.625rem; background: var(--surface-2); }
.bal-hero b { font-size: 1.5rem; font-variant-numeric: tabular-nums; }
.s { font-size: 0.75rem; }
.facts-dl { display: grid; grid-template-columns: 8rem 1fr; gap: 0.375rem 0.75rem; font-size: 0.8125rem; margin: 0 0 1rem; }
.facts-dl dt { color: var(--text-2); }
.facts-dl dd { margin: 0; word-break: break-word; }
.mini { margin-bottom: 1rem; }
.mini-h { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); margin-bottom: 0.5rem; }
.pst { display: flex; justify-content: space-between; gap: 0.75rem; padding: 0.4375rem 0; border-bottom: 1px solid var(--border-soft); font-size: 0.8125rem; }
.pst > div { display: flex; flex-direction: column; min-width: 0; }
.pst small { font-size: 0.6875rem; }
.pst b { white-space: nowrap; font-size: 0.75rem; }
.side-act { display: flex; gap: 0.5rem; }
.side-enter-active, .side-leave-active { transition: opacity 0.2s, transform 0.25s var(--ease); }
.side-enter-from, .side-leave-to { opacity: 0; transform: translateX(12px); }
</style>
