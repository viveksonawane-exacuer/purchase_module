<template>
  <div ref="root" class="lg" :class="{ ready, rm: reduced }">
    <div ref="gbox" class="gbox"><canvas ref="canvas" class="globe" aria-hidden="true" /></div>

    <div class="frame">
      <!-- Brand + nav (same placement as the landing page) -->
      <a class="logo fu" href="/procure" :aria-label="company">
        <img v-if="brand.logo && !logoFailed" :src="brand.logo" alt="" @error="logoFailed = true" />
        <span v-else class="wm">{{ initials }}</span>
      </a>
      <ul class="vnav">
        <li><a class="fu d1" href="/procure">← Home</a></li>
        <li><a class="fu d2" href="/login">Standard login</a></li>
      </ul>

      <!-- Story (left) -->
      <section class="story">
        <p class="over fu d2">{{ company }}</p>
        <h1 class="hl">
          <span class="ln g1">Source smarter.</span>
          <span class="ln g2">Order faster.</span>
          <span class="ln g3 accent">Pay on time.</span>
        </h1>
        <ul class="feats">
          <li v-for="(f, i) in feats" :key="f.t" class="fu" :style="{ animationDelay: 0.9 + i * 0.12 + 's' }">
            <span class="no">0{{ i + 1 }}</span>
            <div><b>{{ f.t }}</b><small>{{ f.s }}</small></div>
          </li>
        </ul>
      </section>
    </div>

    <!-- Sign-in card (over the globe) -->
    <section class="card-wrap">
      <form class="sheet" :class="{ shake }" novalidate @submit.prevent="submit" @animationend="shake = false">
        <p class="kicker">Sign in</p>
        <h2>Welcome back</h2>
        <p class="sub">Sign in to {{ brand.company || 'the Procurement Hub' }}</p>

        <label class="fld" :class="{ filled: usr }">
          <Icon name="User" :size="16" />
          <input v-model.trim="usr" type="text" autocomplete="username" required :disabled="busy" @input="err = ''" />
          <span>Email or username</span>
        </label>
        <label class="fld" :class="{ filled: pwd }">
          <Icon name="Lock" :size="16" />
          <input v-model="pwd" :type="showPwd ? 'text' : 'password'" autocomplete="current-password" required :disabled="busy" @input="err = ''" @keyup="caps = $event.getModifierState?.('CapsLock')" />
          <span>Password</span>
          <button type="button" class="eye" :aria-label="showPwd ? 'Hide password' : 'Show password'" @click="showPwd = !showPwd">
            <Icon :name="showPwd ? 'EyeOff' : 'Eye'" :size="16" />
          </button>
        </label>
        <div class="hints">
          <span v-if="caps" class="caps"><Icon name="TriangleAlert" :size="13" /> Caps Lock is on</span>
          <span class="spacer" />
          <a href="/login#forgot">Forgot password?</a>
        </div>

        <Transition name="err"><div v-if="err" class="error" role="alert"><Icon name="XCircle" :size="15" /> {{ err }}</div></Transition>

        <button class="submit" type="submit" :disabled="busy || !usr || !pwd">
          <span v-if="!busy && !done">Sign in</span>
          <span v-else-if="busy" class="spin" />
          <Icon v-else name="Check" :size="18" />
          <Icon v-if="!busy && !done" name="ArrowRight" :size="16" class="arrow" />
        </button>

        <div class="alt">
          <span>Supplier? Use the login sent with your RFQ invitation.</span>
          <a href="/login">Use standard login</a>
        </div>
      </form>
      <footer class="foot">© {{ new Date().getFullYear() }} {{ brand.company || '' }} · Secured by Frappe</footer>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '../components/Icon.vue'
import { createGlobe } from '../landing/globe.js'

const props = defineProps({ brand: { type: Object, default: () => ({}) } })
const root = ref(null)
const gbox = ref(null)
const canvas = ref(null)
const usr = ref('')
const pwd = ref('')
const showPwd = ref(false)
const caps = ref(false)
const busy = ref(false)
const done = ref(false)
const err = ref('')
const shake = ref(false)
const ready = ref(false)
const logoFailed = ref(false)
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const company = computed(() => props.brand.company || 'Procurement Hub')
const initials = computed(() =>
  (props.brand.abbr || company.value.split(/\s+/).map((w) => w[0]).join('')).replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase(),
)
const feats = [
  { t: 'RFQs & quotations', s: 'Invite suppliers, compare bids, award in one click' },
  { t: 'Purchase orders', s: 'Approve, receive and track every delivery' },
  { t: 'Invoices & payments', s: 'Stay ahead of due dates and payables' },
]

// ---- globe: same renderer and frame as the landing hero
let globe = null
let raf = 0
let t0 = 0
function layout() {
  const el = root.value
  const de = document.documentElement
  const vw = de.clientWidth
  const vh = de.clientHeight
  const wide = vw > 980 && vh >= 540
  el.classList.toggle('wide', wide)
  const uc = Math.min(vw / 1440, vh / 900)
  el.style.setProperty('--uc', uc + 'px')
  const cw = gbox.value.clientWidth
  const ch = gbox.value.clientHeight
  if (wide) {
    const uv = Math.max(vw / 1440, vh / 900)
    globe.resize(cw, ch, { up: uv, ox: cw - 1440 * uv, oy: Math.min(0, (ch - 900 * uv) / 2) })
  } else {
    const up = (1.1 * cw) / 800
    globe.resize(cw, ch, { up, ox: cw - 1440 * up, oy: 16 - 130 * up, smallLabels: true })
  }
}
function frame(now) {
  globe.draw((now - t0) / 1000)
  raf = requestAnimationFrame(frame)
}
let rq = 0
const onResize = () => {
  cancelAnimationFrame(rq)
  rq = requestAnimationFrame(layout)
}

onMounted(() => {
  document.title = `Sign in · ${company.value}`
  requestAnimationFrame(() => (ready.value = true))
  globe = createGlobe(canvas.value, { reduced })
  layout()
  t0 = performance.now()
  raf = requestAnimationFrame(frame)
  addEventListener('resize', onResize)
  document.fonts?.ready.then(onResize)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  cancelAnimationFrame(rq)
  removeEventListener('resize', onResize)
})

async function submit() {
  if (!usr.value || !pwd.value) return
  busy.value = true
  err.value = ''
  try {
    const body = new URLSearchParams({ usr: usr.value, pwd: pwd.value })
    const res = await fetch('/api/method/login', {
      method: 'POST',
      body,
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', ...(window.csrf_token && !window.csrf_token.startsWith('{{') ? { 'X-Frappe-CSRF-Token': window.csrf_token } : {}) },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      err.value = res.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : data.message && typeof data.message === 'string' ? data.message : 'Incorrect email/username or password.'
      shake.value = true
      return
    }
    done.value = true
    const next = new URLSearchParams(location.search).get('redirect-to')
    setTimeout(() => location.assign(next && next.startsWith('/procure') ? next : location.pathname + location.search), 450)
  } catch {
    err.value = 'Could not reach the server. Check your connection.'
    shake.value = true
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
/* Same tokens as the landing page (src/landing/Landing.vue) */
.lg {
  --ink: #111111; --cobalt: #2f63ff; --cobalt-h: #1f4fe0; --muted: #5d6270; --muted2: #6b6f78; --hair: #d9dbe0;
  --anton: 'Anton', Impact, sans-serif; --archivo: 'Archivo', system-ui, sans-serif; --mono: 'JetBrains Mono', ui-monospace, monospace;
  position: fixed; inset: 0; overflow: hidden auto; background: #fff; color: var(--ink); font-family: var(--archivo);
  color-scheme: light; display: flex; flex-direction: column;
}
.lg *, .lg *::before, .lg *::after { box-sizing: border-box; }
.lg a { color: inherit; text-decoration: none; }
.lg ul { list-style: none; margin: 0; padding: 0; }
.lg p, .lg h1, .lg h2 { margin: 0; }

/* ---------- globe ---------- */
.gbox { position: relative; order: 3; height: min(92vw, 520px); overflow: hidden; flex: none; -webkit-mask-image: linear-gradient(#000 70%, transparent); mask-image: linear-gradient(#000 70%, transparent); }
.globe { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.wide .gbox { position: fixed; inset: 0; height: auto; -webkit-mask-image: none; mask-image: none; }

/* ---------- brand, nav, story ---------- */
.frame { position: relative; z-index: 1; order: 1; padding: 22px 22px 0; }
.logo { display: inline-block; min-width: 58px; }
.logo img { display: block; height: 26px; width: auto; max-width: 140px; object-fit: contain; }
.wm { display: block; font-family: var(--anton); font-size: 34px; line-height: 0.76; letter-spacing: -0.01em; }
.vnav { position: absolute; right: 22px; top: 20px; text-align: right; }
.vnav a { display: inline-block; padding: 4px 0; font-family: var(--mono); font-size: 12px; line-height: 1; letter-spacing: 0.09em; text-transform: uppercase; transition: color 0.25s; }
.vnav a:hover { color: var(--cobalt); }
.story { margin-top: clamp(36px, 7vh, 72px); }
.over { font-weight: 700; font-size: 14px; line-height: 1; text-transform: uppercase; letter-spacing: -0.005em; color: var(--cobalt); }
.hl { margin-top: 12px; font-family: var(--anton); font-weight: 400; text-transform: uppercase; font-size: min(12.2vw, 96px, 15vh); line-height: 0.953; letter-spacing: -0.004em; }
.ln { display: block; width: fit-content; white-space: nowrap; }
.accent { color: var(--cobalt); }
.feats { display: none; }

.wide .frame { position: absolute; inset: 0; padding: 0; pointer-events: none; }
.wide .frame a { pointer-events: auto; }
.wide .logo { position: absolute; left: calc(var(--uc) * 40); top: calc(var(--uc) * 36); min-width: calc(var(--uc) * 71); }
.wide .logo img { height: calc(var(--uc) * 31); max-width: calc(var(--uc) * 150); }
.wide .wm { font-size: calc(var(--uc) * 41); }
.wide .vnav { right: auto; left: calc(var(--uc) * 218); top: calc(var(--uc) * 77); text-align: left; }
.wide .vnav a { display: block; padding: calc(var(--uc) * 6.1) 0; font-size: max(calc(var(--uc) * 13), 11px); }
.wide .story { position: absolute; left: calc(var(--uc) * 218); top: 50%; transform: translateY(-50%); margin: 0; width: calc(var(--uc) * 520); }
.wide .over { font-size: max(calc(var(--uc) * 19.2), 12px); }
.wide .hl { margin-top: calc(var(--uc) * 7); font-size: calc(var(--uc) * 80); }
.wide .feats { display: block; margin-top: calc(var(--uc) * 40); max-width: calc(var(--uc) * 420); }
.feats li { display: flex; gap: 16px; align-items: baseline; padding: 14px 0; border-top: 1px solid var(--hair); }
.feats li:last-child { border-bottom: 1px solid var(--hair); }
.feats .no { font-family: var(--mono); font-size: 12px; letter-spacing: 0.09em; color: var(--cobalt); flex: none; }
.feats b { display: block; font-weight: 600; font-size: 15px; }
.feats small { display: block; margin-top: 3px; font-size: 13.5px; color: var(--muted2); }

/* ---------- card ---------- */
.card-wrap { position: relative; z-index: 2; order: 2; display: flex; flex-direction: column; align-items: center; padding: 28px 22px 8px; }
.wide .card-wrap {
  /* centred on the globe (frame x 1166 → 274 frame units from the right edge) */
  position: absolute; top: 50%; transform: translateY(-50%); padding: 0; width: 400px;
  right: max(32px, calc(max(100vw / 1440, 100vh / 900) * 274 - 200px));
}
.sheet {
  width: min(400px, 100%); padding: 32px 30px 26px; position: relative; border-radius: 14px;
  background: rgba(255, 255, 255, 0.84); border: 1px solid var(--hair);
  box-shadow: 0 30px 80px -30px rgba(47, 99, 255, 0.45), 0 2px 6px rgba(17, 17, 17, 0.04);
  backdrop-filter: blur(16px) saturate(1.2); -webkit-backdrop-filter: blur(16px) saturate(1.2);
}
.kicker { font-family: var(--mono); font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--cobalt); }
h2 { margin-top: 10px; font-family: var(--anton); font-weight: 400; font-size: 44px; line-height: 0.95; text-transform: uppercase; }
.sub { margin: 8px 0 22px; color: var(--muted); font-size: 14px; }

.fld { position: relative; display: flex; align-items: center; margin-bottom: 12px; border-radius: 999px; background: #fff; border: 1.3px solid var(--hair); transition: border-color 0.2s, box-shadow 0.2s; }
.fld:focus-within { border-color: var(--cobalt); box-shadow: 0 0 0 4px rgba(47, 99, 255, 0.12); }
.fld > svg { position: absolute; left: 18px; color: var(--muted2); transition: color 0.2s; }
.fld:focus-within > svg { color: var(--cobalt); }
.fld input { flex: 1; min-width: 0; height: 52px; padding: 17px 46px 2px 44px; border: 0; outline: 0; background: none; color: var(--ink); font: inherit; font-size: 15px; }
.fld > span { position: absolute; left: 44px; top: 50%; transform: translateY(-50%); color: var(--muted2); font-size: 14.5px; pointer-events: none; transition: all 0.18s cubic-bezier(0.2, 0, 0, 1); }
.fld:focus-within > span, .fld.filled > span { top: 15px; font-family: var(--mono); font-size: 10px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--cobalt); }
.fld input:-webkit-autofill { -webkit-text-fill-color: var(--ink); -webkit-box-shadow: 0 0 0 40px #fff inset; }
.eye { position: absolute; right: 8px; width: 34px; height: 34px; border: 0; border-radius: 999px; background: none; color: var(--muted2); cursor: pointer; display: grid; place-items: center; }
.eye:hover { background: #eef2ff; color: var(--cobalt); }
.hints { display: flex; align-items: center; font-size: 13px; margin: 2px 4px 16px; min-height: 18px; }
.hints a, .alt a { color: var(--ink); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.28em; transition: color 0.25s; }
.hints a:hover, .alt a:hover { color: var(--cobalt); }
.caps { display: inline-flex; gap: 4px; align-items: center; color: #b26a00; }
.spacer { flex: 1; }
.error { display: flex; gap: 8px; align-items: center; padding: 10px 14px; margin-bottom: 14px; border-radius: 12px; background: #fff3f4; border: 1px solid #f3c2c8; color: #b4232f; font-size: 13.5px; }
.err-enter-active, .err-leave-active { transition: all 0.2s; }
.err-enter-from, .err-leave-to { opacity: 0; transform: translateY(-4px); }

.submit {
  width: 100%; height: 50px; border: 1.3px solid var(--cobalt); border-radius: 999px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 10px; background: var(--cobalt); color: #fff;
  font-family: var(--mono); font-size: 13px; letter-spacing: 0.09em; text-transform: uppercase;
  transition: background-color 0.25s, border-color 0.25s, transform 0.15s;
}
.submit:hover:not(:disabled) { background: var(--cobalt-h); border-color: var(--cobalt-h); }
.submit:active:not(:disabled) { transform: scale(0.98); }
.submit:disabled { opacity: 0.45; cursor: not-allowed; }
.submit .arrow { transition: transform 0.2s; }
.submit:hover .arrow { transform: translateX(4px); }
.spin { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.35); border-top-color: #fff; animation: rot 0.7s linear infinite; }
@keyframes rot { to { transform: rotate(360deg); } }
.alt { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 18px; font-size: 13px; color: var(--muted2); text-align: center; }
.foot { margin-top: 16px; font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted2); text-align: center; }

/* ---------- entrance: fade-ups + the landing page's glitch reveal ---------- */
.fu, .ln, .card-wrap > * { opacity: 0; }
.ready .fu { animation: fu 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.ready .d1 { animation-delay: 0.07s; }
.ready .d2 { animation-delay: 0.14s; }
.ready .ln { animation: glitch 0.9s steps(14, end) both; }
.ready .g1 { animation-delay: 0.26s; }
.ready .g2 { animation-delay: 0.39s; }
.ready .g3 { animation-delay: 0.52s; }
.ready .sheet { animation: fu 0.8s 0.35s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.ready .foot { animation: fu 0.8s 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.ready .sheet.shake { animation: shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; opacity: 1; }
@keyframes fu { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes glitch {
  0% { opacity: 0; clip-path: inset(0 100% 0 0); transform: translateX(-0.05em); text-shadow: -0.12em 0 0 rgba(47, 99, 255, 0.8), 0.07em 0 0 rgba(17, 17, 17, 0.25); }
  30% { opacity: 1; clip-path: inset(0 38% 0 0); transform: translateX(0.035em); text-shadow: 0.09em 0 0 rgba(47, 99, 255, 0.65), -0.05em 0 0 rgba(17, 17, 17, 0.3); }
  55% { opacity: 0.8; clip-path: inset(0 0 0 0); transform: translateX(-0.018em); text-shadow: -0.045em 0 0 rgba(47, 99, 255, 0.55), 0.025em 0 0 rgba(17, 17, 17, 0.2); }
  78% { opacity: 1; clip-path: inset(0 0 0 0); transform: translateX(0.008em); text-shadow: 0.015em 0 0 rgba(47, 99, 255, 0.35), 0 0 0 transparent; }
  100% { opacity: 1; clip-path: inset(0 0 0 0); transform: none; text-shadow: none; }
}
@keyframes shake { 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }

.rm .fu, .rm .ln, .rm .card-wrap > * { opacity: 1; animation: none !important; }
</style>
