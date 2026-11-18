<template>
  <div ref="root" class="op" :class="{ 'in-fcl': inFcl, win: scrollerIsWindow }">
    <div v-if="!data" class="op-loading"><div class="skeleton" style="height: 9rem; margin-bottom: 1rem" /><div class="skeleton" style="height: 20rem" /></div>

    <template v-else>
      <!-- ============ Expanded header (scrolls away naturally) ============ -->
      <header ref="headerEl" class="op-header shine">
        <div class="row top-row">
          <div class="breadcrumbs">
            <router-link to="/">Home</router-link><Icon name="ChevronRight" :size="12" />
            <router-link :to="`/${m.key}`">{{ m.title }}</router-link>
          </div>
          <div class="spacer" />
          <div v-if="nav && navIndex > -1" class="pager">
            <span class="muted">{{ navIndex + 1 }} / {{ nav.names.value.length }}</span>
            <button class="btn btn-transparent btn-icon btn-sm" title="Previous (K)" :disabled="navIndex <= 0" @click="step(-1)"><Icon name="ChevronLeft" :size="16" /></button>
            <button class="btn btn-transparent btn-icon btn-sm" title="Next (J)" :disabled="navIndex >= nav.names.value.length - 1" @click="step(1)"><Icon name="ChevronRight" :size="16" /></button>
          </div>
        </div>

        <div class="row wrap title-row">
          <span class="avatar-obj"><Icon :name="m.icon" :size="22" /></span>
          <div style="min-width: 0; flex: 1">
            <div class="row wrap" style="gap: 0.625rem">
              <h1 class="page-title">{{ doc.name }}</h1>
              <StatusBadge :status="doc.status" :docstatus="doc.docstatus" />
            </div>
            <div class="muted row wrap" style="gap: 0.5rem">
              <span class="dt-chip" title="DocType in ERPNext Desk"><Icon name="Layers" :size="12" /> {{ m.doctype }}</span>
              <span v-if="subtitle">{{ subtitle }}</span>
            </div>
          </div>
          <div class="row header-actions">
            <router-link v-if="doc.docstatus === 0 && m.form" :to="`/${m.key}/${encodeURIComponent(doc.name)}/edit`" class="btn btn-ghost">
              <Icon name="Pencil" /> Edit
            </router-link>
            <button class="btn btn-transparent btn-icon" title="Copy link" @click="copyLink"><Icon :name="copied ? 'Check' : 'Copy'" /></button>
            <a class="btn btn-transparent btn-icon" :href="pdfUrl(m.doctype, doc.name)" target="_blank" title="Download PDF"><Icon name="Printer" /></a>
            <a class="btn btn-transparent btn-icon" :href="`/app/${slug}/${encodeURIComponent(doc.name)}`" target="_blank" title="Open in ERP Desk"><Icon name="LayoutGrid" /></a>
            <template v-if="inFcl">
              <button v-if="canFull" class="btn btn-transparent btn-icon hide-mob" :title="(full ? 'Exit full screen' : 'Full screen') + ' (F)'" @click="$emit('toggle-full')">
                <Icon :name="full ? 'Minimize2' : 'Maximize2'" />
              </button>
              <button class="btn btn-transparent btn-icon" title="Close (Esc)" @click="$emit('close')"><Icon name="X" /></button>
            </template>
          </div>
        </div>

        <!-- Message strips -->
        <TransitionGroup name="strip" tag="div" class="strips">
          <div v-for="s in strips" :key="s.id" class="strip" :class="s.tone" role="status">
            <Icon :name="s.icon" :size="16" />
            <span style="flex: 1">{{ s.text }}</span>
            <button v-if="s.action" class="btn btn-sm" :class="s.tone === 'negative' ? 'btn-negative' : ''" @click="run(s.action)">{{ s.action.label }}</button>
            <button class="btn btn-transparent btn-icon btn-sm" aria-label="Dismiss" @click="dismissed.add(s.id)"><Icon name="X" :size="14" /></button>
          </div>
        </TransitionGroup>

        <div class="header-content">
          <div class="facts header-facts">
            <div v-for="f in m.facts" :key="f.field" class="fact">
              <div class="k">{{ f.label }}</div>
              <div class="v">{{ show(f, doc[f.field]) || '—' }}</div>
            </div>
          </div>
          <div v-if="m.kpis" class="kpis">
            <div v-for="k in m.kpis" :key="k.field" class="kpi">
              <div class="k">{{ k.label }}</div>
              <template v-if="k.type === 'percent'">
                <div class="v"><AnimatedNumber :value="doc[k.field] || 0" /><small>%</small></div>
                <div class="progress" :class="{ positive: doc[k.field] >= 100 }"><span :style="{ width: Math.min(100, doc[k.field] || 0) + '%' }" /></div>
              </template>
              <div v-else class="v" :class="k.tone && doc[k.field] > 0 ? k.tone : ''"><AnimatedNumber :value="doc[k.field] || 0" :format="(v) => fmtMoney(v, doc.currency)" /></div>
            </div>
          </div>
        </div>
      </header>

      <!-- ============ Sticky bar: compact title (when snapped) + anchor navigation ============ -->
      <div class="op-sticky" :class="{ snapped }">
        <div class="snap-title" :aria-hidden="!snapped">
          <span class="snap-ico"><Icon :name="m.icon" :size="16" /></span>
          <b class="ell">{{ doc.name }}</b>
          <StatusBadge :status="doc.status" :docstatus="doc.docstatus" />
        </div>
        <nav class="anchor tabs">
          <button v-for="s in sections" :key="s.id" :class="{ on: activeSection === s.id }" @click="scrollTo(s.id)">
            {{ s.label }}<span v-if="s.count" class="count">{{ s.count }}</span>
          </button>
        </nav>
        <div class="snap-actions">
          <template v-if="nav && navIndex > -1">
            <button class="btn btn-transparent btn-icon btn-sm" title="Previous (K)" :disabled="navIndex <= 0" @click="step(-1)"><Icon name="ChevronLeft" :size="16" /></button>
            <button class="btn btn-transparent btn-icon btn-sm" title="Next (J)" :disabled="navIndex >= nav.names.value.length - 1" @click="step(1)"><Icon name="ChevronRight" :size="16" /></button>
          </template>
          <button class="btn btn-transparent btn-icon btn-sm" title="Back to top" @click="toTop"><Icon name="ChevronDown" :size="16" style="transform: rotate(180deg)" /></button>
        </div>
      </div>

      <div class="op-body">
        <!-- Document flow -->
        <section v-if="data.flow.length" id="sec-flow" class="card sec">
          <div class="card-header"><h3>Document Flow</h3><span class="sub">End-to-end procure-to-pay chain</span></div>
          <div class="card-body"><ProcessFlow :steps="data.flow" :current="doc.name" /></div>
        </section>

        <!-- Items -->
        <section v-if="!m.noItems" id="sec-items" class="card sec">
          <div class="card-header">
            <h3>Items</h3><span class="sub">{{ (doc.items || []).length }} line(s)</span>
            <div class="spacer" />
            <div v-if="(doc.items || []).length > 5" class="mini-search">
              <Icon name="Search" :size="14" />
              <input v-model="itemQuery" class="input compact" placeholder="Filter items…" />
            </div>
          </div>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th v-for="c in itemCols" :key="c.f" :class="{ num: c.num }">{{ c.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="it in shownItems" :key="it.name">
                  <td class="muted">{{ it.idx }}</td>
                  <td>
                    <div class="title">{{ it.item_name || it.item_code }}</div>
                    <div class="muted">{{ it.item_code }}</div>
                  </td>
                  <td v-for="c in itemCols" :key="c.f" :class="{ num: c.num }">
                    <Progress v-if="c.pct" :value="(100 * (it[c.f] || 0)) / (it.qty || 1)" />
                    <template v-else>{{ c.money ? fmtMoney(it[c.f], doc.currency) : c.date ? fmtDate(it[c.f]) : c.num ? fmtNum(it[c.f]) : it[c.f] }}</template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="doc.grand_total !== undefined" class="totals">
            <div><span>Net Total</span><b>{{ fmtMoney(doc.net_total ?? doc.total, doc.currency) }}</b></div>
            <div v-for="t in doc.taxes || []" :key="t.name"><span>{{ t.description || t.account_head }}</span><b>{{ fmtMoney(t.tax_amount, doc.currency) }}</b></div>
            <div v-if="doc.discount_amount"><span>Discount</span><b>− {{ fmtMoney(doc.discount_amount, doc.currency) }}</b></div>
            <div class="grand"><span>Grand Total</span><b>{{ fmtMoney(doc.grand_total, doc.currency) }}</b></div>
            <div v-if="doc.outstanding_amount !== undefined && doc.docstatus === 1" class="due"><span>Outstanding</span><b>{{ fmtMoney(doc.outstanding_amount, doc.currency) }}</b></div>
          </div>
        </section>

        <!-- Payment references -->
        <section v-if="m.doctype === 'Payment Entry'" id="sec-items" class="card sec">
          <div class="card-header"><h3>Allocated References</h3></div>
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Type</th><th>Document</th><th class="num">Outstanding</th><th class="num">Allocated</th></tr></thead>
              <tbody>
                <tr v-for="r in doc.references" :key="r.name">
                  <td>{{ r.reference_doctype }}</td>
                  <td><router-link :to="`/${BY_DOCTYPE[r.reference_doctype]?.key}/${encodeURIComponent(r.reference_name)}`">{{ r.reference_name }}</router-link></td>
                  <td class="num">{{ fmtMoney(r.outstanding_amount) }}</td>
                  <td class="num">{{ fmtMoney(r.allocated_amount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- RFQ suppliers -->
        <section v-if="doc.suppliers" id="sec-suppliers" class="card sec">
          <div class="card-header">
            <h3>Invited Suppliers</h3><span class="sub">{{ doc.suppliers.length }} supplier(s)</span>
            <div class="spacer" />
            <router-link v-if="doc.docstatus === 1" :to="`/rfq/${encodeURIComponent(doc.name)}/compare`" class="btn btn-sm"><Icon name="Columns2" /> Compare Quotations</router-link>
          </div>
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Supplier</th><th>Contact</th><th>Email Sent</th><th>Quote Status</th></tr></thead>
              <tbody>
                <tr v-for="s in doc.suppliers" :key="s.name">
                  <td class="title">{{ s.supplier_name || s.supplier }}</td>
                  <td>{{ s.email_id || '—' }}</td>
                  <td>{{ s.email_sent ? 'Yes' : 'No' }}</td>
                  <td><StatusBadge :status="s.quote_status || 'Pending'" :docstatus="1" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Supplier 360 -->
        <section v-if="sup" id="sec-supplier" class="card sec">
          <div class="card-header">
            <h3>Supplier 360°</h3><span class="sub">Last 12 months</span>
            <div class="spacer" />
            <router-link :to="`/po?supplier=${encodeURIComponent(sup.name)}`" class="btn btn-sm btn-transparent">Orders <Icon name="ArrowRight" :size="14" /></router-link>
            <router-link :to="`/pi?supplier=${encodeURIComponent(sup.name)}`" class="btn btn-sm btn-transparent">Invoices <Icon name="ArrowRight" :size="14" /></router-link>
          </div>
          <div class="card-body sup">
            <div class="sup-id">
              <span class="sup-avatar">{{ initials(sup.supplier_name) }}</span>
              <div style="min-width: 0">
                <div class="row wrap" style="gap: 0.5rem">
                  <b class="ell">{{ sup.supplier_name }}</b>
                  <span v-if="sup.on_hold" class="status critical">On Hold</span>
                  <span v-if="sup.disabled" class="status negative">Disabled</span>
                </div>
                <div class="muted ell">{{ [sup.supplier_group, sup.country].filter(Boolean).join(' · ') }}</div>
                <div class="muted ell">
                  <a v-if="sup.email_id" :href="`mailto:${sup.email_id}`">{{ sup.email_id }}</a>
                  <template v-if="sup.mobile_no"> · {{ sup.mobile_no }}</template>
                </div>
              </div>
            </div>
            <div class="sup-stats">
              <div class="sstat spot"><div class="k">Spend</div><div class="v"><AnimatedNumber :value="sup.spend_12m" :format="fmtCompact" /></div><small class="muted">{{ sup.orders_12m }} orders</small></div>
              <div class="sstat spot"><div class="k">Open Orders</div><div class="v"><AnimatedNumber :value="sup.open_orders" /></div><small class="muted">Last order {{ fmtDate(sup.last_order) || '—' }}</small></div>
              <div class="sstat spot" :class="{ warn: sup.overdue_invoices }"><div class="k">Payables</div><div class="v"><AnimatedNumber :value="sup.outstanding" :format="fmtCompact" /></div><small :class="sup.overdue_invoices ? 'neg' : 'muted'">{{ sup.overdue_invoices }} overdue invoice(s)</small></div>
            </div>
          </div>
        </section>

        <!-- All Desk fields, organised in Desk's tabs and sections -->
        <section v-if="fmeta" id="sec-details" class="card sec">
          <div class="card-header"><h3>All Details</h3><span class="sub">Every field from the {{ m.doctype }} form</span></div>
          <div class="card-body details-body">
            <DynamicForm :meta="fmeta" :doc="doc" view flat :skip="m.noItems ? [] : ['items']" />
          </div>
        </section>

        <!-- Notes -->
        <section v-if="doc.terms || doc.message_for_supplier || doc.remarks" id="sec-notes" class="card sec">
          <div class="card-header"><h3>Notes &amp; Terms</h3></div>
          <div class="card-body notes" v-html="sanitize(doc.message_for_supplier || doc.terms || doc.remarks)" />
        </section>

        <!-- Attachments -->
        <section id="sec-files" class="card sec">
          <div class="card-header">
            <h3>Attachments</h3><span class="sub">{{ data.attachments.length }} file(s)</span>
            <div class="spacer" />
            <button class="btn btn-sm" @click="fileInput.click()"><Icon name="Upload" /> Upload</button>
            <input ref="fileInput" type="file" multiple hidden @change="onFiles($event.target.files); $event.target.value = ''" />
          </div>
          <div class="card-body">
            <div class="drop" :class="{ over: dragOver }" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="dragOver = false; onFiles($event.dataTransfer.files)" @click="fileInput.click()">
              <Icon name="Upload" :size="22" />
              <span v-if="uploading">Uploading {{ uploading }} file(s)…</span>
              <span v-else>Drop quotations, delivery notes or invoices here, or <a>browse</a></span>
            </div>
            <ul v-if="data.attachments.length" class="files">
              <li v-for="f in data.attachments" :key="f.name">
                <span class="f-ico" :data-ext="ext(f.file_name)">{{ ext(f.file_name) }}</span>
                <div style="flex: 1; min-width: 0">
                  <a :href="f.file_url" target="_blank" class="ell f-name">{{ f.file_name }}</a>
                  <small class="muted">{{ fmtSize(f.file_size) }} · {{ (f.owner || '').split('@')[0] }} · {{ timeAgo(f.creation) }}</small>
                </div>
                <a class="btn btn-transparent btn-icon btn-sm" :href="f.file_url" target="_blank" title="Open"><Icon name="Eye" :size="15" /></a>
                <button class="btn btn-transparent btn-icon btn-sm" title="Remove" @click="removeFile(f)"><Icon name="Trash2" :size="15" /></button>
              </li>
            </ul>
          </div>
        </section>

        <!-- Activity -->
        <section id="sec-activity" class="card sec">
          <div class="card-header"><h3>Activity</h3></div>
          <div class="card-body">
            <div class="comment-box">
              <textarea v-model="comment" class="input" placeholder="Add a comment for your team… (Ctrl+Enter to post)" @keydown.ctrl.enter="postComment" @keydown.meta.enter="postComment" />
              <button class="btn btn-sm btn-emphasized" :disabled="!comment.trim()" @click="postComment"><Icon name="Send" /> Post</button>
            </div>
            <ol class="timeline">
              <li v-for="(e, i) in data.timeline" :key="i" :class="e.type">
                <span class="tl-dot"><Icon :name="e.type === 'Comment' ? 'MessageSquare' : e.type === 'Created' ? 'Plus' : 'Pencil'" :size="12" /></span>
                <div>
                  <div><b>{{ e.user }}</b> <span class="muted">{{ e.type === 'Version' ? 'changed' : '' }}</span> <span>{{ plain(e.text) }}</span></div>
                  <small class="muted">{{ timeAgo(e.at) }}</small>
                </div>
              </li>
            </ol>
          </div>
        </section>
        <div class="kbd-hint muted"><kbd>J</kbd>/<kbd>K</kbd> next/previous · <kbd>F</kbd> full screen · <kbd>Esc</kbd> close</div>
      </div>

      <!-- Footer toolbar -->
      <div v-if="data.actions.length" class="footer-bar" :class="{ infcl: inFcl && !full }">
        <span class="msg"><Icon name="Info" :size="14" /> {{ footerHint }}</span>
        <div class="spacer" />
        <button v-for="a in data.actions" :key="a.key" class="btn" :class="'btn-' + a.type" :disabled="busy" @click="run(a)">{{ a.label }}</button>
      </div>
    </template>

    <!-- Supplier picker dialog -->
    <Teleport to="body">
      <div v-if="pick" class="overlay" @click.self="pick.resolve(null); pick = null">
        <div class="dialog">
          <header><Icon name="Building2" /><h3>{{ pick.title }}</h3></header>
          <div class="dialog-body">
            <div class="field"><label class="req">Supplier</label><LinkInput v-model="pick.supplier" doctype="Supplier" :filters="pick.filters" /></div>
          </div>
          <footer>
            <button class="btn btn-emphasized" :disabled="!pick.supplier" @click="pick.resolve(pick.supplier); pick = null">Continue</button>
            <button class="btn btn-transparent" @click="pick.resolve(null); pick = null">Cancel</button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api, pdfUrl } from '../api'
import AnimatedNumber from '../components/AnimatedNumber.vue'
import DynamicForm from '../components/DynamicForm.vue'
import Icon from '../components/Icon.vue'
import LinkInput from '../components/LinkInput.vue'
import ProcessFlow from '../components/ProcessFlow.vue'
import Progress from '../components/Progress.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { BY_DOCTYPE, MODULES } from '../config'
import { confirmBox, fmtCompact, fmtDate, fmtMoney, fmtNum, state, timeAgo, toast } from '../store'

const props = defineProps({ module: String, name: String, inFcl: Boolean, full: Boolean, canFull: { type: Boolean, default: true } })
const emit = defineEmits(['changed', 'toggle-full', 'close'])
const router = useRouter()
const nav = inject('docNav', null) // { names: Ref<string[]>, go(name) } from the list / inbox

const m = computed(() => MODULES[props.module])
const docName = computed(() => decodeURIComponent(props.name))
const data = ref(null)
const doc = computed(() => data.value?.doc || {})
const sup = computed(() => data.value?.supplier)
const busy = ref(false)
const comment = ref('')
const pick = ref(null)
const snapped = ref(false)
const activeSection = ref('')
const fmeta = ref(null)
const itemQuery = ref('')
const copied = ref(false)
const dragOver = ref(false)
const uploading = ref(0)
const dismissed = reactive(new Set())
const root = ref(null)
const headerEl = ref(null)
const fileInput = ref(null)
const slug = computed(() => m.value.doctype.toLowerCase().replace(/ /g, '-'))

const subtitle = computed(() => doc.value.supplier_name || doc.value.party_name || doc.value.title || '')
const show = (f, v) => (f.type === 'date' ? fmtDate(v) : f.type === 'user' ? (v || '').split('@')[0] : v)
const plain = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim()
const sanitize = (s) => String(s || '').replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, '').replace(/ on\w+="[^"]*"/gi, '')
const initials = (s) => (s || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
const ext = (n) => ((n || '').split('.').pop() || 'file').slice(0, 4).toUpperCase()
const fmtSize = (b) => (!b ? '—' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`)
const daysSince = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)

const ITEM_FIELDS = [
  { f: 'qty', label: 'Qty', num: true },
  { f: 'uom', label: 'UoM' },
  { f: 'received_qty', label: 'Received', pct: true, only: ['Purchase Order'] },
  { f: 'ordered_qty', label: 'Ordered', pct: true, only: ['Material Request'] },
  { f: 'rejected_qty', label: 'Rejected', num: true, only: ['Purchase Receipt'] },
  { f: 'rate', label: 'Rate', num: true, money: true, skip: ['Request for Quotation'] },
  { f: 'amount', label: 'Amount', num: true, money: true, skip: ['Request for Quotation'] },
  { f: 'schedule_date', label: 'Required By', date: true },
  { f: 'warehouse', label: 'Warehouse' },
  { f: 's_warehouse', label: 'From Warehouse', only: ['Stock Entry'] },
  { f: 't_warehouse', label: 'To Warehouse', only: ['Stock Entry'] },
  { f: 'basic_rate', label: 'Basic Rate', num: true, money: true, only: ['Stock Entry'] },
  { f: 'current_qty', label: 'Current Qty', num: true, only: ['Stock Reconciliation'] },
  { f: 'valuation_rate', label: 'Valuation Rate', num: true, money: true, only: ['Stock Reconciliation'] },
]
const itemCols = computed(() => {
  const first = doc.value.items?.[0] || {}
  return ITEM_FIELDS.filter((c) => c.f in first && (!c.only || c.only.includes(m.value.doctype)) && !(c.skip || []).includes(m.value.doctype))
})
const shownItems = computed(() => {
  const q = itemQuery.value.trim().toLowerCase()
  const items = doc.value.items || []
  return q ? items.filter((i) => `${i.item_code} ${i.item_name}`.toLowerCase().includes(q)) : items
})
const sections = computed(() => {
  const s = data.value?.flow.length ? [{ id: 'sec-flow', label: 'Document Flow' }] : []
  if (!m.value.noItems || m.value.doctype === 'Payment Entry') s.push({ id: 'sec-items', label: m.value.noItems ? 'References' : 'Items', count: (doc.value.items || doc.value.references || []).length })
  if (doc.value.suppliers) s.push({ id: 'sec-suppliers', label: 'Suppliers' })
  if (sup.value) s.push({ id: 'sec-supplier', label: 'Supplier 360°' })
  if (fmeta.value) s.push({ id: 'sec-details', label: 'All Details' })
  if (doc.value.terms || doc.value.message_for_supplier || doc.value.remarks) s.push({ id: 'sec-notes', label: 'Notes' })
  s.push({ id: 'sec-files', label: 'Attachments', count: data.value?.attachments.length })
  s.push({ id: 'sec-activity', label: 'Activity' })
  return s
})
const footerHint = computed(() =>
  doc.value.docstatus === 0 ? 'Draft — not yet posted' : doc.value.docstatus === 2 ? 'Cancelled document' : `Last updated ${timeAgo(doc.value.modified)}`,
)
const actionByKey = (k) => data.value?.actions.find((a) => a.key === k)

// Fiori message strips: contextual warnings about this document
const strips = computed(() => {
  const d = doc.value
  const out = []
  if (d.docstatus === 0) out.push({ id: 'draft', tone: 'info', icon: 'Info', text: 'This document is a draft. Review it and submit to post it.', action: actionByKey('submit') })
  if (d.docstatus === 2) out.push({ id: 'cancel', tone: 'negative', icon: 'XCircle', text: 'This document was cancelled. Amend it to create a corrected copy.', action: actionByKey('amend') })
  if (d.status === 'Overdue' && d.due_date)
    out.push({ id: 'overdue', tone: 'negative', icon: 'AlarmClock', text: `Payment overdue by ${daysSince(d.due_date)} days — ${fmtMoney(d.outstanding_amount, d.currency)} outstanding.`, action: actionByKey('make_payment') })
  if (d.status === 'On Hold') out.push({ id: 'hold', tone: 'critical', icon: 'TriangleAlert', text: 'This order is on hold. Receipts and invoices are blocked until it is re-opened.', action: actionByKey('resume') })
  if (m.value.doctype === 'Purchase Order' && d.docstatus === 1 && d.per_received < 100 && d.schedule_date && daysSince(d.schedule_date) > 0 && !['Closed', 'On Hold'].includes(d.status))
    out.push({ id: 'late', tone: 'critical', icon: 'Truck', text: `Delivery is ${daysSince(d.schedule_date)} days late (${Math.round(d.per_received || 0)}% received).`, action: actionByKey('make_pr') })
  if (m.value.doctype === 'Supplier Quotation' && d.valid_till && daysSince(d.valid_till) > 0 && d.status !== 'Ordered')
    out.push({ id: 'expired', tone: 'critical', icon: 'Clock', text: `This quotation expired on ${fmtDate(d.valid_till)}. Confirm prices with the supplier before awarding.` })
  if (sup.value?.on_hold) out.push({ id: 'suphold', tone: 'critical', icon: 'Building2', text: `Supplier ${sup.value.supplier_name} is on hold.` })
  return out.filter((s) => !dismissed.has(s.id))
})

// ---------- scrolling: own scroll container, no layout shift on snap ----------
let scroller = window
const scrollerIsWindow = ref(true)
function findScroller(el) {
  for (let p = el?.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if (oy === 'auto' || oy === 'scroll') return p
  }
  return window
}
const scrollTop = () => (scroller === window ? scrollY : scroller.scrollTop)
const viewTop = () => (scroller === window ? document.querySelector('.shell')?.offsetHeight || 52 : scroller.getBoundingClientRect().top)
let ticking = false
let lockUntil = 0 // keep the clicked anchor highlighted while smooth-scrolling
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    ticking = false
    const h = headerEl.value?.offsetHeight || 200
    snapped.value = scrollTop() > h - 8
    if (Date.now() < lockUntil) return
    const line = viewTop() + 64
    let cur = sections.value[0]?.id
    for (const s of sections.value) {
      const el = document.getElementById(s.id)
      if (el && el.getBoundingClientRect().top <= line) cur = s.id
    }
    // at the very bottom, highlight the last section
    const atEnd = scroller === window ? innerHeight + scrollY >= document.body.scrollHeight - 4 : scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
    activeSection.value = atEnd ? sections.value[sections.value.length - 1].id : cur
  })
}
function scrollTo(id) {
  const el = document.getElementById(id)
  if (!el) return
  activeSection.value = id
  lockUntil = Date.now() + 900
  const top = el.getBoundingClientRect().top - viewTop() + scrollTop() - 56
  scroller.scrollTo({ top, behavior: 'smooth' })
}
const toTop = () => scroller.scrollTo({ top: 0, behavior: 'smooth' })
function bindScroller() {
  scroller.removeEventListener?.('scroll', onScroll)
  scroller = findScroller(root.value)
  scrollerIsWindow.value = scroller === window
  scroller.addEventListener('scroll', onScroll, { passive: true })
}

// ---------- prev / next & keyboard ----------
const navIndex = computed(() => (nav ? nav.names.value.indexOf(doc.value.name) : -1))
function step(d) {
  const n = nav?.names.value[navIndex.value + d]
  if (n) nav.go(n)
}
function onKey(e) {
  if (state.dialog || pick.value || e.ctrlKey || e.metaKey || e.altKey) return
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return
  const k = e.key.toLowerCase()
  if (k === 'j') step(1)
  else if (k === 'k') step(-1)
  else if (k === 'escape' && props.inFcl) emit('close')
  else if (k === 'f' && props.inFcl && props.canFull) emit('toggle-full')
  else return
  e.preventDefault()
}

// ---------- data & actions ----------
const metaCache = new Map()
async function loadMeta() {
  const dt = m.value.doctype
  if (!metaCache.has(dt)) metaCache.set(dt, api.formMeta(dt).catch(() => null))
  fmeta.value = await metaCache.get(dt)
}
async function load() {
  loadMeta()
  data.value = await api.getDocument(m.value.doctype, docName.value)
  await nextTick()
  bindScroller()
  onScroll()
}
function askSupplier(title, filters) {
  return new Promise((resolve) => (pick.value = { title, supplier: '', filters, resolve }))
}
async function run(a) {
  const dt = m.value.doctype
  const args = {}
  if (a.key === 'save') return router.push(`/${m.value.key}/${encodeURIComponent(doc.value.name)}/edit`)
  if (a.key === 'compare') return router.push(`/rfq/${encodeURIComponent(doc.value.name)}/compare`)
  if (['cancel', 'delete'].includes(a.key)) {
    const ok = await confirmBox({ title: `${a.label} ${doc.value.name}?`, message: a.key === 'cancel' ? 'Cancelling reverses all postings for this document.' : 'This draft will be permanently deleted.', confirmText: a.label, type: 'negative' })
    if (!ok) return
  }
  if (['hold', 'close'].includes(a.key)) {
    const reason = await confirmBox({ title: `${a.label} Purchase Order`, message: `Put ${doc.value.name} ${a.key === 'hold' ? 'on hold' : 'to closed'}.`, input: 'Reason (shared in activity)', confirmText: a.label })
    if (!reason) return
    args.reason = reason === true ? '' : reason
  }
  if (a.key === 'submit') {
    const ok = await confirmBox({ title: a.label, message: `Submit ${doc.value.name}? Submitted documents can only be cancelled, not edited.`, confirmText: a.label })
    if (!ok) return
  }
  if (dt === 'Material Request' && ['make_po', 'make_sq'].includes(a.key)) {
    const s = await askSupplier(a.key === 'make_po' ? 'Create Purchase Order for supplier' : 'Record quotation from supplier')
    if (!s) return
    args.supplier = s
  }
  if (dt === 'Request for Quotation' && a.key === 'record_quote') {
    const invited = (doc.value.suppliers || []).map((x) => x.supplier)
    const s = await askSupplier('Record quotation from invited supplier', { name: ['in', invited] })
    if (!s) return
    args.supplier = s
  }
  busy.value = true
  try {
    const r = await api.runAction(dt, doc.value.name, a.key, args)
    toast(r.message)
    emit('changed')
    if (r.deleted) return router.push(`/${m.value.key}`)
    if (r.doctype && r.doctype !== dt) {
      const tm = BY_DOCTYPE[r.doctype]
      router.push(`/${tm.key}/${encodeURIComponent(r.name)}${tm.form ? '/edit' : ''}`)
    } else if (r.name && r.name !== doc.value.name) {
      router.push(`/${m.value.key}/${encodeURIComponent(r.name)}`)
    } else await load()
  } catch {
    /* toast already shown */
  } finally {
    busy.value = false
  }
}
async function postComment() {
  if (!comment.value.trim()) return
  await api.addComment(m.value.doctype, doc.value.name, comment.value.trim())
  comment.value = ''
  toast('Comment posted')
  load()
}
async function onFiles(files) {
  const list = [...(files || [])]
  if (!list.length) return
  uploading.value = list.length
  let ok = 0
  for (const f of list) {
    try {
      await api.upload(m.value.doctype, doc.value.name, f)
      ok++
    } catch { /* toast shown */ }
    uploading.value--
  }
  if (ok) toast(`${ok} file(s) attached`)
  load()
}
async function removeFile(f) {
  const yes = await confirmBox({ title: 'Remove attachment?', message: f.file_name, confirmText: 'Remove', type: 'negative' })
  if (!yes) return
  await api.removeAttachment(f.name)
  toast('Attachment removed')
  load()
}
async function copyLink() {
  const url = `${location.origin}/procure/${m.value.key}/${encodeURIComponent(doc.value.name)}`
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: url })
    document.body.appendChild(t)
    t.select()
    document.execCommand('copy')
    t.remove()
  }
  copied.value = true
  toast('Link copied', 'info', 2000)
  setTimeout(() => (copied.value = false), 1500)
}

// keep the active anchor tab visible inside the (horizontally scrollable) anchor bar
watch(activeSection, async () => {
  await nextTick()
  const b = root.value?.querySelector('.anchor button.on')
  const bar = b?.parentElement
  if (b && bar) bar.scrollTo({ left: b.offsetLeft - bar.clientWidth / 2 + b.offsetWidth / 2, behavior: 'smooth' })
})
watch(() => [props.module, props.name], () => {
  dismissed.clear()
  itemQuery.value = ''
  load()
})
onMounted(() => {
  load()
  addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  scroller.removeEventListener?.('scroll', onScroll)
  removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.op { padding-bottom: 1.5rem; --sticky-top: 0px; min-height: 100%; }
.op.win { --sticky-top: var(--shell-h); }
.op-loading { padding: 1.5rem 2rem; }
.op-body { flex: 1; }
.details-body { padding: 0 0 0.5rem; }
.details-body :deep(.dyn-tabs) { margin: 0 1rem; box-shadow: none; }
.details-body :deep(.dyn-sec-head) { padding: 0.75rem 1rem; background: var(--surface-2); }
.details-body :deep(.dyn-cols) { padding: 1rem; }

/* expanded header: plain block, scrolls away with content (no sticky → no layout jump) */
.op-header { padding: 1rem 2rem 0.25rem; background: var(--surface); background-image: var(--hero-grad); }
.in-fcl .op-header { padding: 1rem 1.25rem 0.25rem; }
.top-row { gap: 0.5rem; margin-bottom: 0.25rem; }
.top-row .breadcrumbs { margin: 0; }
.pager { display: flex; align-items: center; gap: 0.125rem; }
.pager .muted { font-size: 0.75rem; margin-right: 0.25rem; font-variant-numeric: tabular-nums; }
.title-row { gap: 0.875rem; align-items: center; }
.avatar-obj { width: 3rem; height: 3rem; border-radius: 0.75rem; display: grid; place-items: center; flex: none; background: var(--brand-soft); color: var(--brand); }
.header-actions { gap: 0.25rem; flex-wrap: wrap; }
.header-content { display: flex; gap: 2rem; flex-wrap: wrap; padding: 1rem 0 0.75rem; }
.header-facts { flex: 1; min-width: 16rem; }
.in-fcl .header-facts { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.kpis { display: flex; gap: 2rem; flex-wrap: wrap; }
.kpi .k { font-size: 0.8125rem; color: var(--text-2); }
.kpi .v { font-size: 1.625rem; font-weight: 300; margin: 0.125rem 0 0.375rem; font-variant-numeric: tabular-nums; }
.kpi .v small { font-size: 1rem; }
.kpi .v.critical { color: var(--critical-text); }
.kpi .progress { width: 7rem; }

/* message strips */
.strips { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem; }
.strip { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.5rem 0.5rem 0.875rem; border-radius: 0.5rem; border: 1px solid transparent; font-size: 0.875rem; background: var(--info-bg); border-color: color-mix(in srgb, var(--info) 30%, transparent); color: var(--text); }
.strip > svg { color: var(--info); flex: none; }
.strip.critical { background: var(--critical-bg); border-color: color-mix(in srgb, var(--critical) 35%, transparent); }
.strip.critical > svg { color: var(--critical); }
.strip.negative { background: var(--negative-bg); border-color: color-mix(in srgb, var(--negative) 30%, transparent); }
.strip.negative > svg { color: var(--negative); }
.strip-enter-active, .strip-leave-active { transition: all 0.25s var(--ease); }
.strip-enter-from, .strip-leave-to { opacity: 0; transform: translateY(-4px); }

/* sticky bar: fixed height, only opacity/transform animate */
.op-sticky {
  position: sticky; top: var(--sticky-top); z-index: 30;
  display: flex; align-items: center; gap: 0.75rem; height: 3rem; padding: 0 2rem;
  background: var(--glass); backdrop-filter: saturate(1.6) blur(14px); -webkit-backdrop-filter: saturate(1.6) blur(14px);
  border-bottom: 1px solid var(--border-soft);
  transition: box-shadow 0.25s var(--ease);
}
.in-fcl .op-sticky { padding: 0 1.25rem; }
.op-sticky.snapped { box-shadow: 0 6px 16px -10px rgba(34, 54, 73, 0.35); }
.snap-title {
  display: flex; align-items: center; gap: 0.5rem; min-width: 0; max-width: 0; overflow: hidden; white-space: nowrap;
  opacity: 0; transform: translateY(6px); pointer-events: none;
  transition: max-width 0.35s var(--ease), opacity 0.25s var(--ease), transform 0.25s var(--ease);
}
.snapped .snap-title { max-width: 26rem; opacity: 1; transform: none; pointer-events: auto; }
.snap-ico { width: 1.75rem; height: 1.75rem; border-radius: 0.5rem; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand); flex: none; }
.anchor { flex: 1; min-width: 0; border-bottom: 0; height: 100%; scrollbar-width: none; }
.anchor::-webkit-scrollbar { display: none; }
.anchor button { height: 100%; }
.snap-actions { display: flex; gap: 0.125rem; opacity: 0; transition: opacity 0.25s; }
.snapped .snap-actions { opacity: 1; }

.op-body { padding: 1rem 2rem; display: flex; flex-direction: column; gap: 1rem; }
.in-fcl .op-body { padding: 1rem 1.25rem; }
.sec { animation: fade-up 0.4s var(--ease) both; }
.sec:nth-child(2) { animation-delay: 60ms; } .sec:nth-child(3) { animation-delay: 120ms; } .sec:nth-child(n + 4) { animation-delay: 180ms; }

.mini-search { position: relative; width: 13rem; }
.mini-search svg { position: absolute; left: 0.5rem; top: 50%; transform: translateY(-50%); color: var(--text-3); }
.mini-search .input { padding-left: 1.75rem; }

.totals { margin-left: auto; width: min(24rem, 100%); padding: 0.75rem 1rem 1rem; display: flex; flex-direction: column; gap: 0.375rem; }
.totals div { display: flex; justify-content: space-between; gap: 1rem; color: var(--text-2); }
.totals b { color: var(--text); font-variant-numeric: tabular-nums; }
.totals .grand { border-top: 1px solid var(--border-soft); padding-top: 0.5rem; margin-top: 0.25rem; font-size: 1.0625rem; color: var(--text); }
.totals .due b { color: var(--critical-text); }

/* supplier 360 */
.sup { display: grid; grid-template-columns: minmax(14rem, 1fr) 2fr; gap: 1.5rem; align-items: center; }
@media (max-width: 900px) { .sup { grid-template-columns: 1fr; } }
.sup-id { display: flex; gap: 0.875rem; align-items: center; min-width: 0; }
.sup-avatar { width: 3rem; height: 3rem; border-radius: 50%; flex: none; display: grid; place-items: center; font-weight: 700; color: #fff; background: linear-gradient(135deg, #0070f2, #00a99d); }
.sup-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
@media (max-width: 560px) { .sup-stats { grid-template-columns: 1fr; } }
.sstat { position: relative; overflow: hidden; padding: 0.75rem 0.875rem; border-radius: 0.625rem; background: var(--surface-2); display: flex; flex-direction: column; }
.sstat .k { font-size: 0.75rem; color: var(--text-2); }
.sstat .v { font-size: 1.375rem; font-weight: 600; }
.sstat.warn { background: var(--negative-bg); }
.neg { color: var(--negative); }
.ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }

/* attachments */
.drop {
  display: flex; align-items: center; justify-content: center; gap: 0.625rem; padding: 1.25rem; cursor: pointer;
  border: 1.5px dashed var(--border); border-radius: 0.75rem; color: var(--text-2); transition: all 0.2s var(--ease);
}
.drop:hover, .drop.over { border-color: var(--brand); background: var(--brand-soft); color: var(--brand); }
.drop.over { transform: scale(1.01); }
.files { list-style: none; margin: 0.75rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.files li { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; border-radius: 0.5rem; animation: fade-up 0.3s var(--ease) both; }
.files li:hover { background: var(--surface-hover); }
.f-ico { width: 2.25rem; height: 2.25rem; border-radius: 0.5rem; flex: none; display: grid; place-items: center; font-size: 0.625rem; font-weight: 800; background: var(--info-bg); color: var(--info); }
.f-ico[data-ext='PDF'] { background: var(--negative-bg); color: var(--negative); }
.f-ico[data-ext='XLSX'], .f-ico[data-ext='CSV'], .f-ico[data-ext='XLS'] { background: var(--positive-bg); color: var(--positive); }
.f-name { font-weight: 600; }

.notes :deep(p) { margin: 0 0 0.5rem; }
.comment-box { display: flex; gap: 0.5rem; align-items: flex-end; margin-bottom: 1rem; }
.comment-box textarea { min-height: 2.75rem; }
.timeline { list-style: none; margin: 0; padding: 0; position: relative; }
.timeline::before { content: ''; position: absolute; left: 0.6875rem; top: 0.5rem; bottom: 0.5rem; width: 2px; background: var(--border-soft); }
.timeline li { position: relative; display: flex; gap: 0.75rem; padding: 0.5rem 0; }
.tl-dot { position: relative; z-index: 1; flex: none; width: 1.5rem; height: 1.5rem; border-radius: 50%; display: grid; place-items: center; background: var(--neutral-bg); color: var(--text-2); }
.Comment .tl-dot { background: var(--info-bg); color: var(--info); }
.Created .tl-dot { background: var(--positive-bg); color: var(--positive); }
.kbd-hint { text-align: center; font-size: 0.75rem; padding: 0.5rem; }
kbd { font: 600 0.6875rem var(--font); padding: 0.0625rem 0.3125rem; border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 0.25rem; }

.op { display: flex; flex-direction: column; }
/* sticky inside the page's own column (never under the sidebar, in split or full screen) */
.footer-bar, .footer-bar.infcl {
  position: sticky; left: auto; right: auto; bottom: 1rem; transform: none;
  width: auto; margin: 0.5rem 2rem 0; animation-name: footer-in-r;
}
.in-fcl .footer-bar { margin: 0.5rem 1.25rem 0; }
@media (max-width: 720px) { .footer-bar, .in-fcl .footer-bar { margin: 0.5rem 0.75rem 0; bottom: 0.5rem; } }
@media (max-width: 720px) {
  .op-header { padding: 0.75rem 1rem 0.25rem; }
  .op-sticky, .in-fcl .op-sticky { padding: 0 0.5rem; }
  .op-body { padding: 1rem; }
  .hide-mob, .kbd-hint, .pager .muted { display: none; }
}
.overlay { position: fixed; inset: 0; z-index: 150; background: rgba(0, 0, 0, 0.45); display: grid; place-items: center; padding: 1rem; }
.dialog { width: min(30rem, 100%); background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-3); overflow: visible; }
.dialog header { display: flex; gap: 0.5rem; align-items: center; padding: 1rem 1.25rem; border-bottom: 3px solid var(--brand); }
.dialog header h3 { font-size: 1rem; }
.dialog-body { padding: 1rem 1.25rem 1.5rem; }
.dialog footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.75rem 1.25rem; background: var(--surface-2); border-radius: 0 0 var(--radius) var(--radius); }
</style>
