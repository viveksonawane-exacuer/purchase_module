<template>
  <svg class="spark" viewBox="0 0 120 36" preserveAspectRatio="none" role="img" :aria-label="label">
    <defs>
      <linearGradient :id="gid" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="var(--chart)" stop-opacity="0.28" />
        <stop offset="100%" stop-color="var(--chart)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path :d="area" :fill="`url(#${gid})`" />
    <path :d="line" class="ln" pathLength="1" />
    <circle :cx="pts.at(-1)[0]" :cy="pts.at(-1)[1]" r="2.5" class="end" />
    <title>{{ label }}</title>
  </svg>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ data: { type: Array, default: () => [] }, label: String })
const gid = 'sg' + Math.random().toString(36).slice(2, 8)
const pts = computed(() => {
  const d = props.data.length ? props.data : [0, 0]
  const max = Math.max(1, ...d)
  return d.map((v, i) => [3 + (i * 114) / Math.max(1, d.length - 1), 32 - (v / max) * 28])
})
const line = computed(() => pts.value.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '))
const area = computed(() => `${line.value} L${pts.value.at(-1)[0]},36 L${pts.value[0][0]},36 Z`)
</script>
<style scoped>
.spark { width: 100%; height: 36px; display: block; overflow: visible; }
.ln { fill: none; stroke: var(--chart); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1s var(--ease) forwards; }
.end { fill: var(--chart); stroke: var(--surface); stroke-width: 2; vector-effect: non-scaling-stroke; animation: pop-in 0.3s 0.9s var(--spring) both; }
@keyframes draw { to { stroke-dashoffset: 0; } }
</style>
