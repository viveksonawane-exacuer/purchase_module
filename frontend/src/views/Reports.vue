<template>
  <div class="page page-narrow">
    <div class="dyn-header">
      <div class="breadcrumbs"><router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" /> Report Center</div>
      <div class="row wrap">
        <h1 class="page-title">Report Center</h1>
        <span class="muted">Standard ERPNext reports for purchasing, stock and accounts</span>
        <div class="spacer" />
        <div class="search-box">
          <Icon name="Search" :size="15" />
          <input v-model="q" class="input" placeholder="Find a report…" />
        </div>
      </div>
      <div class="segmented" style="margin-top: 1rem">
        <button :class="{ on: !group }" @click="setGroup('')">All</button>
        <button v-for="g in REPORT_GROUPS" :key="g.key" :class="{ on: group === g.key }" @click="setGroup(g.key)">{{ g.label }}</button>
      </div>
    </div>

    <section v-for="g in shown" :key="g.key" class="rg">
      <h2 class="rg-title"><span class="rg-ico"><Icon :name="g.icon" :size="16" /></span> {{ g.label }} <span class="muted">{{ g.reports.length }}</span></h2>
      <div class="rg-grid">
        <router-link v-for="(r, i) in g.reports" :key="r.name" :to="`/reports/${reportSlug(r.name)}`" class="rcard spot spot-border" :style="{ '--i': i }">
          <span class="rcard-ico"><Icon :name="r.icon" :size="20" /></span>
          <div class="rcard-body">
            <b>{{ r.name }}</b>
            <small class="muted">{{ r.desc }}</small>
          </div>
          <Icon name="ArrowRight" :size="16" class="go" />
        </router-link>
      </div>
    </section>
    <div v-if="!shown.length" class="card empty"><Icon name="Search" /><div>No report matches “{{ q }}”.</div></div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import { REPORT_GROUPS, reportSlug } from '../config'

const route = useRoute()
const router = useRouter()
const q = ref('')
const group = ref(route.query.group || '')
function setGroup(g) {
  group.value = g
  router.replace({ query: g ? { group: g } : {} })
}
const shown = computed(() => {
  const s = q.value.trim().toLowerCase()
  return REPORT_GROUPS.filter((g) => !group.value || g.key === group.value)
    .map((g) => ({ ...g, reports: g.reports.filter((r) => !s || `${r.name} ${r.desc}`.toLowerCase().includes(s)) }))
    .filter((g) => g.reports.length)
})
</script>

<style scoped>
.search-box { position: relative; width: min(20rem, 100%); }
.search-box svg { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-3); }
.search-box .input { padding-left: 2.25rem; }
.rg { margin-top: 1.5rem; }
.rg-title { display: flex; align-items: center; gap: 0.625rem; font-size: 1.0625rem; margin-bottom: 0.75rem; }
.rg-title .muted { font-size: 0.8125rem; font-weight: 500; }
.rg-ico { width: 1.875rem; height: 1.875rem; border-radius: 0.5rem; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand); }
.rg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); gap: 0.75rem; }
.rcard {
  position: relative; overflow: hidden; display: flex; align-items: center; gap: 0.875rem; padding: 1rem;
  border-radius: var(--radius); background: var(--surface); border: 1px solid var(--border-soft); color: var(--text); text-decoration: none;
  transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease);
  animation: fade-up 0.35s var(--ease) both; animation-delay: calc(var(--i) * 35ms);
}
.rcard:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); text-decoration: none; }
.rcard-ico { width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--brand), #7858ff); }
.rcard-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.125rem; }
.rcard-body small { font-size: 0.8125rem; line-height: 1.35; }
.go { color: var(--text-3); transition: transform 0.2s var(--ease), color 0.2s; }
.rcard:hover .go { transform: translateX(3px); color: var(--brand); }
</style>
