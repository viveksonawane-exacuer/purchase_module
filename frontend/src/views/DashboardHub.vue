<template>
  <div class="page page-narrow">
    <section class="dyn-header shine">
      <div class="breadcrumbs"><router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" /> Dashboards</div>
      <h1 class="page-title"><span class="grad-text">Procurement Analytics</span></h1>
      <p class="muted" style="margin: 0.25rem 0 0">One dashboard per document type: volumes, value, status mix, top suppliers and items. Last 6 months shown below.</p>
    </section>

    <section class="hub">
      <router-link
        v-for="(d, i) in cards"
        :key="d.key"
        :to="`/insights/${d.key}`"
        class="hcard spot spot-border fade-up"
        :style="{ animationDelay: i * 50 + 'ms' }"
      >
        <div class="row">
          <span class="ico"><Icon :name="d.icon" :size="20" /></span>
          <div style="min-width: 0">
            <div class="t">{{ d.title }}</div>
            <div class="muted s">{{ d.desc }}</div>
            <span v-if="d.reports" class="rep-tag"><Icon name="FileSpreadsheet" :size="12" /> {{ d.reports }} reports</span>
          </div>
          <div class="spacer" />
          <Icon name="ArrowRight" :size="18" class="go" />
        </div>
        <template v-if="hub">
          <div v-if="hub[d.key]" class="row nums">
            <div><div class="n"><AnimatedNumber :value="hub[d.key].count" /></div><small class="muted">documents</small></div>
            <div><div class="n"><AnimatedNumber :value="total(d.key)" :format="hub[d.key].money ? fmtCompact : undefined" /></div><small class="muted">{{ hub[d.key].money ? 'value, 6 mo' : 'submitted, 6 mo' }}</small></div>
            <div v-if="hub[d.key].drafts"><div class="n warn"><AnimatedNumber :value="hub[d.key].drafts" /></div><small class="muted">drafts</small></div>
          </div>
          <div v-else class="muted nums">No access</div>
          <Sparkline v-if="hub[d.key]" :data="hub[d.key].spark" :label="`${d.title}: last 6 months`" />
        </template>
        <div v-else class="skeleton" style="height: 5.5rem; margin-top: 0.75rem" />
      </router-link>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api'
import AnimatedNumber from '../components/AnimatedNumber.vue'
import Icon from '../components/Icon.vue'
import Sparkline from '../components/Sparkline.vue'
import { DASHBOARD_REPORTS, DASH_KEYS, MODULES } from '../config'
import { fmtCompact } from '../store'

const DESC = {
  pr: 'Demand, sourcing backlog & PO conversion',
  rfq: 'Sourcing events & supplier response rate',
  sq: 'Bids received, win rate & expiries',
  po: 'Spend, open receipts & late deliveries',
  grn: 'Inbound volume, returns & rejection rate',
  pi: 'Billing, outstanding & overdue',
  payment: 'Outflow by month & payment mode',
}
const cards = DASH_KEYS.map((k) => MODULES[k]).map((m) => ({ key: m.key, title: m.title, icon: m.icon, desc: DESC[m.key], reports: (DASHBOARD_REPORTS[m.key] || []).length }))
const hub = ref(null)
const total = (k) => (hub.value[k]?.spark || []).reduce((a, b) => a + b, 0)
onMounted(async () => (hub.value = await api.dashboardHub()))
</script>

<style scoped>
.rep-tag { display: inline-flex; align-items: center; gap: 0.25rem; margin-top: 0.375rem; padding: 0.0625rem 0.5rem; border-radius: 1rem; background: var(--brand-soft); color: var(--brand); font-size: 0.6875rem; font-weight: 700; }
.hub { display: grid; grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr)); gap: 1rem; }
.hcard {
  position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 0.75rem; padding: 1.125rem;
  border-radius: var(--radius-l); background: var(--tile-grad); box-shadow: var(--shadow-1); color: var(--text); text-decoration: none;
  transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease);
}
.hcard:hover { transform: translateY(-4px); box-shadow: var(--shadow-3); text-decoration: none; }
.ico { width: 2.5rem; height: 2.5rem; flex: none; border-radius: 0.75rem; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand); transition: transform 0.35s var(--spring); }
.hcard:hover .ico { transform: scale(1.12) rotate(-6deg); }
.t { font-weight: 700; }
.s { font-size: 0.8125rem; }
.go { color: var(--brand); transition: transform 0.25s var(--ease); }
.hcard:hover .go { transform: translateX(4px); }
.nums { gap: 1.5rem; align-items: flex-end; }
.n { font-size: 1.5rem; font-weight: 300; line-height: 1.1; }
.n.warn { color: var(--critical-text); }
</style>
