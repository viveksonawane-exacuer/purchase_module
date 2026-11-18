// Dotted, rotating 3D globe (orthographic canvas render) shared by the landing page and the sign-in screen.
// The globe lives in a 1440 x 900 design frame: centre (1166, 530), radius 400, scaled by `up` from origin (ox, oy).
import DOTS from './landdots.json'

const D2R = Math.PI / 180
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)

// Supplier lanes drawn on the globe: India <-> South Africa ports
const CITIES = [
  { name: 'Mumbai', lat: 18.95, lon: 72.84 },
  { name: 'Chennai', lat: 13.08, lon: 80.29 },
  { name: 'Durban', lat: -29.87, lon: 31.03 },
  { name: 'Cape Town', lat: -33.91, lon: 18.43 },
]
const ROUTES = [
  [2, 0], // Durban -> Mumbai
  [2, 1], // Durban -> Chennai
  [3, 0], // Cape Town -> Mumbai
]
const VIEW_LON0 = 62 // centre meridian at load (°E): Indian Ocean, so both coasts face the viewer
const SPIN = 1.2 // ° per second (slow, so the routes stay in view longer)
const TILT = -10 * D2R // south pole tipped toward the viewer, lifting South Africa into the frame
const vec = (lat, lon) => {
  const a = lat * D2R
  const b = lon * D2R
  return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)]
}

export function createGlobe(canvas, { reduced = false } = {}) {
  const ctx = canvas.getContext('2d')
  const G = {}
  let dpr = 1
  const N = DOTS.length / 2
  const P = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const v = vec(DOTS[i * 2 + 1] / 10, DOTS[i * 2] / 10)
    P[i * 3] = v[0]
    P[i * 3 + 1] = v[1]
    P[i * 3 + 2] = v[2]
  }
  const pins = CITIES.map((c) => vec(c.lat, c.lon))
  const arcs = ROUTES.map(([a, b]) => {
    const p = pins[a]
    const q = pins[b]
    const w = Math.acos(clamp(p[0] * q[0] + p[1] * q[1] + p[2] * q[2], -1, 1))
    const lift = 0.07 + (0.42 * w) / Math.PI
    const pts = []
    for (let i = 0; i < 57; i++) {
      const t = i / 56
      const s0 = Math.sin((1 - t) * w) / Math.sin(w)
      const s1 = Math.sin(t * w) / Math.sin(w)
      const h = 1 + lift * Math.sin(Math.PI * t)
      pts.push([(s0 * p[0] + s1 * q[0]) * h, (s0 * p[1] + s1 * q[1]) * h, (s0 * p[2] + s1 * q[2]) * h])
    }
    return pts
  })

  function resize(cw, ch, { up, ox, oy, smallLabels = false }) {
    dpr = Math.min(2, devicePixelRatio || 1)
    canvas.width = Math.round(cw * dpr)
    canvas.height = Math.round(ch * dpr)
    Object.assign(G, { cw, ch, up, smallLabels, cx: ox + 1166 * up, cy: oy + 530 * up, R: 400 * up })
  }

  const buckets = [[], [], [], [], []]
  function drawGlobe(t) {
    const { cw, ch, cx, cy, R, up } = G
    const alpha = reduced ? 1 : 1 - (1 - clamp(t / 1.1)) ** 3
    const it = reduced ? 99 : t // intro clock
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cw, ch)
    ctx.globalAlpha = alpha

    // 1. haze + rim glow
    const hx = cx - 0.05 * R
    const hy = cy + 0.08 * R
    let g = ctx.createRadialGradient(hx, hy, 0.9 * R, hx, hy, 1.5 * R)
    g.addColorStop(0, 'rgba(47,99,255,.55)')
    g.addColorStop(0.12, 'rgba(90,128,255,.32)')
    g.addColorStop(0.4, 'rgba(169,188,255,.16)')
    g.addColorStop(1, 'rgba(238,242,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, cw, ch)

    // 2. sphere body
    g = ctx.createRadialGradient(cx + 0.3 * R, cy - 0.42 * R, 0.05 * R, cx + 0.1 * R, cy - 0.15 * R, 1.25 * R)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.55, '#f6f8ff')
    g.addColorStop(0.85, '#e8eeff')
    g.addColorStop(1, '#d5dfff')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fill()

    // 3. inner shading (clipped)
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.clip()
    g = ctx.createRadialGradient(cx, cy, 0.8 * R, cx, cy, R)
    g.addColorStop(0, 'rgba(47,99,255,0)')
    g.addColorStop(0.75, 'rgba(47,99,255,.10)')
    g.addColorStop(1, 'rgba(47,99,255,.42)')
    ctx.fillStyle = g
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R)
    g = ctx.createLinearGradient(cx - 0.8 * R, cy + 0.8 * R, cx + 0.2 * R, cy - 0.2 * R)
    g.addColorStop(0, 'rgba(47,99,255,.30)')
    g.addColorStop(1, 'rgba(47,99,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R)

    // rotation: lon' = lon - viewLon, then tilt about the horizontal axis
    const v = (reduced ? VIEW_LON0 : VIEW_LON0 - SPIN * t) * D2R
    const cv = Math.cos(v)
    const sv = Math.sin(v)
    const ct = Math.cos(TILT)
    const st = Math.sin(TILT)
    const rot = (x, y, z) => {
      const x1 = x * cv - z * sv
      const z1 = z * cv + x * sv
      return [x1, y * ct - z1 * st, z1 * ct + y * st]
    }

    // 4. land dots in 5 depth buckets
    for (const b of buckets) b.length = 0
    for (let i = 0; i < N; i++) {
      const x = P[i * 3]
      const y = P[i * 3 + 1]
      const z = P[i * 3 + 2]
      const x1 = x * cv - z * sv
      const z1 = z * cv + x * sv
      const z2 = z1 * ct + y * st
      if (z2 <= 0.02) continue
      buckets[Math.min(4, Math.floor(z2 * 5.5))].push(x1, y * ct - z1 * st, z2)
    }
    const base = Math.max(0.9, 1.75 * up)
    ctx.fillStyle = '#111'
    buckets.forEach((b, bi) => {
      if (!b.length) return
      ctx.globalAlpha = alpha * (0.22 + bi * 0.19)
      ctx.beginPath()
      for (let i = 0; i < b.length; i += 3) {
        const sx = cx + R * b[i]
        const sy = cy - R * b[i + 1]
        const r = base * (0.5 + 0.5 * Math.sqrt(b[i + 2]))
        ctx.moveTo(sx + r, sy)
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
      }
      ctx.fill()
    })
    ctx.restore()
    ctx.globalAlpha = alpha

    // 5. rim
    ctx.lineWidth = Math.max(1, 1.4 * up)
    ctx.strokeStyle = 'rgba(47,99,255,.38)'
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,.9)'
    ctx.beginPath()
    ctx.arc(cx, cy, R - 0.8, -2.4, -0.3)
    ctx.stroke()

    // 6. route arcs
    ctx.strokeStyle = '#2f63ff'
    ctx.lineWidth = Math.max(1, 1.15 * up)
    ctx.globalAlpha = alpha * 0.8
    ctx.lineCap = 'round'
    arcs.forEach((pts, ai) => {
      const prog = clamp((it - (1 + ai * 0.18)) / 1.1)
      if (prog <= 0) return
      const segs = prog * 56
      const sp = pts.map((p) => rot(p[0], p[1], p[2]))
      const vis = (p) => p[2] > 0 || p[0] * p[0] + p[1] * p[1] > 1
      ctx.beginPath()
      for (let i = 0; i < Math.ceil(segs); i++) {
        const a = sp[i]
        let b = sp[i + 1]
        if (!vis(a) || !vis(b)) continue
        const f = Math.min(1, segs - i)
        if (f < 1) b = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, b[2]]
        ctx.moveTo(cx + R * a[0], cy - R * a[1])
        ctx.lineTo(cx + R * b[0], cy - R * b[1])
      }
      ctx.stroke()
    })

    // 7. pins + labels
    const pr = Math.max(3, 4.6 * up)
    const ls = G.smallLabels ? Math.max(9.5, 12.5 * up) : 12.5 * up
    ctx.font = `500 ${ls}px "JetBrains Mono", ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    if ('letterSpacing' in ctx) ctx.letterSpacing = 0.05 * ls + 'px'
    pins.forEach((p, i) => {
      const [x, y, z] = rot(p[0], p[1], p[2])
      const a = clamp(z * 5) * clamp((it - (0.8 + i * 0.16)) / 0.6)
      if (a <= 0) return
      const sx = cx + R * x
      const sy = cy - R * y
      ctx.globalAlpha = alpha * a
      ctx.beginPath()
      ctx.arc(sx, sy, pr, 0, Math.PI * 2)
      ctx.fillStyle = '#2f63ff'
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#fff'
      ctx.stroke()
      ctx.fillStyle = '#111'
      ctx.fillText(CITIES[i].name.toUpperCase(), sx, sy - (pr + 0.55 * ls))
    })
    ctx.globalAlpha = 1
  }

  return { resize, draw: drawGlobe }
}
