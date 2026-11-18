<template>
  <LinkInput v-if="f.type === 'link'" :model-value="modelValue" :doctype="f.doctype" :filters="f.filters" :compact="compact" :readonly="readonly" @update:model-value="emit('update:modelValue', $event)" @select="emit('select', $event)" />
  <SelectInput v-else-if="f.type === 'select'" :model-value="modelValue" :options="f.options" :placeholder="f.placeholder || 'All'" :compact="compact" :readonly="readonly" @update:model-value="emit('update:modelValue', $event)" @select="emit('select', $event)" />
  <textarea v-else-if="f.type === 'text'" class="input" :value="modelValue" :readonly="readonly" @input="emit('update:modelValue', $event.target.value)" />
  <input
    v-else
    class="input"
    :class="{ compact, mono: f.type === 'number' }"
    :type="f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'"
    :step="f.type === 'number' ? 'any' : undefined"
    :value="modelValue"
    :readonly="readonly"
    @input="emit('update:modelValue', f.type === 'number' ? ($event.target.value === '' ? '' : +$event.target.value) : $event.target.value)"
  />
</template>
<script setup>
import LinkInput from './LinkInput.vue'
import SelectInput from './SelectInput.vue'
defineProps({ f: Object, modelValue: [String, Number], compact: Boolean, readonly: Boolean })
const emit = defineEmits(['update:modelValue', 'select'])
</script>
