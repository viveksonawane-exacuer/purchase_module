<template>
  <router-link v-if="l.to" :to="l.to" class="vl" @click.stop>{{ name }}</router-link>
  <a v-else :href="l.href" target="_blank" class="vl" @click.stop>{{ name }} <Icon name="ExternalLink" :size="11" /></a>
</template>
<script setup>
import { computed } from 'vue'
import Icon from '../../components/Icon.vue'
import { voucherLink } from './fin'
const props = defineProps({ type: String, name: String })
const l = computed(() => voucherLink(props.type, props.name))
</script>
<style scoped>
.vl { font-weight: 600; white-space: nowrap; }
</style>
