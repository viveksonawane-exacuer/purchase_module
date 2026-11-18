<template>
  <div class="rc">
    <div class="rc-legend">
      <span v-for="(d, i) in sets" :key="i" class="lg"><i :style="{ background: color(i) }" />{{ d.name || `Series ${i + 1}` }}</span>
    </div>

    <!-- share of total (pie / donut / percentage): one stacked bar + ranked list -->
    <div v-if="isShare" class="share">
      <div class="share-bar">
        <span v-for="(v, i) in shareVals" :key="i" :style="{ width: (100 * v) / shareTotal + '%', background: color(i), animationDelay: i * 60 + 'ms' }" :title="`${labels[i]}: ${fmt(v)}`" />
      </div>
      <ul class="share-list">
        <li v-for="(v, i) in shareVals" :key="i"><i :style="{ background: color(i) }" /><span class="ell">{{ labels[i] }}</span><b>{{ fmt(v) }}</b><small class="muted">{{ ((100 * v) / shareTotal).toFixed(1) }}%</small></li>
      </ul>
    </div>

    <div v-else class="plot" @mouseleave="hover = -1">
      <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" :aria-label="title || 'Report chart'">
        <g v-for="t in ticks" :key="t">
          <line :x1="PL" :x2="W" :y1="y(t)" :y2="y(t)" class="grid" />
          <text :x="PL - 6" :y="y(t) + 4" text-anchor="end" class="axis">{{ short(t) }}</text>
        </g>
        <line :x1="PL" :x2="W" :y1="y(0)" :y2="y(0)" class="base" />
        <template v-if="type === 'line'">
          <g v-for="(d, si) in sets" :key="si">
            <path :d="area(d.values)" :fill="color(si)" class="area" />
            <path :d="line(d.values)" :stroke="color(si)" class="ln" />
            <circle v-for="(v, i) in d.values" :key="i" :cx="cx(i)" :cy="y(+v || 0)" r="3.5" :fill="color(si)" :class="{ show: hover === i }" class="pt" />
          </g>
        </template>
        <template v-else>
          <g v-for="(_, i) in labels" :key="i" :class="{ dim: hover > -1 && hover !== i }">
            <rect
              v-for="(d, si) in sets"
              :key="si"
              :x="cx(i) - groupW / 2 + si * barW"
              :y="Math.min(y(+d.values[i] || 0), y(0))"
              :width="Math.max(1, barW - 2)"
              :height="Math.abs(y(0) - y(+d.values[i] || 0))"
              rx="3"
              :fill="color(si)"
              class="bar"
              :style="{ animationDelay: i * 30 + 'ms' }"
            />
          </g>
        </template>
        <g v-for="(l, i) in labels" :key="'x' + i">
          <rect :x="cx(i) - step / 2" y="0" :width="step" :height="H" fill="transparent" @mouseenter="hover = i" />
          <text v-if="showLabel(i)" :x="cx(i)" :y="H - 6" text-anchor="middle" class="axis">{{ String(l).slice(0, 12) }}</text>
        </g>
      </svg>
      <div v-if="hover > -1" class="tip" :style="{ left: (cx(hover) / W) * 100 + '%' }">
        <small>{{ labels[hover] }}</small>
        <span v-for="(d, si) in sets" :key="si"><i :style="{ background: color(si) }" /> {{ d.name || 'Value' }} <b>{{ fmt(d.values[hover]) }}</b></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { fmtCompact, fmtMoney, fmtNum } from '../store'

const props = defineProps({ chart: Object, title: String })
const PALETTE = ['var(--chart)', '#7858ff', '#00a99d', '#e76500', '#d6336c', '#256f3a', '#0f7bb8', '#8b5cf6']
const color = (i) => (props.chart.colors?.[i] && /^#|^rgb/.test(props.chart.colors[i]) ? props.chart.colors[i] : PALETTE[i % PALETTE.length])
const W = 720
const H = 240
const PL = 56
const PB = 26
const hover = ref(-1)

const type = computed(() => (props.chart?.type || 'bar').toLowerCase())
const isShare = computed(() => ['pie', 'donut', 'percentage'].includes(type.value))
const labels = computed(() => props.chart?.data?.labels || [])
const sets = computed(() => (props.chart?.data?.datasets || []).slice(0, 6))
const money = computed(() => ['Currency'].includes(props.chart?.fieldtype))
const fmt = (v) => (money.value ? fmtMoney(+v || 0) : fmtNum(+v || 0))
const short = (v) => (money.value ? fmtCompact(v) : Intl.NumberFormat(undefined, { notation: 'compact' }).format(v))

const shareVals = computed(() => (sets.value[0]?.values || []).map((v) => Math.max(0, +v || 0)))
const shareTotal = computed(() => shareVals.value.reduce((a, b) => a + b, 0) || 1)

const all = computed(() => sets.value.flatMap((d) => d.values.map((v) => +v || 0)))
const max = computed(() => nice(Math.max(0, ...all.value)))
const min = computed(() => -nice(-Math.min(0, ...all.value)))
function nice(m) {
  if (m <= 0) return 0
  const p = Math.pow(10, Math.floor(Math.log10(m)))
  return Math.ceil(m / p) * p
}
const ticks = computed(() => {
  const span = max.value - min.value || 1
  return [0, 0.25, 0.5, 0.75, 1].map((f) => min.value + f * span)
})
const step = computed(() => (W - PL) / Math.max(1, labels.value.length))
const groupW = computed(() => Math.min(56, step.value * 0.7))
const barW = computed(() => groupW.value / Math.max(1, sets.value.length))
const cx = (i) => PL + step.value * i + step.value / 2
const y = (v) => 8 + (H - PB - 8) * (1 - (v - min.value) / (max.value - min.value || 1))
const showLabel = (i) => labels.value.length <= 14 || i % Math.ceil(labels.value.length / 12) === 0
const line = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${cx(i)},${y(+v || 0)}`).join(' ')
const area = (vals) => (vals.length ? `${line(vals)} L${cx(vals.length - 1)},${y(0)} L${cx(0)},${y(0)} Z` : '')
</script>

<style scoped>
.rc-legend { display: flex; flex-wrap: wrap; gap: 0.375rem 1rem; margin-bottom: 0.75rem; font-size: 0.75rem; color: var(--text-2); }
.lg, .share-list li, .tip span { display: inline-flex; align-items: center; gap: 0.375rem; }
i { display: inline-block; width: 0.625rem; height: 0.625rem; border-radius: 3px; flex: none; }
.plot { position: relative; }
svg { width: 100%; height: 240px; display: block; overflow: visible; }
.grid { stroke: var(--grid); stroke-dasharray: 3 4; }
.base { stroke: var(--border); }
.axis { fill: var(--text-2); font-size: 11px; font-family: var(--font); }
.bar { transform-box: fill-box; transform-origin: bottom; animation: rc-up 0.6s var(--ease) both; transition: opacity 0.15s; }
g.dim .bar { opacity: 0.35; }
@keyframes rc-up { from { transform: scaleY(0); } }
.ln { fill: none; stroke-width: 2.25; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 2000; animation: rc-draw 1.2s var(--ease) both; }
@keyframes rc-draw { from { stroke-dashoffset: 2000; } to { stroke-dashoffset: 0; } }
.area { opacity: 0.08; }
.pt { opacity: 0; transition: opacity 0.15s; }
.pt.show { opacity: 1; }
.tip {
  position: absolute; top: 0; transform: translate(-50%, -105%); pointer-events: none; white-space: nowrap; z-index: 2;
  display: flex; flex-direction: column; gap: 0.125rem; padding: 0.5rem 0.75rem; font-size: 0.8125rem;
  background: var(--surface); border: 1px solid var(--border-soft); border-radius: 0.5rem; box-shadow: var(--shadow-2);
}
.tip b { margin-left: auto; padding-left: 0.75rem; font-variant-numeric: tabular-nums; }
.share-bar { display: flex; height: 0.875rem; border-radius: 1rem; overflow: hidden; background: var(--neutral-bg); }
.share-bar span { height: 100%; transform-origin: left; animation: grow-x 0.7s var(--ease) both; }
.share-list { list-style: none; margin: 0.875rem 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.5rem 1.5rem; }
.share-list li { font-size: 0.875rem; }
.share-list .ell { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.share-list b { font-variant-numeric: tabular-nums; }
</style>
