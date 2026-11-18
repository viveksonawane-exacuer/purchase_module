<template>
  <div class="chart" ref="root" @mouseleave="hover = -1">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" :style="{ height: H + 'px' }" role="img" :aria-label="label">
      <g v-for="t in ticks" :key="t">
        <line :x1="padL" :x2="W - 4" :y1="y(t)" :y2="y(t)" class="grid" />
        <text :x="padL - 6" :y="y(t) + 4" class="axis" text-anchor="end">{{ fmt(t, true) }}</text>
      </g>
      <g v-for="(d, i) in data" :key="i">
        <rect
          :x="x(i) - bw / 2"
          :y="y(d.value)"
          :width="bw"
          :height="Math.max(0, y(0) - y(d.value))"
          :rx="Math.min(4, bw / 2)"
          :style="{ animationDelay: i * 60 + 'ms' }"
          class="bar grow"
          :class="{ dim: hover > -1 && hover !== i }"
        />
        <!-- square off the baseline end -->
        <rect v-if="d.value > 0" :x="x(i) - bw / 2" :y="Math.max(y(d.value), y(0) - 4)" :width="bw" :height="Math.min(4, y(0) - y(d.value))" class="bar grow" :style="{ animationDelay: i * 60 + 'ms' }" :class="{ dim: hover > -1 && hover !== i }" />
        <rect :x="x(i) - step / 2" :y="0" :width="step" :height="H - padB" fill="transparent" @mouseenter="hover = i" />
        <text v-if="data.length <= 12 || i % 2 === (data.length - 1) % 2" :x="x(i)" :y="H - 6" class="axis" text-anchor="middle">{{ d.label }}</text>
      </g>
      <line :x1="padL" :x2="W - 4" :y1="y(0)" :y2="y(0)" class="base" />
    </svg>
    <div v-if="hover > -1" class="tip" :style="{ left: (x(hover) / W) * 100 + '%' }">
      <small>{{ data[hover].label }}</small>
      <b>{{ fmt(data[hover].value) }}</b>
    </div>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { fmtCompact, fmtMoney, fmtNum } from '../store'
const props = defineProps({ data: Array, money: Boolean, label: String, height: { type: Number, default: 200 } })
const W = 600
const H = computed(() => props.height).value
const padL = 52
const padB = 24
const hover = ref(-1)
const max = computed(() => {
  const m = Math.max(1, ...props.data.map((d) => d.value))
  const p = Math.pow(10, Math.floor(Math.log10(m)))
  return Math.ceil(m / p) * p
})
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => f * max.value))
const step = computed(() => (W - padL - 8) / Math.max(1, props.data.length))
const bw = computed(() => Math.min(36, step.value * 0.5))
const x = (i) => padL + step.value * i + step.value / 2
const y = (v) => 8 + (H - padB - 8) * (1 - v / max.value)
const fmt = (v, short) => (props.money ? (short ? fmtCompact(v) : fmtMoney(v)) : fmtNum(v, short ? 0 : 2))
</script>
<style scoped>
.chart { position: relative; width: 100%; }
svg { width: 100%; display: block; overflow: visible; }
.grid { stroke: var(--grid); stroke-width: 1; }
.base { stroke: var(--text-3); stroke-width: 1; }
.axis { fill: var(--text-2); font-size: 11px; font-family: var(--font); }
.bar { fill: var(--chart); transition: opacity 0.15s; }
.bar.dim { opacity: 0.35; }
.grow { transform-box: fill-box; transform-origin: bottom; animation: bar-grow 0.7s cubic-bezier(0.2, 0, 0, 1) both; }
@keyframes bar-grow { from { transform: scaleY(0); } }
.tip { animation: tip-in 0.15s ease both; }
@keyframes tip-in { from { opacity: 0; margin-top: 4px; } }
.tip {
  position: absolute; top: 0; transform: translate(-50%, -110%);
  background: var(--surface); box-shadow: var(--shadow-2); border-radius: 0.5rem;
  padding: 0.375rem 0.625rem; display: flex; flex-direction: column; pointer-events: none; white-space: nowrap;
}
.tip small { color: var(--text-2); }
</style>
