// Shared helpers for the financial accounting pages (/accounts/...).
import { reactive } from 'vue'
import { call } from '../../api'
import { fmtMoney, state } from '../../store'

const A = 'purchase_module.accounts.'
export const finApi = {
  context: () => call(A + 'context'),
  coa: (as_on) => call(A + 'chart_of_accounts', { as_on }),
  accountDetail: (account) => call(A + 'account_detail', { account }, { background: true }),
  trialBalance: (args) => call(A + 'trial_balance', args),
  balanceSheet: (args) => call(A + 'balance_sheet', args),
  profitLoss: (args) => call(A + 'profit_and_loss', args),
  cashFlow: (args) => call(A + 'cash_flow', args),
  generalLedger: (args) => call(A + 'general_ledger', args),
}

// fiscal-year context, fetched once per company
export const fin = reactive({ ctx: null, company: null })
export async function loadContext() {
  if (!fin.ctx || fin.company !== state.boot?.company) {
    fin.ctx = await finApi.context()
    fin.company = state.boot?.company
  }
  return fin.ctx
}

export const iso = (d) => {
  const x = new Date(d)
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
export function monthEnd(offset = 0, from = new Date()) {
  return iso(new Date(from.getFullYear(), from.getMonth() + 1 + offset, 0))
}
export function monthStart(offset = 0, from = new Date()) {
  return iso(new Date(from.getFullYear(), from.getMonth() + offset, 1))
}
export function quarterStart(ctx, date = new Date()) {
  // fiscal quarters counted from the fiscal year start month
  const fyStart = new Date(ctx.fy_start)
  const m = (date.getFullYear() - fyStart.getFullYear()) * 12 + date.getMonth() - fyStart.getMonth()
  return iso(new Date(fyStart.getFullYear(), fyStart.getMonth() + Math.floor(m / 3) * 3, 1))
}

/** Date-range presets shown as a segmented control. */
export function rangePresets(ctx) {
  const t = ctx.today
  return [
    { key: 'fy', label: 'FY to date', from: ctx.fy_start, to: t },
    { key: 'q', label: 'This quarter', from: quarterStart(ctx), to: t },
    { key: 'm', label: 'This month', from: monthStart(0), to: t },
    { key: 'lm', label: 'Last month', from: monthStart(-1), to: monthEnd(-1) },
  ]
}

/** Money without the currency symbol, negatives in brackets (accounting style). */
export function amt(v, { blankZero = true, brackets = true } = {}) {
  const n = +v || 0
  if (blankZero && Math.abs(n) < 0.005) return '–'
  const s = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n))
  return n < 0 ? (brackets ? `(${s})` : `-${s}`) : s
}
export const money = (v) => fmtMoney(v, fin.ctx?.currency)
/** Balance with Dr / Cr suffix, the way ledgers print it. */
export function drcr(v) {
  const n = +v || 0
  if (Math.abs(n) < 0.005) return '–'
  return `${amt(Math.abs(n))} ${n > 0 ? 'Dr' : 'Cr'}`
}
export const pct = (v) => (v === null || v === undefined || !isFinite(v) ? '–' : `${(v * 100).toFixed(1)}%`)

export function glRoute(account, from_date, to_date, extra = {}) {
  return { path: '/accounts/general-ledger', query: { account, from_date, to_date, ...extra } }
}

// portal route for a voucher when the portal has a page for it, else ERP Desk
const PORTAL = {
  'Purchase Invoice': 'pi',
  'Payment Entry': 'payment',
  'Purchase Receipt': 'grn',
  'Journal Entry': 'je',
  'Stock Entry': 'se',
  'Stock Reconciliation': 'sr',
  'Purchase Order': 'po',
}
export function voucherLink(type, name) {
  const k = PORTAL[type]
  if (k) return { to: `/${k}/${encodeURIComponent(name)}` }
  return { href: `/app/${type.toLowerCase().replace(/ /g, '-')}/${encodeURIComponent(name)}` }
}

export function downloadCsv(filename, header, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }))
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Expand/collapse state for account hierarchies (SAP "hierarchy level"). */
export function useTree(level = 2) {
  const t = reactive({ level, open: new Set(), closed: new Set() })
  t.isOpen = (r) => (t.closed.has(r.account) ? false : t.open.has(r.account) || r.depth < t.level - 1)
  t.toggle = (r) => {
    if (t.isOpen(r)) {
      t.open.delete(r.account)
      t.closed.add(r.account)
    } else {
      t.closed.delete(r.account)
      t.open.add(r.account)
    }
  }
  t.setLevel = (l) => {
    t.level = l
    t.open.clear()
    t.closed.clear()
  }
  /** rows visible given the open state (rows are in tree / lft order). */
  t.visible = (rows) => {
    const out = []
    const hiddenUnder = []
    for (const r of rows) {
      while (hiddenUnder.length && r.depth <= hiddenUnder[hiddenUnder.length - 1]) hiddenUnder.pop()
      if (hiddenUnder.length) continue
      out.push(r)
      if (r.is_group && !t.isOpen(r)) hiddenUnder.push(r.depth)
    }
    return out
  }
  return t
}
