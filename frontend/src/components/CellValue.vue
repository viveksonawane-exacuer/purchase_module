<template>
  <StatusBadge v-if="col.type === 'status'" :status="row.status" :docstatus="row.docstatus" />
  <Progress v-else-if="col.type === 'percent'" :value="row[col.field]" />
  <span v-else-if="col.type === 'money'" class="mono">{{ fmtMoney(row[col.field], row.currency) }}</span>
  <span v-else-if="col.type === 'date'">{{ fmtDate(row[col.field]) }}</span>
  <span v-else-if="col.type === 'user'" class="muted">{{ (row[col.field] || '').split('@')[0] }}</span>
  <span v-else-if="col.type === 'title'" class="title">{{ row[col.field] }}</span>
  <span v-else>{{ row[col.field] ?? '' }}</span>
</template>
<script setup>
import { fmtDate, fmtMoney } from '../store'
import Progress from './Progress.vue'
import StatusBadge from './StatusBadge.vue'
defineProps({ col: Object, row: Object })
</script>
