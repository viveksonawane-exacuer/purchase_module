import { createApp } from 'vue'
import App from './App.vue'
import { api, call } from './api'
import { installEffects } from './effects'
import { router } from './router'
import { initTheme, state } from './store'
import './styles/fiori.css'

initTheme()
installEffects()

async function start() {
  let boot
  try {
    boot = await api.boot()
  } catch {
    boot = null
  }
  if (!boot || boot.user === 'Guest') {
    // Signed-out: the bare /procure URL shows the public landing page; deep links
    // (and #signin / ?redirect-to) go straight to the portal's own 3D login screen.
    const brand = (await call('purchase_module.api.branding', {}, { silent: true }).catch(() => ({}))) || {}
    const showLogin = async () => {
      const { default: Login } = await import('./login/Login.vue')
      createApp(Login, { brand }).mount('#app')
    }
    const atRoot = location.pathname.replace(/\/+$/, '') === '/procure'
    const wantsLogin = location.hash === '#signin' || new URLSearchParams(location.search).has('redirect-to')
    if (!atRoot || wantsLogin) return showLogin()

    const { default: Landing } = await import('./landing/Landing.vue')
    const landing = createApp(Landing, {
      brand,
      onSignin: () => {
        landing.unmount()
        history.pushState(null, '', location.pathname + location.search + '#signin')
        scrollTo(0, 0)
        showLogin()
      },
    })
    landing.mount('#app')
    // Back button from the sign-in screen returns to the landing page
    addEventListener('popstate', () => location.hash !== '#signin' && location.reload())
    return
  }
  state.boot = boot
  window.__boot = boot
  createApp(App).use(router).mount('#app')
}

start().catch(() => {
  document.getElementById('app').innerHTML =
    '<div style="padding:4rem;text-align:center;font-family:sans-serif">Could not reach the server. <a href="">Retry</a></div>'
})
