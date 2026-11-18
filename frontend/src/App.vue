<template>
  <div class="app">
    <ShellBar :vendor="vendor" :inbox="inboxCount" @toggle="toggleNav" />
    <div v-if="state.boot.mode === 'none'" class="page">
      <div class="card empty" style="max-width: 36rem; margin: 10vh auto">
        <Icon name="User" />
        <h3 style="color: var(--text)">No procurement access</h3>
        <p>Your user has no purchasing role and is not linked to a supplier. Ask your administrator to assign the
          <b>Purchase User</b> role, or add you as a Portal User on a Supplier.</p>
      </div>
    </div>
    <div v-else class="app-body">
      <SideNav v-if="!vendor" :items="NAV" :collapsed="collapsed" :mobile-open="mobileOpen" :badges="{ inbox: inboxCount }" @navigate="mobileOpen = false" />
      <main style="flex: 1; min-width: 0">
        <router-view v-slot="{ Component, route }">
          <Transition name="route" mode="out-in">
            <component :is="Component" :key="route.matched[0]?.path" />
          </Transition>
        </router-view>
      </main>
    </div>
    <Toasts />
    <Transition name="route"><div v-if="busy" class="top-loader" /></Transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api } from './api'
import Icon from './components/Icon.vue'
import ShellBar from './components/ShellBar.vue'
import SideNav from './components/SideNav.vue'
import Toasts from './components/Toasts.vue'
import { NAV } from './config'
import { state } from './store'

const vendor = computed(() => state.boot.mode === 'vendor')
const collapsed = ref(false)
const mobileOpen = ref(false)
const inboxCount = ref(0)
// show the loader only for requests that take longer than 250 ms
const busy = ref(false)
let busyT
watch(() => state.pending, (n) => {
  clearTimeout(busyT)
  if (n > 0) busyT = setTimeout(() => (busy.value = true), 250)
  else busy.value = false
})
function toggleNav() {
  if (innerWidth <= 960) mobileOpen.value = !mobileOpen.value
  else collapsed.value = !collapsed.value
}
async function refreshInbox() {
  if (state.boot.mode !== 'internal') return
  const q = [
    ['Purchase Order', [['docstatus', '=', 0]]],
    ['Material Request', [['docstatus', '=', 0], ['material_request_type', '=', 'Purchase']]],
    ['Purchase Invoice', [['docstatus', '=', 0]]],
    ['Payment Entry', [['docstatus', '=', 0], ['party_type', '=', 'Supplier']]],
  ]
  const co = state.boot.company ? [['company', '=', state.boot.company]] : []
  const c = await Promise.all(q.map(([dt, f]) => api.getCount(dt, [...f, ...co]).catch(() => 0)))
  inboxCount.value = c.reduce((a, b) => a + (b || 0), 0)
}
let timer
onMounted(() => {
  refreshInbox()
  timer = setInterval(refreshInbox, 120000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>
