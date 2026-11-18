<template>
  <span class="status" :class="tone">{{ label }}</span>
</template>
<script setup>
import { computed } from 'vue'
import { statusTone } from '../store'
const props = defineProps({ status: String, docstatus: Number })
const label = computed(() => props.status || ['Draft', 'Submitted', 'Cancelled'][props.docstatus ?? 0])
const tone = computed(() => statusTone(label.value, props.docstatus))
</script>
