<template>
  <ul class="rank">
    <li v-for="(r, i) in rows" :key="r.label + i" :style="{ '--d': i * 70 + 'ms' }" :title="`${r.label}: ${fmt(r.value)}`">
      <component :is="r.to ? 'router-link' : 'span'" :to="r.to" class="lbl" :class="{ link: r.to }">
        <slot name="label" :row="r">{{ r.label }}</slot>
      </component>
      <span class="track"><span :style="{ width: (r.value / max) * 100 + '%' }" /></span>
      <span class="val mono">{{ fmt(r.value, true) }}</span>
    </li>
    <li v-if="!rows.length" class="muted none">No data in this period</li>
  </ul>
</template>
<script setup>
import { computed } from 'vue'
import { fmtCompact, fmtMoney, fmtNum } from '../store'
const props = defineProps({ rows: Array, money: { type: Boolean, default: true } })
const max = computed(() => Math.max(1, ...props.rows.map((r) => r.value || 0)))
const fmt = (v, short) => (props.money ? (short ? fmtCompact(v) : fmtMoney(v)) : fmtNum(v, short ? 0 : 2))
</script>
<style scoped>
.rank { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.rank li { display: grid; grid-template-columns: minmax(6rem, 11rem) 1fr 4.5rem; gap: 0.75rem; align-items: center; }
.rank li.none { display: block; padding: 1.5rem 0; text-align: center; }
.lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
.lbl.link:hover { color: var(--link); text-decoration: underline; }
.track { height: 0.625rem; background: var(--neutral-bg); border-radius: 1rem; overflow: hidden; }
.track span { display: block; height: 100%; background: var(--chart); border-radius: 0 4px 4px 0; transform-origin: left; animation: grow-x 0.8s var(--ease) both; animation-delay: var(--d); transition: width 0.5s var(--ease); }
.val { text-align: right; color: var(--text-2); font-weight: 600; }
</style>
