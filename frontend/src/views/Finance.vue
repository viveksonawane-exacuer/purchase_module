<template>
  <div class="page page-narrow">
    <div class="dyn-header">
      <div class="breadcrumbs"><router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" /> Finance</div>
      <div class="row wrap">
        <h1 class="page-title">Accounts Payable</h1>
        <div class="spacer" />
        <router-link to="/pi" class="btn"><Icon name="Receipt" /> All Invoices</router-link>
        <router-link to="/payment" class="btn"><Icon name="Banknote" /> Payments</router-link>
      </div>
    </div>

    <div class="grid">
      <div class="card lift spot shine">
        <div class="card-header"><h3>Total Payables</h3></div>
        <div class="card-body">
          <div class="big"><AnimatedNumber :value="data?.total_outstanding || 0" :format="fmtMoney" /></div>
          <div class="muted">{{ data?.invoices.length ?? '–' }} open invoices</div>
          <div class="split">
            <div><span class="status negative">Overdue</span><b class="mono">{{ fmtMoney(data?.overdue) }}</b></div>
            <div><span class="status positive">Not yet due</span><b class="mono">{{ fmtMoney((data?.total_outstanding || 0) - (data?.overdue || 0)) }}</b></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Payables Aging</h3><span class="sub">Outstanding by days past due</span></div>
        <div class="card-body">
          <div v-if="!data" class="skeleton" style="height: 190px" />
          <BarChart v-else :data="data.aging.map((a) => ({ label: a.bucket, value: a.value }))" money :height="190" label="Payables aging" />
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 1rem">
      <div class="tabs" style="padding: 0 0.75rem">
        <button :class="{ on: tab === 'inv' }" @click="tab = 'inv'">Open Invoices<span class="count">{{ data?.invoices.length ?? 0 }}</span></button>
        <button :class="{ on: tab === 'pay' }" @click="tab = 'pay'">Recent Payments<span class="count">{{ data?.payments.length ?? 0 }}</span></button>
      </div>
      <div v-if="tab === 'inv'" class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Invoice</th><th>Supplier</th><th>Due Date</th><th>Overdue</th><th class="num">Amount</th><th class="num">Outstanding</th><th /></tr></thead>
          <tbody>
            <tr v-for="i in data?.invoices || []" :key="i.name" class="clickable" @click="$router.push(`/pi/${encodeURIComponent(i.name)}`)">
              <td class="title">{{ i.name }}</td>
              <td>{{ i.supplier_name }}</td>
              <td>{{ fmtDate(i.due_date) }}</td>
              <td><span v-if="i.overdue_days" class="status" :class="i.overdue_days > 30 ? 'negative' : 'critical'">{{ i.overdue_days }} days</span><span v-else class="status positive">On time</span></td>
              <td class="num">{{ fmtMoney(i.grand_total, i.currency) }}</td>
              <td class="num"><b>{{ fmtMoney(i.outstanding_amount, i.currency) }}</b></td>
              <td @click.stop><button class="btn btn-sm btn-emphasized" @click="pay(i)"><Icon name="Banknote" /> Pay</button></td>
            </tr>
          </tbody>
        </table>
        <div v-if="data && !data.invoices.length" class="empty"><Icon name="CheckCircle2" /><div>No open payables. All caught up.</div></div>
      </div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Payment</th><th>Supplier</th><th>Date</th><th>Mode</th><th class="num">Amount</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="p in data?.payments || []" :key="p.name" class="clickable" @click="$router.push(`/payment/${encodeURIComponent(p.name)}`)">
              <td class="title">{{ p.name }}</td>
              <td>{{ p.party_name }}</td>
              <td>{{ fmtDate(p.posting_date) }}</td>
              <td>{{ p.mode_of_payment || '—' }}</td>
              <td class="num">{{ fmtMoney(p.paid_amount) }}</td>
              <td><StatusBadge :status="p.status" :docstatus="p.docstatus" /></td>
            </tr>
          </tbody>
        </table>
        <div v-if="data && !data.payments.length" class="empty"><Icon name="Banknote" /><div>No supplier payments yet.</div></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import AnimatedNumber from '../components/AnimatedNumber.vue'
import BarChart from '../components/BarChart.vue'
import Icon from '../components/Icon.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { confirmBox, fmtDate, fmtMoney, toast } from '../store'
const router = useRouter()
const data = ref(null)
const tab = ref('inv')
async function pay(i) {
  const ok = await confirmBox({ title: 'Post Payment', message: `Create a draft payment of ${fmtMoney(i.outstanding_amount, i.currency)} to ${i.supplier_name} against ${i.name}?`, confirmText: 'Create Payment' })
  if (!ok) return
  const r = await api.runAction('Purchase Invoice', i.name, 'make_payment')
  toast(r.message)
  router.push(`/payment/${encodeURIComponent(r.name)}/edit`)
}
onMounted(async () => (data.value = await api.finance()))
</script>

<style scoped>
.grid { display: grid; grid-template-columns: 1fr 2fr; gap: 1rem; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
.big { font-size: 2.25rem; font-weight: 300; font-variant-numeric: tabular-nums; margin-top: 0.25rem; }
.split { display: flex; flex-direction: column; gap: 0.625rem; margin-top: 1.25rem; }
.split div { display: flex; justify-content: space-between; align-items: center; }
</style>
