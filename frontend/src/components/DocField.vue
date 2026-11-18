<template>
  <!-- ============ read-only / view ============ -->
  <div v-if="view || ro" class="df-view" :class="{ compact, boxed: !view, bold: df.bold }">
    <template v-if="df.fieldtype === 'Check'">
      <span class="df-check" :class="{ on: !!modelValue }"><Icon v-if="modelValue" name="Check" :size="12" /></span>
      <span v-if="!compact">{{ modelValue ? 'Yes' : 'No' }}</span>
    </template>
    <router-link v-else-if="linkTo" :to="linkTo">{{ modelValue }}</router-link>
    <a v-else-if="isAttach && modelValue" :href="modelValue" target="_blank"><Icon name="FileText" :size="14" /> {{ fileName }}</a>
    <span v-else-if="TEXTAREA.has(df.fieldtype)" class="df-text">{{ plain || '—' }}</span>
    <span v-else :class="{ muted: isEmpty(modelValue), num: NUMERIC.has(df.fieldtype) }">{{ display }}</span>
  </div>

  <!-- ============ edit ============ -->
  <LinkInput
    v-else-if="df.fieldtype === 'Link' || df.fieldtype === 'Dynamic Link'"
    :model-value="modelValue"
    :doctype="linkDoctype"
    :filters="linkFilters"
    :compact="compact"
    :readonly="!linkDoctype"
    :placeholder="linkDoctype ? `Search ${linkDoctype}` : `Select ${df.options} first`"
    @update:model-value="set($event)"
    @select="emit('select', $event)"
  />
  <SelectInput v-else-if="df.fieldtype === 'Select'" :model-value="modelValue" :options="options" placeholder="Select…" :compact="compact" @update:model-value="set($event)" @select="emit('select', $event)" />
  <label v-else-if="df.fieldtype === 'Check'" class="df-switch" :class="{ compact }">
    <input type="checkbox" :checked="!!modelValue" @change="set($event.target.checked ? 1 : 0)" />
    <span class="track"><span class="thumb" /></span>
    <span v-if="!compact" class="df-switch-lbl">{{ modelValue ? 'Yes' : 'No' }}</span>
  </label>
  <textarea v-else-if="TEXTAREA.has(df.fieldtype)" class="input" :class="{ compact, tall: ['Text Editor', 'Long Text', 'Code', 'JSON'].includes(df.fieldtype) }" :value="modelValue ?? ''" @input="set($event.target.value)" />
  <div v-else-if="NUMERIC.has(df.fieldtype)" class="df-num" :class="{ compact }">
    <span v-if="df.fieldtype === 'Currency' && currency" class="adorn l">{{ currency }}</span>
    <input
      class="input mono"
      :class="{ compact, 'has-l': df.fieldtype === 'Currency' && currency, 'has-r': df.fieldtype === 'Percent' }"
      type="number"
      :step="df.fieldtype === 'Int' ? 1 : 'any'"
      :min="df.non_negative ? 0 : undefined"
      :value="modelValue ?? ''"
      @input="set($event.target.value === '' ? null : +$event.target.value)"
    />
    <span v-if="df.fieldtype === 'Percent'" class="adorn r">%</span>
  </div>
  <input v-else-if="df.fieldtype === 'Date'" class="input" :class="{ compact }" type="date" :value="modelValue || ''" @input="set($event.target.value || null)" />
  <input v-else-if="df.fieldtype === 'Datetime'" class="input" :class="{ compact }" type="datetime-local" step="1" :value="toLocal(modelValue)" @input="set(fromLocal($event.target.value))" />
  <input v-else-if="df.fieldtype === 'Time'" class="input" :class="{ compact }" type="time" step="1" :value="modelValue || ''" @input="set($event.target.value || null)" />
  <div v-else-if="isAttach" class="df-attach">
    <a v-if="modelValue" :href="modelValue" target="_blank" class="df-file"><Icon name="FileText" :size="14" /> <span>{{ fileName }}</span></a>
    <button type="button" class="btn btn-sm" :disabled="uploading" @click="pickFile"><Icon name="Upload" /> {{ uploading ? 'Uploading…' : modelValue ? 'Replace' : 'Attach' }}</button>
    <button v-if="modelValue" type="button" class="btn btn-sm btn-transparent btn-icon" title="Remove" @click="set(null)"><Icon name="X" :size="14" /></button>
  </div>
  <div v-else-if="df.fieldtype === 'Rating'" class="df-rating">
    <button v-for="i in 5" :key="i" type="button" :class="{ on: i <= Math.round((modelValue || 0) * 5) }" @click="set(i / 5)"><Icon name="Star" :size="18" /></button>
  </div>
  <input v-else-if="df.fieldtype === 'Color'" class="input df-color" :class="{ compact }" type="color" :value="modelValue || '#000000'" @input="set($event.target.value)" />
  <div v-else-if="df.fieldtype === 'Table MultiSelect'" class="df-view boxed muted">{{ (modelValue || []).length }} selected · edit in Desk</div>
  <input
    v-else
    class="input"
    :class="{ compact }"
    :type="df.options === 'Email' ? 'email' : df.options === 'Phone' ? 'tel' : df.options === 'URL' ? 'url' : 'text'"
    :maxlength="df.length || undefined"
    :value="modelValue ?? ''"
    @input="set($event.target.value)"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import { api } from '../api'
import { BY_DOCTYPE } from '../config'
import { fmtDate, fmtMoney, fmtNum, state } from '../store'
import Icon from './Icon.vue'
import LinkInput from './LinkInput.vue'
import SelectInput from './SelectInput.vue'
import { NUMERIC, TEXTAREA, isEmpty } from './formLogic'

const props = defineProps({
  df: Object,
  modelValue: null,
  doc: Object, // the row / document this field belongs to
  parent: Object, // parent document (for child rows)
  view: Boolean, // display mode
  readonly: Boolean,
  compact: Boolean,
})
const emit = defineEmits(['update:modelValue', 'select'])
const uploading = ref(false)

const ro = computed(() => props.readonly || props.df.fieldtype === 'Read Only')
const isAttach = computed(() => ['Attach', 'Attach Image'].includes(props.df.fieldtype))
const root = computed(() => props.parent || props.doc || {})
const currency = computed(() => {
  const o = props.df.options
  if (o && o !== 'currency' && /^[A-Z]{3}$/.test(o)) return o
  return props.doc?.[o] || root.value?.[o] || root.value.currency || state.boot?.currency
})
const options = computed(() => String(props.df.options || '').split('\n'))
const linkDoctype = computed(() => (props.df.fieldtype === 'Dynamic Link' ? props.doc?.[props.df.options] || root.value?.[props.df.options] : props.df.options))
const linkFilters = computed(() => {
  const f = props.df.link_filters
  if (!f) return undefined
  const out = {}
  for (const [k, v] of Object.entries(f)) {
    if (v === '$company') {
      const c = root.value.company || state.boot?.company
      if (c) out[k] = c
    } else out[k] = v
  }
  return Object.keys(out).length ? out : undefined
})
const linkTo = computed(() => {
  if (!['Link', 'Dynamic Link'].includes(props.df.fieldtype) || !props.modelValue) return null
  const m = BY_DOCTYPE[linkDoctype.value]
  return m ? `/${m.key}/${encodeURIComponent(props.modelValue)}` : null
})
const plain = computed(() => String(props.modelValue ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
const fileName = computed(() => decodeURIComponent(String(props.modelValue || '').split('/').pop()))
const display = computed(() => {
  const v = props.modelValue
  if (isEmpty(v)) return '—'
  switch (props.df.fieldtype) {
    case 'Currency': return fmtMoney(v, currency.value)
    case 'Float': return fmtNum(v, props.df.precision ? +props.df.precision : 3)
    case 'Int': return fmtNum(v, 0)
    case 'Percent': return `${fmtNum(v)}%`
    case 'Date': return fmtDate(v)
    case 'Datetime': return `${fmtDate(v)} ${String(v).slice(11, 16)}`
    case 'Rating': return '★'.repeat(Math.round(v * 5)) || '—'
    default: return String(v)
  }
})

function set(v) {
  emit('update:modelValue', v)
}
const toLocal = (v) => (v ? String(v).replace(' ', 'T').slice(0, 19) : '')
const fromLocal = (v) => (v ? `${v.replace('T', ' ')}${v.length === 16 ? ':00' : ''}` : null)
function pickFile() {
  const i = Object.assign(document.createElement('input'), { type: 'file', accept: props.df.fieldtype === 'Attach Image' ? 'image/*' : '' })
  i.onchange = async () => {
    const f = i.files?.[0]
    if (!f) return
    uploading.value = true
    try {
      const r = await api.upload(null, null, f)
      set(r.file_url)
    } catch { /* toast shown */ }
    uploading.value = false
  }
  i.click()
}
</script>

<style scoped>
.df-view { display: flex; align-items: center; gap: 0.375rem; min-height: 1.5rem; word-break: break-word; }
.df-view.boxed { min-height: 2.5rem; padding: 0 0.75rem; border-radius: 0.5rem; background: var(--surface-2); border: 1px dashed var(--border); color: var(--text-2); }
.df-view.boxed.compact { min-height: 2.125rem; padding: 0 0.625rem; font-size: 0.875rem; }
.df-view.bold { font-weight: 700; }
.df-view .num { font-variant-numeric: tabular-nums; }
.df-text { white-space: pre-line; }
.df-check { width: 1.125rem; height: 1.125rem; border-radius: 0.3125rem; display: grid; place-items: center; border: 1px solid var(--border); background: var(--surface); color: #fff; }
.df-check.on { background: var(--brand); border-color: var(--brand); }

textarea.tall { min-height: 8rem; }
.df-num { position: relative; }
.df-num .adorn { position: absolute; top: 50%; transform: translateY(-50%); font-size: 0.75rem; font-weight: 600; color: var(--text-3); pointer-events: none; }
.df-num .adorn.l { left: 0.625rem; }
.df-num .adorn.r { right: 0.75rem; }
.df-num .input.has-l { padding-left: 2.75rem; }
.df-num .input.has-r { padding-right: 1.75rem; }
.df-num.compact .adorn.l { left: 0.5rem; font-size: 0.6875rem; }
.df-num.compact .input.has-l { padding-left: 2.5rem; }
.mono { text-align: right; }

.df-switch { display: inline-flex; align-items: center; gap: 0.625rem; height: 2.5rem; cursor: pointer; user-select: none; }
.df-switch.compact { height: 2.125rem; }
.df-switch input { position: absolute; opacity: 0; pointer-events: none; }
.df-switch .track { position: relative; width: 2.375rem; height: 1.375rem; border-radius: 1rem; background: var(--border); transition: background 0.2s var(--ease); flex: none; }
.df-switch .thumb { position: absolute; top: 0.1875rem; left: 0.1875rem; width: 1rem; height: 1rem; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25); transition: transform 0.25s var(--spring); }
.df-switch input:checked + .track { background: var(--brand); }
.df-switch input:checked + .track .thumb { transform: translateX(1rem); }
.df-switch input:focus-visible + .track { outline: 2px solid var(--focus); outline-offset: 2px; }
.df-switch-lbl { font-size: 0.875rem; color: var(--text-2); }

.df-attach { display: flex; align-items: center; gap: 0.5rem; min-height: 2.5rem; flex-wrap: wrap; }
.df-file { display: inline-flex; align-items: center; gap: 0.375rem; max-width: 100%; padding: 0.25rem 0.625rem; border-radius: 0.5rem; background: var(--info-bg); font-weight: 600; }
.df-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 14rem; }
.df-rating { display: flex; gap: 0.125rem; height: 2.5rem; align-items: center; }
.df-rating button { border: 0; background: none; color: var(--border); cursor: pointer; padding: 0.125rem; }
.df-rating button.on { color: #f5a623; }
.df-rating button.on :deep(svg) { fill: currentColor; }
.df-color { padding: 0.25rem; width: 4rem; }
</style>
