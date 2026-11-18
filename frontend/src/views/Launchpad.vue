<template>
  <div class="page page-narrow">
    <section class="hero shine fade-up">
      <div>
        <div class="muted" style="font-weight: 600">{{ greeting }}, {{ firstName }}</div>
        <h1 class="grad-text">Procurement Overview</h1>
        <p class="muted" style="margin: 0.25rem 0 0">
          {{ data?.company || 'Your company' }} · {{ new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) }}
        </p>
      </div>
      <div class="spacer" />
      <div class="row wrap hero-actions">
        <router-link to="/pr/new" class="btn btn-emphasized"><Icon name="Plus" /> New Requisition</router-link>
        <router-link to="/rfq/new" class="btn"><Icon name="Send" /> New RFQ</router-link>
        <router-link to="/po/new" class="btn"><Icon name="ShoppingCart" /> New PO</router-link>
      </div>
    </section>

    <!-- Insight cards -->
    <section class="insights">
      <div class="card insight lift spot fade-up" style="animation-delay: 40ms">
        <div class="card-header">
          <h3>Purchase Spend</h3>
          <span class="sub">Submitted POs, last 6 months</span>
          <div class="spacer" />
          <span class="hero-num"><AnimatedNumber :value="totalSpend" :format="fmtCompact" /></span>
        </div>
        <div class="card-body">
          <div v-if="!data" class="skeleton" style="height: 200px" />
          <BarChart v-else :data="spendData" money label="Monthly purchase spend" />
        </div>
      </div>
      <div class="card insight lift spot fade-up" style="animation-delay: 80ms">
        <div class="card-header">
          <h3>Top Suppliers</h3>
          <span class="sub">By order value</span>
        </div>
        <div class="card-body">
          <div v-if="!data" class="skeleton" style="height: 180px" />
          <RankBars v-else :rows="(data.top_suppliers || []).map((s) => ({ label: s.supplier, value: s.value }))" />
        </div>
      </div>
      <div class="card insight attention lift spot fade-up" style="animation-delay: 120ms">
        <div class="card-header">
          <h3>Needs Attention</h3>
        </div>
        <div class="card-body att-list">
          <router-link v-for="a in attention" :key="a.label" :to="a.to" class="att" :class="a.tone">
            <span class="att-ico"><Icon :name="a.icon" :size="16" /></span>
            <span style="flex: 1">{{ a.label }}</span>
            <b class="mono">{{ a.value ?? '–' }}</b>
            <Icon name="ChevronRight" :size="16" />
          </router-link>
        </div>
      </div>
    </section>

    <!-- Spaces -->
    <div class="tabs" style="margin: 1.75rem 0 0.25rem">
      <button v-for="s in SPACES" :key="s.id" :class="{ on: space === s.id }" @click="setSpace(s.id)">{{ s.label }}</button>
      <button :class="{ on: space === 'all' }" @click="setSpace('all')">All Apps</button>
    </div>

    <template v-for="s in shownSpaces" :key="s.id">
      <section v-for="g in s.groups" :key="g.title" class="group">
        <h2>{{ g.title }}</h2>
        <div class="tiles">
          <router-link v-for="(t, i) in g.tiles" :key="t.title" :to="t.to" class="tile spot spot-border fade-up" :class="{ action: t.action }" :style="{ animationDelay: i * 30 + 'ms' }">
            <div class="tile-head">
              <div>
                <div class="tile-title">{{ t.title }}</div>
                <div class="tile-sub">{{ t.sub }}</div>
              </div>
            </div>
            <div class="tile-foot">
              <span class="tile-icon" :class="t.tone"><Icon :name="t.icon" :size="22" /></span>
              <div v-if="t.kpi" class="tile-kpi" :class="t.tone">
                <template v-if="tiles[t.kpi] === undefined"><span class="skeleton" style="width: 3rem; height: 1.75rem; display: inline-block" /></template>
                <template v-else-if="tiles[t.kpi] === null"><span class="muted" style="font-size: 0.8125rem">No access</span></template>
                <template v-else>
                  <span class="n"><AnimatedNumber :value="tiles[t.kpi]" :format="t.money ? fmtCompact : undefined" /></span>
                  <span v-if="t.unit" class="u">{{ t.unit }}</span>
                </template>
              </div>
              <Icon v-else-if="t.action" name="ArrowRight" :size="20" class="go" />
            </div>
          </router-link>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import AnimatedNumber from '../components/AnimatedNumber.vue'
import BarChart from '../components/BarChart.vue'
import Icon from '../components/Icon.vue'
import RankBars from '../components/RankBars.vue'
import { SPACES } from '../config'
import { fmtCompact, state } from '../store'

const data = ref(null)
const KEY = 'procure.space'
const space = ref((() => { try { return localStorage.getItem(KEY) || 'procure' } catch { return 'procure' } })())
function setSpace(s) {
  space.value = s
  try { localStorage.setItem(KEY, s) } catch {}
}
const shownSpaces = computed(() => (space.value === 'all' ? SPACES : SPACES.filter((s) => s.id === space.value)))
const tiles = computed(() => data.value?.tiles || {})
const firstName = computed(() => (state.boot?.full_name || '').split(' ')[0])
const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
})
const spendData = computed(() =>
  (data.value?.spend || []).map((s) => ({
    label: new Date(s.month + '-01').toLocaleDateString(undefined, { month: 'short' }),
    value: s.value,
  })),
)
const totalSpend = computed(() => (data.value?.spend || []).reduce((a, b) => a + b.value, 0))
const attention = computed(() => [
  { label: 'POs waiting for approval', value: tiles.value.po_to_approve, to: '/po?tab=1', icon: 'BadgeCheck', tone: 'critical' },
  { label: 'Overdue supplier invoices', value: tiles.value.pi_overdue, to: '/pi?tab=3', icon: 'AlarmClock', tone: 'negative' },
  { label: 'Items below reorder level', value: tiles.value.low_stock, to: '/reorder', icon: 'TriangleAlert', tone: 'critical' },
  { label: 'Draft requisitions', value: tiles.value.pr_draft, to: '/pr?tab=1', icon: 'ClipboardList', tone: 'info' },
])
onMounted(async () => {
  data.value = await api.dashboard()
})
</script>

<style scoped>
.hero {
  display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap;
  padding: 1.5rem 1.75rem; margin-bottom: 1rem; border-radius: var(--radius-l);
  background: var(--surface); background-image: var(--hero-grad); box-shadow: var(--shadow-1);
}
.hero h1 { font-size: 1.75rem; margin-top: 0.125rem; }
.hero-num { font-size: 1.5rem; font-weight: 700; }
.insights { display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 1rem; }
@media (max-width: 1200px) { .insights { grid-template-columns: 1fr 1fr; } .insights > :first-child { grid-column: 1 / -1; } }
@media (max-width: 720px) { .insights { grid-template-columns: 1fr; } .hero-actions { width: 100%; } }
.att-list { display: flex; flex-direction: column; gap: 0.375rem; }
.att { display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 0.5rem; border-radius: 0.5rem; color: var(--text); text-decoration: none; }
.att:hover { background: var(--surface-hover); text-decoration: none; }
.att-ico { width: 2rem; height: 2rem; border-radius: 0.5rem; display: grid; place-items: center; background: var(--info-bg); color: var(--info); }
.att.critical .att-ico { background: var(--critical-bg); color: var(--critical-text); }
.att.negative .att-ico { background: var(--negative-bg); color: var(--negative); }
.group { margin-top: 1.5rem; }
.group h2 { font-size: 1.0625rem; margin-bottom: 0.75rem; }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 11rem)); gap: 1rem; }
@media (max-width: 520px) { .tiles { grid-template-columns: 1fr 1fr; } }
.tile {
  height: 11rem; display: flex; flex-direction: column; justify-content: space-between;
  padding: 1rem; border-radius: var(--radius); background: var(--tile-grad); box-shadow: var(--shadow-1);
  color: var(--text); text-decoration: none; transition: box-shadow 0.2s var(--ease), transform 0.2s var(--ease);
}
.tile { position: relative; overflow: hidden; }
.tile:hover { box-shadow: var(--shadow-3); transform: translateY(-4px); text-decoration: none; }
.tile-icon { transition: transform 0.35s var(--spring); display: inline-flex; padding: 0.5rem; margin: -0.5rem; border-radius: 0.75rem; }
.tile:hover .tile-icon { transform: scale(1.15) rotate(-6deg); background: var(--brand-soft); }
.tile:hover .go { transform: translateX(4px); }
.go { transition: transform 0.25s var(--ease); }
.att { transition: background 0.15s, transform 0.2s var(--ease); }
.att:hover { transform: translateX(3px); }
.tile.action { border: 1px dashed var(--brand); background: var(--brand-soft); }
.tile-title { font-weight: 700; font-size: 0.9375rem; line-height: 1.25; }
.tile-sub { color: var(--text-2); font-size: 0.8125rem; margin-top: 0.25rem; }
.tile-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 0.5rem; }
.tile-icon { color: var(--brand); }
.tile-icon.critical { color: var(--critical); }
.tile-icon.negative { color: var(--negative); }
.tile-kpi { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
.tile-kpi .n { font-size: 2rem; font-weight: 300; line-height: 1; color: var(--text); }
.tile-kpi.critical .n { color: var(--critical-text); }
.tile-kpi.negative .n { color: var(--negative); }
.tile-kpi .u { font-size: 0.75rem; color: var(--text-2); margin-top: 0.25rem; }
.go { color: var(--brand); }
</style>
