<template>
  <div class="cg" :class="{ view }">
    <div class="table-wrap">
      <table class="tbl cg-tbl">
        <thead>
          <tr>
            <th class="cg-idx">#</th>
            <th v-for="c in cols" :key="c.fieldname" :style="{ minWidth: width(c) }" :class="{ num: NUMERIC.has(c.fieldtype), req: !view && c.reqd }">{{ c.label }}</th>
            <th v-if="!view" class="cg-act" />
          </tr>
        </thead>
        <tbody>
          <template v-for="(r, i) in rows" :key="r._k || r.name || i">
            <tr :class="{ open: openRow === i, bad: showErrors && rowErrors.has(i) }" class="cg-row">
              <td class="cg-idx muted">{{ i + 1 }}</td>
              <td v-for="c in cols" :key="c.fieldname" :class="{ num: NUMERIC.has(c.fieldtype) }">
                <DocField
                  :df="c"
                  :model-value="r[c.fieldname]"
                  :doc="r"
                  :parent="parent"
                  :view="view"
                  :readonly="isReadOnly(c, r, parent)"
                  compact
                  :class="{ invalid: showErrors && isRequired(c, r, parent) && isEmpty(r[c.fieldname]) && !isBlankRow(r, cmeta) }"
                  @update:model-value="change(r, c, $event)"
                  @select="emit('link', { row: r, df: c, value: $event?.value })"
                />
                <template v-if="c.fieldname === 'item_code' && r.item_code">
                  <small v-if="r.item_name && r.item_name !== r.item_code" class="muted cg-sub">{{ r.item_name }}</small>
                  <small v-if="r._stock !== undefined" class="cg-sub" :class="r._stock > 0 ? 'pos' : 'neg'"> · In stock {{ fmtNum(r._stock) }}</small>
                </template>
              </td>
              <td v-if="!view" class="cg-act">
                <button type="button" class="btn btn-transparent btn-icon btn-sm" :title="openRow === i ? 'Collapse' : 'All fields'" @click="openRow = openRow === i ? -1 : i">
                  <Icon name="ChevronDown" :size="15" :style="{ transform: openRow === i ? 'rotate(180deg)' : '' }" />
                </button>
                <button type="button" class="btn btn-transparent btn-icon btn-sm del" title="Remove row" @click="remove(i)"><Icon name="Trash2" :size="15" /></button>
              </td>
            </tr>
            <tr v-if="openRow === i && !view" class="cg-detail">
              <td :colspan="cols.length + 2">
                <div class="cg-form">
                  <div class="cg-form-head">
                    <b>Row {{ i + 1 }}</b><span class="muted"> · all fields</span>
                    <div class="spacer" />
                    <button type="button" class="btn btn-sm btn-transparent" @click="openRow = -1">Done</button>
                  </div>
                  <div class="form-grid">
                    <template v-for="c in detailFields" :key="c.fieldname">
                      <div v-if="isVisible(c, r, parent) && c.fieldtype !== 'Table'" class="field" :style="TEXTAREA.has(c.fieldtype) ? 'grid-column: 1 / -1' : ''">
                        <label :class="{ req: isRequired(c, r, parent) }">{{ c.label }}</label>
                        <DocField :df="c" :model-value="r[c.fieldname]" :doc="r" :parent="parent" :readonly="isReadOnly(c, r, parent)" @update:model-value="change(r, c, $event)" @select="emit('link', { row: r, df: c, value: $event?.value })" />
                        <small v-if="c.description" class="hint">{{ c.description }}</small>
                      </div>
                    </template>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <div v-if="!rows.length" class="cg-empty">
        <Icon name="Layers" :size="22" />
        <span>No {{ label.toLowerCase() }} yet</span>
        <button v-if="!view" type="button" class="btn btn-sm" @click="add()"><Icon name="Plus" /> Add Row</button>
      </div>
    </div>
    <div v-if="!view && rows.length" class="cg-foot">
      <button type="button" class="btn btn-sm btn-transparent" @click="add()"><Icon name="Plus" /> Add Row</button>
      <span class="muted">{{ rows.length }} row(s)</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { fmtNum } from '../store'
import DocField from './DocField.vue'
import Icon from './Icon.vue'
import { NUMERIC, TEXTAREA, applyDefaults, isBlankRow, isEmpty, isReadOnly, isRequired, isVisible, markTouched } from './formLogic'

const props = defineProps({
  rows: { type: Array, required: true },
  cmeta: Object, // { fields, list_view }
  parent: Object,
  label: { type: String, default: 'Rows' },
  view: Boolean,
  showErrors: Boolean,
  rowErrors: { type: Set, default: () => new Set() },
})
const emit = defineEmits(['change', 'link', 'add'])
const openRow = ref(-1)
let k = 0

const byName = computed(() => Object.fromEntries((props.cmeta?.fields || []).map((f) => [f.fieldname, f])))
const cols = computed(() => {
  const lv = (props.cmeta?.list_view || []).map((f) => byName.value[f]).filter(Boolean)
  if (lv.length) return lv
  return (props.cmeta?.fields || []).filter((f) => f.fieldtype !== 'Table' && !TEXTAREA.has(f.fieldtype)).slice(0, 5)
})
const detailFields = computed(() => props.cmeta?.fields || [])

function width(c) {
  if (c.fieldname === 'item_code') return '15rem'
  if (['Link', 'Dynamic Link'].includes(c.fieldtype)) return '11rem'
  if (['Date', 'Datetime'].includes(c.fieldtype)) return '9.5rem'
  if (c.fieldtype === 'Currency') return '8.5rem'
  if (NUMERIC.has(c.fieldtype)) return '6.5rem'
  if (c.fieldtype === 'Check') return '3.5rem'
  if (c.fieldtype === 'Select') return '9rem'
  return '10rem'
}
function change(r, c, v) {
  r[c.fieldname] = v
  markTouched(r, c.fieldname)
  emit('change', { row: r, df: c, value: v })
}
function add(data = {}) {
  const row = applyDefaults(props.cmeta?.fields || [], { _k: `n${++k}`, ...data })
  props.rows.push(row)
  emit('add', row)
  return row
}
function remove(i) {
  props.rows.splice(i, 1)
  if (openRow.value === i) openRow.value = -1
  emit('change', {})
}
defineExpose({ add })
</script>

<style scoped>
.cg-tbl td { vertical-align: top; padding: 0.4375rem 0.5rem; }
.cg-tbl th { padding: 0.5rem; }
.cg.view .cg-tbl td { padding: 0.625rem 0.75rem; vertical-align: middle; }
.cg-tbl th.req::after { content: ' *'; color: var(--negative); }
.cg-idx { width: 2.5rem; text-align: center; padding-top: 0.875rem !important; }
.cg.view .cg-idx { padding-top: 0.625rem !important; }
.cg-act { width: 4.75rem; white-space: nowrap; text-align: right; }
.cg-act .del:hover { color: var(--negative); }
.cg-row.open { background: var(--surface-select); }
.cg-row.bad { box-shadow: inset 3px 0 0 var(--negative); }
.cg-sub { display: inline-block; margin-top: 0.25rem; font-size: 0.75rem; }
.pos { color: var(--positive); }
.neg { color: var(--negative); }
:deep(.invalid .input), :deep(.input.invalid) { border-color: var(--negative); }
.cg-detail td { padding: 0 0.5rem 0.75rem !important; background: var(--surface-select); }
.cg-detail:hover { background: transparent !important; }
.cg-form { padding: 1rem; border-radius: 0.75rem; background: var(--surface); border: 1px solid var(--border-soft); animation: fade-up 0.25s var(--ease) both; }
.cg-form-head { display: flex; align-items: center; gap: 0.25rem; margin-bottom: 0.875rem; }
.cg-empty { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 2rem 1rem; color: var(--text-2); }
.cg-empty svg { color: var(--text-3); }
.cg-foot { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; border-top: 1px solid var(--border-soft); font-size: 0.8125rem; }
</style>
