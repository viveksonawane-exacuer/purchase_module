"""Desk-equivalent form metadata, live recalculation and report execution for the portal.

The portal renders forms from the real DocType metadata (tabs, sections, columns, field
types, select options, depends_on rules, child tables), so what users see matches Desk.
"""

import frappe
from frappe import _
from frappe.utils import getdate, nowdate

from purchase_module.api import PROCURE_DOCTYPES, _check_doctype, _default_company, _parse

LAYOUT = {"Section Break", "Column Break", "Tab Break"}
# field types the portal does not render as inputs
SKIP_TYPES = {"HTML", "Button", "Fold", "Heading", "Image", "Password", "Signature", "Barcode", "Geolocation"}
FIELD_PROPS = (
	"fieldname",
	"label",
	"fieldtype",
	"options",
	"reqd",
	"read_only",
	"default",
	"description",
	"depends_on",
	"mandatory_depends_on",
	"read_only_depends_on",
	"fetch_from",
	"fetch_if_empty",
	"in_list_view",
	"columns",
	"precision",
	"allow_on_submit",
	"bold",
	"collapsible",
	"collapsible_depends_on",
	"non_negative",
	"length",
)
# link targets that Desk filters to non-group records
GROUP_DOCTYPES = {"Warehouse", "Account", "Cost Center", "Item Group", "Supplier Group", "Territory"}


def _link_filters(fieldtype, target, cache={}):  # noqa: B006 - per-process memo
	"""Generic version of Desk's set_query: same company, leaf nodes, enabled records."""
	if fieldtype != "Link" or not target or not frappe.db.exists("DocType", target):
		return None
	if target not in cache:
		meta = frappe.get_meta(target)
		f = {}
		if meta.has_field("company") and target not in ("Company",):
			f["company"] = "$company"
		if target in GROUP_DOCTYPES and meta.has_field("is_group"):
			f["is_group"] = 0
		if meta.has_field("disabled"):
			f["disabled"] = 0
		if target == "Item":
			f["has_variants"] = 0
		cache[target] = f or None
	return cache[target]


def _field(df):
	d = {k: df.get(k) for k in FIELD_PROPS if df.get(k) not in (None, "", 0)}
	d["label"] = _(df.label) if df.label else ""
	if df.fieldtype == "Link":
		lf = _link_filters(df.fieldtype, df.options)
		if lf:
			d["link_filters"] = lf
	return d


def _layout(meta):
	"""Turn the flat field list into tabs -> sections -> columns -> fields."""
	tabs = []
	tab = {"label": _("Details"), "fieldname": "__details", "sections": []}
	section = None
	column = None

	def new_section(df=None):
		nonlocal section, column
		section = {
			"label": _(df.label) if df and df.label else "",
			"fieldname": df.fieldname if df else None,
			"collapsible": bool(df and df.collapsible),
			"depends_on": df.depends_on if df else None,
			"columns": [],
		}
		column = []
		section["columns"].append(column)
		tab["sections"].append(section)

	for df in meta.fields:
		if df.fieldtype == "Tab Break":
			if tab["sections"]:
				tabs.append(tab)
			tab = {"label": _(df.label or ""), "fieldname": df.fieldname, "depends_on": df.depends_on, "sections": []}
			section = None
			continue
		if df.fieldtype == "Section Break" or section is None:
			new_section(df if df.fieldtype == "Section Break" else None)
			if df.fieldtype == "Section Break":
				continue
		if df.fieldtype == "Column Break":
			column = []
			section["columns"].append(column)
			continue
		if df.hidden or df.fieldtype in SKIP_TYPES:
			continue
		column.append(_field(df))
	if tab["sections"]:
		tabs.append(tab)

	# drop empty columns / sections / tabs
	for t in tabs:
		for s in t["sections"]:
			s["columns"] = [c for c in s["columns"] if c]
		t["sections"] = [s for s in t["sections"] if s["columns"]]
	return [t for t in tabs if t["sections"]]


def _child_meta(meta):
	out = {}
	for df in meta.get_table_fields():
		cm = frappe.get_meta(df.options)
		fields = [_field(f) for f in cm.fields if not f.hidden and f.fieldtype not in LAYOUT | SKIP_TYPES]
		out[df.options] = {
			"fields": fields,
			"list_view": [f["fieldname"] for f in fields if f.get("in_list_view")][:8],
		}
	return out


@frappe.whitelist()
def get_form_meta(doctype):
	_check_doctype(doctype)
	frappe.has_permission(doctype, "read", throw=True)
	meta = frappe.get_meta(doctype)
	return {
		"doctype": doctype,
		"is_submittable": meta.is_submittable,
		"title_field": meta.title_field,
		"autoname": meta.autoname,
		"tabs": _layout(meta),
		"children": _child_meta(meta),
		"company": _default_company(),
	}


@frappe.whitelist(methods=["POST"])
def form_preview(doc):
	"""Desk's client triggers, server side: fill missing values (party details, item rates,
	UoM, taxes) and recalculate totals for an unsaved document, without writing anything."""
	doc = _parse(doc)
	_check_doctype(doc.get("doctype"))
	frappe.has_permission(doc["doctype"], "create" if not doc.get("name") else "write", throw=True)
	frappe.db.savepoint("procure_preview")
	try:
		d = frappe.get_doc(doc)
		d.company = d.get("company") or _default_company()
		if d.meta.has_field("supplier") and not d.get("supplier"):
			d.flags.ignore_party = True
		for method in ("set_missing_values", "set_missing_item_details", "calculate_taxes_and_totals"):
			fn = getattr(d, method, None)
			if not fn:
				continue
			try:
				fn()
			except Exception:
				frappe.clear_messages()
		if d.doctype == "Stock Entry":
			for m in ("set_missing_values", "set_stock_entry_type", "calculate_rate_and_amount"):
				try:
					getattr(d, m)()
				except Exception:
					frappe.clear_messages()
		return d.as_dict(convert_dates_to_str=True, no_nulls=True)
	finally:
		frappe.db.rollback(save_point="procure_preview")
		frappe.clear_messages()


@frappe.whitelist()
def fetch_values(doctype, name, fields):
	"""Values for fetch_from fields (e.g. supplier -> supplier_name) when a link is picked."""
	fields = [f for f in (_parse(fields) or []) if isinstance(f, str) and f.isidentifier()]
	if not fields or not frappe.db.exists(doctype, name):
		return {}
	frappe.has_permission(doctype, "read", doc=name, throw=True)
	meta = frappe.get_meta(doctype)
	fields = [f for f in fields if meta.has_field(f) or f == "name"]
	return frappe.db.get_value(doctype, name, fields, as_dict=True) or {}


# --------------------------------------------------------------------------- #
# Reports
# --------------------------------------------------------------------------- #

REPORTS = {
	"Purchase Order Analysis",
	"Purchase Analytics",
	"Item-wise Purchase History",
	"Procurement Tracker",
	"Requested Items to Order and Receive",
	"Supplier Quotation Comparison",
	"Stock Balance",
	"Stock Ledger",
	"Stock Projected Qty",
	"Stock Ageing",
	"Item Shortage Report",
	"Warehouse Wise Stock Balance",
	"Accounts Payable",
	"Accounts Payable Summary",
	"General Ledger",
	"Purchase Register",
	"Item-wise Purchase Register",
	"Supplier Ledger Summary",
	"Trial Balance",
}


@frappe.whitelist()
def report_defaults():
	"""Values report filters default to in Desk (company, fiscal year)."""
	from erpnext.accounts.utils import get_fiscal_year

	company = _default_company()
	try:
		fy = get_fiscal_year(getdate(nowdate()), company=company, as_dict=True)
	except Exception:
		frappe.clear_messages()
		fy = None
	return {
		"company": company,
		"fiscal_year": fy.name if fy else None,
		"year_start": str(fy.year_start_date) if fy else None,
		"year_end": str(fy.year_end_date) if fy else None,
		"allowed": sorted(r for r in REPORTS if frappe.db.exists("Report", r) and frappe.has_permission("Report", "read", r)),
	}


@frappe.whitelist()
def run_report(report_name, filters=None):
	if report_name not in REPORTS:
		frappe.throw(_("Report {0} is not available in the portal").format(report_name))
	from frappe.desk.query_report import run

	filters = _parse(filters) or {}
	filters = {k: v for k, v in filters.items() if v not in (None, "", [])}
	if "company" not in filters:
		filters["company"] = _default_company()
	res = run(report_name, filters=filters, ignore_prepared_report=True, are_default_filters=False)
	ref = frappe.get_cached_value("Report", report_name, ["ref_doctype", "report_type", "add_total_row"], as_dict=True)
	res["ref_doctype"] = ref.ref_doctype if ref else None
	res["add_total_row"] = ref.add_total_row if ref else 0
	return res
