<template>
  <div class="cs" :class="{ open }">
    <button ref="btn" class="cs-btn" aria-haspopup="listbox" :aria-expanded="open" title="Switch company" @click="toggle">
      <span class="cs-text">
        <b>{{ state.boot.company || 'Select company' }}</b>
        <small>Procurement Hub</small>
      </span>
      <Icon name="ChevronsUpDown" :size="15" class="cs-chev" />
    </button>

    <Teleport to="body">
      <Transition name="vh-pop">
        <div v-if="open" ref="pop" class="cs-pop" :style="pos" role="dialog" aria-label="Switch company" @keydown.esc.stop="close">
          <div class="cs-head">
            <span>Switch company</span>
            <small class="muted">{{ companies.length }} available</small>
          </div>
          <div class="cs-search">
            <Icon name="Search" :size="15" />
            <input
              ref="inp"
              v-model="q"
              class="input compact"
              placeholder="Search companies…"
              @keydown.down.prevent="move(1)"
              @keydown.up.prevent="move(-1)"
              @keydown.enter.prevent="pick(list[sel])"
            />
          </div>
          <ul ref="ul" class="cs-list" role="listbox">
            <li
              v-for="(c, i) in list"
              :key="c.name"
              role="option"
              :aria-selected="c.name === state.boot.company"
              :class="{ on: i === sel, cur: c.name === state.boot.company }"
              @mouseenter="sel = i"
              @click="pick(c)"
            >
              <span class="cs-av" :style="{ background: c.logo ? 'var(--surface)' : tint(c.name) }">
                <img v-if="c.logo" :src="c.logo" alt="" @error="c.logo = null" />
                <template v-else>{{ ini(c) }}</template>
              </span>
              <span class="cs-name">
                <b>{{ c.name }}</b>
                <small class="muted">{{ c.abbr }} · {{ c.currency }}</small>
              </span>
              <span v-if="busy === c.name" class="cs-spin" />
              <Icon v-else-if="c.name === state.boot.company" name="Check" :size="16" class="cs-check" />
            </li>
            <li v-if="!list.length" class="cs-none muted">No company matches “{{ q }}”</li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { rowMatches } from '../search'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import { state, toast } from '../store'
import Icon from './Icon.vue'

const route = useRoute()
const open = ref(false)
const q = ref('')
const sel = ref(0)
const busy = ref('')
const btn = ref(null)
const pop = ref(null)
const inp = ref(null)
const ul = ref(null)
const pos = ref({})
const companies = computed(() => state.boot.companies || [])
const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  const all = companies.value
  return s ? all.filter((c) => rowMatches(c, s)) : all
})
watch(q, () => (sel.value = 0))

const ini = (c) => (c.abbr || c.name).replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()
const PALETTE = ['#0070f2', '#7858ff', '#00a99d', '#e76500', '#d6336c', '#256f3a', '#0f7bb8', '#8b5cf6']
const tint = (s) => PALETTE[[...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length]

function place() {
  const r = btn.value?.getBoundingClientRect()
  if (r) pos.value = { top: `${r.bottom + 8}px`, left: `${Math.max(8, Math.min(r.left, innerWidth - 328))}px` }
}
async function show() {
  q.value = ''
  sel.value = Math.max(0, companies.value.findIndex((c) => c.name === state.boot.company))
  place()
  open.value = true
  await nextTick()
  inp.value?.focus()
  ul.value?.querySelector('li.on')?.scrollIntoView({ block: 'nearest' })
}
function close() {
  open.value = false
}
const toggle = () => (open.value ? close() : show())
function move(d) {
  const n = list.value.length
  if (!n) return
  sel.value = (sel.value + d + n) % n
  nextTick(() => ul.value?.querySelector('li.on')?.scrollIntoView({ block: 'nearest' }))
}
async function pick(c) {
  if (!c || busy.value) return
  if (c.name === state.boot.company) return close()
  busy.value = c.name
  try {
    await api.setCompany(c.name)
    toast(`Switched to ${c.name}`, 'success', 2500)
    // documents belong to one company: leave detail / edit pages for their list, then reload everything
    const seg = route.path.split('/').filter(Boolean)
    const path = seg.length > 1 && !['insights', 'vendor'].includes(seg[0]) ? `/${seg[0]}` : route.path
    setTimeout(() => location.assign(`/procure${path === '/' ? '' : path}`), 350)
  } catch {
    busy.value = ''
  }
}

function onDoc(e) {
  if (!open.value) return
  if (pop.value?.contains(e.target) || btn.value?.contains(e.target)) return
  close()
}
watch(open, (v) => {
  const fn = v ? addEventListener : removeEventListener
  fn('mousedown', onDoc)
  fn('resize', place)
})
onBeforeUnmount(() => {
  removeEventListener('mousedown', onDoc)
  removeEventListener('resize', place)
})
</script>

<style scoped>
.cs { position: relative; min-width: 0; }
.cs-btn {
  display: flex; align-items: center; gap: 0.5rem; min-width: 0; max-width: 18rem; height: 2.5rem; padding: 0 0.5rem 0 0.375rem;
  border: 1px solid transparent; border-radius: 0.625rem; background: transparent; color: var(--text); font: inherit; cursor: pointer; text-align: left;
  transition: background 0.15s, border-color 0.15s;
}
.cs-btn:hover, .cs.open .cs-btn { background: var(--surface-hover); border-color: var(--border-soft); }
.cs-text { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.cs-text b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-text small { color: var(--text-2); font-size: 0.75rem; }
.cs-chev { flex: none; color: var(--text-3); transition: color 0.15s; }
.cs.open .cs-chev { color: var(--brand); }
@media (max-width: 860px) { .cs-text small { display: none; } }
@media (max-width: 520px) { .cs-text { display: none; } }
</style>

<style>
/* global: popover is teleported to <body> */
.cs-pop {
  position: fixed; z-index: 400; width: 20rem; max-width: calc(100vw - 16px); transform-origin: top left;
  background: var(--surface); border: 1px solid var(--border-soft); border-radius: 0.875rem;
  box-shadow: 0 16px 40px -10px rgba(16, 24, 40, 0.28), 0 4px 10px -4px rgba(16, 24, 40, 0.12);
  font-family: var(--font); font-size: 0.875rem; color: var(--text); overflow: hidden;
}
.cs-head { display: flex; align-items: baseline; justify-content: space-between; padding: 0.75rem 0.875rem 0.25rem; font-weight: 700; font-size: 0.8125rem; }
.cs-head small { font-weight: 400; font-size: 0.75rem; }
.cs-search { position: relative; padding: 0.375rem 0.625rem 0.5rem; border-bottom: 1px solid var(--border-soft); }
.cs-search svg { position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
.cs-search .input { padding-left: 2rem; }
.cs-list { list-style: none; margin: 0; padding: 0.3125rem; max-height: min(22rem, 60vh); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.cs-list li { display: flex; align-items: center; gap: 0.625rem; padding: 0.4375rem 0.5rem; border-radius: 0.5rem; cursor: pointer; }
.cs-list li.on { background: var(--surface-select); }
.cs-list li.cur .cs-name b { color: var(--brand); }
.cs-av {
  width: 2rem; height: 2rem; border-radius: 0.5rem; flex: none; display: grid; place-items: center; overflow: hidden;
  color: #fff; font-size: 0.6875rem; font-weight: 800; letter-spacing: 0.02em; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.cs-av img { width: 100%; height: 100%; object-fit: contain; padding: 2px; }
.cs-name { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.cs-name b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-name small { font-size: 0.75rem; }
.cs-check { flex: none; color: var(--brand); }
.cs-none { padding: 1rem; text-align: center; cursor: default !important; }
.cs-spin { width: 1rem; height: 1rem; flex: none; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--brand); animation: vh-spin 0.7s linear infinite; }
@keyframes vh-spin { to { transform: rotate(360deg); } }
</style>
