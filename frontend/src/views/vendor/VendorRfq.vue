<template>
  <div class="page page-narrow">
    <div class="dyn-header">
      <div class="breadcrumbs"><router-link to="/vendor">Supplier Portal</router-link><Icon name="ChevronRight" :size="12" /> RFQ {{ rfqName }}</div>
      <div class="row wrap">
        <h1 class="page-title">Request for Quotation {{ rfqName }}</h1>
        <span v-if="quoted" class="status positive">Quoted</span>
        <span v-else class="status critical">Awaiting your quote</span>
      </div>
      <div v-if="rfq" class="facts" style="margin-top: 1rem">
        <div class="fact"><div class="k">Customer</div><div class="v">{{ rfq.company }}</div></div>
        <div class="fact"><div class="k">Issued</div><div class="v">{{ fmtDate(rfq.transaction_date) }}</div></div>
        <div class="fact"><div class="k">Required By</div><div class="v">{{ fmtDate(rfq.schedule_date) || '—' }}</div></div>
        <div class="fact"><div class="k">Line Items</div><div class="v">{{ rfq.items.length }}</div></div>
      </div>
    </div>

    <div v-if="!rfq" class="skeleton" style="height: 18rem" />
    <template v-else>
      <div v-if="rfq.message_for_supplier" class="card msg-card">
        <Icon name="MessageSquare" :size="18" />
        <div v-html="rfq.message_for_supplier" />
      </div>

      <div class="card" style="margin-top: 1rem">
        <div class="card-header"><h3>Your Offer</h3><span class="sub">Enter a unit rate for each item you can supply</span></div>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Item</th><th class="num">Requested Qty</th><th>Required By</th><th style="width: 9rem">Offered Qty</th><th style="width: 10rem">Unit Rate</th><th style="width: 8rem">Lead Time (days)</th><th class="num">Amount</th></tr></thead>
            <tbody>
              <tr v-for="it in rfq.items" :key="it.name">
                <td><div class="title">{{ it.item_name }}</div><div class="muted">{{ it.item_code }}</div><div v-if="it.description && it.description !== it.item_name" class="muted desc">{{ strip(it.description) }}</div></td>
                <td class="num">{{ fmtNum(it.qty) }} {{ it.uom }}</td>
                <td>{{ fmtDate(it.schedule_date) }}</td>
                <td><input v-model.number="offer[it.name].qty" type="number" min="0" step="any" class="input compact mono" :readonly="quoted" /></td>
                <td><input v-model.number="offer[it.name].rate" type="number" min="0" step="any" class="input compact mono" placeholder="0.00" :readonly="quoted" /></td>
                <td><input v-model.number="offer[it.name].lead_time_days" type="number" min="0" class="input compact mono" :readonly="quoted" /></td>
                <td class="num mono">{{ fmtMoney((offer[it.name].qty || 0) * (offer[it.name].rate || 0)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="foot-form">
          <div class="field" style="flex: 1; min-width: 16rem"><label>Terms / Remarks</label><textarea v-model="terms" class="input" :readonly="quoted" placeholder="Payment terms, delivery conditions, validity…" /></div>
          <div class="field" style="width: 12rem"><label>Quote Valid Till</label><input v-model="validTill" type="date" class="input" :readonly="quoted" /></div>
          <div class="total"><span class="muted">Total Offer</span><b>{{ fmtMoney(total) }}</b></div>
        </div>
      </div>
    </template>

    <div class="footer-bar">
      <span class="msg"><Icon name="Info" :size="14" /> {{ quoted ? 'You already submitted a quotation for this RFQ.' : `${priced} of ${rfq?.items.length || 0} items priced` }}</span>
      <div class="spacer" />
      <button v-if="!quoted" class="btn btn-emphasized" :disabled="!priced || busy" @click="submit"><Icon name="Send" /> Submit Quotation</button>
      <router-link to="/vendor" class="btn btn-transparent">Back</router-link>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api'
import Icon from '../../components/Icon.vue'
import { addDays, confirmBox, fmtDate, fmtMoney, fmtNum, toast } from '../../store'

const props = defineProps({ name: String })
const router = useRouter()
const rfqName = computed(() => decodeURIComponent(props.name))
const rfq = ref(null)
const offer = reactive({})
const terms = ref('')
const validTill = ref(addDays(30))
const busy = ref(false)
const quoted = computed(() => rfq.value?.suppliers?.[0]?.quote_status === 'Received')
const priced = computed(() => Object.values(offer).filter((o) => o.rate > 0).length)
const total = computed(() => Object.values(offer).reduce((a, o) => a + (o.qty || 0) * (o.rate || 0), 0))
const strip = (s) => String(s).replace(/<[^>]+>/g, '')

async function submit() {
  const ok = await confirmBox({ title: 'Submit Quotation', message: `Submit your offer of ${fmtMoney(total.value)} for ${rfqName.value}?`, confirmText: 'Submit' })
  if (!ok) return
  busy.value = true
  try {
    const items = Object.entries(offer).map(([name, o]) => ({ name, ...o }))
    const r = await api.vendorQuote(rfqName.value, items, terms.value, validTill.value)
    toast(r.message)
    router.push('/vendor')
  } catch {
    /* toast shown */
  } finally {
    busy.value = false
  }
}
onMounted(async () => {
  rfq.value = await api.vendorDoc('Request for Quotation', rfqName.value)
  for (const it of rfq.value.items) offer[it.name] = { qty: it.qty, rate: null, lead_time_days: null }
})
</script>

<style scoped>
.msg-card { display: flex; gap: 0.75rem; padding: 1rem 1.25rem; border-left: 4px solid var(--info); }
.msg-card :deep(p) { margin: 0; }
.desc { max-width: 28rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.foot-form { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; padding: 1rem; border-top: 1px solid var(--border-soft); }
.total { margin-left: auto; text-align: right; display: flex; flex-direction: column; }
.total b { font-size: 1.5rem; font-variant-numeric: tabular-nums; }
</style>
