// 3D "global supply network" background for the login screen (three.js).
// A rotating point-cloud globe, shipment arcs with travelling packets, orbiting
// parcels, and a starfield, all with pointer parallax. Returns a dispose() function.
import * as THREE from 'three'

const BRAND = new THREE.Color('#2f8cff')
const VIOLET = new THREE.Color('#8b6cff')
const CYAN = new THREE.Color('#33d1ff')

function dotTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.35, 'rgba(255,255,255,0.85)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function fibonacciSphere(n, r) {
  const pts = []
  const phi = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const rad = Math.sqrt(1 - y * y)
    const th = phi * i
    pts.push(new THREE.Vector3(Math.cos(th) * rad * r, y * r, Math.sin(th) * rad * r))
  }
  return pts
}

export function createScene(canvas, { reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1))
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2('#070b18', 0.045)
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
  camera.position.set(0, 0, 10)
  const dot = dotTexture()
  const disposables = [dot]
  const track = (o) => (disposables.push(o), o)

  scene.add(new THREE.AmbientLight('#b8cdff', 1.1))
  const key = new THREE.DirectionalLight('#fff1dc', 1.6)
  key.position.set(3, 5, 8)
  scene.add(key)
  const l1 = new THREE.PointLight(BRAND, 40, 30)
  l1.position.set(4, 3, 6)
  const l2 = new THREE.PointLight(VIOLET, 35, 30)
  l2.position.set(-5, -3, 4)
  scene.add(l1, l2)

  // ---------- globe ----------
  const R = 2.4
  const world = new THREE.Group()
  scene.add(world)
  const globe = new THREE.Group()
  world.add(globe)

  const pts = fibonacciSphere(520, R)
  const gPts = track(new THREE.BufferGeometry().setFromPoints(pts))
  const colors = new Float32Array(pts.length * 3)
  pts.forEach((p, i) => {
    const c = BRAND.clone().lerp(VIOLET, (p.y / R + 1) / 2)
    colors.set([c.r, c.g, c.b], i * 3)
  })
  gPts.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  globe.add(new THREE.Points(gPts, track(new THREE.PointsMaterial({ size: 0.075, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))))

  const wire = new THREE.LineSegments(
    track(new THREE.WireframeGeometry(track(new THREE.IcosahedronGeometry(R * 0.985, 3)))),
    track(new THREE.LineBasicMaterial({ color: BRAND, transparent: true, opacity: 0.07 })),
  )
  globe.add(wire)

  // inner glow shell
  const glow = new THREE.Mesh(
    track(new THREE.SphereGeometry(R * 0.96, 48, 48)),
    track(new THREE.MeshBasicMaterial({ color: '#0b2a5c', transparent: true, opacity: 0.35 })),
  )
  globe.add(glow)
  const atmo = new THREE.Mesh(
    track(new THREE.SphereGeometry(R * 1.12, 48, 48)),
    track(
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { c: { value: BRAND } },
        vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 c; varying vec3 vN; void main(){ float i = pow(0.75 - dot(vN, vec3(0.,0.,1.)), 3.0); gl_FragColor = vec4(c, 1.0) * i; }',
      }),
    ),
  )
  world.add(atmo)

  // ---------- shipment arcs + packets ----------
  const arcs = []
  const rnd = (a, b) => a + Math.random() * (b - a)
  for (let i = 0; i < 20; i++) {
    const a = pts[(Math.random() * pts.length) | 0]
    const b = pts[(Math.random() * pts.length) | 0]
    if (a.distanceTo(b) < R * 0.8) continue
    const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * rnd(1.35, 1.75))
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
    const color = [BRAND, VIOLET, CYAN][i % 3]
    const line = new THREE.Line(
      track(new THREE.BufferGeometry().setFromPoints(curve.getPoints(64))),
      track(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })),
    )
    globe.add(line)
    const packet = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: dot, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })))
    packet.scale.setScalar(0.28)
    globe.add(packet)
    // landing pulse at the destination
    const ring = new THREE.Mesh(
      track(new THREE.RingGeometry(0.05, 0.08, 32)),
      track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })),
    )
    ring.position.copy(b)
    ring.lookAt(b.clone().multiplyScalar(2))
    globe.add(ring)
    arcs.push({ curve, packet, ring, t: Math.random(), speed: rnd(0.12, 0.25) })
  }

  // ---------- orbit rings ----------
  for (const [rad, tilt, op] of [[R * 1.45, 0.5, 0.18], [R * 1.7, -0.35, 0.1]]) {
    const ring = new THREE.LineLoop(
      track(new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, rad, rad).getPoints(160).map((p) => new THREE.Vector3(p.x, 0, p.y)))),
      track(new THREE.LineDashedMaterial({ color: CYAN, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: op })),
    )
    ring.computeLineDistances()
    ring.rotation.x = tilt
    world.add(ring)
  }

  // ---------- orbiting parcels ----------
  const boxGeo = track(new THREE.BoxGeometry(0.34, 0.26, 0.26))
  const edgeGeo = track(new THREE.EdgesGeometry(boxGeo))
  const boxMat = track(new THREE.MeshStandardMaterial({ color: '#d9b37a', roughness: 0.5, metalness: 0.05, emissive: '#5a3a10', emissiveIntensity: 0.55 }))
  const tapeMat = track(new THREE.LineBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.6 }))
  const parcels = []
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(boxGeo, boxMat), new THREE.LineSegments(edgeGeo, tapeMat))
    world.add(g)
    parcels.push({ g, r: rnd(R * 1.35, R * 1.85), a: (i / 9) * Math.PI * 2, s: rnd(0.12, 0.22), tilt: rnd(-0.6, 0.6), spin: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)), bob: rnd(0, 6) })
  }

  // ---------- starfield ----------
  const stars = []
  for (let i = 0; i < 1600; i++) stars.push(new THREE.Vector3().randomDirection().multiplyScalar(rnd(18, 60)))
  const starField = new THREE.Points(
    track(new THREE.BufferGeometry().setFromPoints(stars)),
    track(new THREE.PointsMaterial({ size: 0.12, map: dot, color: '#9fbfff', transparent: true, opacity: 0.75, depthWrite: false })),
  )
  scene.add(starField)

  // ---------- layout / interaction ----------
  let w = 1, h = 1
  function resize() {
    w = canvas.clientWidth || innerWidth
    h = canvas.clientHeight || innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    const wide = w > 980
    world.position.set(wide ? -0.2 : 0, wide ? 0 : 1.6, 0)
    world.scale.setScalar(wide ? 0.92 : 0.78)
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  const onMove = (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1
    pointer.ty = (e.clientY / innerHeight) * 2 - 1
  }
  addEventListener('pointermove', onMove, { passive: true })

  const clock = new THREE.Clock()
  let raf = 0
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime
    const intro = Math.min(1, t / 1.6)
    const ease = 1 - Math.pow(1 - intro, 3)

    globe.rotation.y += dt * 0.08
    globe.rotation.x = 0.35
    atmo.scale.setScalar(0.85 + 0.15 * ease)
    globe.scale.setScalar(0.6 + 0.4 * ease)

    for (const a of arcs) {
      a.t += dt * a.speed
      if (a.t > 1) a.t = 0
      a.packet.position.copy(a.curve.getPoint(a.t))
      a.packet.material.opacity = Math.sin(a.t * Math.PI)
      const land = a.t > 0.9 ? (a.t - 0.9) / 0.1 : 0
      a.ring.scale.setScalar(1 + land * 3)
      a.ring.material.opacity = land ? (1 - land) * 0.9 : 0
    }
    for (const p of parcels) {
      p.a += dt * p.s
      p.g.position.set(Math.cos(p.a) * p.r, Math.sin(p.a) * p.r * p.tilt + Math.sin(t + p.bob) * 0.12, Math.sin(p.a) * p.r)
      p.g.rotation.x += dt * p.spin.x * 0.6
      p.g.rotation.y += dt * p.spin.y * 0.6
      p.g.scale.setScalar(ease)
    }
    starField.rotation.y += dt * 0.006

    pointer.x += (pointer.tx - pointer.x) * 0.04
    pointer.y += (pointer.ty - pointer.y) * 0.04
    camera.position.x = pointer.x * 0.9
    camera.position.y = -pointer.y * 0.6
    camera.lookAt(world.position.x * 0.35, world.position.y * 0.35, 0)

    renderer.render(scene, camera)
    if (!reduced) raf = requestAnimationFrame(frame)
  }
  if (reduced) {
    clock.elapsedTime = 2
    clock.getDelta = () => 0
    Object.defineProperty(clock, 'elapsedTime', { get: () => 2 })
  }
  frame()

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    removeEventListener('pointermove', onMove)
    disposables.forEach((d) => d.dispose?.())
    renderer.dispose()
  }
}
