<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in state.toasts" :key="t.id" class="toast" :class="t.type">
        <Icon :name="t.type === 'error' ? 'XCircle' : t.type === 'info' ? 'Info' : 'CheckCircle2'" />
        <span style="white-space: pre-line">{{ t.message }}</span>
        <i class="toast-timer" />
      </div>
    </TransitionGroup>
  </div>

  <Teleport to="body">
    <div v-if="state.dialog" class="overlay" @click.self="close(null)" @keydown.esc="close(null)">
      <div class="dialog fade-up" role="dialog" aria-modal="true">
        <header :class="state.dialog.type">
          <Icon :name="['negative', 'critical'].includes(state.dialog.type) ? 'TriangleAlert' : 'Info'" />
          <h3>{{ state.dialog.title }}</h3>
        </header>
        <div class="dialog-body">
          <p style="margin: 0 0 0.75rem; white-space: pre-line">{{ state.dialog.message }}</p>
          <ul v-if="state.dialog.details?.length" class="dlg-details">
            <li v-for="(d, i) in state.dialog.details" :key="i">{{ d }}</li>
          </ul>
          <div v-if="state.dialog.input" class="field">
            <label :class="{ req: state.dialog.inputType === 'date' }">{{ state.dialog.input }}</label>
            <input v-if="state.dialog.inputType === 'date'" ref="inp" v-model="state.dialog.value" type="date" class="input" :min="state.dialog.min || undefined" />
            <textarea v-else ref="inp" v-model="state.dialog.value" class="input" />
          </div>
        </div>
        <footer>
          <button
            class="btn" :class="'btn-' + (state.dialog.type === 'negative' ? 'negative' : 'emphasized')"
            :disabled="state.dialog.inputType === 'date' && (!state.dialog.value || (state.dialog.min && state.dialog.value < state.dialog.min))"
            @click="close(state.dialog.value || true)"
          >
            {{ state.dialog.confirmText }}
          </button>
          <button class="btn btn-transparent" @click="close(null)">Cancel</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
<script setup>
import { state } from '../store'
import Icon from './Icon.vue'
function close(v) {
  const d = state.dialog
  state.dialog = null
  d?.resolve(v)
}
</script>
<style>
.dlg-details { margin: 0 0 0.875rem; padding: 0.5rem 0.75rem 0.5rem 1.75rem; border-radius: 0.5rem; background: var(--critical-bg); color: var(--critical-text); font-size: 0.8125rem; max-height: 10rem; overflow: auto; }
.dlg-details li + li { margin-top: 0.125rem; }
.toasts {
  position: fixed;
  bottom: 5.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  pointer-events: none;
}
.toast {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  max-width: min(36rem, calc(100vw - 2rem));
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: #2b3540;
  color: #fff;
  box-shadow: var(--shadow-3);
  pointer-events: auto;
}
.toast { position: relative; overflow: hidden; }
.toast svg { flex: none; margin-top: 1px; }
.toast-timer { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: rgba(255,255,255,0.35); transform-origin: left; animation: toast-t 4s linear forwards; }
@keyframes toast-t { to { transform: scaleX(0); } }
.toast.success svg { color: #7ddc8f; }
.toast.error { background: #6b0909; }
.toast-enter-from { opacity: 0; transform: translateY(16px) scale(0.95); }
.toast-leave-to { opacity: 0; transform: scale(0.95); }
.toast-enter-active, .toast-leave-active { transition: all 0.25s var(--ease); }
.overlay {
  position: fixed; inset: 0; z-index: 150;
  background: rgba(0, 0, 0, 0.45);
  display: grid; place-items: center; padding: 1rem;
}
.dialog {
  width: min(30rem, 100%);
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-3);
  overflow: hidden;
}
.dialog header {
  display: flex; gap: 0.5rem; align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 3px solid var(--brand);
}
.dialog header.negative { border-color: var(--negative); color: var(--negative); }
.dialog header.critical { border-color: var(--critical); color: var(--critical-text); }
.dialog header h3 { font-size: 1rem; color: var(--text); }
.dialog-body { padding: 1rem 1.25rem; }
.dialog footer {
  display: flex; justify-content: flex-end; gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--surface-2);
}
</style>
