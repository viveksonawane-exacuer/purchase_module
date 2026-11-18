<template>
  <div class="vh" ref="root">
    <input
      ref="inp"
      class="input"
      :class="{ compact }"
      :value="text"
      :placeholder="placeholder || 'Search ' + doctype"
      :readonly="readonly"
      autocomplete="off"
      role="combobox"
      :aria-expanded="open"
      @input="onInput"
      @focus="onFocus"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="pick(opts[sel])"
      @keydown.esc="close"
      @keydown.tab="close"
      @blur="onBlur"
    />
    <button v-if="!readonly && text" type="button" class="vh-clear" tabindex="-1" aria-label="Clear" @mousedown.prevent="clear"><Icon name="X" :size="13" /></button>
    <Icon v-else-if="!readonly" name="Search" :size="14" class="vh-ico" />

    <!-- Rendered in <body> so tables/cards with overflow never clip it -->
    <Teleport to="body">
      <Transition name="vh-pop">
        <ul v-if="open" ref="list" class="vh-list" :class="{ up: pos.up }" :style="pos.style" role="listbox" @mousedown.prevent>
          <li v-if="loading && !opts.length" class="vh-state"><span class="spin" /> Searching…</li>
          <li v-else-if="!opts.length" class="vh-state">No {{ doctype }} found{{ text ? ` for “${text}”` : '' }}</li>
          <li
            v-for="(o, i) in opts"
            :key="o.value"
            :class="{ on: i === sel }"
            role="option"
            :aria-selected="i === sel"
            @mousedown.prevent="pick(o)"
            @mouseenter="sel = i"
          >
            <b v-html="hl(o.value)" />
            <small v-if="o.description || o.label" class="muted" v-html="hl(strip(o.label || o.description))" />
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { api } from '../api'
import { state } from '../store'
import Icon from './Icon.vue'
import { usePopover } from './popover'

const props = defineProps({ modelValue: String, doctype: String, filters: Object, placeholder: String, compact: Boolean, readonly: Boolean })
const emit = defineEmits(['update:modelValue', 'select'])
const root = ref(null)
const inp = ref(null)
const list = ref(null)
const text = ref(props.modelValue || '')
const opts = ref([])
const open = ref(false)
const sel = ref(0)
const loading = ref(false)
watch(() => props.modelValue, (v) => (text.value = v || ''))

const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').slice(0, 90)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
function hl(s) {
  const safe = esc(s)
  const q = text.value.trim()
  if (!q) return safe
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;')})`, 'ig')
  return safe.replace(re, '<mark>$1</mark>')
}

const { pos, place } = usePopover(inp, list, open, close)

// Doctypes owned by a company: only offer records of the company selected in the shell
const COMPANY_DOCTYPES = new Set([
  'Warehouse', 'Account', 'Cost Center', 'Bank Account', 'Project', 'Department',
  'Purchase Taxes and Charges Template', 'Asset', 'Finance Book',
])
function effectiveFilters() {
  const f = { ...(props.filters || {}) }
  const company = state.boot?.company
  if (company && COMPANY_DOCTYPES.has(props.doctype) && !('company' in f)) f.company = company
  // stock is held in leaf warehouses only
  if (props.doctype === 'Warehouse' && !('is_group' in f)) f.is_group = 0
  return Object.keys(f).length ? f : undefined
}

// ---- search ----
let t
let seq = 0
async function search(q) {
  const my = ++seq
  loading.value = true
  try {
    const r = (await api.searchLink(props.doctype, q, effectiveFilters())) || []
    if (my === seq) opts.value = r
  } catch {
    if (my === seq) opts.value = []
  }
  if (my === seq) {
    loading.value = false
    sel.value = 0
    nextTick(place)
  }
}
function onInput(e) {
  text.value = e.target.value
  open.value = true
  clearTimeout(t)
  t = setTimeout(() => search(text.value), 180)
  if (!text.value) emit('update:modelValue', '')
}
function onFocus() {
  if (props.readonly) return
  open.value = true
  search(text.value)
}
function close() {
  open.value = false
}
function onBlur() {
  setTimeout(() => {
    close()
    if (text.value !== (props.modelValue || '')) text.value = props.modelValue || ''
  }, 120)
}
function move(d) {
  if (!open.value) return onFocus()
  const n = opts.value.length
  if (!n) return
  sel.value = (sel.value + d + n) % n
  nextTick(() => list.value?.querySelector('li.on')?.scrollIntoView({ block: 'nearest' }))
}
function clear() {
  text.value = ''
  emit('update:modelValue', '')
  emit('select', { value: '' })
  inp.value?.focus()
}
function pick(o) {
  if (!o) return
  text.value = o.value
  close()
  emit('update:modelValue', o.value)
  emit('select', o)
}
</script>

<style scoped>
.vh { position: relative; }
.vh .input { padding-right: 1.75rem; }
.vh-ico { position: absolute; right: 0.625rem; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; transition: color 0.15s; }
.vh:focus-within .vh-ico { color: var(--brand); }
.vh-clear {
  position: absolute; right: 0.375rem; top: 50%; transform: translateY(-50%); width: 1.375rem; height: 1.375rem;
  display: grid; place-items: center; border: 0; border-radius: 50%; background: transparent; color: var(--text-3); cursor: pointer;
  opacity: 0; transition: opacity 0.15s, background 0.15s, color 0.15s;
}
.vh:hover .vh-clear, .vh:focus-within .vh-clear { opacity: 1; }
.vh-clear:hover { background: var(--surface-hover); color: var(--text); }
</style>

<style>
/* global: the list lives in <body> (base list styles are in fiori.css) */
.vh-list .vh-state { flex-direction: row; align-items: center; gap: 0.5rem; color: var(--text-2); cursor: default; }
.vh-list .spin { width: 0.875rem; height: 0.875rem; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--brand); animation: vh-spin 0.7s linear infinite; }
@keyframes vh-spin { to { transform: rotate(360deg); } }
</style>
