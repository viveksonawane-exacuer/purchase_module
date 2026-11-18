// Shared positioning for dropdown lists teleported to <body>:
// fixed position under the anchor, flips above when there is no room below,
// follows the anchor on scroll/resize and closes once it scrolls out of view.
import { nextTick, onBeforeUnmount, reactive, watch } from 'vue'

export function usePopover(anchor, list, open, close, { maxH = 288, minW = 240 } = {}) {
  const pos = reactive({ style: {}, up: false })

  function place() {
    const el = anchor.value
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = innerHeight - r.bottom
    const up = below < Math.min(maxH, 200) && r.top > below
    const width = Math.max(r.width, minW)
    const left = Math.min(r.left, innerWidth - width - 8)
    pos.up = up
    pos.style = {
      left: `${Math.max(8, left)}px`,
      minWidth: `${width}px`,
      maxHeight: `${Math.min(maxH, (up ? r.top : below) - 12)}px`,
      transformOrigin: up ? 'bottom left' : 'top left',
      ...(up ? { bottom: `${innerHeight - r.top + 6}px` } : { top: `${r.bottom + 6}px` }),
    }
  }
  function onViewportChange(e) {
    if (list.value && e?.target instanceof Node && list.value.contains(e.target)) return // scrolling inside the list
    const r = anchor.value?.getBoundingClientRect()
    if (!r || r.bottom < 0 || r.top > innerHeight) return close()
    place()
  }
  function bind(on) {
    const fn = on ? addEventListener : removeEventListener
    fn('scroll', onViewportChange, true)
    fn('resize', onViewportChange)
  }
  watch(open, (v) => {
    bind(v)
    if (v) nextTick(place)
  })
  onBeforeUnmount(() => bind(false))
  return { pos, place }
}
