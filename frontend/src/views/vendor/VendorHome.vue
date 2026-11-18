<template>
  <div class="page page-narrow">
    <section class="hero shine fade-up">
      <span class="logo-sup"><Icon name="Store" :size="26" /></span>
      <div>
        <div class="muted" style="font-weight: 600">Supplier Portal</div>
        <h1>{{ data?.supplier_name || 'Welcome' }}</h1>
        <p class="muted" style="margin: 0.25rem 0 0">Respond to RFQs, track orders and follow your invoices &amp; payments.</p>
      </div>
    </section>

    <div class="kpis">
      <button v-for="k in kpis" :key="k.tab" class="kpi spot spot-border fade-up" :class="{ on: tab === k.tab }" @click="tab = k.tab">
        <span class="ico" :class="k.tone"><Icon :name="k.icon" /></span>
        <div style="text-align: left">
          <div class="k">{{ k.label }}</div>
          <div class="v">{{ k.value ?? '–' }}</div>
          <div class="muted" style="font-size: 0.75rem">{{ k.sub }}</div>
        </div>
      </button>
    </div>

    <div class="card">
      <div class="tabs" style="padding: 0 0.75rem">
        <button v-for="k in kpis" :key="k.tab" :class="{ on: tab === k.tab }" @click="tab = k.tab">{{ k.label }}</button>
      </div>
      <div class="table-wrap">
        <div v-if="!data" style="padding: 1rem"><div class="skeleton" style="height: 12rem" /></div>

        <table v-else-if="tab === 'rfq'" class="tbl">
          <thead><tr><th>RFQ</th><th>Customer</th><th>Issued</th><th>Respond By</th><th>Your Response</th><th /></tr></thead>
          <tbody>
            <tr v-for="r in data.rfqs" :key="r.name" class="clickable" @click="$router.push(`/vendor/rfq/${encodeURIComponent(r.name)}`)">
              <td class="title">{{ r.name }}</td>
              <td>{{ r.company }}</td>
              <td>{{ fmtDate(r.transaction_date) }}</td>
              <td>{{ fmtDate(r.schedule_date) || '—' }}</td>
              <td><span class="status" :class="r.quote_status === 'Received' ? 'positive' : 'critical'">{{ r.quote_status === 'Received' ? 'Quoted' : 'Awaiting quote' }}</span></td>
              <td><button class="btn btn-sm" :class="r.quote_status === 'Received' ? '' : 'btn-emphasized'">{{ r.quote_status === 'Received' ? 'View' : 'Submit Quote' }}</button></td>
            </tr>
          </tbody>
        </table>

        <table v-else-if="tab === 'sq'" class="tbl">
          <thead><tr><th>Quotation</th><th>Date</th><th class="num">Value</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="r in data.quotations" :key="r.name" class="clickable" @click="$router.push(`/vendor/doc/Supplier Quotation/${encodeURIComponent(r.name)}`)">
              <td class="title">{{ r.name }}</td><td>{{ fmtDate(r.transaction_date) }}</td>
              <td class="num">{{ fmtMoney(r.grand_total, r.currency) }}</td><td><StatusBadge :status="r.status" :docstatus="r.docstatus" /></td>
            </tr>
          </tbody>
        </table>

        <table v-else-if="tab === 'po'" class="tbl">
          <thead><tr><th>Order</th><th>Ordered</th><th>Deliver By</th><th class="num">Value</th><th>Delivered</th><th>Invoiced</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="r in data.orders" :key="r.name" class="clickable" @click="$router.push(`/vendor/doc/Purchase Order/${encodeURIComponent(r.name)}`)">
              <td class="title">{{ r.name }}</td><td>{{ fmtDate(r.transaction_date) }}</td><td>{{ fmtDate(r.schedule_date) }}</td>
              <td class="num">{{ fmtMoney(r.grand_total, r.currency) }}</td>
              <td><Progress :value="r.per_received" /></td><td><Progress :value="r.per_billed" /></td>
              <td><StatusBadge :status="r.status" :docstatus="1" /></td>
            </tr>
          </tbody>
        </table>

        <table v-else class="tbl">
          <thead><tr><th>Invoice</th><th>Posted</th><th>Due</th><th class="num">Amount</th><th class="num">Unpaid</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="r in data.invoices" :key="r.name" class="clickable" @click="$router.push(`/vendor/doc/Purchase Invoice/${encodeURIComponent(r.name)}`)">
              <td class="title">{{ r.name }}</td><td>{{ fmtDate(r.posting_date) }}</td><td>{{ fmtDate(r.due_date) }}</td>
              <td class="num">{{ fmtMoney(r.grand_total, r.currency) }}</td><td class="num">{{ fmtMoney(r.outstanding_amount, r.currency) }}</td>
              <td><StatusBadge :status="r.status" :docstatus="1" /></td>
            </tr>
          </tbody>
        </table>

        <div v-if="data && !currentRows.length" class="empty"><Icon name="Inbox" /><div>Nothing here yet.</div></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../../api'
import Icon from '../../components/Icon.vue'
import Progress from '../../components/Progress.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { fmtCompact, fmtDate, fmtMoney } from '../../store'

const data = ref(null)
const tab = ref('rfq')
const currentRows = computed(() => ({ rfq: data.value?.rfqs, sq: data.value?.quotations, po: data.value?.orders, pi: data.value?.invoices })[tab.value] || [])
const kpis = computed(() => {
  const d = data.value
  const open = d?.rfqs.filter((r) => r.quote_status !== 'Received').length
  const active = d?.orders.filter((o) => !['Completed', 'Closed'].includes(o.status))
  const unpaid = d?.invoices.reduce((a, i) => a + (i.outstanding_amount || 0), 0)
  return [
    { tab: 'rfq', label: 'Open RFQs', value: open, sub: `${d?.rfqs.length ?? 0} total`, icon: 'Send', tone: open ? 'critical' : '' },
    { tab: 'sq', label: 'My Quotations', value: d?.quotations.length, sub: 'Submitted bids', icon: 'FileBadge' },
    { tab: 'po', label: 'Active Orders', value: active?.length, sub: `${d?.orders.length ?? 0} total`, icon: 'ShoppingCart' },
    { tab: 'pi', label: 'Receivable', value: d ? fmtCompact(unpaid) : undefined, sub: `${d?.invoices.length ?? 0} invoices`, icon: 'Landmark' },
  ]
})
onMounted(async () => (data.value = await api.vendorDashboard()))
</script>

<style scoped>
.hero { display: flex; align-items: center; gap: 1.25rem; padding: 1.5rem 1.75rem; margin-bottom: 1rem; border-radius: var(--radius-l); background: var(--surface); background-image: var(--hero-grad); box-shadow: var(--shadow-1); }
.hero h1 { font-size: 1.75rem; }
.logo-sup { width: 3.5rem; height: 3.5rem; border-radius: 1rem; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--brand), var(--brand-2)); }
.kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.kpi { display: flex; gap: 0.875rem; align-items: center; padding: 1rem; border: 2px solid transparent; border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-1); cursor: pointer; font: inherit; color: var(--text); }
.kpi { position: relative; overflow: hidden; transition: transform 0.2s var(--ease), box-shadow 0.2s; }
.kpi:hover { box-shadow: var(--shadow-2); transform: translateY(-3px); }
.kpi .ico { transition: transform 0.35s var(--spring); }
.kpi:hover .ico { transform: scale(1.12) rotate(-6deg); }
.kpi.on { border-color: var(--brand); }
.kpi .ico { width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand); }
.kpi .ico.critical { background: var(--critical-bg); color: var(--critical-text); }
.kpi .k { font-size: 0.8125rem; color: var(--text-2); }
.kpi .v { font-size: 1.625rem; font-weight: 600; }
</style>
