<template>
  <div class="field">
    <label>Period</label>
    <div class="segmented">
      <button v-for="p in presets" :key="p.key" :class="{ on: p.from === from && p.to === to }" @click="apply(p)">{{ p.label }}</button>
    </div>
  </div>
  <div class="field"><label>From date</label><input type="date" class="input" :value="from" :max="to" @change="set('from', $event.target.value)" /></div>
  <div class="field"><label>To date</label><input type="date" class="input" :value="to" :min="from" @change="set('to', $event.target.value)" /></div>
</template>

<script setup>
import { computed } from 'vue'
import { fin, rangePresets } from './fin'
const props = defineProps({ from: String, to: String })
const emit = defineEmits(['update:from', 'update:to', 'change'])
const presets = computed(() => (fin.ctx ? rangePresets(fin.ctx) : []))
function apply(p) {
  emit('update:from', p.from)
  emit('update:to', p.to)
  setTimeout(() => emit('change'))
}
function set(k, v) {
  if (!v) return
  emit('update:' + k, v)
  setTimeout(() => emit('change'))
}
</script>
