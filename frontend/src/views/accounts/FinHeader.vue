<template>
  <div class="dyn-header fh">
    <div class="breadcrumbs">
      <router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" />
      <span>Accounts</span><Icon name="ChevronRight" :size="12" />
      {{ title }}
    </div>
    <div class="row wrap fh-top">
      <span class="hd-ico"><Icon :name="icon" :size="20" /></span>
      <div class="fh-title">
        <h1 class="page-title">{{ title }}</h1>
        <div class="muted fh-sub">
          <span>{{ company }}</span>
          <span v-if="period" class="dot-sep">{{ period }}</span>
          <span v-if="currency" class="dot-sep">Amounts in {{ currency }}</span>
        </div>
      </div>
      <div class="spacer" />
      <button class="btn btn-transparent" :class="{ on: guide }" :aria-expanded="guide" @click="toggleGuide"><Icon name="Info" /> <span class="hide-sm">How to read</span></button>
      <slot name="actions" />
    </div>

    <div class="guide-wrap" :class="{ open: guide }">
      <div class="guide-inner">
        <div class="guide">
          <Icon name="BookOpen" :size="18" class="g-ico" />
          <div><slot name="guide" /></div>
        </div>
      </div>
    </div>

    <div v-if="$slots.filters" class="fh-filters"><slot name="filters" /></div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { state } from '../../store'
import { fin } from './fin'

const props = defineProps({ title: String, icon: { type: String, default: 'Landmark' }, period: String, guideKey: String })
const company = computed(() => state.boot?.company || fin.ctx?.company)
const currency = computed(() => fin.ctx?.currency)
const KEY = 'procure.fin.guide.' + (props.guideKey || props.title)
const guide = ref((() => {
  try {
    return localStorage.getItem(KEY) !== '0' // open the first time, remember after
  } catch {
    return true
  }
})())
function toggleGuide() {
  guide.value = !guide.value
  try {
    localStorage.setItem(KEY, guide.value ? '1' : '0')
  } catch {}
}
</script>

<style scoped>
.fh-top { gap: 0.75rem; }
.fh-title { min-width: 0; }
.fh-sub { display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.8125rem; }
.dot-sep::before { content: '·'; margin-right: 0.5rem; }
.hd-ico { width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--brand), var(--brand-2)); }
.btn.on { background: var(--surface-select); color: var(--brand); }
.guide-wrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.3s var(--ease); }
.guide-wrap.open { grid-template-rows: 1fr; }
.guide-inner { overflow: hidden; }
.guide {
  display: flex; gap: 0.75rem; margin-top: 1rem; padding: 0.875rem 1rem; border-radius: 0.625rem;
  background: var(--info-bg); color: var(--text); font-size: 0.8125rem; line-height: 1.55;
  border: 1px solid color-mix(in srgb, var(--info) 25%, transparent);
}
.g-ico { flex: none; color: var(--info); margin-top: 0.125rem; }
.guide :deep(p) { margin: 0 0 0.375rem; }
.guide :deep(ul) { margin: 0.25rem 0 0; padding-left: 1.125rem; }
.guide :deep(li) { margin: 0.125rem 0; }
.fh-filters { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; align-items: flex-end; margin-top: 1.25rem; }
.fh-filters :deep(.field) { min-width: 10rem; max-width: 100%; }
.fh-filters :deep(.segmented) { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
.fh-filters :deep(.segmented button) { white-space: nowrap; flex: none; }
@media (max-width: 720px) { .hide-sm { display: none; } }
</style>
