<template>
  <div class="page page-narrow">
    <div class="dyn-header">
      <div class="breadcrumbs"><router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" /> Inventory</div>
      <div class="row wrap">
        <h1 class="page-title">Stock Overview</h1>
        <div class="spacer" />
        <router-link to="/reorder" class="btn reorder-link"><Icon name="TriangleAlert" /> Reorder<span v-if="data?.low_stock.length" class="badge">{{ data.low_stock.length }}</span></router-link>
      </div>
      <div class="kpi-row">
        <div class="kpi-card spot"><span class="ico"><Icon name="CircleDollarSign" /></span><div><div class="k">Stock Value</div><div class="v"><AnimatedNumber :value="data?.totals.stock_value || 0" :format="fmtCompact" /></div></div></div>
        <div class="kpi-card spot"><span class="ico"><Icon name="Package" /></span><div><div class="k">Items in Stock</div><div class="v"><AnimatedNumber :value="data?.totals.items || 0" /></div></div></div>
        <div class="kpi-card spot"><span class="ico"><Icon name="Warehouse" /></span><div><div class="k">Warehouses</div><div class="v"><AnimatedNumber :value="data?.totals.warehouses || 0" /></div></div></div>
        <div class="kpi-card spot"><span class="ico"><Icon name="Truck" /></span><div><div class="k">Qty on Order</div><div class="v"><AnimatedNumber :value="data?.totals.on_order || 0" /></div></div></div>
      </div>
      <div class="filterbar">
        <div class="field"><label>Item</label><input v-model="search" class="input" placeholder="Item, group, UoM, warehouse…" title="Searches: Item Code, Item Name, Item Group, UoM, Brand, Description, Warehouse" @input="onSearchInput" @keydown.enter="load" /></div>
        <div class="field"><label>Warehouse</label><LinkInput v-model="warehouse" doctype="Warehouse" @select="load" /></div>
        <div class="row" style="align-self: end"><button class="btn btn-emphasized" @click="load">Go</button><button class="btn btn-transparent" @click="search = ''; warehouse = ''; load()">Clear</button></div>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr><th>Item</th><th>Warehouse</th><th class="num">On Hand</th><th class="num">On Order</th><th class="num">Requested</th><th class="num">Reserved</th><th class="num">Projected</th><th class="num">Value</th><th>Availability</th><th class="nav" /></tr>
          </thead>
          <tbody>
            <template v-if="!data"><tr v-for="i in 6" :key="i"><td colspan="10"><div class="skeleton" style="height: 1.25rem" /></td></tr></template>
            <tr v-for="b in data?.bins || []" :key="b.item_code + b.warehouse" class="clickable" :class="{ active: activeItem === b.item_code }" tabindex="0" @click="openItem(b.item_code)" @keydown.enter="openItem(b.item_code)">
              <td><div class="title">{{ b.item_name }}</div><div class="muted">{{ b.item_code }} · {{ b.item_group }}</div></td>
              <td>{{ b.warehouse }}</td>
              <td class="num"><b>{{ fmtNum(b.actual_qty) }}</b> <small class="muted">{{ b.uom }}</small></td>
              <td class="num">{{ fmtNum(b.ordered_qty) }}</td>
              <td class="num">{{ fmtNum(b.indented_qty) }}</td>
              <td class="num">{{ fmtNum(b.reserved_qty) }}</td>
              <td class="num" :style="{ color: b.projected_qty < 0 ? 'var(--negative)' : '' }">{{ fmtNum(b.projected_qty) }}</td>
              <td class="num">{{ fmtMoney(b.stock_value) }}</td>
              <td style="min-width: 7rem"><span class="status" :class="b.projected_qty <= 0 ? 'negative' : b.projected_qty < b.reserved_qty + b.actual_qty * 0.2 ? 'critical' : 'positive'">{{ b.projected_qty <= 0 ? 'Shortage' : 'Available' }}</span></td>
              <td class="nav"><Icon name="ChevronRight" :size="16" /></td>
            </tr>
          </tbody>
        </table>
        <div v-if="data && !data.bins.length" class="empty"><Icon name="Warehouse" /><div>No stock found for these filters.</div></div>
      </div>
    </div>

    <!-- Stock detail drawer (child route /inventory/:item) -->
    <router-view v-slot="{ Component }">
      <Transition name="drawer" :duration="{ enter: 550, leave: 320 }" appear>
        <component :is="Component" v-if="Component" />
      </Transition>
    </router-view>
  </div>
</template>

<script setup>
import { computed, onMounted, provide, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import AnimatedNumber from '../components/AnimatedNumber.vue'
import Icon from '../components/Icon.vue'
import LinkInput from '../components/LinkInput.vue'
import { fmtCompact, fmtMoney, fmtNum } from '../store'
const route = useRoute()
const router = useRouter()
const data = ref(null)
const search = ref('')
const warehouse = ref('')
const activeItem = computed(() => route.params.item && decodeURIComponent(route.params.item))
function openItem(code) {
  router.push({ path: `/inventory/${encodeURIComponent(code)}`, query: route.query })
}
// prev / next for the drawer: unique items in the order they are listed
provide('stockNav', {
  items: computed(() => [...new Set((data.value?.bins || []).map((r) => r.item_code))]),
  go: openItem,
})
let searchTimer
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 350)
}
async function load() {
  clearTimeout(searchTimer)
  data.value = await api.inventory(warehouse.value || undefined, search.value || undefined)
}
onMounted(load)
</script>

<style scoped>
.kpi-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 1rem; margin: 1rem 0; }
.kpi-card { position: relative; overflow: hidden; transition: transform 0.2s var(--ease), box-shadow 0.2s; }
.kpi-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-1); }
.kpi-card { display: flex; gap: 0.75rem; align-items: center; padding: 0.875rem 1rem; border-radius: var(--radius); background: var(--surface-2); }
.kpi-card .ico { width: 2.5rem; height: 2.5rem; border-radius: 0.625rem; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand); }
.kpi-card .k { font-size: 0.8125rem; color: var(--text-2); }
.kpi-card .v { font-size: 1.375rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.reorder-link { border-color: var(--critical); color: var(--critical-text); }
.reorder-link:hover { background: var(--critical-bg); text-decoration: none; }
.reorder-link .badge { min-width: 1.25rem; padding: 0 0.375rem; border-radius: 1rem; background: var(--critical); color: #fff; font-size: 0.6875rem; }
.filterbar { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0.75rem 1rem; }
</style>
