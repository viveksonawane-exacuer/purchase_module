<template>
  <header class="shell">
    <button class="btn btn-transparent btn-icon shell-btn" aria-label="Toggle navigation" @click="$emit('toggle')">
      <Icon name="Menu" />
    </button>
    <router-link :to="vendor ? '/vendor' : '/'" class="brand">
      <span class="logo" :class="{ img: showLogo }">
        <img v-if="showLogo" :src="state.boot.company_logo" alt="" @error="logoFailed = true" />
        <span v-else-if="companyInitials" class="ini">{{ companyInitials }}</span>
        <Icon v-else name="Workflow" :size="18" :stroke="2.25" />
      </span>
      <span v-if="!canSwitch" class="brand-text">
        <b :title="state.boot?.company">{{ state.boot?.company || 'Procurement Hub' }}</b>
        <small>{{ vendor ? 'Supplier Portal' : 'Procurement Hub' }}</small>
      </span>
    </router-link>
    <CompanySwitcher v-if="canSwitch" class="switcher" />

    <button v-if="!vendor" class="search" @click="openPalette">
      <Icon name="Search" :size="16" />
      <span>Search apps, documents, actions…</span>
      <kbd>Ctrl K</kbd>
    </button>
    <div class="spacer" />

    <div class="row" style="gap: 0.25rem">
      <button class="btn btn-transparent btn-icon shell-btn" :title="'Theme: ' + themeLabel" @click="cycleTheme">
        <Icon :name="state.theme === 'dark' ? 'Moon' : state.theme === 'hcb' ? 'Contrast' : 'Sun'" />
      </button>
      <router-link v-if="!vendor" to="/inbox" class="btn btn-transparent btn-icon shell-btn notif" title="My Inbox">
        <Icon name="Bell" />
        <span v-if="inbox" class="dot">{{ inbox > 99 ? '99+' : inbox }}</span>
      </router-link>
      <div class="menu-wrap">
        <button class="avatar" :title="state.boot?.full_name" @click="menu = !menu">
          <img v-if="state.boot?.user_image" :src="state.boot.user_image" alt="" />
          <span v-else>{{ initials }}</span>
        </button>
        <div v-if="menu" class="popover" @click="menu = false">
          <div class="pop-head">
            <b>{{ state.boot?.full_name }}</b>
            <small class="muted">{{ state.boot?.user }}</small>
          </div>
          <a v-if="!vendor" href="/app" class="pop-item"><Icon name="LayoutGrid" :size="16" /> Open ERP Desk</a>
          <button class="pop-item" @click="cycleTheme"><Icon name="Contrast" :size="16" /> Theme: {{ themeLabel }}</button>
          <button class="pop-item" @click="logout"><Icon name="LogOut" :size="16" /> Sign out</button>
        </div>
      </div>
    </div>
  </header>

  <!-- Command palette -->
  <Teleport to="body">
    <div v-if="palette" class="overlay palette-overlay" @click.self="palette = false">
      <div class="palette fade-up" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter.prevent="go(results[sel])" @keydown.esc="palette = false">
        <div class="palette-input">
          <Icon name="Search" />
          <input ref="q" v-model="query" placeholder="Type an app, action, or document number (e.g. PUR-ORD-…)" />
        </div>
        <ul>
          <li v-for="(r, i) in results" :key="r.key" :class="{ on: i === sel }" @mouseenter="sel = i" @click="go(r)">
            <Icon :name="r.icon" :size="16" />
            <span>{{ r.label }}</span>
            <small class="muted">{{ r.hint }}</small>
          </li>
          <li v-if="!results.length" class="muted" style="cursor: default">No matches</li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { MODULES, SPACES } from '../config'
import { setTheme, state } from '../store'
import CompanySwitcher from './CompanySwitcher.vue'
import Icon from './Icon.vue'

const props = defineProps({ vendor: Boolean, inbox: Number })
defineEmits(['toggle'])
const router = useRouter()
const menu = ref(false)
const palette = ref(false)
const query = ref('')
const sel = ref(0)
const q = ref(null)
const docHits = ref([])
const logoFailed = ref(false)
const canSwitch = computed(() => !props.vendor && (state.boot?.companies?.length || 0) > 1)
const showLogo = computed(() => !!state.boot?.company_logo && !logoFailed.value)
const companyInitials = computed(() =>
  (state.boot?.company_abbr || (state.boot?.company || '').split(/\s+/).map((w) => w[0]).join('')).replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase(),
)

const initials = computed(() =>
  (state.boot?.full_name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase(),
)
const themes = ['light', 'dark', 'hcb']
const themeLabel = computed(() => ({ light: 'Morning Horizon', dark: 'Evening Horizon', hcb: 'High Contrast' })[state.theme])
function cycleTheme() {
  setTheme(themes[(themes.indexOf(state.theme) + 1) % themes.length])
}
async function logout() {
  await api.logout().catch(() => {})
  location.href = '/login'
}

const apps = computed(() => {
  const out = []
  for (const sp of SPACES) for (const g of sp.groups) for (const t of g.tiles) out.push({ key: t.to + t.title, label: t.title, hint: sp.label, icon: t.icon, to: t.to })
  out.push({ key: 'inbox', label: 'My Inbox – approvals', hint: 'Workflow', icon: 'Inbox', to: '/inbox' })
  return out
})
const results = computed(() => {
  const s = query.value.trim().toLowerCase()
  const a = apps.value.filter((x) => !s || x.label.toLowerCase().includes(s))
  return [...docHits.value, ...a].slice(0, 12)
})
let timer
watch(query, (v) => {
  sel.value = 0
  clearTimeout(timer)
  docHits.value = []
  if (v.trim().length < 3) return
  timer = setTimeout(async () => {
    const hits = []
    await Promise.all(
      Object.values(MODULES).map(async (m) => {
        const rows = await api
          .getList(m.doctype, { fields: ['name'], filters: [['name', 'like', `%${v.trim()}%`], ...(m.baseFilters || [])], limit: 3 })
          .catch(() => [])
        rows.forEach((r) => hits.push({ key: m.key + r.name, label: r.name, hint: m.singular, icon: m.icon, to: `/${m.key}/${encodeURIComponent(r.name)}` }))
      }),
    )
    docHits.value = hits
  }, 250)
})
function move(d) {
  const n = results.value.length
  if (n) sel.value = (sel.value + d + n) % n
}
function go(r) {
  if (!r) return
  palette.value = false
  router.push(r.to)
}
async function openPalette() {
  query.value = ''
  palette.value = true
  await nextTick()
  q.value?.focus()
}
function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    openPalette()
  }
}
function onDoc(e) {
  if (!e.target.closest('.menu-wrap')) menu.value = false
}
onMounted(() => {
  addEventListener('keydown', onKey)
  addEventListener('click', onDoc)
})
onBeforeUnmount(() => {
  removeEventListener('keydown', onKey)
  removeEventListener('click', onDoc)
})
</script>

<style scoped>
.shell {
  position: sticky; top: 0; z-index: 60;
  height: var(--shell-h);
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0 0.75rem;
  background: var(--bg-shell);
  box-shadow: 0 1px 0 var(--border-soft), 0 2px 6px rgba(34, 54, 73, 0.05);
}
.shell-btn { color: var(--text-2); border-color: transparent; }
.brand { display: flex; align-items: center; gap: 0.625rem; color: var(--text); text-decoration: none; margin-right: 1rem; }
.brand:has(+ .switcher) { margin-right: 0; }
.switcher { margin-right: 0.75rem; }
.logo {
  width: 2rem; height: 2rem; border-radius: 0.5rem; display: grid; place-items: center;
  color: #fff; background: linear-gradient(135deg, #0070f2, #7858ff);
}
.brand-text { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; max-width: 16rem; }
.brand-text b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.logo.img { background: #fff; box-shadow: inset 0 0 0 1px var(--border-soft); overflow: hidden; }
.logo img { width: 100%; height: 100%; object-fit: contain; padding: 2px; }
.logo .ini { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.02em; }
.brand:hover .logo { transform: rotate(-6deg) scale(1.06); }
.logo { transition: transform 0.3s var(--spring); }
.brand-text small { color: var(--text-2); font-size: 0.75rem; }
.search {
  display: flex; align-items: center; gap: 0.5rem;
  width: min(30rem, 40vw); height: 2.25rem; padding: 0 0.75rem;
  border: 1px solid var(--border-soft); border-radius: 1.25rem;
  background: var(--surface-2); color: var(--text-3); font: inherit; cursor: pointer;
}
.search:hover { border-color: var(--brand); }
.search span { flex: 1; text-align: left; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
kbd { font: 600 0.6875rem var(--font); padding: 0.125rem 0.375rem; border: 1px solid var(--border); border-radius: 0.25rem; color: var(--text-2); }
.notif { position: relative; }
.dot {
  position: absolute; top: 2px; right: 0; min-width: 1.1rem; height: 1.1rem; padding: 0 4px;
  border-radius: 1rem; background: var(--negative); color: #fff; font-size: 0.65rem; font-weight: 700;
  display: grid; place-items: center;
}
.avatar {
  width: 2rem; height: 2rem; border-radius: 50%; border: 0; overflow: hidden; cursor: pointer;
  background: #d1efff; color: #0040b0; font-weight: 700; font-size: 0.75rem;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.menu-wrap { position: relative; }
.popover {
  position: absolute; right: 0; top: calc(100% + 0.5rem); width: 15rem;
  background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-3);
  padding: 0.375rem; z-index: 70;
}
.pop-head { padding: 0.5rem 0.625rem 0.625rem; display: flex; flex-direction: column; border-bottom: 1px solid var(--border-soft); margin-bottom: 0.25rem; }
.pop-item {
  width: 100%; display: flex; gap: 0.5rem; align-items: center; padding: 0.5rem 0.625rem;
  border: 0; background: none; color: var(--text); font: inherit; border-radius: 0.375rem; cursor: pointer; text-decoration: none;
}
.pop-item:hover { background: var(--surface-hover); text-decoration: none; }
.palette-overlay { place-items: start center; padding-top: 12vh; }
.palette { width: min(40rem, 100%); background: var(--surface); border-radius: var(--radius-l); box-shadow: var(--shadow-3); overflow: hidden; }
.palette-input { display: flex; align-items: center; gap: 0.625rem; padding: 0.875rem 1rem; border-bottom: 1px solid var(--border-soft); color: var(--text-2); }
.palette-input input { flex: 1; border: 0; outline: 0; background: none; color: var(--text); font: inherit; font-size: 1rem; }
.palette ul { list-style: none; margin: 0; padding: 0.375rem; max-height: 50vh; overflow: auto; }
.palette li { display: flex; gap: 0.625rem; align-items: center; padding: 0.625rem 0.75rem; border-radius: 0.5rem; cursor: pointer; }
.palette li span { flex: 1; }
.palette li.on { background: var(--surface-select); }
@media (max-width: 860px) {
  .search span, .search kbd { display: none; }
  .search { width: 2.25rem; padding: 0; justify-content: center; }
  .brand-text small { display: none; }
}
@media (max-width: 520px) { .brand-text { display: none; } }
</style>
