<template>
  <div class="fc">
    <div v-if="series.length > 1" class="legend" role="list">
      <span v-for="s in series" :key="s.name" class="lg" role="listitem">
        <i :class="[s.type === 'line' ? 'ln' : 'sw']" :style="{ '--c': s.color }" />{{ s.name }}
      </span>
    </div>
    <div ref="plot" class="plot" @mouseleave="hover = -1">
      <svg :viewBox="`0 0 ${Wc} ${H}`" :style="{ height: H + 'px' }" role="img" :aria-label="label">
        <g v-for="t in ticks" :key="t">
          <line :x1="padL" :x2="Wc - 4" :y1="y(t)" :y2="y(t)" class="grid" />
          <text :x="padL - 6" :y="y(t) + 4" class="axis" text-anchor="end">{{ fmtCompact(t) }}</text>
        </g>
        <g v-for="(lbl, i) in labels" :key="i">
          <rect :x="x(i) - step / 2" y="0" :width="step" :height="H - padB" class="hit" :class="{ on: hover === i }" @mouseenter="hover = i" />
          <template v-for="(s, si) in bars" :key="s.name">
            <path :d="barPath(i, si, s.values[i])" :style="{ fill: s.color, animationDelay: i * 40 + 'ms' }" class="bar" :class="{ dim: hover > -1 && hover !== i }" />
          </template>
          <text v-if="i % labelEvery === 0" :x="x(i)" :y="H - 6" class="axis" text-anchor="middle">{{ lbl }}</text>
        </g>
        <line :x1="padL" :x2="Wc - 4" :y1="y(0)" :y2="y(0)" class="base" />
        <template v-for="s in lines" :key="s.name">
          <polyline :points="s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')" class="line" :style="{ stroke: s.color }" />
          <circle v-for="(v, i) in s.values" :key="i" :cx="x(i)" :cy="y(v)" :r="hover === i ? 5 : 3.5" class="pt" :style="{ fill: s.color }" />
        </template>
      </svg>
      <div v-if="hover > -1" class="tip" :style="{ left: (x(hover) / Wc) * 100 + '%' }">
        <small>{{ labels[hover] }}</small>
        <div v-for="s in series" :key="s.name" class="tip-row">
          <i :class="[s.type === 'line' ? 'ln' : 'sw']" :style="{ '--c': s.color }" />
          <span>{{ s.name }}</span><b>{{ fmtMoney(s.values[hover]) }}</b>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { fmtCompact, fmtMoney } from '../../store'

const props = defineProps({ labels: Array, series: Array, height: { type: Number, default: 220 }, label: String })
const plot = ref(null)
const width = ref(640)
let ro
onMounted(() => {
  ro = new ResizeObserver(([e]) => (width.value = Math.max(280, Math.round(e.contentRect.width))))
  ro.observe(plot.value)
})
onBeforeUnmount(() => ro?.disconnect())
const H = props.height
const Wc = computed(() => width.value)
const padL = 56
const padB = 24
const hover = ref(-1)
const bars = computed(() => props.series.filter((s) => s.type !== 'line'))
const lines = computed(() => props.series.filter((s) => s.type === 'line'))
function nice(v) {
  if (v <= 0) return 0
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}
const all = computed(() => props.series.flatMap((s) => s.values.map((v) => +v || 0)))
const hi = computed(() => nice(Math.max(0, ...all.value)) || 1)
const lo = computed(() => -nice(-Math.min(0, ...all.value)))
const ticks = computed(() => {
  const span = hi.value - lo.value
  const st = nice(span / 4)
  const out = []
  for (let t = Math.ceil(lo.value / st) * st; t <= hi.value + 1e-6; t += st) out.push(Math.round(t))
  return out
})
const step = computed(() => (Wc.value - padL - 8) / Math.max(1, props.labels.length))
const labelEvery = computed(() => Math.max(1, Math.ceil(52 / step.value)))
const bw = computed(() => Math.min(22, (step.value * 0.7) / Math.max(1, bars.value.length)))
const x = (i) => padL + step.value * i + step.value / 2
const y = (v) => 8 + (H - padB - 8) * (1 - ((+v || 0) - lo.value) / (hi.value - lo.value))
// bar with 4px rounded data end, square at the baseline; 2px gap between adjacent bars
function barPath(i, si, v) {
  const n = bars.value.length
  const gap = 2
  const left = x(i) - (n * bw.value + (n - 1) * gap) / 2 + si * (bw.value + gap)
  const w = bw.value
  const y0 = y(0)
  const y1 = y(v)
  const h = Math.abs(y0 - y1)
  if (h < 0.5) return ''
  const r = Math.min(4, w / 2, h)
  if (y1 < y0) return `M${left},${y0} V${y1 + r} Q${left},${y1} ${left + r},${y1} H${left + w - r} Q${left + w},${y1} ${left + w},${y1 + r} V${y0} Z`
  return `M${left},${y0} V${y1 - r} Q${left},${y1} ${left + r},${y1} H${left + w - r} Q${left + w},${y1} ${left + w},${y1 - r} V${y0} Z`
}
</script>

<style scoped>
.fc { width: 100%; }
.legend { display: flex; flex-wrap: wrap; gap: 0.375rem 1rem; margin-bottom: 0.5rem; font-size: 0.75rem; color: var(--text-2); }
.lg { display: inline-flex; align-items: center; gap: 0.375rem; }
.sw { width: 0.625rem; height: 0.625rem; border-radius: 2px; background: var(--c); display: inline-block; flex: none; }
.ln { width: 0.875rem; height: 2px; border-radius: 1px; background: var(--c); display: inline-block; flex: none; }
.plot { position: relative; }
svg { width: 100%; display: block; overflow: visible; }
.grid { stroke: var(--grid); stroke-width: 1; }
.base { stroke: var(--text-3); stroke-width: 1; }
.axis { fill: var(--text-2); font-size: 11px; font-family: var(--font); }
.hit { fill: transparent; }
.hit.on { fill: var(--surface-hover); opacity: 0.6; }
.bar { transition: opacity 0.15s; animation: fc-grow 0.5s var(--ease) both; transform-box: fill-box; transform-origin: bottom; }
.bar.dim { opacity: 0.4; }
@keyframes fc-grow { from { transform: scaleY(0); } }
.line { fill: none; stroke-width: 2; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.pt { stroke: var(--surface); stroke-width: 2; transition: r 0.15s; }
.tip {
  position: absolute; top: 0; transform: translateX(-50%); pointer-events: none; z-index: 5;
  background: var(--surface); border: 1px solid var(--border-soft); border-radius: 0.5rem; box-shadow: var(--shadow-2);
  padding: 0.5rem 0.625rem; font-size: 0.75rem; min-width: 11rem;
}
.tip small { color: var(--text-2); font-weight: 600; display: block; margin-bottom: 0.25rem; }
.tip-row { display: flex; align-items: center; gap: 0.375rem; }
.tip-row span { flex: 1; color: var(--text-2); }
.tip-row b { font-variant-numeric: tabular-nums; color: var(--text); }
</style>
