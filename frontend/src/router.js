import { createRouter, createWebHistory } from 'vue-router'
import { DASH_KEYS, MODULES } from './config'
import { state } from './store'

const ListReport = () => import('./views/ListReport.vue')
const ObjectPage = () => import('./views/ObjectPage.vue')
const DocForm = () => import('./views/DocForm.vue')

const moduleRoutes = Object.keys(MODULES).flatMap((key) => [
  { path: `/${key}/new`, component: DocForm, props: { module: key } },
  { path: `/${key}/:name/edit`, component: DocForm, props: (r) => ({ module: key, name: r.params.name }) },
  {
    path: `/${key}`,
    component: ListReport,
    props: { module: key },
    children: [{ path: ':name', component: ObjectPage, props: (r) => ({ module: key, name: r.params.name }) }],
  },
])

const routes = [
  { path: '/', component: () => import('./views/Launchpad.vue') },
  { path: '/inbox', component: () => import('./views/Inbox.vue') },
  { path: '/finance', component: () => import('./views/Finance.vue') },
  {
    path: '/inventory',
    component: () => import('./views/Inventory.vue'),
    // the old "Below Reorder" tab now has its own page
    beforeEnter: (to) => (to.query.view === 'low' ? '/reorder' : true),
    children: [{ path: ':item', component: () => import('./views/StockDetail.vue'), props: true }],
  },
  {
    path: '/reorder',
    component: () => import('./views/Reorder.vue'),
    children: [{ path: ':item', component: () => import('./views/StockDetail.vue'), props: true }],
  },
  { path: '/reports', component: () => import('./views/Reports.vue') },
  { path: '/reports/:report', component: () => import('./views/ReportView.vue'), props: true },
  { path: '/insights', component: () => import('./views/DashboardHub.vue') },
  { path: '/insights/:module', component: () => import('./views/Dashboard.vue'), props: true, beforeEnter: (to) => (DASH_KEYS.includes(to.params.module) ? true : '/insights') },
  { path: '/rfq/:name/compare', component: () => import('./views/RfqCompare.vue'), props: true },
  ...moduleRoutes,
  { path: '/vendor', component: () => import('./views/vendor/VendorHome.vue'), meta: { vendor: true } },
  { path: '/vendor/rfq/:name', component: () => import('./views/vendor/VendorRfq.vue'), props: true, meta: { vendor: true } },
  { path: '/vendor/doc/:doctype/:name', component: () => import('./views/vendor/VendorDoc.vue'), props: true, meta: { vendor: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory('/procure'),
  routes,
  scrollBehavior: (to, from) => (to.path === from.path ? false : { top: 0 }),
})

router.beforeEach((to) => {
  const mode = state.boot?.mode
  if (mode === 'vendor' && !to.meta.vendor) return '/vendor'
  if (mode === 'internal' && to.meta.vendor && !state.boot?.supplier) return '/'
})
