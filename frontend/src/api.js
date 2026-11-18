// Thin wrapper over Frappe's REST endpoints.
import { state, toast } from './store'

function csrf() {
  const t = window.csrf_token
  return t && !t.startsWith('{{') ? t : ''
}

function parseServerMessages(data) {
  try {
    return JSON.parse(data._server_messages || '[]').map((m) => {
      const o = typeof m === 'string' ? JSON.parse(m) : m
      return (o.message || '').replace(/<[^>]+>/g, '')
    })
  } catch {
    return []
  }
}

export async function call(method, args = {}, opts = {}) {
  if (opts.background) return doCall(method, args, opts) // no top loader (live previews)
  state.pending++
  try {
    return await doCall(method, args, opts)
  } finally {
    state.pending--
  }
}

async function doCall(method, args = {}, { post = false, silent = false } = {}) {
  const url = `/api/method/${method}`
  let res
  if (post) {
    const body = new FormData()
    for (const [k, v] of Object.entries(args)) {
      if (v === undefined || v === null) continue
      body.append(k, typeof v === 'object' ? JSON.stringify(v) : v)
    }
    res = await fetch(url, {
      method: 'POST',
      body,
      headers: { 'X-Frappe-CSRF-Token': csrf(), Accept: 'application/json' },
      credentials: 'include',
    })
  } else {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(args)) {
      if (v === undefined || v === null) continue
      qs.append(k, typeof v === 'object' ? JSON.stringify(v) : v)
    }
    res = await fetch(`${url}?${qs}`, { headers: { Accept: 'application/json' }, credentials: 'include' })
  }
  let data = {}
  try {
    data = await res.json()
  } catch {
    /* non-json */
  }
  if (res.status === 403 && data.exc_type === 'CSRFTokenError') location.reload()
  if (!res.ok || data.exc) {
    const msgs = parseServerMessages(data)
    const msg = msgs.join('\n') || data.exception || data.exc_type || `Request failed (${res.status})`
    if (!silent) toast(msg.replace(/^[\w.]+Error: /, ''), 'error')
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data.message
}

const M = 'purchase_module.api.'
const F = 'purchase_module.forms.'
export const api = {
  boot: () => call(M + 'boot'),
  dashboard: () => call(M + 'dashboard'),
  getDocument: (doctype, name) => call(M + 'get_document', { doctype, name }),
  runAction: (doctype, name, action, args) => call(M + 'run_action', { doctype, name, action, args }, { post: true }),
  saveDocument: (doc, submit = 0) => call(M + 'save_document', { doc, submit }, { post: true }),
  itemDetails: (item_code, supplier, warehouse) => call(M + 'item_details', { item_code, supplier, warehouse }),
  rfqComparison: (rfq) => call(M + 'rfq_comparison', { rfq }),
  inventory: (warehouse, search) => call(M + 'inventory_overview', { warehouse, search }),
  formMeta: (doctype) => call(F + 'get_form_meta', { doctype }),
  formPreview: (doc) => call(F + 'form_preview', { doc }, { post: true, silent: true, background: true }),
  fetchValues: (doctype, name, fields) => call(F + 'fetch_values', { doctype, name, fields }, { silent: true, background: true }),
  reportDefaults: () => call(F + 'report_defaults'),
  runReport: (report_name, filters) => call(F + 'run_report', { report_name, filters }),
  setCompany: (company) => call(M + 'set_company', { company }, { post: true }),
  reorderOverview: () => call(M + 'reorder_overview'),
  createReorderRequests: (rows) => call(M + 'create_reorder_requests', { rows }, { post: true }),
  itemStock: (item_code) => call(M + 'item_stock_detail', { item_code }),
  finance: () => call(M + 'finance_overview'),
  doctypeDashboard: (module, months) => call(M + 'doctype_dashboard', { module, months }),
  dashboardHub: () => call(M + 'dashboard_hub'),
  vendorDashboard: () => call(M + 'vendor_dashboard'),
  vendorDoc: (doctype, name) => call(M + 'vendor_get_document', { doctype, name }),
  vendorQuote: (rfq, items, terms, valid_till) =>
    call(M + 'vendor_submit_quotation', { rfq, items, terms, valid_till }, { post: true }),
  vendorAck: (name, note) => call(M + 'vendor_acknowledge_po', { name, note }, { post: true }),

  getList: (doctype, opts) =>
    call('frappe.client.get_list', {
      doctype,
      fields: opts.fields,
      filters: opts.filters,
      order_by: opts.order_by,
      limit_start: opts.start || 0,
      limit_page_length: opts.limit || 20,
    }),
  getCount: (doctype, filters) => call('frappe.client.get_count', { doctype, filters }),
  searchLink: (doctype, txt, filters) =>
    call('frappe.desk.search.search_link', { doctype, txt, filters, page_length: 12 }, { silent: true }),
  addComment: (doctype, name, content) =>
    call(
      'frappe.desk.form.utils.add_comment',
      {
        reference_doctype: doctype,
        reference_name: name,
        content,
        comment_email: window.__boot?.user,
        comment_by: window.__boot?.full_name,
      },
      { post: true },
    ),
  logout: () => call('logout', {}, { post: true }),
  removeAttachment: (fid) => call('frappe.desk.form.utils.remove_attach', { fid }, { post: true }),
  async upload(doctype, docname, file) {
    const body = new FormData()
    body.append('file', file, file.name)
    if (doctype && docname) {
      body.append('doctype', doctype)
      body.append('docname', docname)
    }
    body.append('is_private', 1)
    state.pending++
    try {
      const res = await fetch('/api/method/upload_file', { method: 'POST', body, credentials: 'include', headers: { 'X-Frappe-CSRF-Token': csrf(), Accept: 'application/json' } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.exc) {
        const msg = parseServerMessages(data).join('\n') || `Upload failed (${res.status})`
        toast(msg, 'error')
        throw new Error(msg)
      }
      return data.message
    } finally {
      state.pending--
    }
  },
}

export function pdfUrl(doctype, name) {
  return `/api/method/frappe.utils.print_format.download_pdf?doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(name)}`
}
