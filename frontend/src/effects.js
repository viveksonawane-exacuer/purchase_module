// Global UI effects via event delegation: ripple on buttons, pointer spotlight on .spot elements.
export function installEffects() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  document.addEventListener('pointerdown', (e) => {
    if (reduce) return
    const btn = e.target.closest('.btn, .tile, .kpi, .nav-item')
    if (!btn || btn.disabled) return
    const r = btn.getBoundingClientRect()
    const size = Math.max(r.width, r.height) * 2
    const s = document.createElement('span')
    s.className = 'ripple'
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
    btn.appendChild(s)
    setTimeout(() => s.remove(), 650)
  })
  document.addEventListener(
    'pointermove',
    (e) => {
      const el = e.target.closest('.spot, .spot-border')
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    },
    { passive: true },
  )
}
