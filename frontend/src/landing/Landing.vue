<template>
  <div ref="root" class="lp">
    <!-- 1. Globe hero -->
    <div id="top" class="hwrap">
      <section class="hero">
        <div class="gwrap"><canvas class="globe" aria-hidden="true" /></div>
        <div class="hf">
          <a class="logo ent" href="#top" :aria-label="company">
            <img v-if="brand.logo && !logoFailed" :src="brand.logo" alt="" @error="logoFailed = true" />
            <span v-else class="wm">{{ initials }}</span>
          </a>
          <div class="copy">
            <p class="over ent">Procure to pay</p>
            <h1 class="hl">
              <span class="ln ent">One flow</span>
              <span class="ln ent">for every</span>
              <span class="ln ent">purchase</span>
            </h1>
            <p class="lede ent">Requests, quotes, orders, receipts and payments, run as one flow on one source of truth.</p>
            <div class="btns ent">
              <a class="b fill" href="#signin" @click.prevent="signIn">Sign in</a>
            </div>
          </div>
        </div>
      </section>
    </div>
    <div class="hz" aria-hidden="true" />

    <!-- 2. Stats -->
    <section id="about" class="stats">
      <div class="pin">
        <div class="ph ent-clip"><i :style="{ backgroundImage: `url(${MEDIA.port})` }" /></div>
        <h2 class="big">
          <span class="ln ent">We source</span>
          <span class="ln ent">smarter.</span>
          <span class="ln ent">We pay</span>
          <span class="ln ent">on time.</span>
        </h2>
      </div>
      <div class="col">
        <div class="intro ent">
          <p>With every purchasing step in one hub, your spend moves the way your business demands.</p>
          <p>From requisition to RFQ, purchase order to goods receipt and invoice to payment, every document stays on standard ERPNext, so buyers, stores, finance and suppliers see the same truth.</p>
          <div class="links">
            <a href="#services">Our modules</a>
            <a href="#signin" @click.prevent="signIn">Sign in</a>
          </div>
        </div>
        <ul class="nums">
          <li v-for="(s, i) in STATS" :key="s.c" class="ent">
            <span v-if="i" class="hline" />
            <div class="n" :data-to="s.to" :data-fmt="s.fmt">{{ s.n }}</div>
            <div class="c">{{ s.c }}</div>
          </li>
        </ul>
      </div>
    </section>

    <!-- 3. Modules scroll scene -->
    <section id="services" class="track">
      <div class="scene">
        <video muted playsinline preload="auto" :poster="MEDIA.poster" aria-hidden="true" />
        <div class="giant" aria-hidden="true">Our modules</div>
        <div class="kmh" aria-hidden="true"><b>00</b> KM/H</div>
        <div class="band">
          <div class="strip">
            <div class="lead">
              <h2>Everything your<br />purchasing needs.<br /><em>Under one hub.</em></h2>
              <div class="ps">
                <p>From the first requisition to the final payment, every procurement step runs on the documents your team already trusts.</p>
                <p>One hub means one inbox for approvals, one view of every supplier and full visibility from request to payment.</p>
              </div>
            </div>
            <div class="cards">
              <article v-for="c in CARDS" :key="c.t" class="mcard">
                <svg viewBox="0 0 24 24" aria-hidden="true" v-html="c.icon" />
                <h3>{{ c.t[0] }}<br />{{ c.t[1] }}</h3>
                <p>{{ c.b }}</p>
              </article>
            </div>
          </div>
          <a class="pill" href="#signin" @click.prevent="signIn">Sign in to the hub</a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { initLanding, MEDIA } from './landing.js'

const props = defineProps({ brand: { type: Object, default: () => ({}) } })
const emit = defineEmits(['signin'])
const root = ref(null)
const logoFailed = ref(false)
const company = computed(() => props.brand.company || 'Procurement Hub')
const initials = computed(() =>
  (props.brand.abbr || company.value.split(/\s+/).map((w) => w[0]).join('')).replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase(),
)

const STATS = [
  { n: '7', to: 7, fmt: 'int', c: 'Linked documents, requisition to payment' },
  { n: '100%', to: 100, fmt: 'pct', c: 'Standard ERPNext documents, no shadow data' },
  { n: '3-WAY', c: 'Match across order, receipt and invoice' },
  { n: '1-CLICK', c: 'Award from bid comparison to purchase order' },
  { n: '24/7', c: 'Supplier portal for quotes, orders and invoices' },
]

const CARDS = [
  {
    t: ['Requisitions', '& RFQs'],
    icon: '<rect x="5" y="4" width="14" height="17" rx="1.5"/><path d="M9 4V2.8h6V4M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
    b: 'Raise purchase requisitions, invite suppliers to quote and follow every request from draft to ordered.',
  },
  {
    t: ['Bid', 'comparison'],
    icon: '<path d="M12 3v18M7 21h10M4 7h16M6.5 7 3.5 14h6L6.5 7ZM17.5 7l-3 7h6l-3-7Z"/>',
    b: 'Supplier quotations side by side, lowest prices marked, and one click to award the winner a purchase order.',
  },
  {
    t: ['Purchase', 'orders'],
    icon: '<path d="M2.5 4h2.6l2.3 11h10.8l2.3-8H6.2"/><circle cx="9" cy="19.2" r="1.4"/><circle cx="17" cy="19.2" r="1.4"/>',
    b: 'Approve from your inbox, track what is still to receive and to bill, and keep every order on budget.',
  },
  {
    t: ['Goods receipt', '& inventory'],
    icon: '<path d="M3 9.5 12 4l9 5.5V20H3V9.5Z"/><path d="M7 20v-7h10v7M7 16.5h10"/>',
    b: 'Receive against the order, update stock by warehouse and replenish anything below its reorder level.',
  },
  {
    t: ['Invoices', '& payments'],
    icon: '<path d="M6 2.8h8.5L19 7.3V21H6V2.8Z"/><path d="M14.5 2.8v4.5H19"/><path d="m9 14 2.3 2.3L16 11.6"/>',
    b: 'Payables aging, overdue invoices and one-click payment entries, so suppliers are paid on time.',
  },
  {
    t: ['Supplier', 'portal'],
    icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3Z"/>',
    b: 'Suppliers quote on RFQs, acknowledge purchase orders and follow their invoices in their own portal.',
  },
]

function signIn() {
  emit('signin')
}

let destroy = null
onMounted(() => {
  document.title = `${company.value} · Procurement Hub`
  let meta = document.querySelector('meta[name="description"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'description'
    document.head.appendChild(meta)
  }
  meta.content = 'Requisitions, RFQs, purchase orders, goods receipts, invoices and payments, run as one flow on one source of truth.'
  destroy = initLanding(root.value, { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches })
})
onBeforeUnmount(() => destroy?.())
</script>

<style>
/* Everything is scoped under html.lp-on / .lp so nothing leaks into the app shell. */
html.lp-on {
  --ink: #111111;
  --cobalt: #2f63ff;
  --cobalt-h: #1f4fe0;
  --muted: #5d6270;
  --muted2: #6b6f78;
  --hair: #d9dbe0;
  --anton: 'Anton', Impact, sans-serif;
  --archivo: 'Archivo', system-ui, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, monospace;
  background: #fff;
  color-scheme: light;
}
html.lp-on body {
  background: #fff;
  color: var(--ink);
  font-family: var(--archivo);
  font-size: 16px;
  overflow-x: clip;
}
.lp, .lp * { box-sizing: border-box; margin: 0; padding: 0; }
.lp { position: relative; background: #fff; color: var(--ink); font-family: var(--archivo); }
.lp a { color: inherit; text-decoration: none; }
.lp a:hover { text-decoration: none; }
.lp ul { list-style: none; }
html.js-anim .lp .ent { opacity: 0; }
html.js-anim .lp .ent-clip { clip-path: inset(100% 0 0 0); }
html.anim-done .lp .ent { opacity: 1; }
html.anim-done .lp .ent-clip { clip-path: none; }

/* ---------- 1. Hero ---------- */
.lp .hwrap { position: relative; }
.lp .hero { position: relative; z-index: 1; height: 100vh; height: 100svh; overflow: hidden; background: #fff; }
html.sticky .lp .hero { position: fixed; top: 0; left: 0; right: 0; }
.lp .gwrap { position: absolute; inset: 0; }
.lp .globe { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.lp .hf { position: absolute; left: 0; width: calc(var(--uc) * 1440); height: calc(var(--uc) * 900); }
.lp .logo { position: absolute; left: calc(var(--uc) * 40); top: calc(var(--uc) * 36); display: block; min-width: calc(var(--uc) * 71); }
.lp .logo img { display: block; height: calc(var(--uc) * 31); width: auto; max-width: calc(var(--uc) * 150); object-fit: contain; }
.lp .logo .wm { display: block; font-family: var(--anton); font-size: calc(var(--uc) * 41); line-height: 0.76; letter-spacing: -0.01em; color: var(--ink); }
.lp .copy { position: absolute; left: calc(var(--uc) * 218); top: calc(var(--uc) * 294); width: calc(var(--uc) * 560); }
.lp .over {
  font-family: var(--archivo); font-weight: 700; font-size: max(calc(var(--uc) * 19.2), 12px); line-height: 1;
  text-transform: uppercase; letter-spacing: -0.005em; color: var(--cobalt);
}
.lp .hl {
  margin-top: calc(var(--uc) * 7); font-family: var(--anton); font-weight: 400; text-transform: uppercase;
  font-size: calc(var(--uc) * 114.3); line-height: 0.953; letter-spacing: -0.004em; color: var(--ink);
}
.lp .ln { display: block; width: fit-content; white-space: nowrap; }
.lp .lede {
  margin-top: calc(var(--uc) * 21); font-size: max(calc(var(--uc) * 18.2), 13px); line-height: 1.45;
  color: var(--muted); max-width: max(calc(var(--uc) * 418), 250px);
}
.lp .btns { margin-top: calc(var(--uc) * 19); display: flex; flex-wrap: wrap; gap: calc(var(--uc) * 15); }
.lp .b {
  display: inline-flex; align-items: center; height: max(calc(var(--uc) * 40), 34px); padding: 0 max(calc(var(--uc) * 25), 16px);
  border-radius: 999px; border: 1.3px solid var(--cobalt); font-family: var(--mono); font-weight: 400;
  font-size: max(calc(var(--uc) * 12), 11px); letter-spacing: 0.09em; text-transform: uppercase;
  color: var(--cobalt); background: transparent; transition: background-color 0.25s, color 0.25s, border-color 0.25s;
}
.lp .b:hover { background: var(--cobalt); color: #fff; }
.lp .b.fill { background: var(--cobalt); color: #fff; }
.lp .b.fill:hover { background: var(--cobalt-h); border-color: var(--cobalt-h); }

/* horizon glow */
.lp .hz { position: fixed; inset: 0; z-index: 2; pointer-events: none; display: none; }

/* ---------- 2. Stats ---------- */
.lp .stats { position: relative; z-index: 3; background: transparent; }
.lp .pin { position: sticky; top: min(0px, calc(100vh - var(--us) * 900)); height: calc(var(--us) * 900); z-index: 1; }
.lp .col { position: relative; margin-top: calc(var(--us) * -900); height: calc(var(--us) * 1341); }
.lp .ph { position: absolute; left: calc(var(--us) * 64); top: calc(var(--us) * 93); width: calc(var(--us) * 440); height: calc(var(--us) * 236); overflow: hidden; background: #1d3b44; }
.lp .ph i { position: absolute; inset: 0; background: #1d3b44 50% 50% / cover no-repeat; }
.lp .big {
  position: absolute; left: calc(var(--us) * 64); top: calc(var(--us) * 383); font-family: var(--anton); font-weight: 400;
  text-transform: uppercase; font-size: calc(var(--us) * 105); line-height: 1; letter-spacing: 0.02em; color: var(--ink);
}
.lp .intro {
  position: absolute; left: calc(var(--us) * 594); top: calc(var(--us) * 117); width: calc(var(--us) * 440);
  font-size: max(calc(var(--us) * 17.9), 12.5px); line-height: 1.36; color: var(--muted2);
}
.lp .intro p + p { margin-top: calc(var(--us) * 24); }
.lp .intro .links { margin-top: calc(var(--us) * 22); display: flex; flex-wrap: wrap; gap: calc(var(--us) * 26); }
.lp .intro .links a { color: var(--ink); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.28em; transition: color 0.25s; }
.lp .intro .links a:hover { color: var(--cobalt); text-decoration: underline; }
.lp .nums { position: absolute; left: calc(var(--us) * 993); top: calc(var(--us) * 371); width: calc(var(--us) * 384); }
.lp .nums li { position: relative; height: calc(var(--us) * 166); }
.lp .hline { position: absolute; left: 0; right: 0; top: calc(var(--us) * -16); height: 1px; background: var(--hair); transform-origin: 0 50%; }
.lp .nums .n {
  display: block; width: fit-content; font-family: var(--anton); font-size: calc(var(--us) * 82); line-height: 1;
  color: var(--cobalt); font-variant-numeric: tabular-nums; white-space: nowrap;
}
.lp .nums .c { margin-top: calc(var(--us) * 6); font-size: max(calc(var(--us) * 17), 11.5px); color: var(--muted2); }

/* ---------- 3. Modules scene ---------- */
.lp .track { position: relative; z-index: 4; background: #fff; }
.lp .scene {
  position: sticky; top: 0; height: 100vh; height: 100lvh; overflow: hidden;
  background: linear-gradient(#fff 0, #fff var(--gl, 90%), #111 var(--gl, 90%));
}
.lp .scene video { position: absolute; display: block; object-fit: cover; }
.lp .giant {
  position: absolute; left: 0; top: calc(var(--edge-px) - var(--u) * 264); width: max-content; font-family: var(--anton);
  font-size: calc(var(--u) * 330); line-height: 0.8; color: #e9e9e9; white-space: nowrap; text-transform: uppercase;
  mix-blend-mode: darken; pointer-events: none; will-change: transform; transform: translate3d(100vw, 0, 0);
}
.lp .kmh {
  position: absolute; left: calc(var(--u) * 26); top: calc(var(--u) * 52); font-family: var(--mono);
  font-size: calc(var(--u) * 10.5); letter-spacing: 0.06em; color: var(--ink); opacity: 0; transition: opacity 0.5s;
}
.lp .kmh b { font-weight: 400; font-variant-numeric: tabular-nums; }
.lp .scene.settled .kmh { opacity: 1; }
.lp .band { position: absolute; left: 0; right: 0; top: var(--edge-px); bottom: 0; color: #fff; }
.lp .strip {
  position: absolute; left: 0; top: calc(var(--u) * 76); display: flex; align-items: flex-start; gap: calc(var(--u) * 120);
  width: max-content; will-change: transform; transform: translate3d(100vw, 0, 0);
}
.lp .lead { display: flex; gap: calc(var(--u) * 64); flex: none; }
.lp .lead h2 { font-family: var(--anton); font-weight: 400; font-size: calc(var(--u) * 64); line-height: 0.98; white-space: nowrap; text-transform: uppercase; }
.lp .lead h2 em { font-style: normal; color: var(--cobalt); }
.lp .lead .ps { width: calc(var(--u) * 250); font-size: calc(var(--u) * 12); line-height: 1.5; color: rgba(255, 255, 255, 0.62); }
.lp .lead .ps p + p { margin-top: 1em; }
.lp .cards { display: flex; flex: none; }
.lp .mcard { width: calc(var(--u) * 270); padding: 0 calc(var(--u) * 30); border-left: 1px solid rgba(255, 255, 255, 0.12); flex: none; --s: -40%; }
.lp .mcard:first-child { border-left: 0; }
.lp .mcard svg { display: block; width: calc(var(--u) * 38); height: calc(var(--u) * 38); fill: none; stroke: #fff; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
.lp .mcard h3, .lp .mcard p {
  background-image: linear-gradient(90deg, #fff calc(var(--s) - 34%), #2f63ff calc(var(--s) - 6%), transparent calc(var(--s) + 26%));
  -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;
}
.lp .mcard h3 { margin-top: calc(var(--u) * 22); font-family: var(--anton); font-weight: 400; font-size: calc(var(--u) * 26); line-height: 1.05; text-transform: uppercase; }
.lp .mcard p { margin-top: calc(var(--u) * 14); font-size: calc(var(--u) * 12.4); line-height: 1.5; }
.lp .pill {
  position: absolute; left: 50%; bottom: calc(var(--u) * 36); padding: calc(var(--u) * 11) calc(var(--u) * 22);
  border: 1px solid rgba(255, 255, 255, 0.7); border-radius: 999px; font-family: var(--archivo); font-weight: 500;
  font-size: calc(var(--u) * 10); letter-spacing: 0.1em; text-transform: uppercase; color: #fff; white-space: nowrap;
  opacity: 0; transform: translate(-50%, 24px); pointer-events: none;
  transition: opacity 0.6s cubic-bezier(.2,.7,.2,1), transform 0.6s cubic-bezier(.2,.7,.2,1), background-color 0.25s, color 0.25s;
}
.lp .scene.settled .pill { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
.lp .pill:hover { background: #fff; color: var(--ink); }

/* ---------- Portrait (phones + portrait tablets) ---------- */
html.m-port .lp .hero { height: auto; min-height: 100svh; display: flex; flex-direction: column; }
html.m-port .lp .hf { position: relative; top: auto; width: auto; height: auto; padding: 22px 22px 0; }
html.m-port .lp .logo { position: static; display: inline-block; min-width: 58px; }
html.m-port .lp .logo .wm { font-size: 34px; }
html.m-port .lp .logo img { height: 26px; max-width: 140px; }
html.m-port .lp .copy { position: static; width: auto; margin-top: clamp(44px, 9vh, 96px); }
html.m-port .lp .over { font-size: 14px; }
html.m-port .lp .hl { font-size: min(23vw, 150px); margin-top: 12px; }
html.m-port .lp .lede { font-size: 15px; max-width: 420px; margin-top: 20px; }
html.m-port .lp .btns { margin-top: 22px; gap: 10px; }
html.m-port .lp .b { height: 40px; padding: 0 20px; font-size: 11px; }
html.m-port .lp .gwrap {
  position: relative; inset: auto; order: 2; flex: none; height: 98vw; overflow: hidden;
  -webkit-mask-image: linear-gradient(#000 72%, transparent); mask-image: linear-gradient(#000 72%, transparent);
}

/* ---------- Stacked stats (portrait + short landscape) ---------- */
html.m-port .lp .stats, html.m-land .lp .stats { display: flex; flex-direction: column; padding: 56px 22px 72px; }
html.m-port .lp .pin, html.m-port .lp .col, html.m-land .lp .pin, html.m-land .lp .col { display: contents; }
html.m-port .lp .ph, html.m-land .lp .ph { position: relative; left: auto; top: auto; order: 1; width: 100%; max-width: 620px; height: auto; aspect-ratio: 440 / 236; }
html.m-port .lp .intro, html.m-land .lp .intro { position: static; order: 2; width: auto; max-width: 520px; margin-top: 28px; font-size: 15px; }
html.m-port .lp .intro p + p, html.m-land .lp .intro p + p { margin-top: 16px; }
html.m-port .lp .intro .links, html.m-land .lp .intro .links { margin-top: 18px; gap: 22px; }
html.m-port .lp .big, html.m-land .lp .big { position: static; order: 3; margin-top: 48px; font-size: min(15.5vw, 120px); }
html.m-port .lp .nums, html.m-land .lp .nums { position: static; order: 4; width: auto; margin-top: 44px; }
html.m-port .lp .nums li, html.m-land .lp .nums li { height: auto; padding: 18px 0; }
html.m-port .lp .hline, html.m-land .lp .hline { top: 0; }
html.m-port .lp .nums .n, html.m-land .lp .nums .n { font-size: min(19vw, 100px); }
html.m-port .lp .nums .c, html.m-land .lp .nums .c { margin-top: 6px; font-size: 14px; }

/* ---------- Modules scene, phone framing ---------- */
html.m-hp .lp .lead { flex-direction: column; gap: calc(var(--u) * 22); }
html.m-hp .lp .lead h2 { font-size: calc(var(--u) * 46); }
html.m-hp .lp .lead .ps { width: calc(var(--u) * 300); font-size: calc(var(--u) * 13); }
html.m-hp .lp .mcard { width: calc(var(--u) * 250); }
html.m-hp .lp .mcard p { font-size: calc(var(--u) * 13); }
html.m-hp .lp .kmh { font-size: 11px; left: 20px; top: 22px; }

/* ---------- Short landscape phones ---------- */
html.m-land .lp .strip { top: calc(var(--u) * 14); gap: calc(var(--u) * 48); }
html.m-land .lp .lead { flex-direction: row; gap: calc(var(--u) * 28); }
html.m-land .lp .lead h2 { font-size: calc(var(--u) * 34); }
html.m-land .lp .lead .ps { width: calc(var(--u) * 230); font-size: max(calc(var(--u) * 12), 10px); }
html.m-land .lp .mcard { width: calc(var(--u) * 240); }
html.m-land .lp .mcard svg { width: calc(var(--u) * 30); height: calc(var(--u) * 30); }
html.m-land .lp .mcard h3 { font-size: calc(var(--u) * 22); margin-top: calc(var(--u) * 12); }
html.m-land .lp .mcard p { font-size: max(calc(var(--u) * 12), 10px); }
html.m-land .lp .pill { bottom: calc(var(--u) * 12); }

@media (prefers-reduced-motion: reduce) {
  .lp .kmh, .lp .pill { transition: none; }
}
</style>
