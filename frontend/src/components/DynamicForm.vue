<template>
  <div class="dyn" :class="{ view }">
    <!-- Desk tabs -->
    <nav v-if="tabs.length > 1" class="dyn-tabs" role="tablist">
      <button v-for="t in tabs" :key="t.fieldname" role="tab" :aria-selected="tab === t.fieldname" :class="{ on: tab === t.fieldname }" @click="setTab(t.fieldname)">
        {{ t.label || 'Details' }}
        <span v-if="showErrors && errCount(t)" class="err-badge">{{ errCount(t) }}</span>
      </button>
    </nav>

    <template v-for="t in tabs" :key="t.fieldname">
      <div v-show="tab === t.fieldname || tabs.length === 1" class="dyn-tab">
        <section v-for="(s, si) in sections(t)" :key="t.fieldname + si" class="dyn-sec" :class="{ card: !flat, collapsed: isCollapsed(s), 'no-head': !s.label }">
          <header v-if="s.label" class="dyn-sec-head" :class="{ toggle: s.collapsible }" @click="s.collapsible && toggle(s)">
            <h3>{{ s.label }}</h3>
            <span v-if="s.collapsible && isCollapsed(s)" class="muted sub">{{ filledCount(s) }} filled</span>
            <div class="spacer" />
            <Icon v-if="s.collapsible" name="ChevronDown" :size="16" class="chev" />
          </header>
          <div class="dyn-grid-wrap">
            <div class="dyn-cols" :style="{ '--n': s.columns.length }">
              <div v-for="(col, ci) in s.columns" :key="ci" class="dyn-col">
                <template v-for="df in col" :key="df.fieldname">
                  <!-- child table -->
                  <div v-if="df.fieldtype === 'Table' && showField(df)" class="dyn-table" :data-field="df.fieldname">
                    <div class="dyn-table-head">
                      <label :class="{ req: !view && df.reqd }">{{ df.label }}</label>
                      <span class="muted">{{ (doc[df.fieldname] || []).length }}</span>
                    </div>
                    <ChildGrid
                      :ref="(el) => el && (grids[df.fieldname] = el)"
                      :rows="ensureRows(df)"
                      :cmeta="meta.children[df.options]"
                      :parent="doc"
                      :label="df.label"
                      :view="view || isReadOnly(df, doc)"
                      :show-errors="showErrors"
                      :row-errors="rowErrors(df)"
                      @change="emit('change', { table: df, ...$event })"
                      @link="emit('link', { table: df, ...$event })"
                      @add="emit('row-add', { table: df, row: $event })"
                    />
                  </div>
                  <!-- field -->
                  <div v-else-if="showField(df)" class="field" :data-field="df.fieldname" :class="{ 'has-error': fieldErr(df), wide: TEXTAREA.has(df.fieldtype) && s.columns.length === 1 }">
                    <label :class="{ req: !view && isRequired(df, doc) }">{{ df.label }}</label>
                    <DocField :df="df" :model-value="doc[df.fieldname]" :doc="doc" :view="view" :readonly="isReadOnly(df, doc)" @update:model-value="set(df, $event)" @select="emit('link', { df, value: $event?.value })" />
                    <small v-if="fieldErr(df)" class="err"><Icon name="TriangleAlert" :size="12" /> {{ df.label }} is required</small>
                    <small v-else-if="df.description && !view" class="hint">{{ plain(df.description) }}</small>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </section>
        <div v-if="!sections(t).length" class="empty muted">Nothing to show in this tab.</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import ChildGrid from './ChildGrid.vue'
import DocField from './DocField.vue'
import Icon from './Icon.vue'
import { TEXTAREA, evalDepends, isEmpty, isReadOnly, isRequired, isVisible, markTouched } from './formLogic'

const props = defineProps({
  meta: Object,
  doc: Object,
  view: Boolean,
  flat: Boolean, // no cards around sections (used inside other cards)
  showErrors: Boolean,
  errors: { type: Array, default: () => [] },
  skip: { type: Array, default: () => [] }, // fieldnames rendered elsewhere
})
const emit = defineEmits(['change', 'link', 'row-add'])
const grids = reactive({})
const opened = reactive(new Set())
const closed = reactive(new Set())

const tabs = computed(() => (props.meta?.tabs || []).filter((t) => evalDepends(t.depends_on, props.doc) && sections(t).length))
const tab = ref(null)
watch(tabs, (t) => {
  if (!t.some((x) => x.fieldname === tab.value)) tab.value = t[0]?.fieldname
}, { immediate: true })
function setTab(name) {
  tab.value = name
}

function showField(df) {
  if (props.skip.includes(df.fieldname)) return false
  if (!isVisible(df, props.doc)) return false
  const v = props.doc[df.fieldname]
  if (df.fieldtype === 'Table') return !(props.view && !(v || []).length)
  // read-only fields only appear once they hold a value (as in Desk); view mode hides blanks
  if ((props.view || isReadOnly(df, props.doc)) && (isEmpty(v) || (df.fieldtype === 'Check' && !v && props.view))) return false
  return true
}
function sections(t) {
  return t.sections.filter((s) => evalDepends(s.depends_on, props.doc) && s.columns.some((c) => c.some(showField)))
}
const sectionKey = (s) => s.fieldname || s.label
const errFields = computed(() => new Set(props.errors.map((e) => e.field)))
function sectionHasErr(s) {
  return props.showErrors && s.columns.some((c) => c.some((f) => errFields.value.has(f.fieldname)))
}
function isCollapsed(s) {
  if (!s.collapsible || props.view) return false
  const k = sectionKey(s)
  if (opened.has(k) || sectionHasErr(s)) return false
  if (closed.has(k)) return true
  return !evalDepends(s.collapsible_depends_on || null, props.doc) || !s.collapsible_depends_on
}
function toggle(s) {
  const k = sectionKey(s)
  if (isCollapsed(s)) {
    opened.add(k)
    closed.delete(k)
  } else {
    closed.add(k)
    opened.delete(k)
  }
}
const filledCount = (s) => s.columns.flat().filter((f) => f.fieldtype !== 'Table' && !isEmpty(props.doc[f.fieldname]) && !(f.fieldtype === 'Check' && !props.doc[f.fieldname])).length
const errCount = (t) => props.errors.filter((e) => e.tab === t.fieldname).length
const fieldErr = (df) => props.showErrors && errFields.value.has(df.fieldname) && isEmpty(props.doc[df.fieldname])
function rowErrors(df) {
  return new Set(props.errors.filter((e) => e.field === df.fieldname && e.row !== undefined).map((e) => e.row))
}
function ensureRows(df) {
  if (!Array.isArray(props.doc[df.fieldname])) props.doc[df.fieldname] = []
  return props.doc[df.fieldname]
}
function set(df, v) {
  props.doc[df.fieldname] = v
  markTouched(props.doc, df.fieldname)
  emit('change', { df, value: v })
}
const plain = (s) => String(s || '').replace(/<[^>]+>/g, '')

/** open the tab containing a field (used to reveal validation errors) */
function reveal(field) {
  const t = (props.meta?.tabs || []).find((x) => x.sections.some((s) => s.columns.some((c) => c.some((f) => f.fieldname === field))))
  if (t) tab.value = t.fieldname
}
defineExpose({ grids, reveal })
</script>

<style scoped>
.dyn { display: flex; flex-direction: column; gap: 1rem; }
.dyn-tabs {
  position: sticky; top: calc(var(--shell-h) + 0.5rem); z-index: 20;
  display: flex; gap: 0.25rem; padding: 0.3125rem; overflow-x: auto; scrollbar-width: none;
  background: var(--glass); backdrop-filter: saturate(1.6) blur(14px); -webkit-backdrop-filter: saturate(1.6) blur(14px);
  border: 1px solid var(--border-soft); border-radius: 0.75rem; box-shadow: var(--shadow-1);
}
.dyn-tabs::-webkit-scrollbar { display: none; }
.dyn-tabs button {
  display: inline-flex; align-items: center; gap: 0.375rem; height: 2.25rem; padding: 0 0.875rem; flex: none;
  border: 0; border-radius: 0.5rem; background: none; color: var(--text-2); font: inherit; font-weight: 600; cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.dyn-tabs button:hover { background: var(--surface-hover); color: var(--text); }
.dyn-tabs button.on { background: var(--brand); color: var(--brand-text); box-shadow: 0 4px 12px -4px color-mix(in srgb, var(--brand) 60%, transparent); }
.err-badge { min-width: 1.125rem; height: 1.125rem; padding: 0 0.3125rem; border-radius: 1rem; display: grid; place-items: center; font-size: 0.6875rem; background: var(--negative); color: #fff; }
.dyn-tab { display: flex; flex-direction: column; gap: 1rem; animation: dyn-in 0.35s var(--ease) both; }
@keyframes dyn-in { from { opacity: 0; transform: translateX(-10px); } }

.dyn-sec { overflow: visible; }
.dyn-sec.card { border: 1px solid var(--border-soft); box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04); }
.dyn-sec-head { display: flex; align-items: center; gap: 0.625rem; padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border-soft); }
.dyn-sec-head h3 { font-size: 0.9375rem; }
.dyn-sec-head .sub { font-size: 0.75rem; }
.dyn-sec-head.toggle { cursor: pointer; user-select: none; border-radius: var(--radius) var(--radius) 0 0; }
.dyn-sec-head.toggle:hover { background: var(--surface-hover); }
.dyn-sec .chev { color: var(--text-3); transition: transform 0.3s var(--ease); }
.dyn-sec.collapsed .chev { transform: rotate(-90deg); }
.dyn-sec.collapsed .dyn-sec-head { border-bottom-color: transparent; }

/* smooth collapse */
.dyn-grid-wrap { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 0.32s var(--ease); }
.dyn-sec.collapsed .dyn-grid-wrap { grid-template-rows: 0fr; }
.dyn-cols { min-height: 0; overflow: hidden; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 1rem 1.5rem; padding: 1.125rem 1.25rem 1.25rem; }
.dyn-sec.collapsed .dyn-cols { padding-top: 0; padding-bottom: 0; }
.dyn-cols { transition: padding 0.32s var(--ease); }
@media (max-width: 900px) { .dyn-cols { grid-template-columns: repeat(min(var(--n), 2), minmax(0, 1fr)); } }
@media (max-width: 600px) { .dyn-cols { grid-template-columns: 1fr; } }
.dyn-col { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
.dyn-cols:has(.dyn-table) { overflow: visible; }

.dyn-table { grid-column: 1 / -1; margin: 0 -1.25rem; border-top: 1px solid var(--border-soft); border-bottom: 1px solid var(--border-soft); }
.dyn-col:only-child .dyn-table:first-child { border-top: 0; margin-top: -1.125rem; }
.dyn-table-head { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem 0.5rem; }
.dyn-table-head label { font-weight: 700; font-size: 0.875rem; }
.dyn-table-head label.req::after { content: ' *'; color: var(--negative); }
.dyn-table-head .muted { font-size: 0.75rem; padding: 0 0.4375rem; border-radius: 1rem; background: var(--neutral-bg); }

.field.has-error :deep(.input) { border-color: var(--negative); box-shadow: 0 0 0 3px color-mix(in srgb, var(--negative) 12%, transparent); }
.field.has-error > label { color: var(--negative); }
.err { display: flex; align-items: center; gap: 0.25rem; color: var(--negative); font-size: 0.75rem; animation: fade-up 0.2s var(--ease) both; }

/* view mode: compact label/value pairs */
.view .dyn-cols { gap: 0.875rem 1.5rem; }
.view .dyn-col { gap: 0.875rem; }
.view .field { gap: 0.125rem; }
.view .field > label { font-weight: 500; color: var(--text-2); font-size: 0.75rem; }
.view .field :deep(.df-view) { font-weight: 600; }
.view .dyn-tabs { position: static; }
</style>
