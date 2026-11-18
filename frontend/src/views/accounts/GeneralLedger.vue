<template>
  <div class="page fin">
    <FinHeader title="General Ledger" icon="BookOpen" :period="period">
      <template #actions>
        <button class="btn btn-transparent" :disabled="!data?.entries.length" @click="exportCsv"><Icon name="Download" /> <span class="hide-sm">Export</span></button>
        <button class="btn btn-emphasized" @click="apply"><Icon name="RefreshCw" :class="{ spin: loading }" /> Go</button>
      </template>
      <template #guide>
        <p>The <b>general ledger</b> shows every individual posting (line item) behind the balances in the other reports, in date order, with a <b>running balance</b>.</p>
        <ul>
          <li>Pick an <b>account</b> to see its opening balance, each debit and credit, and the closing balance. Picking a <b>group</b> account includes all ledgers under it.</li>
          <li><b>Dr</b> (debit) increases assets and expenses; <b>Cr</b> (credit) increases liabilities, equity and income.</li>
          <li><b>Against</b> is the other side of the entry, e.g. the bank account paid from. Click a voucher number to open the source document.</li>
          <li>Leave the account empty to browse all postings of the company (filter by party or voucher type to narrow down).</li>
        </ul>
      </template>
      <template #filters>
        <div class="field acc-f"><label>Account</label><LinkInput v-model="f.account" doctype="Account" :filters="{ company: state.boot?.company }" placeholder="All accounts" @select="apply" @update:model-value="(v) => !v && apply()" /></div>
        <RangeFilter v-model:from="f.from_date" v-model:to="f.to_date" @change="apply" />
        <div class="field">
          <label>Party type</label>
          <select v-model="f.party_type" class="input" @change="(f.party = ''), apply()">
            <option value="">Any</option><option>Supplier</option><option>Customer</option><option>Employee</option>
          </select>
        </div>
        <div v-if="f.party_type" class="field"><label>{{ f.party_type }}</label><LinkInput v-model="f.party" :doctype="f.party_type" @select="apply" @update:model-value="(v) => !v && apply()" /></div>
        <div class="field"><label>Voucher no.</label><input v-model="f.voucher_no" class="input" placeholder="e.g. ACC-JV-2026-0001" @keydown.enter="apply" /></div>
      </template>
    </FinHeader>

    <div v-if="d" class="acc-card card">
      <div class="ac-name">
        <small class="muted">{{ d.account ? (d.account.is_group ? 'Account group' : 'Ledger account') + ' · ' + d.account.root_type : 'All accounts' }}</small>
        <h2>{{ d.account?.account_name || 'Every posting of ' + d.company }}</h2>
        <div class="vt">
          <button v-for="t in d.by_voucher_type" :key="t.voucher_type" class="vt-chip" :class="{ on: f.voucher_type === t.voucher_type }" @click="setType(t.voucher_type)">{{ t.voucher_type }} <b>{{ t.count }}</b></button>
          <button v-if="f.voucher_type" class="vt-chip clear" @click="setType('')"><Icon name="X" :size="12" /> {{ f.voucher_type }}</button>
        </div>
      </div>
      <div class="ac-figs">
        <div><span>Opening</span><b>{{ drcr(d.opening) }}</b></div>
        <div class="op">+</div>
        <div><span>Debits</span><b>{{ amt(d.debit) }}</b></div>
        <div class="op">−</div>
        <div><span>Credits</span><b>{{ amt(d.credit) }}</b></div>
        <div class="op">=</div>
        <div class="cl"><span>Closing</span><b>{{ drcr(d.closing) }}</b></div>
      </div>
    </div>

    <section class="card sec">
      <div class="toolbar">
        <b>{{ d ? `${filtered.length} line item(s)` : 'Loading…' }}</b>
        <span v-if="d?.truncated" class="check bad"><Icon name="TriangleAlert" :size="12" /> First 2,000 lines shown, narrow the filters</span>
        <div class="spacer" />
        <div class="mini-search"><Icon name="Search" :size="14" /><input v-model="q" class="input compact" placeholder="Search remarks, party, voucher…" /></div>
      </div>
      <div class="table-wrap gl-wrap" :class="{ busy: loading }">
        <table class="tbl gl">
          <thead>
            <tr>
              <th>Posting date</th><th>Voucher</th><th>Type</th><th v-if="showAcc">Account</th><th>Party</th><th>Against</th><th>Remarks</th>
              <th class="num">Debit</th><th class="num">Credit</th><th v-if="runBal" class="num">Balance</th>
            </tr>
          </thead>
          <tbody v-if="d">
            <tr class="ob">
              <td>{{ fmtDate(d.from_date) }}</td><td :colspan="cols - (runBal ? 4 : 3)"><b>Opening balance</b></td>
              <td class="num">{{ d.opening > 0 ? amt(d.opening) : '' }}</td><td class="num">{{ d.opening < 0 ? amt(-d.opening) : '' }}</td>
              <td v-if="runBal" class="num"><b>{{ drcr(d.opening) }}</b></td>
            </tr>
            <tr v-for="e in paged" :key="e.name">
              <td class="nw">{{ fmtDate(e.posting_date) }}</td>
              <td><VoucherLink :type="e.voucher_type" :name="e.voucher_no" /></td>
              <td class="muted nw">{{ e.voucher_type }}</td>
              <td v-if="showAcc" class="nw"><router-link :to="{ query: { ...$route.query, account: e.account } }" @click="f.account = e.account">{{ e.account_name }}</router-link></td>
              <td class="nw">{{ e.party || '' }}<small v-if="e.party" class="muted"> · {{ e.party_type }}</small></td>
              <td class="against" :title="e.against">{{ short(e.against) }}</td>
              <td class="rem" :title="e.remarks">{{ (e.remarks || '').replace(/^DEMO-FIN: /, '') }}</td>
              <td class="num">{{ e.debit ? amt(e.debit) : '' }}</td>
              <td class="num">{{ e.credit ? amt(e.credit) : '' }}</td>
              <td v-if="runBal" class="num nw" :class="{ cr: e.balance < 0 }">{{ drcr(e.balance) }}</td>
            </tr>
          </tbody>
          <tfoot v-if="d">
            <tr class="subtotal"><td :colspan="cols - (runBal ? 3 : 2)">Total for the period</td><td class="num">{{ amt(d.debit) }}</td><td class="num">{{ amt(d.credit) }}</td><td v-if="runBal" /></tr>
            <tr class="total"><td :colspan="cols - (runBal ? 3 : 2)">Closing balance ({{ fmtDate(d.to_date) }})</td><td class="num">{{ d.closing > 0 ? amt(d.closing) : '' }}</td><td class="num">{{ d.closing < 0 ? amt(-d.closing) : '' }}</td><td v-if="runBal" class="num">{{ drcr(d.closing) }}</td></tr>
          </tfoot>
        </table>
        <div v-if="d && !filtered.length" class="empty"><Icon name="BookOpen" /><div>No postings for these filters.</div></div>
        <div v-if="!d" class="sk"><div v-for="i in 10" :key="i" class="skeleton" /></div>
      </div>
      <div v-if="filtered.length > limit" class="more"><button class="btn btn-transparent" @click="limit += 200">Show more <span class="muted">[{{ limit }} / {{ filtered.length }}]</span></button></div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../../components/Icon.vue'
import LinkInput from '../../components/LinkInput.vue'
import { rowMatches } from '../../search'
import { fmtDate, state } from '../../store'
import FinHeader from './FinHeader.vue'
import RangeFilter from './RangeFilter.vue'
import VoucherLink from './VoucherLink.vue'
import { amt, downloadCsv, drcr, finApi, loadContext } from './fin'

const route = useRoute()
const router = useRouter()
const KEYS = ['account', 'from_date', 'to_date', 'party_type', 'party', 'voucher_type', 'voucher_no']
const f = reactive(Object.fromEntries(KEYS.map((k) => [k, ''])))
const data = ref(null)
const d = computed(() => data.value)
const loading = ref(false)
const q = ref('')
const limit = ref(300)
const period = computed(() => (f.from_date ? `${fmtDate(f.from_date)} – ${fmtDate(f.to_date)}` : ''))
// a running balance is only meaningful for one account (or one group)
const runBal = computed(() => !!d.value?.account)
const showAcc = computed(() => !d.value?.account || d.value.account.is_group)
const cols = computed(() => 9 + (showAcc.value ? 1 : 0) - (runBal.value ? 0 : 1))

function fromQuery() {
  for (const k of KEYS) f[k] = route.query[k] || ''
}
async function load() {
  const ctx = await loadContext()
  if (!f.from_date) f.from_date = ctx.fy_start
  if (!f.to_date) f.to_date = ctx.today
  loading.value = true
  try {
    const args = Object.fromEntries(KEYS.filter((k) => f[k]).map((k) => [k, f[k]]))
    if (!(f.party_type && f.party)) delete args.party_type
    data.value = await finApi.generalLedger(args)
    limit.value = 300
  } finally {
    loading.value = false
  }
}
function apply() {
  const query = Object.fromEntries(KEYS.filter((k) => f[k]).map((k) => [k, f[k]]))
  if (JSON.stringify(query) === JSON.stringify(route.query)) load()
  else router.replace({ query })
}
function setType(t) {
  f.voucher_type = t
  apply()
}
onMounted(() => (fromQuery(), load()))
watch(() => route.query, () => route.path.endsWith('general-ledger') && (fromQuery(), load()))
watch(() => state.boot?.company, () => ((f.account = ''), apply()))

const filtered = computed(() => {
  const e = d.value?.entries || []
  const s = q.value.trim()
  return s ? e.filter((x) => rowMatches(x, s, ['voucher_no', 'party', 'remarks', 'against', 'account_name', 'voucher_type'])) : e
})
const paged = computed(() => filtered.value.slice(0, limit.value))
const short = (s) => {
  if (!s) return ''
  const parts = s.split(',').map((x) => x.trim().replace(/ - [A-Z0-9]+$/, ''))
  return parts.length > 2 ? `${parts.slice(0, 2).join(', ')} +${parts.length - 2}` : parts.join(', ')
}

function exportCsv() {
  downloadCsv(
    `general-ledger-${(d.value.account?.account_name || 'all').replace(/\W+/g, '-')}-${f.from_date}-${f.to_date}.csv`,
    ['Posting Date', 'Voucher Type', 'Voucher No', 'Account', 'Party Type', 'Party', 'Against', 'Remarks', 'Debit', 'Credit', 'Balance'],
    [
      [f.from_date, '', '', '', '', '', '', 'Opening balance', d.value.opening > 0 ? d.value.opening : '', d.value.opening < 0 ? -d.value.opening : '', d.value.opening],
      ...filtered.value.map((e) => [e.posting_date, e.voucher_type, e.voucher_no, e.account, e.party_type, e.party, e.against, e.remarks, e.debit, e.credit, runBal.value ? e.balance : '']),
      [f.to_date, '', '', '', '', '', '', 'Closing balance', '', '', d.value.closing],
    ],
  )
}
</script>

<style scoped>
@import './fin.css';
.acc-f { min-width: 17rem !important; }
.acc-card { display: flex; flex-wrap: wrap; align-items: center; gap: 1.25rem; margin: 1.25rem 0 1rem; padding: 1rem 1.25rem; border: 1px solid var(--border-soft); box-shadow: none; overflow: visible; }
.ac-name { flex: 1; min-width: 16rem; }
.ac-name h2 { font-size: 1.25rem; margin: 0.125rem 0 0.5rem; }
.vt { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.vt-chip { border: 1px solid var(--border-soft); background: var(--surface); border-radius: 1rem; padding: 0.125rem 0.625rem; font: inherit; font-size: 0.75rem; color: var(--text-2); cursor: pointer; }
.vt-chip b { color: var(--text); margin-left: 0.25rem; }
.vt-chip:hover { background: var(--surface-hover); }
.vt-chip.on { background: var(--surface-select); border-color: var(--brand); color: var(--brand); }
.vt-chip.clear { color: var(--negative); }
.ac-figs { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.ac-figs > div:not(.op) { display: flex; flex-direction: column; padding: 0.5rem 0.875rem; border-radius: 0.5rem; background: var(--surface-2); min-width: 8rem; }
.ac-figs span { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-3); }
.ac-figs b { font-size: 1rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ac-figs .cl { background: var(--brand-soft) !important; }
.ac-figs .cl b { color: var(--brand); }
.op { color: var(--text-3); font-weight: 700; }
.gl-wrap { max-height: calc(100vh - 14rem); }
.gl-wrap.busy { opacity: 0.55; transition: opacity 0.2s; }
.gl { font-size: 0.8125rem; }
.gl td { padding: 0.4375rem 0.75rem; }
.gl .num { min-width: 7.5rem; white-space: nowrap; font-variant-numeric: tabular-nums; }
.nw { white-space: nowrap; }
.against { max-width: 14rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); }
.rem { max-width: 22rem; min-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob td { background: var(--surface-2); }
tr.subtotal td { font-weight: 700; background: var(--surface-2); border-top: 2px solid var(--text-3); }
tr.total td { font-weight: 800; background: var(--surface-2); border-bottom: 3px double var(--text-3); }
.more { display: flex; justify-content: center; padding: 0.75rem; }
.spin { animation: vh-spin 0.8s linear infinite; }
.sk { padding: 1rem; display: grid; gap: 0.5rem; }
.sk .skeleton { height: 1.125rem; }
</style>
