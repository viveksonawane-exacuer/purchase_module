<template>
  <div class="sel" :class="{ open, compact, disabled: readonly }">
    <button
      ref="btn"
      type="button"
      class="input sel-btn"
      :class="{ compact, placeholder: !modelValue }"
      :disabled="readonly"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
      @keydown.down.prevent="open ? move(1) : show()"
      @keydown.up.prevent="open ? move(-1) : show()"
      @keydown.enter.prevent="open ? pick(options[sel]) : show()"
      @keydown.space.prevent="open ? pick(options[sel]) : show()"
      @keydown.esc="open && (close(), $event.stopPropagation())"
      @keydown.tab="close"
      @keydown="typeahead"
      @blur="close"
    >
      <span class="sel-val">{{ labelOf(modelValue) }}</span>
      <Icon name="ChevronDown" :size="16" class="sel-chev" />
    </button>

    <Teleport to="body">
      <Transition name="vh-pop">
        <ul v-if="open" ref="list" class="vh-list sel-list" :class="{ up: pos.up }" :style="pos.style" role="listbox" @mousedown.prevent>
          <li
            v-for="(o, i) in options"
            :key="o"
            role="option"
            :class="{ on: i === sel, picked: o === (modelValue ?? '') }"
            :aria-selected="o === (modelValue ?? '')"
            @mousedown.prevent="pick(o)"
            @mouseenter="sel = i"
          >
            <span class="sel-opt" :class="{ muted: !o }">{{ labelOf(o) }}</span>
            <Icon v-if="o === (modelValue ?? '')" name="Check" :size="15" class="sel-check" />
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import Icon from './Icon.vue'
import { usePopover } from './popover'

const props = defineProps({ modelValue: [String, Number], options: { type: Array, default: () => [] }, placeholder: { type: String, default: 'All' }, compact: Boolean, readonly: Boolean })
const emit = defineEmits(['update:modelValue', 'select'])
const btn = ref(null)
const list = ref(null)
const open = ref(false)
const sel = ref(0)
const options = computed(() => props.options.map((o) => (o == null ? '' : String(o))))
const labelOf = (o) => (o === '' || o == null ? props.placeholder : o)
const close = () => (open.value = false)
const { pos } = usePopover(btn, list, open, close, { minW: 180 })

function show() {
  if (props.readonly) return
  sel.value = Math.max(0, options.value.indexOf(String(props.modelValue ?? '')))
  open.value = true
  nextTick(scrollSel)
}
const toggle = () => (open.value ? close() : show())
function scrollSel() {
  list.value?.querySelector('li.on')?.scrollIntoView({ block: 'nearest' })
}
function move(d) {
  const n = options.value.length
  if (!n) return
  sel.value = (sel.value + d + n) % n
  nextTick(scrollSel)
}
function pick(o) {
  if (o === undefined) return
  close()
  if (o !== String(props.modelValue ?? '')) {
    emit('update:modelValue', o)
    emit('select', { value: o })
  }
}
// jump to the first option starting with the typed letters
let buf = ''
let bt
function typeahead(e) {
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.key === ' ') return
  buf += e.key.toLowerCase()
  clearTimeout(bt)
  bt = setTimeout(() => (buf = ''), 600)
  const i = options.value.findIndex((o) => o.toLowerCase().startsWith(buf))
  if (i < 0) return
  if (!open.value) show()
  sel.value = i
  nextTick(scrollSel)
}
</script>

<style scoped>
.sel { position: relative; }
.sel-btn { display: flex; align-items: center; gap: 0.5rem; text-align: left; cursor: pointer; padding-right: 0.5rem; }
.sel-btn:disabled { cursor: not-allowed; }
.sel-val { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sel-btn.placeholder .sel-val { color: var(--text-3); }
.sel-chev { flex: none; color: var(--text-3); transition: transform 0.25s var(--ease), color 0.15s; }
.sel.open .sel-chev { transform: rotate(180deg); color: var(--brand); }
</style>

<style>
.sel-list li { flex-direction: row !important; align-items: center; justify-content: space-between; gap: 0.75rem; }
.sel-list li.picked { font-weight: 600; color: var(--brand); }
.sel-list .sel-check { flex: none; color: var(--brand); }
</style>
