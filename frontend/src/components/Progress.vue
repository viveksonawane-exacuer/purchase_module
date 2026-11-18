<template>
  <div class="row" style="gap: 0.5rem; min-width: 6.5rem">
    <div class="progress" :class="tone" style="flex: 1" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100">
      <span :style="{ width: Math.min(pct, 100) + '%' }" />
    </div>
    <span class="mono muted" style="font-size: 0.75rem; width: 2.5rem; text-align: right">{{ Math.round(pct) }}%</span>
  </div>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ value: Number })
const pct = computed(() => +props.value || 0)
const tone = computed(() => (pct.value >= 100 ? 'positive' : pct.value > 0 ? '' : ''))
</script>
