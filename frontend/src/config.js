// Metadata that drives the generic List Report, Object Page and Form views.
// Field types: link | date | data | money | number | percent | status | text | select

import { addDays, today } from './store'

export const MODULES = {
  pr: {
    key: 'pr',
    doctype: 'Material Request',
    title: 'Purchase Requisitions',
    singular: 'Purchase Requisition',
    short: 'PR',
    icon: 'ClipboardList',
    baseFilters: [['material_request_type', '=', 'Purchase']],
    titleField: 'name',
    subtitle: (d) => d.title || `${(d.items || []).length} item(s)`,
    columns: [
      { field: 'name', label: 'Requisition', type: 'title' },
      { field: 'transaction_date', label: 'Requested On', type: 'date' },
      { field: 'schedule_date', label: 'Required By', type: 'date' },
      { field: 'set_warehouse', label: 'Warehouse' },
      { field: 'owner', label: 'Requested By', type: 'user' },
      { field: 'per_ordered', label: 'Ordered', type: 'percent' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    filters: [
      { field: 'status', label: 'Status', type: 'select', options: ['', 'Draft', 'Pending', 'Partially Ordered', 'Ordered', 'Stopped', 'Cancelled'] },
      { field: 'set_warehouse', label: 'Warehouse', type: 'link', doctype: 'Warehouse' },
      { field: 'transaction_date', label: 'Requested From', type: 'date', op: '>=' },
    ],
    quickTabs: [
      { label: 'All', filters: [] },
      { label: 'Drafts', filters: [['docstatus', '=', 0]] },
      { label: 'Pending', filters: [['status', 'in', ['Pending', 'Partially Ordered']]] },
      { label: 'Ordered', filters: [['status', '=', 'Ordered']] },
    ],
    facts: [
      { field: 'transaction_date', label: 'Requested On', type: 'date' },
      { field: 'schedule_date', label: 'Required By', type: 'date' },
      { field: 'set_warehouse', label: 'Target Warehouse' },
      { field: 'company', label: 'Company' },
      { field: 'owner', label: 'Requester', type: 'user' },
    ],
    kpis: [
      { field: 'per_ordered', label: 'Ordered', type: 'percent' },
      { field: 'per_received', label: 'Received', type: 'percent' },
    ],
    form: {
      defaults: () => ({ material_request_type: 'Purchase', transaction_date: today(), schedule_date: addDays(7) }),
      fields: [
        { field: 'transaction_date', label: 'Requested On', type: 'date', reqd: true },
        { field: 'schedule_date', label: 'Required By', type: 'date', reqd: true },
        { field: 'set_warehouse', label: 'Target Warehouse', type: 'link', doctype: 'Warehouse', reqd: true },
        { field: 'title', label: 'Purpose / Title', type: 'data' },
      ],
      items: ['item_code', 'qty', 'uom', 'schedule_date', 'warehouse', 'rate'],
    },
  },

  rfq: {
    key: 'rfq',
    doctype: 'Request for Quotation',
    title: 'Requests for Quotation',
    singular: 'Request for Quotation',
    short: 'RFQ',
    icon: 'Send',
    columns: [
      { field: 'name', label: 'RFQ', type: 'title' },
      { field: 'transaction_date', label: 'Date', type: 'date' },
      { field: 'schedule_date', label: 'Required By', type: 'date' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    filters: [
      { field: 'status', label: 'Status', type: 'select', options: ['', 'Draft', 'Submitted', 'Cancelled'] },
      { field: 'transaction_date', label: 'Date From', type: 'date', op: '>=' },
    ],
    quickTabs: [
      { label: 'All', filters: [] },
      { label: 'Drafts', filters: [['docstatus', '=', 0]] },
      { label: 'Open', filters: [['status', '=', 'Submitted']] },
    ],
    facts: [
      { field: 'transaction_date', label: 'Date', type: 'date' },
      { field: 'schedule_date', label: 'Required By', type: 'date' },
      { field: 'company', label: 'Company' },
      { field: 'owner', label: 'Buyer', type: 'user' },
    ],
    form: {
      defaults: () => ({
        transaction_date: today(),
        schedule_date: addDays(14),
        message_for_supplier: 'Please share your best quotation for the items below.',
        suppliers: [],
      }),
      fields: [
        { field: 'transaction_date', label: 'Date', type: 'date', reqd: true },
        { field: 'schedule_date', label: 'Required By', type: 'date' },
        { field: 'message_for_supplier', label: 'Message for Suppliers', type: 'text', wide: true, reqd: true },
      ],
      suppliers: true,
      items: ['item_code', 'qty', 'uom', 'schedule_date', 'warehouse'],
    },
  },

  sq: {
    key: 'sq',
    doctype: 'Supplier Quotation',
    hasCurrency: true, // doctype has a `currency` field (money columns use it)
    title: 'Supplier Quotations',
    singular: 'Supplier Quotation',
    short: 'SQ',
    icon: 'FileBadge',
    partyField: 'supplier',
    columns: [
      { field: 'name', label: 'Quotation', type: 'title' },
      { field: 'supplier_name', label: 'Supplier' },
      { field: 'transaction_date', label: 'Date', type: 'date' },
      { field: 'valid_till', label: 'Valid Till', type: 'date' },
      { field: 'grand_total', label: 'Total', type: 'money' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    filters: [
      { field: 'supplier', label: 'Supplier', type: 'link', doctype: 'Supplier' },
      { field: 'status', label: 'Status', type: 'select', options: ['', 'Draft', 'Submitted', 'Ordered', 'Expired', 'Cancelled'] },
    ],
    quickTabs: [
      { label: 'All', filters: [] },
      { label: 'Drafts', filters: [['docstatus', '=', 0]] },
      { label: 'Submitted', filters: [['status', '=', 'Submitted']] },
      { label: 'Ordered', filters: [['status', '=', 'Ordered']] },
    ],
    facts: [
      { field: 'supplier_name', label: 'Supplier' },
      { field: 'transaction_date', label: 'Date', type: 'date' },
      { field: 'valid_till', label: 'Valid Till', type: 'date' },
      { field: 'currency', label: 'Currency' },
    ],
    kpis: [{ field: 'grand_total', label: 'Quoted Value', type: 'money' }],
    form: {
      defaults: () => ({ transaction_date: today(), valid_till: addDays(30) }),
      fields: [
        { field: 'supplier', label: 'Supplier', type: 'link', doctype: 'Supplier', reqd: true },
        { field: 'transaction_date', label: 'Date', type: 'date', reqd: true },
        { field: 'valid_till', label: 'Valid Till', type: 'date' },
      ],
      items: ['item_code', 'qty', 'uom', 'rate', 'amount'],
    },
  },

  po: {
    key: 'po',
    doctype: 'Purchase Order',
    hasCurrency: true, // doctype has a `currency` field (money columns use it)
    title: 'Purchase Orders',
    singular: 'Purchase Order',
    short: 'PO',
    icon: 'ShoppingCart',
    partyField: 'supplier',
    columns: [
      { field: 'name', label: 'Purchase Order', type: 'title' },
      { field: 'supplier_name', label: 'Supplier' },
      { field: 'transaction_date', label: 'Order Date', type: 'date' },
      { field: 'schedule_date', label: 'Delivery', type: 'date' },
      { field: 'grand_total', label: 'Net Value', type: 'money' },
      { field: 'per_received', label: 'Received', type: 'percent' },
      { field: 'per_billed', label: 'Billed', type: 'percent' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    filters: [
      { field: 'supplier', label: 'Supplier', type: 'link', doctype: 'Supplier' },
      {
        field: 'status',
        label: 'Status',
        type: 'select',
        options: ['', 'Draft', 'To Receive and Bill', 'To Bill', 'To Receive', 'Completed', 'On Hold', 'Closed', 'Cancelled'],
      },
      { field: 'transaction_date', label: 'Ordered From', type: 'date', op: '>=' },
      { field: 'grand_total', label: 'Min. Value', type: 'number', op: '>=' },
    ],
    quickTabs: [
      { label: 'All', filters: [] },
      { label: 'To Approve', filters: [['docstatus', '=', 0]] },
      { label: 'To Receive', filters: [['status', 'in', ['To Receive and Bill', 'To Receive']]] },
      { label: 'To Bill', filters: [['status', 'in', ['To Receive and Bill', 'To Bill']]] },
      { label: 'Completed', filters: [['status', '=', 'Completed']] },
    ],
    facts: [
      { field: 'supplier_name', label: 'Supplier' },
      { field: 'transaction_date', label: 'Order Date', type: 'date' },
      { field: 'schedule_date', label: 'Delivery Date', type: 'date' },
      { field: 'set_warehouse', label: 'Ship-to Warehouse' },
      { field: 'payment_terms_template', label: 'Payment Terms' },
      { field: 'owner', label: 'Buyer', type: 'user' },
    ],
    kpis: [
      { field: 'grand_total', label: 'Net Value', type: 'money' },
      { field: 'per_received', label: 'Received', type: 'percent' },
      { field: 'per_billed', label: 'Billed', type: 'percent' },
    ],
    form: {
      defaults: () => ({ transaction_date: today(), schedule_date: addDays(10) }),
      fields: [
        { field: 'supplier', label: 'Supplier', type: 'link', doctype: 'Supplier', reqd: true },
        { field: 'transaction_date', label: 'Order Date', type: 'date', reqd: true },
        { field: 'schedule_date', label: 'Delivery Date', type: 'date', reqd: true },
        { field: 'set_warehouse', label: 'Ship-to Warehouse', type: 'link', doctype: 'Warehouse' },
      ],
      items: ['item_code', 'qty', 'uom', 'rate', 'schedule_date', 'amount'],
    },
  },

  grn: {
    key: 'grn',
    doctype: 'Purchase Receipt',
    hasCurrency: true, // doctype has a `currency` field (money columns use it)
    title: 'Goods Receipts',
    singular: 'Goods Receipt',
    short: 'GRN',
    icon: 'PackageCheck',
    partyField: 'supplier',
    columns: [
      { field: 'name', label: 'Receipt', type: 'title' },
      { field: 'supplier_name', label: 'Supplier' },
      { field: 'posting_date', label: 'Posting Date', type: 'date' },
      { field: 'set_warehouse', label: 'Warehouse' },
      { field: 'grand_total', label: 'Value', type: 'money' },
      { field: 'per_billed', label: 'Billed', type: 'percent' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    filters: [
      { field: 'supplier', label: 'Supplier', type: 'link', doctype: 'Supplier' },
      { field: 'status', label: 'Status', type: 'select', options: ['', 'Draft', 'To Bill', 'Partly Billed', 'Completed', 'Return', 'Cancelled'] },
    ],
    quickTabs: [
      { label: 'All', filters: [] },
      { label: 'Drafts', filters: [['docstatus', '=', 0]] },
      { label: 'To Bill', filters: [['status', '=', 'To Bill']] },
    ],
    facts: [
      { field: 'supplier_name', label: 'Supplier' },
      { field: 'posting_date', label: 'Posting Date', type: 'date' },
      { field: 'set_warehouse', label: 'Accepted Warehouse' },
      { field: 'supplier_delivery_note', label: 'Delivery Note #' },
    ],
    kpis: [
      { field: 'grand_total', label: 'Receipt Value', type: 'money' },
      { field: 'per_billed', label: 'Billed', type: 'percent' },
    ],
    form: {
      fields: [
        { field: 'posting_date', label: 'Posting Date', type: 'date', reqd: true },
        { field: 'supplier_delivery_note', label: 'Supplier Delivery Note #', type: 'data' },
        { field: 'set_warehouse', label: 'Accepted Warehouse', type: 'link', doctype: 'Warehouse' },
      ],
      items: ['item_code', 'qty', 'rejected_qty', 'uom', 'rate', 'amount'],
    },
  },

  pi: {
    key: 'pi',
    doctype: 'Purchase Invoice',
    hasCurrency: true, // doctype has a `currency` field (money columns use it)
    title: 'Supplier Invoices',
    singular: 'Supplier Invoice',
    short: 'INV',
    icon: 'Receipt',
    partyField: 'supplier',
    columns: [
      { field: 'name', label: 'Invoice', type: 'title' },
      { field: 'supplier_name', label: 'Supplier' },
      { field: 'bill_no', label: 'Supplier Ref.' },
      { field: 'posting_date', label: 'Posting', type: 'date' },
      { field: 'due_date', label: 'Due', type: 'date' },
      { field: 'grand_total', label: 'Amount', type: 'money' },
      { field: 'outstanding_amount', label: 'Outstanding', type: 'money' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    filters: [
      { field: 'supplier', label: 'Supplier', type: 'link', doctype: 'Supplier' },
      { field: 'status', label: 'Status', type: 'select', options: ['', 'Draft', 'Unpaid', 'Overdue', 'Partly Paid', 'Paid', 'Cancelled'] },
      { field: 'due_date', label: 'Due Before', type: 'date', op: '<=' },
    ],
    quickTabs: [
      { label: 'All', filters: [] },
      { label: 'Drafts', filters: [['docstatus', '=', 0]] },
      { label: 'Unpaid', filters: [['outstanding_amount', '>', 0], ['docstatus', '=', 1]] },
      { label: 'Overdue', filters: [['status', '=', 'Overdue']] },
    ],
    facts: [
      { field: 'supplier_name', label: 'Supplier' },
      { field: 'bill_no', label: 'Supplier Invoice #' },
      { field: 'bill_date', label: 'Supplier Invoice Date', type: 'date' },
      { field: 'posting_date', label: 'Posting Date', type: 'date' },
      { field: 'due_date', label: 'Due Date', type: 'date' },
    ],
    kpis: [
      { field: 'grand_total', label: 'Invoice Amount', type: 'money' },
      { field: 'outstanding_amount', label: 'Outstanding', type: 'money', tone: 'critical' },
    ],
    form: {
      fields: [
        { field: 'posting_date', label: 'Posting Date', type: 'date', reqd: true },
        { field: 'bill_no', label: 'Supplier Invoice #', type: 'data' },
        { field: 'bill_date', label: 'Supplier Invoice Date', type: 'date' },
        { field: 'due_date', label: 'Due Date', type: 'date' },
      ],
      items: ['item_code', 'qty', 'uom', 'rate', 'amount'],
    },
  },

  payment: {
    key: 'payment',
    doctype: 'Payment Entry',
    title: 'Supplier Payments',
    singular: 'Payment',
    short: 'PAY',
    icon: 'Banknote',
    baseFilters: [['party_type', '=', 'Supplier']],
    columns: [
      { field: 'name', label: 'Payment', type: 'title' },
      { field: 'party_name', label: 'Supplier' },
      { field: 'posting_date', label: 'Date', type: 'date' },
      { field: 'mode_of_payment', label: 'Mode' },
      { field: 'reference_no', label: 'Reference' },
      { field: 'paid_amount', label: 'Amount', type: 'money' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    filters: [
      { field: 'party', label: 'Supplier', type: 'link', doctype: 'Supplier' },
      { field: 'mode_of_payment', label: 'Mode', type: 'link', doctype: 'Mode of Payment' },
    ],
    quickTabs: [
      { label: 'All', filters: [] },
      { label: 'Drafts', filters: [['docstatus', '=', 0]] },
      { label: 'Posted', filters: [['docstatus', '=', 1]] },
    ],
    facts: [
      { field: 'party_name', label: 'Supplier' },
      { field: 'posting_date', label: 'Posting Date', type: 'date' },
      { field: 'mode_of_payment', label: 'Mode of Payment' },
      { field: 'paid_from', label: 'Paid From' },
      { field: 'reference_no', label: 'Reference #' },
    ],
    kpis: [{ field: 'paid_amount', label: 'Paid Amount', type: 'money' }],
    noItems: true,
    form: {
      noCreate: true,
      fields: [
        { field: 'posting_date', label: 'Posting Date', type: 'date', reqd: true },
        { field: 'mode_of_payment', label: 'Mode of Payment', type: 'link', doctype: 'Mode of Payment' },
        { field: 'paid_amount', label: 'Paid Amount', type: 'number', reqd: true },
        { field: 'reference_no', label: 'Cheque / Reference #', type: 'data' },
        { field: 'reference_date', label: 'Reference Date', type: 'date' },
      ],
    },
  },

  // ---------------- Stock ----------------
  se: {
    key: 'se',
    doctype: 'Stock Entry',
    title: 'Stock Entries',
    singular: 'Stock Entry',
    short: 'STE',
    icon: 'ArrowLeftRight',
    noStatus: true,
    columns: [
      { field: 'name', label: 'Stock Entry', type: 'title' },
      { field: 'stock_entry_type', label: 'Type' },
      { field: 'posting_date', label: 'Posting Date', type: 'date' },
      { field: 'from_warehouse', label: 'From' },
      { field: 'to_warehouse', label: 'To' },
      { field: 'total_amount', label: 'Value', type: 'money' },
      { field: 'docstatus', label: 'Status', type: 'status' },
    ],
    filters: [
      { field: 'stock_entry_type', label: 'Type', type: 'link', doctype: 'Stock Entry Type' },
      { field: 'from_warehouse', label: 'From Warehouse', type: 'link', doctype: 'Warehouse' },
      { field: 'to_warehouse', label: 'To Warehouse', type: 'link', doctype: 'Warehouse' },
      { field: 'posting_date', label: 'Posted From', type: 'date', op: '>=' },
    ],
    quickTabs: [
      { label: 'All', filters: [] },
      { label: 'Drafts', filters: [['docstatus', '=', 0]] },
      { label: 'Receipts', filters: [['purpose', '=', 'Material Receipt']] },
      { label: 'Issues', filters: [['purpose', '=', 'Material Issue']] },
      { label: 'Transfers', filters: [['purpose', '=', 'Material Transfer']] },
    ],
    facts: [
      { field: 'stock_entry_type', label: 'Type' },
      { field: 'posting_date', label: 'Posting Date', type: 'date' },
      { field: 'from_warehouse', label: 'Source Warehouse' },
      { field: 'to_warehouse', label: 'Target Warehouse' },
      { field: 'owner', label: 'Created By', type: 'user' },
    ],
    kpis: [{ field: 'total_amount', label: 'Total Value', type: 'money' }],
    form: { defaults: () => ({ posting_date: today() }) },
  },

  sr: {
    key: 'sr',
    doctype: 'Stock Reconciliation',
    title: 'Stock Reconciliations',
    singular: 'Stock Reconciliation',
    short: 'SR',
    icon: 'ClipboardCheck',
    noStatus: true,
    columns: [
      { field: 'name', label: 'Reconciliation', type: 'title' },
      { field: 'purpose', label: 'Purpose' },
      { field: 'posting_date', label: 'Posting Date', type: 'date' },
      { field: 'difference_amount', label: 'Difference', type: 'money' },
      { field: 'docstatus', label: 'Status', type: 'status' },
    ],
    filters: [
      { field: 'purpose', label: 'Purpose', type: 'select', options: ['', 'Opening Stock', 'Stock Reconciliation'] },
      { field: 'posting_date', label: 'Posted From', type: 'date', op: '>=' },
    ],
    quickTabs: [
      { label: 'All', filters: [] },
      { label: 'Drafts', filters: [['docstatus', '=', 0]] },
      { label: 'Posted', filters: [['docstatus', '=', 1]] },
    ],
    facts: [
      { field: 'purpose', label: 'Purpose' },
      { field: 'posting_date', label: 'Posting Date', type: 'date' },
      { field: 'expense_account', label: 'Difference Account' },
    ],
    kpis: [{ field: 'difference_amount', label: 'Difference Amount', type: 'money' }],
    form: { defaults: () => ({ posting_date: today() }) },
  },

  item: {
    key: 'item',
    doctype: 'Item',
    title: 'Items',
    singular: 'Item',
    short: 'Item',
    icon: 'Package',
    noStatus: true,
    noCompany: true,
    noItems: true,
    master: true,
    columns: [
      { field: 'name', label: 'Item Code', type: 'title' },
      { field: 'item_name', label: 'Item Name' },
      { field: 'item_group', label: 'Item Group' },
      { field: 'stock_uom', label: 'UoM' },
      { field: 'valuation_rate', label: 'Valuation Rate', type: 'money' },
    ],
    filters: [
      { field: 'item_group', label: 'Item Group', type: 'link', doctype: 'Item Group' },
      { field: 'brand', label: 'Brand', type: 'link', doctype: 'Brand' },
    ],
    quickTabs: [
      { label: 'All', filters: [] },
      { label: 'Stock Items', filters: [['is_stock_item', '=', 1]] },
      { label: 'Purchase Items', filters: [['is_purchase_item', '=', 1]] },
      { label: 'Disabled', filters: [['disabled', '=', 1]] },
    ],
    facts: [
      { field: 'item_name', label: 'Item Name' },
      { field: 'item_group', label: 'Item Group' },
      { field: 'stock_uom', label: 'Stock UoM' },
      { field: 'brand', label: 'Brand' },
    ],
    form: {},
  },

  // ---------------- Accounts ----------------
  je: {
    key: 'je',
    doctype: 'Journal Entry',
    title: 'Journal Entries',
    singular: 'Journal Entry',
    short: 'JV',
    icon: 'BookOpen',
    noStatus: true,
    noItems: true,
    columns: [
      { field: 'name', label: 'Journal Entry', type: 'title' },
      { field: 'voucher_type', label: 'Type' },
      { field: 'posting_date', label: 'Posting Date', type: 'date' },
      { field: 'cheque_no', label: 'Reference' },
      { field: 'total_debit', label: 'Amount', type: 'money' },
      { field: 'docstatus', label: 'Status', type: 'status' },
    ],
    filters: [
      { field: 'voucher_type', label: 'Type', type: 'select', options: ['', 'Journal Entry', 'Bank Entry', 'Cash Entry', 'Credit Note', 'Debit Note', 'Contra Entry', 'Opening Entry', 'Depreciation Entry'] },
      { field: 'posting_date', label: 'Posted From', type: 'date', op: '>=' },
    ],
    quickTabs: [
      { label: 'All', filters: [] },
      { label: 'Drafts', filters: [['docstatus', '=', 0]] },
      { label: 'Posted', filters: [['docstatus', '=', 1]] },
    ],
    facts: [
      { field: 'voucher_type', label: 'Entry Type' },
      { field: 'posting_date', label: 'Posting Date', type: 'date' },
      { field: 'cheque_no', label: 'Reference #' },
      { field: 'user_remark', label: 'Remark' },
    ],
    kpis: [{ field: 'total_debit', label: 'Total Debit', type: 'money' }],
    form: { defaults: () => ({ posting_date: today() }) },
  },

  // ---------------- Masters ----------------
  supplier: {
    key: 'supplier',
    doctype: 'Supplier',
    title: 'Suppliers',
    singular: 'Supplier',
    short: 'Supplier',
    icon: 'Building2',
    noStatus: true,
    noCompany: true,
    noItems: true,
    master: true,
    columns: [
      { field: 'name', label: 'Supplier', type: 'title' },
      { field: 'supplier_name', label: 'Name' },
      { field: 'supplier_group', label: 'Group' },
      { field: 'country', label: 'Country' },
      { field: 'supplier_type', label: 'Type' },
    ],
    filters: [
      { field: 'supplier_group', label: 'Supplier Group', type: 'link', doctype: 'Supplier Group' },
      { field: 'country', label: 'Country', type: 'link', doctype: 'Country' },
    ],
    quickTabs: [
      { label: 'All', filters: [] },
      { label: 'Active', filters: [['disabled', '=', 0]] },
      { label: 'On Hold', filters: [['on_hold', '=', 1]] },
      { label: 'Disabled', filters: [['disabled', '=', 1]] },
    ],
    facts: [
      { field: 'supplier_group', label: 'Supplier Group' },
      { field: 'supplier_type', label: 'Type' },
      { field: 'country', label: 'Country' },
      { field: 'default_currency', label: 'Billing Currency' },
      { field: 'tax_id', label: 'Tax ID' },
    ],
    form: {},
  },
}

export const BY_DOCTYPE = Object.fromEntries(Object.values(MODULES).map((m) => [m.doctype, m]))

export const ITEM_COLUMNS = {
  item_code: { label: 'Item', type: 'link', doctype: 'Item', width: '15rem' },
  qty: { label: 'Qty', type: 'number', width: '6rem' },
  rejected_qty: { label: 'Rejected', type: 'number', width: '6rem' },
  uom: { label: 'UoM', type: 'link', doctype: 'UOM', width: '7rem' },
  rate: { label: 'Rate', type: 'number', width: '8rem' },
  amount: { label: 'Amount', type: 'calc', width: '8rem' },
  schedule_date: { label: 'Required By', type: 'date', width: '9.5rem' },
  warehouse: { label: 'Warehouse', type: 'link', doctype: 'Warehouse', width: '12rem' },
}

// Launchpad structure (Fiori "spaces" → groups → tiles)
export const SPACES = [
  {
    id: 'procure',
    label: 'Procurement',
    groups: [
      {
        title: 'Source to Contract',
        tiles: [
          { to: '/pr', title: 'Purchase Requisitions', sub: 'Pending approval & sourcing', icon: 'ClipboardList', kpi: 'pr_open', unit: 'open' },
          { to: '/rfq', title: 'Requests for Quotation', sub: 'Open sourcing events', icon: 'Send', kpi: 'rfq_open', unit: 'open' },
          { to: '/sq', title: 'Supplier Quotations', sub: 'Bids to evaluate', icon: 'FileBadge', kpi: 'sq_received', unit: 'bids' },
          { to: '/pr/new', title: 'Create Requisition', sub: 'Request material', icon: 'FilePlus2', action: true },
        ],
      },
      {
        title: 'Order to Receipt',
        tiles: [
          { to: '/po?tab=1', title: 'Approve Purchase Orders', sub: 'Waiting for release', icon: 'BadgeCheck', kpi: 'po_to_approve', unit: 'to approve', tone: 'critical' },
          { to: '/po', title: 'Manage Purchase Orders', sub: 'This month', icon: 'ShoppingCart', kpi: 'po_value_month', money: true },
          { to: '/po?tab=2', title: 'Post Goods Receipt', sub: 'Orders due for receipt', icon: 'PackageCheck', kpi: 'po_to_receive', unit: 'orders' },
          { to: '/po/new', title: 'Create Purchase Order', sub: 'Direct buy', icon: 'FilePlus2', action: true },
        ],
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    groups: [
      {
        title: 'Accounts Payable',
        tiles: [
          { to: '/finance', title: 'Payables Overview', sub: 'Open liabilities', icon: 'Landmark', kpi: 'payables', money: true },
          { to: '/pi?tab=3', title: 'Overdue Invoices', sub: 'Past due date', icon: 'AlarmClock', kpi: 'pi_overdue', unit: 'invoices', tone: 'negative' },
          { to: '/po?tab=3', title: 'Orders to Invoice', sub: 'Received, not billed', icon: 'Receipt', kpi: 'po_to_bill', unit: 'orders' },
          { to: '/payment', title: 'Supplier Payments', sub: 'Outgoing payments', icon: 'Banknote' },
        ],
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    groups: [
      {
        title: 'Stock & Replenishment',
        tiles: [
          { to: '/inventory', title: 'Stock Overview', sub: 'By item & warehouse', icon: 'Warehouse' },
          { to: '/reorder', title: 'Below Reorder Level', sub: 'Needs replenishment', icon: 'TriangleAlert', kpi: 'low_stock', unit: 'items', tone: 'critical' },
          { to: '/grn', title: 'Goods Receipts', sub: 'Inbound postings', icon: 'Truck' },
        ],
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    groups: [
      {
        title: 'Document Dashboards',
        tiles: [
          { to: '/insights', title: 'Analytics Overview', sub: 'All dashboards', icon: 'TrendingUp' },
          { to: '/insights/pr', title: 'Requisition Analytics', sub: 'Demand & conversion', icon: 'ClipboardList' },
          { to: '/insights/rfq', title: 'RFQ Analytics', sub: 'Response rates', icon: 'Send' },
          { to: '/insights/sq', title: 'Quotation Analytics', sub: 'Bids & win rate', icon: 'FileBadge' },
          { to: '/insights/po', title: 'Purchase Order Analytics', sub: 'Spend & delivery', icon: 'ShoppingCart' },
          { to: '/insights/grn', title: 'Goods Receipt Analytics', sub: 'Inbound & quality', icon: 'PackageCheck' },
          { to: '/insights/pi', title: 'Invoice Analytics', sub: 'Billing & overdue', icon: 'Receipt' },
          { to: '/insights/payment', title: 'Payment Analytics', sub: 'Outflow by mode', icon: 'Banknote' },
        ],
      },
    ],
  },
]

// Sidebar: plain links and collapsible groups (children)
// Standard procure-to-pay sequence (also drives the flow ribbon on forms)
export const P2P = [
  { doctype: 'Material Request', label: 'Requisition', to: '/pr' },
  { doctype: 'Request for Quotation', label: 'RFQ', to: '/rfq' },
  { doctype: 'Supplier Quotation', label: 'Quotation', to: '/sq' },
  { doctype: 'Purchase Order', label: 'Purchase Order', to: '/po' },
  { doctype: 'Purchase Receipt', label: 'Goods Receipt', to: '/grn' },
  { doctype: 'Purchase Invoice', label: 'Invoice', to: '/pi' },
  { doctype: 'Payment Entry', label: 'Payment', to: '/payment' },
]

// Standard ERPNext reports available in the portal (filters come from reports.generated.json)
export const REPORT_GROUPS = [
  {
    key: 'buying',
    label: 'Purchasing',
    icon: 'ShoppingCart',
    reports: [
      { name: 'Purchase Order Analysis', icon: 'ShoppingCart', desc: 'Order, receipt and billing status per PO line' },
      { name: 'Procurement Tracker', icon: 'ListChecks', desc: 'Requisition → order → receipt → invoice per item' },
      { name: 'Purchase Analytics', icon: 'BarChart3', desc: 'Spend trend by supplier, item or group', chart: true },
      { name: 'Item-wise Purchase History', icon: 'History', desc: 'Every purchase of every item, with rates' },
      { name: 'Requested Items to Order and Receive', icon: 'ClipboardList', desc: 'Open requisition lines still to buy' },
      { name: 'Supplier Quotation Comparison', icon: 'Columns2', desc: 'Compare quoted rates across suppliers' },
    ],
  },
  {
    key: 'stock',
    label: 'Stock',
    icon: 'Warehouse',
    reports: [
      { name: 'Stock Balance', icon: 'Boxes', desc: 'Opening, in, out and closing qty & value' },
      { name: 'Stock Ledger', icon: 'History', desc: 'Every stock transaction with running balance' },
      { name: 'Stock Projected Qty', icon: 'Gauge', desc: 'Actual, ordered, reserved and projected qty' },
      { name: 'Stock Ageing', icon: 'Hourglass', desc: 'How long stock has been sitting, by age bucket' },
      { name: 'Warehouse Wise Stock Balance', icon: 'Warehouse', desc: 'Stock value per warehouse' },
      { name: 'Item Shortage Report', icon: 'TriangleAlert', desc: 'Items with negative projected quantity' },
    ],
  },
  {
    key: 'accounts',
    label: 'Accounts',
    icon: 'Landmark',
    reports: [
      { name: 'Accounts Payable', icon: 'Landmark', desc: 'Open supplier invoices with ageing', chart: true },
      { name: 'Accounts Payable Summary', icon: 'Users', desc: 'Payables per supplier with ageing buckets' },
      { name: 'General Ledger', icon: 'BookOpen', desc: 'All GL entries by account, party or voucher' },
      { name: 'Purchase Register', icon: 'FileSpreadsheet', desc: 'Purchase invoices with tax breakup' },
      { name: 'Item-wise Purchase Register', icon: 'Table2', desc: 'Invoice lines by item' },
      { name: 'Supplier Ledger Summary', icon: 'Building2', desc: 'Opening, invoiced, paid and closing per supplier' },
      { name: 'Trial Balance', icon: 'Columns2', desc: 'Debit and credit balances of all accounts' },
    ],
  },
]
// documents with an analytics dashboard (/insights/:key) and the standard reports that go with each
export const DASH_KEYS = ['pr', 'rfq', 'sq', 'po', 'grn', 'pi', 'payment']
export const DASHBOARD_REPORTS = {
  pr: ['Requested Items to Order and Receive', 'Procurement Tracker', 'Purchase Order Analysis'],
  rfq: ['Supplier Quotation Comparison', 'Procurement Tracker', 'Requested Items to Order and Receive'],
  sq: ['Supplier Quotation Comparison', 'Purchase Analytics', 'Item-wise Purchase History'],
  po: ['Purchase Order Analysis', 'Purchase Analytics', 'Item-wise Purchase History', 'Procurement Tracker'],
  grn: ['Purchase Order Analysis', 'Stock Ledger', 'Stock Balance', 'Stock Projected Qty'],
  pi: ['Purchase Register', 'Item-wise Purchase Register', 'Accounts Payable', 'Accounts Payable Summary'],
  payment: ['Accounts Payable', 'Supplier Ledger Summary', 'General Ledger', 'Accounts Payable Summary'],
}
export const REPORTS = Object.fromEntries(REPORT_GROUPS.flatMap((g) => g.reports.map((r) => [r.name, { ...r, group: g.key }])))
export const reportSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
export const REPORT_BY_SLUG = Object.fromEntries(Object.keys(REPORTS).map((n) => [reportSlug(n), n]))

// Sidebar: plain links and collapsible groups (children). `heading` items are section labels.
export const NAV = [
  { to: '/', label: 'Home', icon: 'LayoutGrid' },
  { to: '/inbox', label: 'My Inbox', icon: 'Inbox', badge: 'inbox' },
  {
    group: 'dash', label: 'Dashboards', icon: 'TrendingUp',
    children: [
      { to: '/insights', label: 'Overview', icon: 'LayoutGrid', exact: true },
      { to: '/insights/pr', label: 'Requisitions', icon: 'ClipboardList' },
      { to: '/insights/rfq', label: 'RFQs', icon: 'Send' },
      { to: '/insights/sq', label: 'Quotations', icon: 'FileBadge' },
      { to: '/insights/po', label: 'Purchase Orders', icon: 'ShoppingCart' },
      { to: '/insights/grn', label: 'Goods Receipts', icon: 'PackageCheck' },
      { to: '/insights/pi', label: 'Invoices', icon: 'Receipt' },
      { to: '/insights/payment', label: 'Payments', icon: 'Banknote' },
    ],
  },
  {
    group: 'p2p', label: 'Procure to Pay', icon: 'Workflow',
    children: [
      { heading: 'Process flow' },
      { to: '/pr', label: 'Material Requests', icon: 'ClipboardList', step: 1 },
      { to: '/rfq', label: 'Requests for Quotation', icon: 'Send', step: 2 },
      { to: '/sq', label: 'Supplier Quotations', icon: 'FileBadge', step: 3 },
      { to: '/po', label: 'Purchase Orders', icon: 'ShoppingCart', step: 4 },
      { to: '/grn', label: 'Purchase Receipts', icon: 'PackageCheck', step: 5 },
      { to: '/pi', label: 'Purchase Invoices', icon: 'Receipt', step: 6 },
      { to: '/payment', label: 'Payment Entries', icon: 'Banknote', step: 7 },
      { heading: 'Masters' },
      { to: '/supplier', label: 'Suppliers', icon: 'Building2' },
    ],
  },
  {
    group: 'stock', label: 'Stock', icon: 'Warehouse',
    children: [
      { heading: 'Manage stock' },
      { to: '/inventory', label: 'Stock Overview', icon: 'Warehouse', exact: true },
      { to: '/reorder', label: 'Reorder', icon: 'TriangleAlert' },
      { to: '/se', label: 'Stock Entries', icon: 'ArrowLeftRight' },
      { to: '/sr', label: 'Stock Reconciliation', icon: 'ClipboardCheck' },
      { to: '/item', label: 'Items', icon: 'Package' },
    ],
  },
  {
    group: 'accounts', label: 'Accounts', icon: 'Landmark',
    children: [
      { heading: 'Payables' },
      { to: '/finance', label: 'Payables Overview', icon: 'Landmark' },
      { to: '/pi', label: 'Purchase Invoices', icon: 'Receipt', alias: true },
      { to: '/payment', label: 'Payment Entries', icon: 'Banknote', alias: true },
      { to: '/je', label: 'Journal Entries', icon: 'BookOpen' },
    ],
  },
  { to: '/reports', label: 'Report Center', icon: 'FileSpreadsheet' },
]
