<template>
  <div class="page page-narrow">
    <div class="dyn-header">
      <div class="breadcrumbs">
        <router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" />
        <router-link to="/rfq">Requests for Quotation</router-link><Icon name="ChevronRight" :size="12" />
        <router-link :to="`/rfq/${encodeURIComponent(rfq)}`">{{ rfq }}</router-link>
      </div>
      <div class="row wrap">
        <h1 class="page-title">Quotation Comparison</h1>
        <div class="spacer" />
        <div class="segmented">
          <button :class="{ on: mode === 'rate' }" @click="mode = 'rate'">Unit Rate</button>
          <button :class="{ on: mode === 'amount' }" @click="mode = 'amount'">Line Amount</button>
        </div>
      </div>
      <div v-if="data" class="summary">
        <div class="fact"><div class="k">Invited</div><div class="v">{{ data.suppliers.length }} suppliers</div></div>
        <div class="fact"><div class="k">Responses</div><div class="v">{{ data.quotes.length }} quotations</div></div>
        <div class="fact"><div class="k">Best Total</div><div class="v">{{ best ? fmtMoney(best.grand_total, best.currency) : '—' }}</div></div>
        <div class="fact"><div class="k">Potential Saving</div><div class="v pos">{{ saving ? fmtMoney(saving) : '—' }}</div></div>
      </div>
    </div>

    <div v-if="!data" class="skeleton" style="height: 18rem" />
    <div v-else-if="!data.quotes.length" class="card empty">
      <Icon name="FileBadge" />
      <div style="font-weight: 600; color: var(--text)">No quotations received yet</div>
      <div>Suppliers can submit quotes in the Supplier Portal, or you can record one from the RFQ.</div>
    </div>
    <div v-else class="card">
      <div class="table-wrap">
        <table class="tbl cmp">
          <thead>
            <tr>
              <th>Item</th>
              <th class="num">Qty</th>
              <th v-for="q in data.quotes" :key="q.name" class="num qh" :class="{ winner: q.name === best?.name }">
                <div class="row" style="justify-content: flex-end; gap: 0.375rem">
                  <Icon v-if="q.name === best?.name" name="Trophy" :size="14" />
                  {{ q.supplier_name || q.supplier }}
                </div>
                <router-link :to="`/sq/${encodeURIComponent(q.name)}`" class="muted" style="font-weight: 400">{{ q.name }}</router-link>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in data.items" :key="it.item_code">
              <td><div class="title">{{ it.item_name }}</div><div class="muted">{{ it.item_code }}</div></td>
              <td class="num">{{ fmtNum(it.qty) }} {{ it.uom }}</td>
              <td v-for="q in data.quotes" :key="q.name" class="num" :class="{ low: isLowest(it, q), winner: q.name === best?.name }">
                <template v-if="q.items[it.item_code]">
                  <b>{{ fmtMoney(q.items[it.item_code][mode], q.currency) }}</b>
                  <div v-if="q.items[it.item_code].lead_time_days" class="muted">{{ q.items[it.item_code].lead_time_days }} d lead time</div>
                  <span v-if="isLowest(it, q)" class="tag">Lowest</span>
                </template>
                <span v-else class="muted">Not quoted</span>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2"><b>Grand Total</b></td>
              <td v-for="q in data.quotes" :key="q.name" class="num" :class="{ winner: q.name === best?.name }">
                <b style="font-size: 1.0625rem">{{ fmtMoney(q.grand_total, q.currency) }}</b>
                <div class="muted">Valid till {{ fmtDate(q.valid_till) || '—' }}</div>
              </td>
            </tr>
            <tr>
              <td colspan="2" />
              <td v-for="q in data.quotes" :key="q.name" class="num" :class="{ winner: q.name === best?.name }">
                <button v-if="q.docstatus === 0" class="btn btn-sm" @click="submitQuote(q)">Submit quote</button>
                <button v-else-if="q.status !== 'Ordered'" class="btn btn-sm" :class="q.name === best?.name ? 'btn-emphasized' : ''" @click="award(q)"><Icon name="Gavel" /> Award</button>
                <StatusBadge v-else :status="q.status" :docstatus="1" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { askPoRequiredBy, confirmSubmitWithDates } from '../requiredBy'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import Icon from '../components/Icon.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { confirmBox, fmtDate, fmtMoney, fmtNum, toast } from '../store'

const props = defineProps({ name: String })
const router = useRouter()
const rfq = computed(() => decodeURIComponent(props.name))
const data = ref(null)
const mode = ref('rate')

const complete = computed(() => (data.value?.quotes || []).filter((q) => q.docstatus < 2))
const best = computed(() => [...complete.value].sort((a, b) => a.grand_total - b.grand_total)[0])
const saving = computed(() => {
  const t = complete.value.map((q) => q.grand_total)
  return t.length > 1 ? Math.max(...t) - Math.min(...t) : 0
})
function isLowest(it, q) {
  const rates = data.value.quotes.map((x) => x.items[it.item_code]?.rate).filter((r) => r > 0)
  return rates.length > 1 && q.items[it.item_code]?.rate === Math.min(...rates)
}
async function load() {
  data.value = await api.rfqComparison(rfq.value)
}
async function submitQuote(q) {
  if ((await confirmSubmitWithDates('Supplier Quotation', q.name, q.name)) === false) return
  await api.runAction('Supplier Quotation', q.name, 'submit')
  toast(`${q.name} submitted`)
  load()
}
async function award(q) {
  const ok = await confirmBox({
    title: 'Award Contract',
    message: `Award ${rfq.value} to ${q.supplier_name || q.supplier} for ${fmtMoney(q.grand_total, q.currency)}?\nA draft Purchase Order will be created.`,
    confirmText: 'Award & Create PO',
  })
  if (!ok) return
  const d = await askPoRequiredBy('Supplier Quotation', q.name)
  if (!d) return
  const r = await api.runAction('Supplier Quotation', q.name, 'make_po', d)
  toast(r.message)
  router.push(`/po/${encodeURIComponent(r.name)}/edit`)
}
onMounted(load)
</script>

<style scoped>
.summary { display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: 1rem; margin-top: 1rem; }
.pos { color: var(--positive); }
.cmp th.qh { min-width: 11rem; }
.cmp td, .cmp th { border-right: 1px solid var(--border-soft); }
.cmp .winner { background: color-mix(in srgb, var(--positive-bg) 60%, transparent); }
.cmp th.winner { color: var(--positive); }
.cmp td.low b { color: var(--positive); }
.tag { display: inline-block; margin-top: 0.25rem; padding: 0 0.375rem; border-radius: 0.25rem; font-size: 0.6875rem; font-weight: 700; background: var(--positive-bg); color: var(--positive); }
tfoot td { padding: 0.75rem; border-bottom: 1px solid var(--border-soft); }
</style>
