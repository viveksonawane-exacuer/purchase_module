// Pre-flight for "Required By" dates: warn before submitting a document whose item dates
// have already passed, and ask for a fresh date before turning it into a Purchase Order
// (ERPNext refuses a PO line whose Required By is before the order date).
import { api } from './api'
import { confirmBox, fmtDate } from './store'

const DOCTYPES = ['Material Request', 'Request for Quotation', 'Supplier Quotation', 'Purchase Order']
const line = (r) => `Row ${r.idx}: ${r.item_name} · Required By ${fmtDate(r.date)}`
const plusDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

async function check(doctype, nameOrDoc) {
  if (!DOCTYPES.includes(doctype)) return null
  const args = typeof nameOrDoc === 'string' ? { name: nameOrDoc } : { doc: nameOrDoc }
  const r = await api.requiredByCheck(doctype, args).catch(() => null)
  return r?.rows?.length ? r : null
}

/** Before submit: true to go ahead, false if the user backed out. */
export async function confirmSubmitWithDates(doctype, nameOrDoc, label) {
  const r = await check(doctype, nameOrDoc)
  if (!r) return null // nothing to warn about: caller shows its usual confirm
  const po = doctype === 'Purchase Order'
  return !!(await confirmBox({
    title: 'Required By date has passed',
    type: 'critical',
    message: po
      ? `${r.rows.length} line(s) of this order are already past their Required By date. Submit anyway?`
      : `${r.rows.length} line(s) are past their Required By date. A Purchase Order cannot be created with these dates. You will be asked for a new Required By date when you create the PO.\n\nSubmit ${label || 'this document'} anyway?`,
    details: r.rows.map(line),
    confirmText: 'Submit anyway',
  }))
}

/** Before Create PO: {} when dates are fine, { schedule_date } when the user picked one, null if cancelled. */
export async function askPoRequiredBy(doctype, name) {
  const r = await check(doctype, name)
  if (!r) return {}
  const v = await confirmBox({
    title: 'Pick a new Required By date',
    type: 'critical',
    message: `The Required By date on ${r.rows.length} line(s) is before today, so the Purchase Order cannot use it. Choose the date you now need these items by.`,
    details: r.rows.map(line),
    input: 'New Required By',
    inputType: 'date',
    value: plusDays(r.today, 7),
    min: r.today,
    confirmText: 'Create Purchase Order',
  })
  return v ? { schedule_date: v } : null
}
