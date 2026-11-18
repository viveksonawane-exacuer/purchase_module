<template>
  <Teleport to="body">
    <Transition name="iv" appear>
      <div v-if="open" class="iv" role="dialog" aria-modal="true" :aria-label="`${title} images`" @click.self="emit('close')">
        <div class="iv-shell">
          <header class="iv-head">
            <div style="min-width: 0">
              <b class="ell">{{ title }}</b>
              <small class="muted">Image {{ idx + 1 }} of {{ images.length }}</small>
            </div>
            <div class="spacer" />
            <a class="btn btn-sm" :href="cur" target="_blank" rel="noopener"><Icon name="ExternalLink" :size="15" /> Open image</a>
            <a class="btn btn-transparent btn-icon btn-sm" :href="cur" download title="Download"><Icon name="Download" :size="16" /></a>
            <button class="btn btn-transparent btn-icon btn-sm" title="Close (Esc)" @click="emit('close')"><Icon name="X" :size="18" /></button>
          </header>

          <div class="iv-body">
            <div v-if="images.length > 1" class="iv-thumbs">
              <button v-for="(u, i) in images" :key="u" :class="{ on: i === idx }" :aria-label="`Image ${i + 1}`" @click="idx = i">
                <img :src="u" alt="" loading="lazy" />
              </button>
            </div>

            <div class="iv-stage">
              <button v-if="images.length > 1" class="iv-nav l" aria-label="Previous image" @click="go(idx - 1)"><Icon name="ChevronLeft" :size="22" /></button>
              <div class="iv-frame">
                <Transition name="iv-swap" mode="out-in">
                  <img :key="cur" :src="cur" alt="" class="iv-img" draggable="false" />
                </Transition>
              </div>
              <button v-if="images.length > 1" class="iv-nav r" aria-label="Next image" @click="go(idx + 1)"><Icon name="ChevronRight" :size="22" /></button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({ images: { type: Array, default: () => [] }, start: { type: Number, default: 0 }, title: String, open: Boolean })
const emit = defineEmits(['close'])
const idx = ref(props.start)
const cur = computed(() => props.images[idx.value])

watch(() => props.open, (v) => {
  if (v) idx.value = Math.min(props.start, props.images.length - 1)
  const fn = v ? addEventListener : removeEventListener
  fn('keydown', onKey)
  document.body.style.overflow = v ? 'hidden' : ''
})
onBeforeUnmount(() => {
  removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
function go(i) {
  const n = props.images.length
  idx.value = (i + n) % n
}
function onKey(e) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowRight') go(idx.value + 1)
  else if (e.key === 'ArrowLeft') go(idx.value - 1)
}
</script>

<style scoped>
.iv { position: fixed; inset: 0; z-index: 300; display: grid; place-items: center; padding: 1.5rem; background: rgba(10, 14, 20, 0.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.iv-shell { width: min(64rem, 100%); height: min(44rem, 100%); display: flex; flex-direction: column; background: var(--surface); border-radius: 1rem; box-shadow: 0 32px 80px -16px rgba(0, 0, 0, 0.5); overflow: hidden; }
.iv-head { display: flex; align-items: center; gap: 0.375rem; padding: 0.875rem 1rem 0.875rem 1.25rem; border-bottom: 1px solid var(--border-soft); }
.iv-head > div:first-child { display: flex; flex-direction: column; }
.iv-head small { font-size: 0.75rem; }
.ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.iv-body { flex: 1; min-height: 0; display: flex; gap: 1rem; padding: 1rem; }
.iv-thumbs { display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto; width: 4.75rem; flex: none; padding: 0.125rem; scrollbar-width: thin; }
.iv-thumbs button { width: 4.25rem; height: 4.25rem; flex: none; padding: 0.25rem; border: 2px solid var(--border-soft); border-radius: 0.625rem; background: #fff; cursor: pointer; transition: border-color 0.15s; }
.iv-thumbs button.on { border-color: var(--brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 20%, transparent); }
.iv-thumbs img { width: 100%; height: 100%; object-fit: contain; }
.iv-stage { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; }
.iv-frame { flex: 1; height: 100%; border-radius: 0.75rem; background: #fff; overflow: hidden; }
.iv-img { width: 100%; height: 100%; object-fit: contain; display: block; user-select: none; }
.iv-nav { position: absolute; z-index: 3; top: 50%; width: 2.75rem; height: 2.75rem; margin-top: -1.375rem; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; background: var(--surface); color: var(--text); box-shadow: var(--shadow-2); transition: transform 0.15s; }
.iv-nav:hover { transform: scale(1.06); }
.iv-nav.l { left: 0.75rem; }
.iv-nav.r { right: 0.75rem; }
@media (max-width: 720px) {
  .iv { padding: 0; }
  .iv-shell { border-radius: 0; height: 100%; }
  .iv-body { flex-direction: column-reverse; padding: 0.5rem; }
  .iv-thumbs { flex-direction: row; width: auto; overflow-x: auto; }
  .iv-thumbs button { width: 3.5rem; height: 3.5rem; }
}
.iv-enter-active, .iv-leave-active { transition: opacity 0.25s var(--ease); }
.iv-enter-active .iv-shell { transition: transform 0.4s var(--spring), opacity 0.25s; }
.iv-leave-active .iv-shell { transition: transform 0.2s ease-in, opacity 0.2s; }
.iv-enter-from, .iv-leave-to { opacity: 0; }
.iv-enter-from .iv-shell, .iv-leave-to .iv-shell { transform: scale(0.94) translateY(12px); opacity: 0; }
.iv-swap-enter-active { transition: opacity 0.25s var(--ease); }
.iv-swap-leave-active { transition: opacity 0.1s linear; }
.iv-swap-enter-from, .iv-swap-leave-to { opacity: 0; }
</style>
