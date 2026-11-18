<template>
  <div class="table-wrap tt">
    <table class="tbl fin-tbl">
      <thead>
        <tr v-if="bands?.length" class="band">
          <th />
          <th v-for="b in bands" :key="b.label" :colspan="b.span" class="num band-th">{{ b.label }}</th>
        </tr>
        <tr>
          <th class="acc-col">{{ accountLabel }}</th>
          <th v-for="c in columns" :key="c.key" class="num" :class="c.cls">{{ c.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in shown"
          :key="r.account"
          :class="['d' + Math.min(r.depth, 4), { grp: r.is_group, sel: r.account === selected }]"
          @click="$emit('select', r)"
        >
          <td class="acc-col">
            <div class="acc" :style="{ paddingLeft: r.depth * 1.125 + 'rem' }">
              <button v-if="r.is_group" class="tg" :aria-label="tree.isOpen(r) ? 'Collapse' : 'Expand'" :aria-expanded="tree.isOpen(r)" @click.stop="tree.toggle(r)">
                <Icon name="ChevronRight" :size="14" :class="{ rot: tree.isOpen(r) }" />
              </button>
              <span v-else class="tg-pad" />
              <span v-if="showNumber && r.account_number" class="no mono">{{ r.account_number }}</span>
              <span class="nm" :title="r.account">{{ r.account_name }}</span>
              <slot name="badge" :row="r" />
              <router-link v-if="drill && !r.is_group && drill(r)" :to="drill(r)" class="drill" title="Open line items in the General Ledger" @click.stop><Icon name="ArrowUpRight" :size="13" /></router-link>
            </div>
          </td>
          <td v-for="c in columns" :key="c.key" class="num" :class="[c.cls, { neg: !c.plain && +r[c.key] < 0, z: isZero(r[c.key]) }]">
            <slot :name="'cell-' + c.key" :row="r" :value="r[c.key]">{{ (c.fmt || amt)(r[c.key]) }}</slot>
          </td>
        </tr>
        <slot name="tail" />
      </tbody>
      <tfoot v-if="$slots.foot"><slot name="foot" /></tfoot>
    </table>
    <div v-if="!rows.length && !loading" class="empty"><Icon name="Table2" /><div>{{ emptyText }}</div></div>
    <div v-if="loading && !rows.length" class="sk"><div v-for="i in 8" :key="i" class="skeleton" /></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Icon from '../../components/Icon.vue'
import { amt } from './fin'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  columns: Array,
  bands: Array,
  tree: Object,
  drill: Function,
  selected: String,
  loading: Boolean,
  showNumber: { type: Boolean, default: true },
  accountLabel: { type: String, default: 'Account' },
  emptyText: { type: String, default: 'No postings in this period.' },
})
defineEmits(['select'])
const shown = computed(() => props.tree.visible(props.rows))
const isZero = (v) => typeof v === 'number' && Math.abs(v) < 0.005
</script>

<style scoped>
.tt { overflow: auto; }
.fin-tbl { font-size: 0.8125rem; }
.fin-tbl th { white-space: nowrap; }
.fin-tbl td { padding: 0.4375rem 0.75rem; white-space: nowrap; }
.fin-tbl .num { font-variant-numeric: tabular-nums; min-width: 6.75rem; }
.band th { background: var(--surface); border-bottom: 0; padding-bottom: 0; color: var(--text-3); font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; }
.band-th { text-align: center !important; border-bottom: 2px solid var(--border-soft) !important; }
.acc-col { position: sticky; left: 0; z-index: 2; background: inherit; min-width: 18rem; }
thead .acc-col { z-index: 3; background: var(--surface-2); }
.band .acc-col { background: var(--surface); }
tbody tr { background: var(--surface); cursor: pointer; }
tbody tr:hover { background: var(--surface-hover); }
tbody tr.sel { background: var(--surface-select); box-shadow: inset 3px 0 0 var(--brand); }
.acc { display: flex; align-items: center; gap: 0.375rem; min-width: 0; }
.tg { width: 1.375rem; height: 1.375rem; flex: none; display: grid; place-items: center; border: 0; border-radius: 0.375rem; background: none; color: var(--text-2); cursor: pointer; }
.tg:hover { background: var(--neutral-bg); color: var(--text); }
.tg svg { transition: transform 0.2s var(--ease); }
.tg .rot { transform: rotate(90deg); }
.tg-pad { width: 1.375rem; flex: none; }
.no { color: var(--text-3); font-size: 0.75rem; }
.nm { overflow: hidden; text-overflow: ellipsis; }
.grp .nm { font-weight: 700; }
tr.d0 { background: var(--surface-2); }
tr.d0 .nm { text-transform: uppercase; letter-spacing: 0.03em; font-size: 0.75rem; }
tr.d0 td { border-top: 1px solid var(--border); }
.grp .num { font-weight: 700; }
.neg { color: var(--negative); }
.z { color: var(--text-3); }
.drill { opacity: 0; color: var(--link); display: inline-grid; place-items: center; width: 1.25rem; height: 1.25rem; border-radius: 0.25rem; }
tr:hover .drill, .drill:focus-visible { opacity: 1; }
.drill:hover { background: var(--brand-soft); }
.sk { padding: 1rem; display: grid; gap: 0.5rem; }
.sk .skeleton { height: 1.125rem; }
:deep(tr.total td) { font-weight: 800; background: var(--surface-2); border-top: 2px solid var(--text-3); border-bottom: 3px double var(--text-3); }
:deep(tr.subtotal td) { font-weight: 700; background: color-mix(in srgb, var(--brand) 5%, var(--surface)); }
:deep(tr.total td.acc-col), :deep(tr.subtotal td.acc-col) { padding-left: 2.25rem; }
</style>
