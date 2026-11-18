<template>
  <div class="page page-narrow">
    <div class="dyn-header">
      <div class="breadcrumbs"><router-link to="/vendor">Supplier Portal</router-link><Icon name="ChevronRight" :size="12" /> {{ doctype }}</div>
      <div class="row wrap">
        <h1 class="page-title">{{ docName }}</h1>
        <StatusBadge v-if="doc" :status="doc.status" :docstatus="doc.docstatus" />
        <div class="spacer" />
        <a class="btn btn-ghost" :href="pdfUrl(doctype, docName)" target="_blank"><Icon name="Printer" /> PDF</a>
      </div>
      <div v-if="doc" class="row wrap" style="gap: 2rem; margin-top: 1rem; align-items: flex-start">
        <div class="facts" style="flex: 1">
          <div class="fact"><div class="k">Customer</div><div class="v">{{ doc.company }}</div></div>
          <div class="fact"><div class="k">Date</div><div class="v">{{ fmtDate(doc.transaction_date || doc.posting_date) }}</div></div>
          <div v-if="doc.schedule_date" class="fact"><div class="k">Deliver By</div><div class="v">{{ fmtDate(doc.schedule_date) }}</div></div>
          <div v-if="doc.due_date" class="fact"><div class="k">Payment Due</div><div class="v">{{ fmtDate(doc.due_date) }}</div></div>
          <div v-if="doc.set_warehouse" class="fact"><div class="k">Ship To</div><div class="v">{{ doc.set_warehouse }}</div></div>
        </div>
        <div class="kpi"><div class="k">Total</div><div class="v">{{ fmtMoney(doc.grand_total, doc.currency) }}</div></div>
        <div v-if="doc.per_received !== undefined" class="kpi" style="min-width: 8rem"><div class="k">Delivered</div><Progress :value="doc.per_received" /></div>
        <div v-if="doc.outstanding_amount !== undefined" class="kpi"><div class="k">Unpaid</div><div class="v">{{ fmtMoney(doc.outstanding_amount, doc.currency) }}</div></div>
      </div>
    </div>

    <div v-if="!doc" class="skeleton" style="height: 16rem" />
    <div v-else class="card">
      <div class="card-header"><h3>Items</h3></div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Item</th><th class="num">Qty</th><th v-if="doctype === 'Purchase Order'" class="num">Delivered</th><th class="num">Rate</th><th class="num">Amount</th><th v-if="doctype === 'Purchase Order'">Deliver By</th></tr></thead>
          <tbody>
            <tr v-for="it in doc.items" :key="it.name">
              <td><div class="title">{{ it.item_name }}</div><div class="muted">{{ it.item_code }}</div></td>
              <td class="num">{{ fmtNum(it.qty) }} {{ it.uom }}</td>
              <td v-if="doctype === 'Purchase Order'" class="num">{{ fmtNum(it.received_qty) }}</td>
              <td class="num">{{ fmtMoney(it.rate, doc.currency) }}</td>
              <td class="num">{{ fmtMoney(it.amount, doc.currency) }}</td>
              <td v-if="doctype === 'Purchase Order'">{{ fmtDate(it.schedule_date) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="doctype === 'Purchase Order' && doc?.docstatus === 1" class="footer-bar">
      <span class="msg"><Icon name="Info" :size="14" /> Confirm you have received this order and the delivery date.</span>
      <div class="spacer" />
      <button class="btn btn-emphasized" @click="ack"><Icon name="BadgeCheck" /> Acknowledge Order</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api, pdfUrl } from '../../api'
import Icon from '../../components/Icon.vue'
import Progress from '../../components/Progress.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { confirmBox, fmtDate, fmtMoney, fmtNum, toast } from '../../store'

const props = defineProps({ doctype: String, name: String })
const docName = computed(() => decodeURIComponent(props.name))
const doc = ref(null)
async function ack() {
  const note = await confirmBox({ title: 'Acknowledge Order', message: `Confirm receipt of ${docName.value}.`, input: 'Note to buyer (optional)', confirmText: 'Acknowledge' })
  if (!note) return
  const r = await api.vendorAck(docName.value, note === true ? '' : note)
  toast(r.message)
}
onMounted(async () => (doc.value = await api.vendorDoc(props.doctype, docName.value)))
</script>

<style scoped>
.kpi .k { font-size: 0.8125rem; color: var(--text-2); }
.kpi .v { font-size: 1.5rem; font-weight: 300; font-variant-numeric: tabular-nums; }
</style>
