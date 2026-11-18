<template>
  <component :is="ICONS[name] || ICONS.Info" :size="size" :stroke-width="stroke" aria-hidden="true" />
</template>
<script setup>
import { ICONS } from './icons'
defineProps({ name: String, size: { type: [Number, String], default: 18 }, stroke: { type: Number, default: 1.75 } })
</script>
