<template>
  <div class="inbox">
    <aside class="master">
      <div class="m-head">
        <h2>My Inbox</h2>
        <span class="muted">{{ tasks.length }} tasks</span>
      </div>
      <div class="segmented" style="margin: 0 1rem 0.75rem">
        <button v-for="f in filters" :key="f.k" :class="{ on: filter === f.k }" @click="filter = f.k">{{ f.label }}</button>
      </div>
      <ul>
        <template v-if="loading"><li v-for="i in 5" :key="i"><div class="skeleton" style="height: 3rem; width: 100%" /></li></template>
        <li v-for="t in shown" :key="t.doctype + t.name" :class="{ on: cur?.name === t.name }" @click="select(t)">
          <span class="t-ico" :class="t.tone"><Icon :name="t.icon" :size="16" /></span>
          <div style="flex: 1; min-width: 0">
            <div class="row"><b class="ell">{{ t.title }}</b><span class="spacer" /><small class="muted">{{ timeAgo(t.modified) }}</small></div>
            <div class="muted ell">{{ t.name }} · {{ t.sub }}</div>
          </div>
        </li>
        <li v-if="!loading && !shown.length" class="empty" style="display: block"><Icon name="Inbox" /><div>Nothing to do here.</div></li>
      </ul>
    </aside>
    <section class="detail">
      <ObjectPage v-if="cur" :key="cur.doctype + cur.name" :module="cur.module" :name="encodeURIComponent(cur.name)" in-fcl :can-full="false" @changed="load" @close="cur = null" />
      <div v-else class="empty" style="margin-top: 20vh"><Icon name="Inbox" /><div>Select a task to review and approve.</div></div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, provide, ref } from 'vue'
import { api } from '../api'
import Icon from '../components/Icon.vue'
import { MODULES } from '../config'
import { state, timeAgo } from '../store'
import ObjectPage from './ObjectPage.vue'

const tasks = ref([])
const cur = ref(null)
const loading = ref(true)
const filter = ref('all')
const filters = [
  { k: 'all', label: 'All' },
  { k: 'approve', label: 'Approvals' },
  { k: 'action', label: 'Follow-ups' },
]
const shown = computed(() => tasks.value.filter((t) => filter.value === 'all' || t.kind === filter.value))

const SOURCES = [
  { module: 'po', kind: 'approve', title: 'Approve Purchase Order', filters: [['docstatus', '=', 0]], icon: 'BadgeCheck', tone: 'critical', sub: (r) => r.supplier_name || '', fields: ['supplier_name'] },
  { module: 'pr', kind: 'approve', title: 'Approve Requisition', filters: [['docstatus', '=', 0], ['material_request_type', '=', 'Purchase']], icon: 'ClipboardList', tone: 'critical', sub: (r) => r.set_warehouse || '', fields: ['set_warehouse'] },
  { module: 'pr', kind: 'action', title: 'Source Requisition', filters: [['status', 'in', ['Pending', 'Partially Ordered']], ['material_request_type', '=', 'Purchase']], icon: 'Send', tone: 'info', sub: (r) => `Required by ${r.schedule_date || '—'}`, fields: ['schedule_date'] },
  { module: 'sq', kind: 'action', title: 'Evaluate Quotation', filters: [['status', '=', 'Submitted']], icon: 'FileBadge', tone: 'info', sub: (r) => r.supplier_name || '', fields: ['supplier_name'] },
  { module: 'pi', kind: 'approve', title: 'Verify Supplier Invoice', filters: [['docstatus', '=', 0]], icon: 'Receipt', tone: 'critical', sub: (r) => r.supplier_name || '', fields: ['supplier_name'] },
  { module: 'payment', kind: 'approve', title: 'Release Payment', filters: [['docstatus', '=', 0], ['party_type', '=', 'Supplier']], icon: 'Banknote', tone: 'critical', sub: (r) => r.party_name || '', fields: ['party_name'] },
]

async function load() {
  loading.value = true
  const out = []
  await Promise.all(
    SOURCES.map(async (s) => {
      const m = MODULES[s.module]
      const rows = await api.getList(m.doctype, { fields: ['name', 'modified', ...s.fields], filters: [...s.filters, ...(state.boot?.company ? [['company', '=', state.boot.company]] : [])], order_by: 'modified desc', limit: 30 }).catch(() => [])
      rows.forEach((r) => out.push({ ...r, module: s.module, doctype: m.doctype, kind: s.kind, title: s.title, icon: s.icon, tone: s.tone, sub: s.sub(r) }))
    }),
  )
  tasks.value = out.sort((a, b) => String(b.modified).localeCompare(String(a.modified)))
  loading.value = false
  if (cur.value && !out.some((t) => t.name === cur.value.name)) cur.value = null
}
provide('docNav', {
  names: computed(() => shown.value.map((t) => t.name)),
  go: (name) => select(shown.value.find((t) => t.name === name)),
})
function select(t) {
  cur.value = t
}
onMounted(load)
defineExpose({ count: computed(() => tasks.value.length) })
</script>

<style scoped>
.inbox { display: flex; height: calc(100vh - var(--shell-h)); overflow: hidden; }
.master, .detail { overflow-y: auto; overscroll-behavior: contain; }
.master { flex: 0 0 24rem; max-width: 100%; border-right: 1px solid var(--border-soft); background: var(--surface); }
.m-head { display: flex; align-items: baseline; gap: 0.75rem; padding: 1.25rem 1rem 0.75rem; }
.m-head h2 { font-size: 1.25rem; }
.master ul { list-style: none; margin: 0; padding: 0 0.5rem; }
.master li { display: flex; gap: 0.75rem; padding: 0.75rem 0.625rem; border-radius: 0.5rem; cursor: pointer; }
.master li:hover { background: var(--surface-hover); }
.master li.on { background: var(--surface-select); box-shadow: inset 3px 0 0 var(--brand); }
.t-ico { flex: none; width: 2rem; height: 2rem; border-radius: 0.5rem; display: grid; place-items: center; background: var(--info-bg); color: var(--info); }
.t-ico.critical { background: var(--critical-bg); color: var(--critical-text); }
.ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail { flex: 1; min-width: 0; }
@media (max-width: 960px) {
  .inbox { flex-direction: column; height: auto; overflow: visible; }
  .master, .detail { overflow: visible; }
  .master { flex: none; border-right: 0; }
}
</style>
