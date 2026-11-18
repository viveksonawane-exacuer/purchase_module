<template>
  <div class="page page-narrow">
    <div class="dyn-header shine">
      <div class="breadcrumbs">
        <router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" />
        <router-link to="/insights">Dashboards</router-link><Icon name="ChevronRight" :size="12" /> {{ m.title }}
      </div>
      <div class="row wrap" style="gap: 0.75rem">
        <span class="hd-ico"><Icon :name="m.icon" :size="22" /></span>
        <div>
          <h1 class="page-title">{{ m.title }} <span class="grad-text">Analytics</span></h1>
          <div class="muted">Submitted documents · last {{ months }} months · {{ state.boot?.company }}</div>
        </div>
        <div class="spacer" />
        <div class="segmented" role="group" aria-label="Period">
          <button v-for="p in [6, 12, 24]" :key="p" :class="{ on: months === p }" @click="setMonths(p)">{{ p }}M</button>
        </div>
        <!-- Reports for this dashboard -->
        <div ref="repWrap" class="rep-wrap">
          <button class="btn" :class="{ open: repOpen }" aria-haspopup="menu" :aria-expanded="repOpen" @click="repOpen = !repOpen">
            <Icon name="FileSpreadsheet" /> Reports <span class="rep-n">{{ reports.length }}</span><Icon name="ChevronDown" :size="14" class="rep-chev" />
          </button>
          <Transition name="rep-pop">
            <div v-if="repOpen" class="rep-menu" role="menu">
              <div class="rep-head">Reports for {{ m.title }}</div>
              <router-link v-for="(r, i) in reports" :key="r.name" :to="`/reports/${reportSlug(r.name)}`" class="rep-item" role="menuitem" :style="{ '--i': i }" @click="repOpen = false">
                <span class="rep-ico"><Icon :name="r.icon" :size="16" /></span>
                <span class="rep-txt"><b>{{ r.name }}</b><small class="muted">{{ r.desc }}</small></span>
              </router-link>
              <router-link :to="`/reports?group=${reportGroup}`" class="rep-all" @click="repOpen = false">All {{ reportGroupLabel }} reports <Icon name="ArrowRight" :size="14" /></router-link>
            </div>
          </Transition>
        </div>
        <router-link :to="`/${m.key}`" class="btn"><Icon name="ClipboardList" /> Open List</router-link>
        <router-link v-if="!m.form?.noCreate" :to="`/${m.key}/new`" class="btn btn-emphasized"><Icon name="Plus" /> Create {{ m.short }}</router-link>
      </div>
      <!-- quick switch between dashboards -->
      <div class="switcher">
        <router-link v-for="d in others" :key="d.key" :to="`/insights/${d.key}`" class="chip" :class="{ on: d.key === m.key }">
          <Icon :name="d.icon" :size="14" /> {{ d.short }}
        </router-link>
      </div>
    </div>

    <!-- KPI cards -->
    <section class="kpi-grid">
      <template v-if="!data"><div v-for="i in 6" :key="i" class="skeleton" style="height: 6.25rem; border-radius: var(--radius)" /></template>
      <template v-else>
        <div v-for="(k, i) in allKpis" :key="k.label" class="kcard spot spot-border fade-up" :class="k.tone" :style="{ animationDelay: i * 40 + 'ms' }">
          <div class="k">{{ k.label }}</div>
          <div class="v">
            <template v-if="k.value === null || k.value === undefined">—</template>
            <AnimatedNumber v-else :value="k.value" :format="k.money ? fmtCompact : k.pct ? (v) => v.toFixed(1) + '%' : undefined" />
          </div>
          <div v-if="k.pct && k.value !== null" class="progress" :class="k.tone"><span :style="{ width: Math.min(100, k.value) + '%' }" /></div>
          <div v-else-if="k.hint" class="muted hint">{{ k.hint }}</div>
        </div>
      </template>
    </section>

    <!-- Trend + status -->
    <section class="grid-2">
      <div class="card lift">
        <div class="card-header">
          <h3>Monthly Trend</h3>
          <span class="sub">{{ measure === 'value' ? 'Value (company currency)' : 'Number of documents' }}</span>
          <div class="spacer" />
          <div v-if="data?.has_value" class="segmented">
            <button :class="{ on: measure === 'value' }" @click="measure = 'value'">Value</button>
            <button :class="{ on: measure === 'count' }" @click="measure = 'count'">Count</button>
          </div>
        </div>
        <div class="card-body">
          <div v-if="!data" class="skeleton" style="height: 220px" />
          <BarChart v-else :key="measure + months" :data="trendData" :money="measure === 'value'" :height="220" :label="`${m.title} monthly trend`" />
        </div>
      </div>
      <div class="card lift">
        <div class="card-header"><h3>Status Mix</h3><span class="sub">All open & closed documents</span></div>
        <div class="card-body">
          <div v-if="!data" class="skeleton" style="height: 220px" />
          <RankBars v-else :rows="statusRows" :money="false">
            <template #label="{ row }"><StatusBadge :status="row.label" :docstatus="row.label === 'Draft' ? 0 : row.label === 'Cancelled' ? 2 : 1" /></template>
          </RankBars>
        </div>
      </div>
    </section>

    <!-- Parties + items -->
    <section class="grid-2 even">
      <div v-if="!data || data.has_party" class="card lift">
        <div class="card-header"><h3>Top {{ (data?.party_label || 'Supplier') + 's' }}</h3><span class="sub">{{ data?.has_value ? 'By value' : 'By document count' }}</span></div>
        <div class="card-body">
          <div v-if="!data" class="skeleton" style="height: 200px" />
          <RankBars v-else :rows="partyRows" :money="data.has_value" />
        </div>
      </div>
      <div class="card lift">
        <div class="card-header"><h3>{{ data?.items_label || 'Top Items' }}</h3><span class="sub">{{ itemsByValue ? 'By value' : 'By quantity' }}</span></div>
        <div class="card-body">
          <div v-if="!data" class="skeleton" style="height: 200px" />
          <RankBars v-else :rows="itemRows" :money="itemsByValue" />
        </div>
      </div>
    </section>

    <!-- Recent -->
    <section class="card" style="margin-top: 1rem">
      <div class="card-header">
        <h3>Recently Updated</h3>
        <div class="spacer" />
        <router-link :to="`/${m.key}`" class="btn btn-sm btn-transparent">View all <Icon name="ArrowRight" :size="14" /></router-link>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Document</th><th v-if="data?.recent?.[0]?.party !== undefined">{{ data?.party_label || 'Supplier' }}</th><th>Date</th><th v-if="data?.has_value" class="num">Value</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>
            <tr v-for="r in data?.recent || []" :key="r.name" class="clickable" @click="$router.push(`/${m.key}/${encodeURIComponent(r.name)}`)">
              <td class="title">{{ r.name }}</td>
              <td v-if="r.party !== undefined">{{ r.party || '—' }}</td>
              <td>{{ fmtDate(r.date) }}</td>
              <td v-if="data.has_value" class="num">{{ fmtMoney(r.value) }}</td>
              <td><StatusBadge :status="r.status" :docstatus="r.docstatus" /></td>
              <td class="muted">{{ timeAgo(r.modified) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="data && !data.recent.length" class="empty"><Icon :name="m.icon" /><div>No {{ m.title.toLowerCase() }} yet.</div></div>
      </div>
    </section>

    <!-- Related standard reports -->
    <section class="rel">
      <div class="rel-head">
        <h3>Reports for {{ m.title }}</h3><span class="muted">Standard ERPNext reports for deeper analysis</span>
        <div class="spacer" />
        <router-link to="/reports" class="btn btn-sm btn-transparent">Report Center <Icon name="ArrowRight" :size="14" /></router-link>
      </div>
      <div class="rel-grid">
        <router-link v-for="(r, i) in reports" :key="r.name" :to="`/reports/${reportSlug(r.name)}`" class="rel-card spot spot-border" :style="{ '--i': i }">
          <span class="rep-ico lg"><Icon :name="r.icon" :size="20" /></span>
          <span class="rep-txt"><b>{{ r.name }}</b><small class="muted">{{ r.desc }}</small></span>
          <Icon name="ArrowRight" :size="16" class="go" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import AnimatedNumber from '../components/AnimatedNumber.vue'
import BarChart from '../components/BarChart.vue'
import Icon from '../components/Icon.vue'
import RankBars from '../components/RankBars.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { DASH_KEYS, DASHBOARD_REPORTS, MODULES, REPORT_GROUPS, REPORTS, reportSlug } from '../config'
import { fmtCompact, fmtDate, fmtMoney, state, timeAgo } from '../store'

const props = defineProps({ module: String })
const route = useRoute()
const router = useRouter()
const m = computed(() => MODULES[props.module])
const others = DASH_KEYS.map((k) => MODULES[k])
const reports = computed(() => (DASHBOARD_REPORTS[props.module] || []).map((n) => REPORTS[n]).filter(Boolean))
const reportGroup = computed(() => reports.value[0]?.group || '')
const reportGroupLabel = computed(() => REPORT_GROUPS.find((g) => g.key === reportGroup.value)?.label.toLowerCase() || '')
const repOpen = ref(false)
const repWrap = ref(null)
function onDocClick(e) {
  if (repOpen.value && !repWrap.value?.contains(e.target)) repOpen.value = false
}
function onEsc(e) {
  if (e.key === 'Escape') repOpen.value = false
}
onMounted(() => {
  addEventListener('mousedown', onDocClick)
  addEventListener('keydown', onEsc)
})
onBeforeUnmount(() => {
  removeEventListener('mousedown', onDocClick)
  removeEventListener('keydown', onEsc)
})
const data = ref(null)
const months = ref(+route.query.months || 12)
const measure = ref('value')

const allKpis = computed(() => [...(data.value?.kpis || []), ...(data.value?.extra || [])])
const trendData = computed(() =>
  (data.value?.trend || []).map((t) => ({
    label: new Date(t.month + '-01').toLocaleDateString(undefined, { month: 'short', ...(months.value > 12 ? { year: '2-digit' } : {}) }),
    value: measure.value === 'value' && data.value.has_value ? t.value : t.count,
  })),
)
const statusRows = computed(() =>
  (data.value?.status || []).map((s) => ({ label: s.status || 'Draft', value: s.n, to: `/${m.value.key}?status=${encodeURIComponent(s.status || '')}` })),
)
const partyField = computed(() => m.value.filters.find((f) => f.type === 'link' && ['Supplier', 'Warehouse'].includes(f.doctype))?.field)
const partyRows = computed(() =>
  (data.value?.parties || []).map((p) => ({ label: p.label, value: p.value, to: partyField.value ? `/${m.value.key}?${partyField.value}=${encodeURIComponent(p.label)}` : null })),
)
const itemsByValue = computed(() => (data.value?.items || []).some((i) => i.value))
const itemRows = computed(() =>
  (data.value?.items || []).map((i) => ({ label: i.item_name && i.item_name !== i.item_code ? `${i.item_name}` : i.item_code, value: itemsByValue.value ? i.value : i.qty })),
)

async function load() {
  data.value = null
  data.value = await api.doctypeDashboard(props.module, months.value)
  if (!data.value.has_value) measure.value = 'count'
}
function setMonths(p) {
  months.value = p
  router.replace({ query: p === 12 ? {} : { months: p } })
  load()
}
watch(() => props.module, load, { immediate: true })
</script>

<style scoped>
/* reports dropdown */
.rep-wrap { position: relative; }
.rep-n { min-width: 1.25rem; padding: 0 0.375rem; border-radius: 1rem; background: var(--brand-soft); color: var(--brand); font-size: 0.6875rem; }
.rep-chev { transition: transform 0.25s var(--ease); }
.btn.open .rep-chev { transform: rotate(180deg); }
.rep-menu {
  position: absolute; right: 0; top: calc(100% + 0.5rem); z-index: 60; width: min(24rem, calc(100vw - 2rem));
  padding: 0.375rem; background: var(--surface); border: 1px solid var(--border-soft); border-radius: 0.875rem;
  box-shadow: 0 16px 40px -10px rgba(16, 24, 40, 0.28), 0 4px 10px -4px rgba(16, 24, 40, 0.12); transform-origin: top right;
}
.rep-head { padding: 0.5rem 0.625rem 0.375rem; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); }
.rep-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.625rem; border-radius: 0.5rem; color: var(--text); text-decoration: none; animation: rep-in 0.3s var(--ease) both; animation-delay: calc(var(--i) * 30ms); }
.rep-item:hover { background: var(--surface-hover); text-decoration: none; }
@keyframes rep-in { from { opacity: 0; transform: translateX(-8px); } }
.rep-ico { width: 2rem; height: 2rem; border-radius: 0.5rem; flex: none; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand); }
.rep-ico.lg { width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; color: #fff; background: linear-gradient(135deg, var(--brand), #7858ff); }
.rep-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.rep-txt b { font-size: 0.875rem; }
.rep-txt small { font-size: 0.75rem; }
.rep-all { display: flex; align-items: center; justify-content: center; gap: 0.375rem; margin-top: 0.25rem; padding: 0.625rem; border-top: 1px solid var(--border-soft); font-size: 0.8125rem; font-weight: 600; }
.rep-pop-enter-active { transition: opacity 0.16s var(--ease), transform 0.2s var(--ease); }
.rep-pop-leave-active { transition: opacity 0.1s linear, transform 0.1s linear; }
.rep-pop-enter-from, .rep-pop-leave-to { opacity: 0; transform: translateY(-6px) scale(0.98); }

/* related reports section */
.rel { margin-top: 1.5rem; }
.rel-head { display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
.rel-head h3 { font-size: 1.0625rem; }
.rel-head .muted { font-size: 0.8125rem; }
.rel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 0.75rem; }
.rel-card {
  position: relative; overflow: hidden; display: flex; align-items: center; gap: 0.875rem; padding: 1rem;
  border-radius: var(--radius); background: var(--surface); border: 1px solid var(--border-soft); color: var(--text); text-decoration: none;
  transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease); animation: fade-up 0.35s var(--ease) both; animation-delay: calc(var(--i) * 40ms);
}
.rel-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); text-decoration: none; }
.rel-card .rep-txt { flex: 1; }
.rel-card .go { color: var(--text-3); transition: transform 0.2s var(--ease), color 0.2s; }
.rel-card:hover .go { transform: translateX(3px); color: var(--brand); }

.hd-ico { width: 3rem; height: 3rem; border-radius: 0.875rem; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, #0070f2, #7858ff); box-shadow: 0 8px 18px -8px #0070f2; }
.switcher { display: flex; gap: 0.375rem; flex-wrap: wrap; margin-top: 1rem; }
.chip { display: inline-flex; align-items: center; gap: 0.375rem; height: 1.875rem; padding: 0 0.75rem; border-radius: 1rem; background: var(--neutral-bg); color: var(--text-2); font-size: 0.8125rem; font-weight: 600; text-decoration: none; transition: all 0.2s var(--ease); }
.chip:hover { background: var(--surface-hover); color: var(--text); text-decoration: none; transform: translateY(-1px); }
.chip.on { background: var(--brand); color: var(--brand-text); }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.kcard {
  position: relative; overflow: hidden; padding: 1rem 1.125rem; border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-1);
  border-top: 3px solid var(--chart); transition: transform 0.2s var(--ease), box-shadow 0.2s;
}
.kcard:hover { transform: translateY(-3px); box-shadow: var(--shadow-2); }
.kcard.critical { border-top-color: var(--critical); }
.kcard.negative { border-top-color: var(--negative); }
.kcard.positive { border-top-color: var(--positive); }
.kcard .k { font-size: 0.8125rem; color: var(--text-2); font-weight: 600; }
.kcard .v { font-size: 1.75rem; font-weight: 300; margin: 0.25rem 0 0.375rem; line-height: 1.1; }
.kcard.critical .v { color: var(--critical-text); }
.kcard.negative .v { color: var(--negative); }
.kcard .hint { font-size: 0.75rem; }
.kcard .progress { height: 0.375rem; }
.progress.negative > span { background: var(--negative); }
.grid-2 { display: grid; grid-template-columns: 1.7fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.grid-2.even { grid-template-columns: 1fr 1fr; }
@media (max-width: 1000px) { .grid-2, .grid-2.even { grid-template-columns: 1fr; } }
</style>
