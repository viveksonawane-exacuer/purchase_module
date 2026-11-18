<template>
  <div class="flow">
    <div v-for="(s, i) in steps" :key="s.step" class="lane" :class="laneState(s)" :style="{ '--d': i * 110 + 'ms' }">
      <div class="node">
        <span class="circle">
          <Icon :name="s.docs.length ? 'Check' : 'Clock'" :size="14" :stroke="2.5" />
        </span>
        <span v-if="i < steps.length - 1" class="connector" />
      </div>
      <div class="lane-title">{{ s.step }}</div>
      <div class="docs">
        <router-link
          v-for="d in s.docs"
          :key="d.name"
          :to="`/${BY_DOCTYPE[d.doctype]?.key}/${encodeURIComponent(d.name)}`"
          class="doc"
          :class="{ current: d.name === current }"
        >
          <b>{{ d.name }}</b>
          <StatusBadge :status="d.status" :docstatus="d.docstatus" />
        </router-link>
        <span v-if="!s.docs.length" class="none">—</span>
      </div>
    </div>
  </div>
</template>
<script setup>
import { BY_DOCTYPE } from '../config'
import Icon from './Icon.vue'
import StatusBadge from './StatusBadge.vue'
defineProps({ steps: Array, current: String })
const laneState = (s) => (s.docs.length ? (s.docs.every((d) => d.docstatus === 1) ? 'done' : 'partial') : 'todo')
</script>
<style scoped>
.flow { display: grid; grid-template-columns: repeat(7, minmax(9.5rem, 1fr)); gap: 0; overflow-x: auto; padding-bottom: 0.5rem; }
.lane { display: flex; flex-direction: column; align-items: center; text-align: center; min-width: 9.5rem; }
.node { position: relative; width: 100%; display: flex; justify-content: center; height: 2rem; align-items: center; }
.circle {
  position: relative; z-index: 1; width: 1.75rem; height: 1.75rem; border-radius: 50%;
  display: grid; place-items: center; background: var(--neutral-bg); color: var(--text-3); border: 2px solid var(--border);
}
.done .circle { background: var(--positive); border-color: var(--positive); color: #fff; }
.partial .circle { background: var(--critical-bg); border-color: var(--critical); color: var(--critical-text); }
.connector { position: absolute; left: 50%; width: 100%; top: 50%; height: 2px; background: var(--border); }
.connector::after { content: ''; position: absolute; inset: 0; background: var(--positive); transform: scaleX(0); transform-origin: left; }
.done .connector::after { animation: conn 0.5s var(--ease) both; animation-delay: calc(var(--d) + 150ms); }
@keyframes conn { to { transform: scaleX(1); } }
.lane { animation: fade-up 0.4s var(--ease) both; animation-delay: var(--d); }
.circle { transition: transform 0.3s var(--spring); }
.lane:hover .circle { transform: scale(1.15); }
.doc { transition: border-color 0.15s, transform 0.2s var(--ease), box-shadow 0.2s; }
.doc:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); }
.doc.current { animation: ring 2.2s ease-in-out infinite; }
@keyframes ring { 50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--brand) 18%, transparent); } }
.lane-title { margin: 0.5rem 0; font-size: 0.75rem; font-weight: 700; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.04em; }
.docs { display: flex; flex-direction: column; gap: 0.375rem; width: 100%; padding: 0 0.375rem; }
.doc {
  display: flex; flex-direction: column; gap: 0.25rem; align-items: center;
  padding: 0.5rem; border-radius: 0.5rem; background: var(--surface-2); border: 1px solid var(--border-soft);
  color: var(--text); font-size: 0.75rem; text-decoration: none;
}
.doc:hover { border-color: var(--brand); text-decoration: none; }
.doc.current { border: 2px solid var(--brand); background: var(--brand-soft); }
.none { color: var(--text-3); }
</style>
