<template>
  <nav class="side" :class="{ collapsed, open: mobileOpen }" aria-label="Main navigation">
    <template v-for="n in items" :key="n.to || n.group">
      <!-- plain link -->
      <router-link v-if="!n.group" :to="n.to" class="nav-item" :class="{ on: isOn(n) }" :title="n.label" @click="$emit('navigate')">
        <Icon :name="n.icon" :size="18" />
        <span class="lbl">{{ n.label }}</span>
        <span v-if="n.badge && badges[n.badge]" class="badge">{{ badges[n.badge] }}</span>
      </router-link>

      <!-- collapsible group -->
      <div v-else class="grp" :class="{ expanded: isOpen(n), active: groupActive(n) }" @mouseenter="hover = n.group" @mouseleave="hover = null">
        <button
          class="nav-item grp-head"
          :aria-expanded="isOpen(n)"
          :aria-controls="'grp-' + n.group"
          :title="n.label"
          @click="toggle(n)"
        >
          <Icon :name="n.icon" :size="18" />
          <span class="lbl">{{ n.label }}</span>
          <span v-if="groupActive(n) && !isOpen(n)" class="dot" />
          <Icon name="ChevronDown" :size="15" class="chev" />
        </button>

        <!-- inline dropdown (expanded sidebar) -->
        <div :id="'grp-' + n.group" class="grp-body" :style="{ '--rows': n.children.length }">
          <div class="grp-inner">
            <template v-for="(c, i) in n.children" :key="c.to || 'h' + i">
              <div v-if="c.heading" class="sub-head" :style="{ '--i': i }">{{ c.heading }}</div>
              <router-link
                v-else
                :to="c.to"
                class="nav-item sub"
                :class="{ on: isOn(c), stepped: c.step }"
                :style="{ '--i': i }"
                :tabindex="isOpen(n) ? 0 : -1"
                :title="c.label"
                @click="$emit('navigate')"
              >
                <span v-if="c.step" class="step">{{ c.step }}</span>
                <Icon v-else :name="c.icon" :size="16" />
                <span class="lbl">{{ c.label }}</span>
              </router-link>
            </template>
          </div>
        </div>

        <!-- fly-out (collapsed rail) -->
        <Transition name="fly">
          <div v-if="collapsed && hover === n.group" class="flyout" role="menu">
            <div class="fly-title">{{ n.label }}</div>
            <template v-for="(c, i) in n.children" :key="c.to || 'h' + i">
              <div v-if="c.heading" class="sub-head">{{ c.heading }}</div>
              <router-link v-else :to="c.to" class="nav-item sub" :class="{ on: isOn(c) }" @click="hover = null">
                <span v-if="c.step" class="step">{{ c.step }}</span>
                <Icon v-else :name="c.icon" :size="16" />
                <span>{{ c.label }}</span>
              </router-link>
            </template>
          </div>
        </Transition>
      </div>
    </template>

    <div class="side-foot">
      <button class="nav-item" :title="allOpen ? 'Collapse all' : 'Expand all'" @click="toggleAll">
        <Icon :name="allOpen ? 'Minimize2' : 'Maximize2'" :size="16" />
        <span class="lbl">{{ allOpen ? 'Collapse all' : 'Expand all' }}</span>
      </button>
    </div>
  </nav>
  <div v-if="mobileOpen" class="scrim" @click="$emit('navigate')" />
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Icon from './Icon.vue'

const props = defineProps({ items: Array, collapsed: Boolean, mobileOpen: Boolean, badges: { type: Object, default: () => ({}) } })
defineEmits(['navigate'])
const route = useRoute()
const hover = ref(null)
const KEY = 'procure.nav.open'

// which groups are expanded (persisted per viewer)
const open = reactive(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || { dash: false, p2p: true, stock: false, accounts: false }
    } catch {
      return { p2p: true }
    }
  })(),
)
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(open))
  } catch {}
}

function isOn(n) {
  if (!n.to) return false
  const [path, qs] = n.to.split('?')
  if (path === '/') return route.path === '/'
  if (qs) return route.path === path && route.fullPath.includes(qs)
  if (n.exact) return route.path === path && !Object.keys(route.query).length
  return route.path === path || route.path.startsWith(path + '/')
}
const groupActive = (g) => g.children.some((c) => !c.alias && isOn(c))
const isOpen = (g) => !!open[g.group]
function toggle(g) {
  open[g.group] = !open[g.group]
  save()
}
const groups = computed(() => props.items.filter((n) => n.group))
const allOpen = computed(() => groups.value.every(isOpen))
function toggleAll() {
  const v = !allOpen.value
  groups.value.forEach((g) => (open[g.group] = v))
  save()
}

// auto-expand the group that contains the current page
watch(
  () => route.fullPath,
  () => {
    for (const g of groups.value) if (groupActive(g) && !open[g.group]) open[g.group] = true
  },
  { immediate: true },
)
</script>

<style scoped>
.side {
  position: sticky; top: var(--shell-h); align-self: flex-start;
  height: calc(100vh - var(--shell-h));
  width: 15.5rem; flex: none; overflow-y: auto; overflow-x: visible; z-index: 50;
  padding: 0.75rem 0.5rem; display: flex; flex-direction: column; gap: 2px;
  background: var(--bg-shell); border-right: 1px solid var(--border-soft);
  transition: width 0.25s var(--ease);
  scrollbar-width: thin;
}
.side > * { flex-shrink: 0; } /* items must not shrink when the menu is taller than the viewport */
.side.collapsed { width: 3.5rem; overflow: visible; }
.side.collapsed .lbl, .side.collapsed .badge, .side.collapsed .chev, .side.collapsed .grp-body { display: none; }

.nav-item {
  position: relative; display: flex; align-items: center; gap: 0.75rem; width: 100%;
  height: 2.5rem; padding: 0 0.75rem; border: 0; background: none; font: inherit; text-align: left;
  border-radius: 0.5rem; color: var(--text); font-weight: 500; text-decoration: none; cursor: pointer; overflow: hidden;
  transition: background 0.15s, color 0.15s;
}
.nav-item svg { flex: none; color: var(--text-2); transition: transform 0.25s var(--spring), color 0.15s; }
.nav-item:hover { background: var(--surface-hover); text-decoration: none; }
.nav-item:hover > svg:first-child { transform: scale(1.12); }
.nav-item.on { background: var(--surface-select); color: var(--brand); font-weight: 700; }
.nav-item.on svg { color: var(--brand); }
.nav-item.on::before { content: ''; position: absolute; left: 0; top: 0.5rem; bottom: 0.5rem; width: 3px; border-radius: 0 3px 3px 0; background: var(--brand); animation: bar-in 0.3s var(--spring) both; }
@keyframes bar-in { from { transform: scaleY(0); } }
.lbl { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge { min-width: 1.25rem; padding: 0 0.375rem; border-radius: 1rem; background: var(--negative); color: #fff; font-size: 0.6875rem; font-weight: 700; text-align: center; animation: pop-in 0.3s var(--spring) both; }

/* group header */
.grp { position: relative; }
.grp-head { font-weight: 600; }
.grp.active > .grp-head > svg:first-child { color: var(--brand); }
.chev { margin-left: auto; color: var(--text-3) !important; transition: transform 0.3s var(--ease) !important; }
.grp.expanded .chev { transform: rotate(180deg); }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brand); }

/* animated dropdown: grid-rows 0fr -> 1fr gives a smooth auto-height transition */
.grp-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.32s var(--ease); }
.grp.expanded .grp-body { grid-template-rows: 1fr; }
.grp-inner { overflow: hidden; position: relative; margin-left: 1.3rem; padding-left: 0.5rem; }
.grp-inner::before { content: ''; position: absolute; left: 0; top: 0.25rem; bottom: 0.25rem; width: 1px; background: var(--border-soft); }
.nav-item.sub { height: 2.25rem; font-size: 0.875rem; gap: 0.625rem; opacity: 0; transform: translateX(-6px); transition: opacity 0.2s, transform 0.25s var(--ease), background 0.15s; }
.grp.expanded .nav-item.sub { opacity: 1; transform: none; transition-delay: calc(var(--i) * 25ms), calc(var(--i) * 25ms), 0s; }
.nav-item.sub.on { background: var(--surface-select); }

/* section headings & numbered flow steps */
.sub-head {
  padding: 0.75rem 0.75rem 0.25rem; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3);
  opacity: 0; transition: opacity 0.2s;
}
.grp.expanded .sub-head { opacity: 1; transition-delay: calc(var(--i) * 25ms); }
.flyout .sub-head { opacity: 1; padding: 0.5rem 0.625rem 0.25rem; }
.step {
  width: 1.25rem; height: 1.25rem; flex: none; border-radius: 50%; display: grid; place-items: center;
  font-size: 0.6875rem; font-weight: 700; background: var(--neutral-bg); color: var(--text-2);
  transition: background 0.15s, color 0.15s;
}
.nav-item.on .step { background: var(--brand); color: var(--brand-text); }
.nav-item.stepped { position: relative; }
.nav-item.stepped:not(:has(+ .stepped))::after { display: none; }
.nav-item.stepped + .nav-item.stepped::after {
  content: ''; position: absolute; left: calc(0.75rem + 0.625rem - 1px); top: -0.4rem; height: 0.8rem; width: 2px; background: var(--border-soft); border-radius: 2px;
}
.nav-item.sub.on::before { display: none; }

/* fly-out for collapsed rail */
.flyout {
  position: absolute; left: calc(100% + 0.5rem); top: 0; z-index: 90; min-width: 13rem; padding: 0.375rem;
  background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-3);
}
.flyout::before { content: ''; position: absolute; left: -0.75rem; top: 0; bottom: 0; width: 0.75rem; } /* hover bridge */
.flyout { max-height: calc(100vh - var(--shell-h) - 2rem); overflow-y: auto; }
.fly-title { padding: 0.375rem 0.625rem 0.5rem; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); }
.flyout .nav-item.sub { opacity: 1; transform: none; }
.fly-enter-active, .fly-leave-active { transition: opacity 0.15s, transform 0.2s var(--ease); }
.fly-enter-from, .fly-leave-to { opacity: 0; transform: translateX(-6px); }

.side-foot { margin-top: auto; padding-top: 0.5rem; border-top: 1px solid var(--border-soft); }
.side-foot .nav-item { height: 2.25rem; font-size: 0.8125rem; color: var(--text-2); }

.scrim { display: none; }
@media (max-width: 960px) {
  .side { position: fixed; left: 0; z-index: 80; transform: translateX(-100%); transition: transform 0.25s var(--ease); width: 16.5rem; box-shadow: var(--shadow-3); }
  .side.collapsed { width: 16.5rem; overflow-y: auto; }
  .side.collapsed .lbl, .side.collapsed .badge, .side.collapsed .chev { display: initial; }
  .side.collapsed .grp-body { display: grid; }
  .side.open { transform: none; }
  .scrim { display: block; position: fixed; inset: var(--shell-h) 0 0 0; background: rgba(0, 0, 0, 0.3); z-index: 75; }
}
</style>
