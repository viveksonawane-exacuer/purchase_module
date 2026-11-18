<template><span class="mono">{{ text }}</span></template>
<script setup>
// Counts up from the previous value to the new one (easeOutCubic).
import { computed, onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps({ value: { type: Number, default: 0 }, format: { type: Function, default: (v) => Math.round(v).toLocaleString() }, duration: { type: Number, default: 900 } })
const shown = ref(0)
let raf
function animate(from, to) {
  cancelAnimationFrame(raf)
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return (shown.value = to)
  const t0 = performance.now()
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / props.duration)
    shown.value = from + (to - from) * (1 - Math.pow(1 - p, 3))
    if (p < 1) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}
watch(() => props.value, (v, o) => animate(o || 0, v || 0), { immediate: true })
onBeforeUnmount(() => cancelAnimationFrame(raf))
const text = computed(() => props.format(shown.value))
</script>
