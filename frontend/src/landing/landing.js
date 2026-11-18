// Guest landing page for the Procurement Hub: rotating dotted globe hero, horizon glow
// transition, pinned stats and the scrubbed "Our modules" scroll scene.
// Plain DOM + canvas; everything after the load sequence is driven by scroll.
import { createGlobe } from './globe.js'

export const MEDIA = {
  clip1080: 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/409763c0-95f4-49d3-a601-dc564d55072b.mp4',
  clip720: 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/b3718419-7a0a-478d-bfb0-0ff8bef7f3f7.mp4',
  poster: 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/2307e4bf-be39-42b4-b579-e168aeccabf0.jpg',
  port: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261116_131941_31d10ef7-4bff-4a6b-94a7-27e15c950f26.png&w=1200&q=85',
}

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
const easeInOutQuad = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)
const easeOutCubic = (k) => 1 - (1 - k) ** 3

const CLIP_DUR = 4.04
const A = 2.4 // screens of scroll for the clip


const SH = (c, i) => `${c}em 0 0 rgba(47,99,255,${i[0]}), ${i[1]}em 0 0 rgba(17,17,17,${i[2]})`
const GLITCH = [
  { offset: 0, opacity: 0, clipPath: 'inset(0 100% 0 0)', transform: 'translateX(-.05em)', textShadow: SH(-0.12, [0.8, 0.07, 0.25]) },
  { offset: 0.3, opacity: 1, clipPath: 'inset(0 38% 0 0)', transform: 'translateX(.035em)', textShadow: SH(0.09, [0.65, -0.05, 0.3]) },
  { offset: 0.55, opacity: 0.8, clipPath: 'inset(0 0% 0 0)', transform: 'translateX(-.018em)', textShadow: SH(-0.045, [0.55, 0.025, 0.2]) },
  { offset: 0.78, opacity: 1, clipPath: 'inset(0 0% 0 0)', transform: 'translateX(.008em)', textShadow: SH(0.015, [0.35, 0, 0]) },
  { offset: 1, opacity: 1, clipPath: 'inset(0 0% 0 0)', transform: 'translateX(0em)', textShadow: SH(0, [0, 0, 0]) },
]

// cubic-bezier(x1,y1,x2,y2) evaluated at x (bisection)
function bezier(x1, y1, x2, y2, x) {
  const f = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2
    if (f(m, x1, x2) < x) lo = m
    else hi = m
  }
  return f((lo + hi) / 2, y1, y2)
}

export function initLanding(root, { reduced = false } = {}) {
  const de = document.documentElement
  const $ = (s) => root.querySelector(s)
  const $$ = (s) => [...root.querySelectorAll(s)]
  const rec = new URLSearchParams(location.search).get('rec') === '1'

  const hwrap = $('.hwrap')
  const hero = $('.hero')
  const hf = $('.hf')
  const copy = $('.copy')
  const h1 = $('.hl')
  const lines = $$('.hl .ln')
  const navEls = [$('.logo'), ...$$('.vnav a')]
  const gwrap = $('.gwrap')
  const canvas = $('.globe')
  const globe = createGlobe(canvas, { reduced })
  const hz = $('.hz')
  const stats = $('.stats')
  const big = $('.big')
  const track = $('.track')
  const scene = $('.scene')
  const video = $('.scene video')
  const giant = $('.giant')
  const strip = $('.strip')
  const cards = $$('.mcard')
  const kmh = $('.kmh b')

  de.classList.add('lp-on', 'js-anim')
  if (reduced) de.classList.add('anim-done')

  // ---------------------------------------------------------------- state
  const L = {} // layout metrics
  let dur = CLIP_DUR
  let cur = 0
  let speed = 0
  let lastY = scrollY
  let lastT = performance.now()
  let entranceDone = reduced
  let lastK = -1
  const t0 = performance.now()
  const timers = []

  // ---------------------------------------------------------------- layout
  function fit(el, lns, avail, on) {
    el.style.fontSize = ''
    if (!on) return
    const w = Math.max(...lns.map((l) => l.getBoundingClientRect().width))
    if (w > avail) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * avail) / w + 'px'
  }

  function pickSource(vw) {
    const src = vw > 900 ? MEDIA.clip1080 : MEDIA.clip720
    if (video.getAttribute('src') !== src) {
      video.setAttribute('src', src)
      video.load()
    }
  }

  function layout() {
    const vw = de.clientWidth
    const vh = de.clientHeight
    const port = vw <= vh
    const land = !port && vh < 500
    const hp = port || land || vw < 768
    const sticky = !port && !land
    de.classList.toggle('m-port', port)
    de.classList.toggle('m-land', land)
    de.classList.toggle('m-hp', hp)
    de.classList.toggle('sticky', sticky)

    const uc = vh < 520 ? Math.min(vw / 1440, Math.max(vh / 900, 0.6)) : Math.min(vw / 1440, vh / 900)
    const us = vw / 1440
    const u = land ? vh / 430 : hp ? Math.min(vw / 430, 1.4) : Math.min(vw / 1440, vh / 960)
    de.style.setProperty('--uc', uc + 'px')
    de.style.setProperty('--us', us + 'px')
    de.style.setProperty('--u', u + 'px')

    // hero
    hero.style.height = ''
    hf.style.top = port ? '' : Math.max(0, (vh - 900 * uc) / 2) + 'px'
    fit(h1, lines, copy.clientWidth, port)
    fit(big, $$('.big .ln'), stats.clientWidth - 44, port || land)
    if (land) {
      const cb = hf.offsetTop + copy.offsetTop + copy.offsetHeight
      hero.style.height = Math.max(vh, 900 * uc, cb + 28) + 'px'
    }
    const heroH = hero.offsetHeight
    const uv = Math.max(vw / 1440, heroH / 900)
    de.style.setProperty('--uv', uv + 'px')
    const wrapH = sticky ? 1.65 * vh : Math.max(1.65 * vh, heroH + 0.12 * vh)
    hwrap.style.height = wrapH + 'px'
    const wrapTop = hwrap.getBoundingClientRect().top + scrollY
    Object.assign(L, { vw, vh, port, land, hp, sticky, uv, heroH, wrapBottom: wrapTop + wrapH, heroBottom: wrapTop + heroH })

    // globe canvas
    const cw = gwrap.clientWidth
    const ch = gwrap.clientHeight
    let up, ox, oy
    if (port) {
      up = (1.25 * vw) / 800
      ox = cw - 1440 * up
      oy = 16 - 300 * up // sphere top tucked above the box so South Africa sits in view
    } else {
      up = uv
      ox = cw - 1440 * uv
      oy = Math.min(0, (heroH - 900 * uv) / 2)
    }
    globe.resize(cw, ch, { up, ox, oy, smallLabels: port })

    // services scene
    pickSource(vw)
    let w, h, left, top
    if (hp) {
      w = 1.55 * vw
      h = (w * 1080) / 1920
      left = vw / 2 - 0.4 * w
      top = 0.36 * vh - 0.448 * h
    } else {
      const s = Math.max(vw / 1920, vh / 1080)
      w = 1920 * s
      h = 1080 * s
      left = (vw - w) / 2
      top = (vh - h) / 2
    }
    Object.assign(video.style, { width: w + 'px', height: h + 'px', left: left + 'px', top: top + 'px' })
    scene.style.setProperty('--edge-px', top + 0.448 * h + 'px')
    scene.style.setProperty('--gl', top + 0.9 * h + 'px')
    const stripW = strip.scrollWidth
    const lettersW = giant.scrollWidth
    const B = ((stripW + 0.45 * vw) / vw) * 1.1
    track.style.height = (1 + A + B) * vh + 'px'
    Object.assign(L, { stripW, lettersW, B, trackTop: track.getBoundingClientRect().top + scrollY })
    lastK = -1
  }

  // ---------------------------------------------------------------- hero + glow
  function updateHero(y, now) {
    const { vh, vw } = L
    const e = (L.wrapBottom - y) / vh - 0.47

    // horizon glow
    const op = 1 - easeInOutQuad(clamp((-0.12 - e) / 0.4))
    if (e > 1.04 || op < 0.002) {
      hz.style.display = 'none'
    } else {
      const d = e > 0.12 ? e : -0.03 + 0.15 * Math.exp((e - 0.12) / 0.15)
      const Rx = Math.max(0.75 * vw, 0.9 * vh)
      const Ry = 0.72 * vh
      const s = (m) => (m * Rx).toFixed(1) + 'px'
      hz.style.display = 'block'
      hz.style.opacity = op
      hz.style.background = `radial-gradient(${Rx.toFixed(1)}px ${Ry.toFixed(1)}px at 50% ${(d * vh - Ry).toFixed(1)}px,
        rgba(255,255,255,0) 0px, rgba(238,242,255,0) ${s(0.985)}, rgba(214,224,255,.6) ${s(1)}, #9fb2ff ${s(1.06)},
        #5a80ff ${s(1.14)}, #2f63ff ${s(1.236)}, #5a80ff ${s(1.32)}, #a9bcff ${s(1.42)}, #dfe6ff ${s(1.53)}, #ffffff ${s(1.65)})`
    }
    if (L.sticky) hero.style.visibility = e < -0.06 ? 'hidden' : ''

    // copy, headline glitch-out, nav
    const k = clamp((0.95 - e) / 0.42)
    if (k !== lastK) {
      lastK = k
      copy.style.opacity = k ? 1 - k : ''
      copy.style.transform = k ? `translateY(${-5 * k}vh)` : ''
      if (entranceDone) {
        const j = k > 0 && k < 1 ? ((Math.floor(k * 16) * 9301 + 49297) % 233280) / 233280 - 0.5 : 0
        lines.forEach((ln, i) => {
          if (!k) {
            ln.style.transform = ln.style.textShadow = ln.style.clipPath = ''
            return
          }
          const o = j * 0.09 * (i % 2 ? -1 : 1)
          ln.style.transform = `translateX(${o}em)`
          ln.style.textShadow = `${-1.6 * o}em 0 0 rgba(47,99,255,${0.7 * k + 0.15}), ${0.8 * o}em 0 0 rgba(17,17,17,.25)`
          ln.style.clipPath = `inset(0 ${k * k * 100}% 0 0)`
        })
      }
      const n = 1 - clamp((0.85 - e) / 0.4)
      navEls.forEach((el) => (el.style.opacity = n < 1 ? n : ''))
    }

    // globe
    const on = e > -0.1 && (L.sticky || y < L.heroBottom)
    if (on) {
      canvas.style.opacity = 0.45 + 0.55 * clamp(e / 0.7)
      globe.draw((now - t0) / 1000)
    }
  }

  // ---------------------------------------------------------------- services
  function updateServices(y, instant) {
    const { vh, vw } = L
    const rel = y - L.trackTop
    if (rel < -vh * 1.5 || rel > (1 + A + L.B) * vh) return null
    const q = clamp(rel / (A * vh))
    const target = q * (dur - 1 / 48)
    cur = instant ? target : cur + (target - cur) * 0.2
    if (!instant && video.readyState >= 1 && !video.seeking && Math.abs(video.currentTime - cur) > 1 / 60) {
      video.currentTime = cur
    }
    scene.classList.toggle('settled', q >= 0.94)
    const r = clamp((rel - A * vh) / (L.B * vh))
    strip.style.transform = `translate3d(${vw - r * (L.stripW + 0.45 * vw)}px,0,0)`
    giant.style.transform = `translate3d(${vw - r * (L.lettersW + vw)}px,0,0)`
    kmh.textContent = String(Math.min(99, Math.round(speed))).padStart(2, '0')
    if (r > 0) {
      for (const c of cards) {
        const s = clamp((0.98 - c.getBoundingClientRect().left / vw) / 0.3, -0.4, 1.6) * 100
        c.style.setProperty('--s', s.toFixed(1) + '%')
      }
    }
    return target
  }
  const onSeeked = () => {
    if (Math.abs(video.currentTime - cur) > 1 / 60) video.currentTime = cur
  }
  const onMeta = () => {
    if (isFinite(video.duration) && video.duration > 0) dur = video.duration
  }
  video.addEventListener('seeked', onSeeked)
  video.addEventListener('loadedmetadata', onMeta)

  // ---------------------------------------------------------------- loop
  let raf = 0
  function frame(now) {
    const y = scrollY
    const dt = Math.max(1, now - lastT) / 1000
    speed += (Math.abs(y - lastY) / dt / 32 - speed) * 0.1
    lastY = y
    lastT = now
    updateHero(y, now)
    updateServices(y)
    if (!rec) raf = requestAnimationFrame(frame)
  }

  // ---------------------------------------------------------------- entrance animations
  const done = (el) => () => el.classList.remove('ent')
  function fadeUp(el, delay, duration, dy) {
    if (!el) return
    el.animate([{ opacity: 0, transform: `translateY(${dy}px)` }, { opacity: 1, transform: 'none' }], {
      duration,
      delay,
      easing: 'cubic-bezier(.2,.7,.2,1)',
      fill: 'backwards',
    }).finished.then(done(el), () => {})
  }
  function glitch(el, delay) {
    const a = el.animate(GLITCH, { duration: 900, delay, easing: 'steps(14, end)', fill: 'backwards' })
    a.finished.then(done(el), () => {})
    return a
  }

  if (!reduced) {
    fadeUp(navEls[0], 0, 700, 8)
    navEls.slice(1).forEach((el, i) => fadeUp(el, 70 * (i + 1), 700, 8))
    fadeUp($('.over'), 150, 700, 10)
    const last = lines.map((ln, i) => glitch(ln, 260 + i * 130)).pop()
    last?.finished.then(() => ((entranceDone = true), (lastK = -1)), () => {})
    fadeUp($('.lede'), 900, 800, 14)
    fadeUp($('.btns'), 1040, 800, 14)
    timers.push(
      setTimeout(() => {
        de.classList.add('anim-done')
        entranceDone = true
        lastK = -1
      }, 4000),
    )
  }

  // ---------------------------------------------------------------- stats reveals
  const fmt = (el, v) => {
    const f = el.dataset.fmt
    const n = f === 'pct' ? Math.round(v) + '%' : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    return n + (el.dataset.suffix || '')
  }
  const counters = $$('.nums .n[data-to]')
  if (!reduced) counters.forEach((el) => (el.textContent = fmt(el, 0)))

  function count(el) {
    const to = parseFloat(el.dataset.to)
    const start = performance.now()
    const step = (now) => {
      const k = clamp((now - start) / 1600)
      el.textContent = fmt(el, to * easeOutCubic(k))
      if (k < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }
  const ease = 'cubic-bezier(.7,0,.2,1)'
  const reveals = new Map()
  reveals.set($('.ph'), (ph) => {
    ph.animate([{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)' }], { duration: 1100, easing: ease, fill: 'backwards' })
      .finished.then(() => ph.classList.remove('ent-clip'), () => {})
    ph.firstElementChild.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 1600, easing: 'cubic-bezier(.2,.7,.2,1)' })
    fadeUp($('.intro'), 250, 900, 14)
  })
  reveals.set(big, () => $$('.big .ln').forEach((ln, i) => glitch(ln, i * 130)))
  $$('.nums li').forEach((li) =>
    reveals.set(li, () => {
      fadeUp(li, 0, 700, 12)
      const n = li.querySelector('.n')
      glitch(n, 60)
      li.querySelector('.hline')?.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
        duration: 900,
        delay: 60,
        easing: ease,
        fill: 'backwards',
      })
      if (n.dataset.to) setTimeout(() => count(n), 60)
    }),
  )
  let io = null
  if (reduced) {
    $$('.stats .ent, .stats .ent-clip').forEach((el) => el.classList.remove('ent', 'ent-clip'))
  } else {
    io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue
          io.unobserve(en.target)
          reveals.get(en.target)?.(en.target)
        }
      },
      { threshold: 0, rootMargin: '0px 0px -15% 0px' },
    )
    reveals.forEach((_, el) => el && io.observe(el))
  }

  // ---------------------------------------------------------------- wiring
  let rq = 0
  const onResize = () => {
    cancelAnimationFrame(rq)
    rq = requestAnimationFrame(() => {
      layout()
      if (rec) frame(performance.now())
    })
  }
  addEventListener('resize', onResize)
  layout()
  document.fonts?.ready.then(onResize)
  if ('fonts' in document) document.fonts.addEventListener?.('loadingdone', onResize)

  if (rec) {
    let prevY = null
    window.__recTime = (v, t) => {
      const p = t < 0.44 ? 0 : t > 10.56 ? 1 : bezier(0.4, 0.05, 0.55, 0.95, (t - 0.44) / 10.12)
      const y = L.trackTop + p * (A + L.B) * L.vh
      scrollTo(0, y)
      speed = prevY === null ? 0 : Math.min(99, (Math.abs(y - prevY) * 60) / 32)
      prevY = y
      updateHero(y, t0 + t * 1000)
      return updateServices(y, true)
    }
    frame(performance.now())
  } else {
    raf = requestAnimationFrame(frame)
  }

  return function destroy() {
    cancelAnimationFrame(raf)
    cancelAnimationFrame(rq)
    timers.forEach(clearTimeout)
    io?.disconnect()
    removeEventListener('resize', onResize)
    document.fonts?.removeEventListener?.('loadingdone', onResize)
    video.removeEventListener('seeked', onSeeked)
    video.removeEventListener('loadedmetadata', onMeta)
    if (rec) delete window.__recTime
    de.classList.remove('lp-on', 'js-anim', 'anim-done', 'm-port', 'm-land', 'm-hp', 'sticky')
    ;['--uc', '--us', '--u', '--uv'].forEach((p) => de.style.removeProperty(p))
  }
}
