"""Backend API for the Fiori-style Procurement portal (/procure).

Every method checks permissions through Frappe's normal permission system.
Document conversions reuse ERPNext's own mappers, so the portal follows the
standard ERPNext flow:

    Purchase Requisition (Material Request) -> RFQ -> Supplier Quotation
        -> Purchase Order -> Purchase Receipt -> Purchase Invoice -> Payment Entry
"""

import json

import frappe
from frappe import _
from frappe.utils import add_days, add_months, cint, flt, get_first_day, getdate, nowdate

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

PROCURE_DOCTYPES = {
	"Material Request",
	"Request for Quotation",
	"Supplier Quotation",
	"Purchase Order",
	"Purchase Receipt",
	"Purchase Invoice",
	"Payment Entry",
	# stock & accounts documents and masters (generic list / object page / meta-driven form)
	"Stock Entry",
	"Stock Reconciliation",
	"Journal Entry",
	"Supplier",
	"Item",
}
# documents that take part in the procure-to-pay document flow
FLOW_DOCTYPES = {
	"Material Request",
	"Request for Quotation",
	"Supplier Quotation",
	"Purchase Order",
	"Purchase Receipt",
	"Purchase Invoice",
	"Payment Entry",
}

# action key -> (dotted path of ERPNext mapper, target doctype, extra kwargs builder)
CONVERSIONS = {
	("Material Request", "make_rfq"): (
		"erpnext.stock.doctype.material_request.material_request.make_request_for_quotation",
		"Request for Quotation",
	),
	("Material Request", "make_sq"): (
		"erpnext.stock.doctype.material_request.material_request.make_supplier_quotation",
		"Supplier Quotation",
	),
	("Material Request", "make_po"): (
		"erpnext.stock.doctype.material_request.material_request.make_purchase_order",
		"Purchase Order",
	),
	("Supplier Quotation", "make_po"): (
		"erpnext.buying.doctype.supplier_quotation.supplier_quotation.make_purchase_order",
		"Purchase Order",
	),
	("Purchase Order", "make_pr"): (
		"erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_receipt",
		"Purchase Receipt",
	),
	("Purchase Order", "make_pi"): (
		"erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_invoice",
		"Purchase Invoice",
	),
	("Purchase Receipt", "make_pi"): (
		"erpnext.stock.doctype.purchase_receipt.purchase_receipt.make_purchase_invoice",
		"Purchase Invoice",
	),
}


def _check_doctype(doctype):
	if doctype not in PROCURE_DOCTYPES:
		frappe.throw(_("Doctype {0} is not available in the procurement portal").format(doctype))


def _parse(value):
	if isinstance(value, str):
		try:
			return json.loads(value)
		except ValueError:
			return value
	return value


def _companies():
	"""Companies the current user may work in (respects User Permissions)."""
	if frappe.session.user == "Guest" or not frappe.has_permission("Company", "read"):
		return []  # portal users (vendors) have no access to Company
	return frappe.get_list(
		"Company", fields=["name", "abbr", "company_logo", "default_currency"], order_by="name asc", limit_page_length=100
	)


def _default_company():
	"""The company the portal is scoped to: the user's session default (set by the
	company switcher), falling back to the global default / first allowed company."""
	if hasattr(frappe.local, "procure_company"):
		return frappe.local.procure_company
	# lowercase "company" is the session default Desk uses ("Company" is treated as a
	# User Permission key and only read when it holds exactly one permitted value)
	company = (
		frappe.defaults.get_user_default("company")
		or frappe.defaults.get_user_default("Company")
		or frappe.db.get_single_value("Global Defaults", "default_company")
	)
	if frappe.session.user != "Guest":
		allowed = [c.name for c in _companies()]
		if allowed and company not in allowed:
			company = allowed[0]
	company = company or frappe.db.get_value("Company", {}, "name")
	frappe.local.procure_company = company
	return company


def _with_company(doctype, filters):
	"""Add the active company to a filter dict when the doctype has a company field."""
	company = _default_company()
	if company and isinstance(filters, dict) and "company" not in filters and frappe.get_meta(doctype).has_field("company"):
		return {**filters, "company": company}
	return filters


def _company_warehouses():
	company = _default_company()
	return frappe.get_all("Warehouse", filters={"company": company}, pluck="name") if company else None


@frappe.whitelist(methods=["POST"])
def set_company(company):
	"""Company switcher: persist the active company as the user's session default."""
	if company not in [c.name for c in _companies()]:
		frappe.throw(_("You do not have access to company {0}").format(company), frappe.PermissionError)
	# same key as Desk's Session Defaults, so Desk and the portal stay in sync
	frappe.defaults.set_user_default("company", company)
	frappe.local.procure_company = company
	return {"company": company, "currency": frappe.get_cached_value("Company", company, "default_currency")}


def _supplier_for_user(user=None):
	"""Return the Supplier linked to a portal user (via Supplier > Portal Users)."""
	user = user or frappe.session.user
	if user in ("Guest", "Administrator"):
		return None
	return frappe.db.get_value("Portal User", {"parenttype": "Supplier", "user": user}, "parent")


def _require_supplier():
	supplier = _supplier_for_user()
	if not supplier:
		frappe.throw(_("Your user is not linked to any Supplier"), frappe.PermissionError)
	return supplier


# --------------------------------------------------------------------------- #
# Boot / session
# --------------------------------------------------------------------------- #


@frappe.whitelist(allow_guest=True)
def boot():
	user = frappe.session.user
	if user == "Guest":
		return {"user": "Guest"}

	roles = frappe.get_roles(user)
	company = _default_company()
	supplier = _supplier_for_user(user)
	is_internal = any(
		r in roles
		for r in (
			"System Manager",
			"Purchase Manager",
			"Purchase User",
			"Purchase Master Manager",
			"Stock User",
			"Stock Manager",
			"Accounts User",
			"Accounts Manager",
		)
	)
	brand = branding()
	return {
		"user": user,
		"company_logo": brand["logo"],
		"company_abbr": brand["abbr"],
		"full_name": frappe.utils.get_fullname(user),
		"user_image": frappe.db.get_value("User", user, "user_image"),
		"roles": roles,
		"company": company,
		"companies": [{"name": c.name, "abbr": c.abbr, "logo": c.company_logo, "currency": c.default_currency} for c in _companies()]
		if is_internal
		else [],
		"currency": frappe.get_cached_value("Company", company, "default_currency") if company else "INR",
		"supplier": supplier,
		"mode": "internal" if is_internal else ("vendor" if supplier else "none"),
		"can": {
			dt: {
				"read": bool(frappe.has_permission(dt, "read")),
				"create": bool(frappe.has_permission(dt, "create")),
				"submit": bool(frappe.has_permission(dt, "submit")),
			}
			for dt in PROCURE_DOCTYPES
		}
		if is_internal
		else {},
	}


PORTAL_ROLES = (
	"System Manager",
	"Purchase Manager",
	"Purchase User",
	"Purchase Master Manager",
	"Stock User",
	"Stock Manager",
	"Accounts User",
	"Accounts Manager",
	"Supplier",
	"Vendor User",
)


def check_app_permission():
	"""Shows the Procurement Hub icon on the Desk apps screen only to users who can use it."""
	if frappe.session.user == "Administrator":
		return True
	return bool(set(PORTAL_ROLES) & set(frappe.get_roles()))


@frappe.whitelist(allow_guest=True)
def branding():
	"""Public branding for the login page and shell bar: default company name, abbreviation and logo."""
	company = _default_company()
	logo = abbr = None
	if company:
		logo, abbr = frappe.db.get_value("Company", company, ["company_logo", "abbr"]) or (None, None)
	# only expose public files to guests
	if logo and logo.startswith("/private/") and frappe.session.user == "Guest":
		logo = None
	if not logo:
		logo = frappe.db.get_single_value("Navbar Settings", "app_logo") or None
		if logo and logo.startswith("/private/") and frappe.session.user == "Guest":
			logo = None
	return {"company": company, "abbr": abbr, "logo": logo, "site_name": frappe.local.site}


# --------------------------------------------------------------------------- #
# Launchpad / analytics
# --------------------------------------------------------------------------- #


def _count(doctype, filters):
	if not frappe.has_permission(doctype, "read"):
		return None
	return frappe.db.count(doctype, _with_company(doctype, filters))


def _sum(doctype, field, filters):
	if not frappe.has_permission(doctype, "read"):
		return None
	row = frappe.get_list(doctype, filters=_with_company(doctype, filters), fields=[{"SUM": field, "as": "total"}])
	return flt(row[0].total) if row else 0


@frappe.whitelist()
def dashboard():
	today = getdate(nowdate())
	company = _default_company()
	tiles = {
		"pr_open": _count(
			"Material Request",
			{"material_request_type": "Purchase", "docstatus": 1, "status": ["in", ["Pending", "Partially Ordered"]]},
		),
		"pr_draft": _count("Material Request", {"material_request_type": "Purchase", "docstatus": 0}),
		"rfq_open": _count("Request for Quotation", {"docstatus": 1, "status": "Submitted"}),
		"sq_received": _count("Supplier Quotation", {"docstatus": ["<", 2], "status": ["!=", "Ordered"]}),
		"po_to_approve": _count("Purchase Order", {"docstatus": 0}),
		"po_to_receive": _count(
			"Purchase Order", {"docstatus": 1, "status": ["in", ["To Receive and Bill", "To Receive"]]}
		),
		"po_to_bill": _count("Purchase Order", {"docstatus": 1, "status": ["in", ["To Receive and Bill", "To Bill"]]}),
		"po_value_month": _sum(
			"Purchase Order", "base_grand_total", {"docstatus": 1, "transaction_date": [">=", get_first_day(today)]}
		),
		"pi_overdue": _count("Purchase Invoice", {"docstatus": 1, "status": "Overdue"}),
		"payables": _sum("Purchase Invoice", "outstanding_amount", {"docstatus": 1, "outstanding_amount": [">", 0]}),
		"suppliers": _count("Supplier", {"disabled": 0}),
		"low_stock": _low_stock_count(),
	}

	spend = []
	if frappe.has_permission("Purchase Order", "read"):
		start = get_first_day(add_months(today, -5))
		rows = frappe.get_list(
			"Purchase Order",
			filters={"docstatus": 1, "transaction_date": [">=", start], "company": company},
			fields=["transaction_date", "base_grand_total"],
			limit_page_length=0,
		)
		buckets = {}
		for i in range(6):
			key = get_first_day(add_months(today, -5 + i)).strftime("%Y-%m")
			buckets[key] = 0
		for r in rows:
			key = getdate(r.transaction_date).strftime("%Y-%m")
			if key in buckets:
				buckets[key] += flt(r.base_grand_total)
		spend = [{"month": k, "value": v} for k, v in buckets.items()]

	top_suppliers = []
	if frappe.has_permission("Purchase Order", "read"):
		top_suppliers = frappe.get_list(
			"Purchase Order",
			filters={"docstatus": 1, "company": company},
			fields=["supplier", {"SUM": "base_grand_total", "as": "value"}],
			group_by="supplier",
			order_by="value desc",
			limit_page_length=5,
		)

	return {"company": company, "tiles": tiles, "spend": spend, "top_suppliers": top_suppliers}


def _low_stock_count():
	if not frappe.has_permission("Bin", "read"):
		return None
	return len(_low_stock_rows(limit=500))


def _low_stock_rows(limit=50):
	bin_ = frappe.qb.DocType("Bin")
	reorder = frappe.qb.DocType("Item Reorder")
	rows = (
		frappe.qb.from_(bin_)
		.join(reorder)
		.on((reorder.parent == bin_.item_code) & (reorder.warehouse == bin_.warehouse))
		.select(
			bin_.item_code,
			bin_.warehouse,
			bin_.actual_qty,
			bin_.projected_qty,
			bin_.ordered_qty,
			bin_.indented_qty,
			bin_.reserved_qty,
			reorder.warehouse_reorder_level.as_("reorder_level"),
			reorder.warehouse_reorder_qty.as_("reorder_qty"),
			reorder.material_request_type,
		)
		.where(bin_.projected_qty < reorder.warehouse_reorder_level)
		.where(bin_.warehouse.isin(_company_warehouses() or [""]))
		.limit(limit)
		.run(as_dict=True)
	)
	return rows


@frappe.whitelist()
def reorder_overview():
	"""Replenishment workspace: every item/warehouse below its reorder level with the
	shortfall, a suggested quantity, last price and preferred supplier."""
	frappe.has_permission("Bin", "read", throw=True)
	company = _default_company()
	rows = _low_stock_rows(limit=1000)
	codes = list({r.item_code for r in rows}) or [""]
	items = {
		i.name: i
		for i in frappe.get_all(
			"Item",
			filters={"name": ["in", codes]},
			fields=["name", "item_name", "item_group", "stock_uom", "image", "last_purchase_rate", "valuation_rate", "min_order_qty", "lead_time_days"],
		)
	}
	suppliers = {
		d.parent: d.default_supplier
		for d in frappe.get_all(
			"Item Default",
			filters={"parent": ["in", codes], "company": company, "default_supplier": ["is", "set"]},
			fields=["parent", "default_supplier"],
		)
	}
	for r in rows:
		i = items.get(r.item_code) or frappe._dict()
		r.item_name = i.item_name or r.item_code
		r.item_group = i.item_group
		r.uom = i.stock_uom
		r.image = i.image
		r.lead_time_days = i.lead_time_days
		r.supplier = suppliers.get(r.item_code)
		r.rate = flt(i.last_purchase_rate or i.valuation_rate)
		r.material_request_type = r.material_request_type or "Purchase"
		r.shortfall = max(0, flt(r.reorder_level) - flt(r.projected_qty))
		# order the rule's reorder qty, but at least enough to get back to the reorder level
		r.suggested_qty = max(flt(r.reorder_qty), r.shortfall, flt(i.min_order_qty))
		r.urgency = "critical" if flt(r.projected_qty) <= 0 else "low"
	rows.sort(key=lambda r: (r.urgency != "critical", flt(r.projected_qty) - flt(r.reorder_level)))
	return {"rows": rows, "company": company}


@frappe.whitelist(methods=["POST"])
def create_reorder_requests(rows):
	"""Create draft Material Requests (one per request type) for the selected reorder lines."""
	rows = _parse(rows) or []
	frappe.has_permission("Material Request", "create", throw=True)
	company = _default_company()
	allowed = set(_company_warehouses() or [])
	groups = {}
	for r in rows:
		if not r.get("item_code") or flt(r.get("qty")) <= 0 or r.get("warehouse") not in allowed:
			continue
		groups.setdefault(r.get("material_request_type") or "Purchase", []).append(r)
	if not groups:
		frappe.throw(_("Select at least one line with a quantity"))
	created = []
	for mr_type, lines in groups.items():
		lead = max([cint(frappe.db.get_value("Item", l["item_code"], "lead_time_days")) for l in lines] + [7])
		schedule = add_days(nowdate(), lead)
		mr = frappe.get_doc(
			{
				"doctype": "Material Request",
				"material_request_type": mr_type,
				"company": company,
				"transaction_date": nowdate(),
				"schedule_date": schedule,
				"title": _("Reorder {0}").format(nowdate()),
				"items": [
					{"item_code": l["item_code"], "qty": flt(l["qty"]), "warehouse": l["warehouse"], "schedule_date": schedule}
					for l in lines
				],
			}
		)
		mr.insert()
		created.append({"name": mr.name, "type": mr_type, "lines": len(lines)})
	return {"created": created}


# --------------------------------------------------------------------------- #
# Object page: document + document flow + allowed actions
# --------------------------------------------------------------------------- #


@frappe.whitelist()
def get_document(doctype, name):
	_check_doctype(doctype)
	doc = frappe.get_doc(doctype, name)
	doc.check_permission("read")
	party = (
		doc.name
		if doctype == "Supplier"
		else doc.get("supplier") or (doc.get("party") if doc.get("party_type") == "Supplier" else None)
	)
	return {
		"doc": doc.as_dict(),
		"flow": _document_flow(doc) if doctype in FLOW_DOCTYPES else [],
		"actions": _allowed_actions(doc),
		"timeline": _timeline(doc),
		"attachments": _attachments(doc),
		"supplier": supplier_snapshot(party) if party else None,
	}


def _attachments(doc):
	return frappe.get_all(
		"File",
		filters={"attached_to_doctype": doc.doctype, "attached_to_name": doc.name, "is_folder": 0},
		fields=["name", "file_name", "file_url", "file_size", "is_private", "owner", "creation"],
		order_by="creation desc",
	)


@frappe.whitelist()
def supplier_snapshot(supplier):
	"""Supplier 360: master data + spend and open-item figures for the last 12 months."""
	if not supplier or not frappe.has_permission("Supplier", "read", supplier):
		return None
	s = frappe.db.get_value(
		"Supplier",
		supplier,
		["name", "supplier_name", "supplier_group", "country", "email_id", "mobile_no", "image", "on_hold", "disabled"],
		as_dict=True,
	)
	if not s:
		return None
	since = add_months(getdate(nowdate()), -12)
	s.spend_12m = _sum("Purchase Order", "base_grand_total", {"supplier": supplier, "docstatus": 1, "transaction_date": [">=", since]}) or 0
	s.orders_12m = _count("Purchase Order", {"supplier": supplier, "docstatus": 1, "transaction_date": [">=", since]}) or 0
	s.open_orders = _count(
		"Purchase Order",
		{"supplier": supplier, "docstatus": 1, "status": ["in", ["To Receive and Bill", "To Receive", "To Bill"]]},
	) or 0
	s.outstanding = _sum("Purchase Invoice", "outstanding_amount", {"supplier": supplier, "docstatus": 1}) or 0
	s.overdue_invoices = _count("Purchase Invoice", {"supplier": supplier, "docstatus": 1, "status": "Overdue"}) or 0
	last = frappe.get_list(
		"Purchase Order", filters={"supplier": supplier, "docstatus": 1}, fields=["transaction_date"],
		order_by="transaction_date desc", limit_page_length=1,
	)
	s.last_order = last[0].transaction_date if last else None
	return s


def _timeline(doc):
	comments = frappe.get_all(
		"Comment",
		filters={"reference_doctype": doc.doctype, "reference_name": doc.name, "comment_type": ["in", ["Comment", "Info", "Workflow"]]},
		fields=["comment_type", "content", "owner", "creation"],
		order_by="creation desc",
		limit=30,
	)
	versions = frappe.get_all(
		"Version",
		filters={"ref_doctype": doc.doctype, "docname": doc.name},
		fields=["owner", "creation", "data"],
		order_by="creation desc",
		limit=15,
	)
	events = [
		{"type": c.comment_type, "text": c.content, "user": frappe.utils.get_fullname(c.owner), "at": c.creation}
		for c in comments
	]
	for v in versions:
		data = _parse(v.data) or {}
		changed = [c[0] for c in (data.get("changed") or [])][:4]
		text = ", ".join(changed) if changed else _("updated the document")
		events.append({"type": "Version", "text": text, "user": frappe.utils.get_fullname(v.owner), "at": v.creation})
	events.append(
		{"type": "Created", "text": _("created this document"), "user": frappe.utils.get_fullname(doc.owner), "at": doc.creation}
	)
	events.sort(key=lambda e: str(e["at"]), reverse=True)
	return events


def _links_from_items(child_doctype, parent_field, filters):
	"""Distinct parent names in a child table matching filters."""
	if not frappe.db.has_column(child_doctype, parent_field.split(".")[-1]):
		return []
	rows = frappe.get_all(child_doctype, filters=filters, fields=["parent"], distinct=True, limit=50)
	return [r.parent for r in rows]


def _doc_brief(doctype, names):
	out = []
	for n in dict.fromkeys(names):
		if not n:
			continue
		if not frappe.has_permission(doctype, "read", n):
			continue
		v = frappe.db.get_value(doctype, n, ["name", "docstatus", "status"], as_dict=True)
		if v and v.docstatus < 2:
			out.append({"doctype": doctype, "name": v.name, "status": v.status, "docstatus": v.docstatus})
	return out


def _document_flow(doc):
	"""Build the upstream/downstream procurement chain for a document."""
	mr, rfq, sq, po, prc, pi, pe = (set() for _ in range(7))
	dt, name = doc.doctype, doc.name

	def from_mr(names):
		for n in list(names):
			rfq.update(_links_from_items("Request for Quotation Item", "material_request", {"material_request": n}))
			sq.update(_links_from_items("Supplier Quotation Item", "material_request", {"material_request": n}))
			po.update(_links_from_items("Purchase Order Item", "material_request", {"material_request": n}))

	def from_po(names):
		for n in list(names):
			prc.update(_links_from_items("Purchase Receipt Item", "purchase_order", {"purchase_order": n}))
			pi.update(_links_from_items("Purchase Invoice Item", "purchase_order", {"purchase_order": n}))

	def from_pi(names):
		for n in list(names):
			pe.update(
				_links_from_items(
					"Payment Entry Reference", "reference_name", {"reference_doctype": "Purchase Invoice", "reference_name": n}
				)
			)

	items = doc.get("items") or []
	if dt == "Material Request":
		mr.add(name)
	elif dt == "Request for Quotation":
		rfq.add(name)
		mr.update(i.material_request for i in items if i.get("material_request"))
		sq.update(_links_from_items("Supplier Quotation Item", "request_for_quotation", {"request_for_quotation": name}))
	elif dt == "Supplier Quotation":
		sq.add(name)
		mr.update(i.material_request for i in items if i.get("material_request"))
		rfq.update(i.request_for_quotation for i in items if i.get("request_for_quotation"))
		po.update(_links_from_items("Purchase Order Item", "supplier_quotation", {"supplier_quotation": name}))
	elif dt == "Purchase Order":
		po.add(name)
		mr.update(i.material_request for i in items if i.get("material_request"))
		sq.update(i.supplier_quotation for i in items if i.get("supplier_quotation"))
	elif dt == "Purchase Receipt":
		prc.add(name)
		po.update(i.purchase_order for i in items if i.get("purchase_order"))
		pi.update(_links_from_items("Purchase Invoice Item", "purchase_receipt", {"purchase_receipt": name}))
	elif dt == "Purchase Invoice":
		pi.add(name)
		po.update(i.purchase_order for i in items if i.get("purchase_order"))
		prc.update(i.purchase_receipt for i in items if i.get("purchase_receipt"))
	elif dt == "Payment Entry":
		pe.add(name)
		pi.update(r.reference_name for r in doc.get("references") or [] if r.reference_doctype == "Purchase Invoice")
		po.update(r.reference_name for r in doc.get("references") or [] if r.reference_doctype == "Purchase Order")

	def child_values(child_doctype, parents, field):
		vals = set()
		for p in list(parents):
			for r in frappe.get_all(child_doctype, {"parent": p}, [field]):
				if r.get(field):
					vals.add(r.get(field))
		return vals

	# walk upstream: payment -> invoice -> receipt -> order -> quotation -> rfq -> requisition
	po.update(child_values("Purchase Invoice Item", pi, "purchase_order"))
	prc.update(child_values("Purchase Invoice Item", pi, "purchase_receipt"))
	po.update(child_values("Purchase Receipt Item", prc, "purchase_order"))
	sq.update(child_values("Purchase Order Item", po, "supplier_quotation"))
	mr.update(child_values("Purchase Order Item", po, "material_request"))
	rfq.update(child_values("Supplier Quotation Item", sq, "request_for_quotation"))
	mr.update(child_values("Supplier Quotation Item", sq, "material_request"))
	mr.update(child_values("Request for Quotation Item", rfq, "material_request"))

	# then fill downstream from the root
	from_mr(mr)
	for n in list(rfq):
		sq.update(_links_from_items("Supplier Quotation Item", "request_for_quotation", {"request_for_quotation": n}))
	for n in list(sq):
		po.update(_links_from_items("Purchase Order Item", "supplier_quotation", {"supplier_quotation": n}))
	from_po(po)
	for n in list(prc):
		pi.update(_links_from_items("Purchase Invoice Item", "purchase_receipt", {"purchase_receipt": n}))
	from_pi(pi)
	for n in list(po):
		pe.update(
			_links_from_items(
				"Payment Entry Reference", "reference_name", {"reference_doctype": "Purchase Order", "reference_name": n}
			)
		)

	return [
		{"step": "Purchase Requisition", "doctype": "Material Request", "docs": _doc_brief("Material Request", mr)},
		{"step": "RFQ", "doctype": "Request for Quotation", "docs": _doc_brief("Request for Quotation", rfq)},
		{"step": "Supplier Quotation", "doctype": "Supplier Quotation", "docs": _doc_brief("Supplier Quotation", sq)},
		{"step": "Purchase Order", "doctype": "Purchase Order", "docs": _doc_brief("Purchase Order", po)},
		{"step": "Goods Receipt", "doctype": "Purchase Receipt", "docs": _doc_brief("Purchase Receipt", prc)},
		{"step": "Invoice", "doctype": "Purchase Invoice", "docs": _doc_brief("Purchase Invoice", pi)},
		{"step": "Payment", "doctype": "Payment Entry", "docs": _doc_brief("Payment Entry", pe)},
	]


def _allowed_actions(doc):
	"""Actions shown in the object page footer, based on status + permissions."""
	dt, ds, status = doc.doctype, doc.docstatus, doc.get("status")
	can = lambda ptype, d=dt: bool(frappe.has_permission(d, ptype, doc if d == dt else None))  # noqa: E731
	actions = []

	def add(key, label, kind="default", target=None):
		if target and not frappe.has_permission(target, "create"):
			return
		actions.append({"key": key, "label": label, "type": kind})

	if ds == 0:
		if can("write"):
			add("save", _("Save"), "ghost")
		if can("submit"):
			add("submit", _("Submit") if dt != "Purchase Order" else _("Approve & Release"), "emphasized")
		if can("delete"):
			add("delete", _("Delete"), "negative")
		return actions

	if ds == 2:
		if can("create"):
			add("amend", _("Amend"))
		return actions

	# submitted
	if dt == "Material Request" and status not in ("Stopped", "Ordered", "Cancelled"):
		add("make_rfq", _("Create RFQ"), "emphasized", "Request for Quotation")
		add("make_sq", _("Supplier Quotation"), "default", "Supplier Quotation")
		add("make_po", _("Create Purchase Order"), "default", "Purchase Order")
		if can("write"):
			add("stop", _("Stop"), "transparent")
	if dt == "Material Request" and status == "Stopped" and can("write"):
		add("reopen", _("Re-open"))

	if dt == "Request for Quotation":
		add("send_emails", _("Send to Suppliers"), "emphasized")
		add("record_quote", _("Record Quotation"), "default", "Supplier Quotation")
		add("compare", _("Compare Quotations"))

	if dt == "Supplier Quotation" and status != "Ordered":
		add("make_po", _("Award & Create PO"), "emphasized", "Purchase Order")

	if dt == "Purchase Order":
		if status in ("To Receive and Bill", "To Receive"):
			add("make_pr", _("Post Goods Receipt"), "emphasized", "Purchase Receipt")
		if status in ("To Receive and Bill", "To Bill"):
			add("make_pi", _("Create Invoice"), "default", "Purchase Invoice")
		if flt(doc.get("per_billed")) < 100 and status not in ("Closed", "On Hold"):
			add("make_payment", _("Advance Payment"), "default", "Payment Entry")
		if status not in ("Closed", "Completed", "On Hold") and can("submit"):
			add("hold", _("Hold"), "transparent")
			add("close", _("Close"), "transparent")
		if status in ("On Hold", "Closed") and can("submit"):
			add("resume", _("Re-open"))

	if dt == "Purchase Receipt" and status in ("To Bill", "Partly Billed"):
		add("make_pi", _("Create Invoice"), "emphasized", "Purchase Invoice")

	if dt == "Purchase Invoice" and flt(doc.get("outstanding_amount")) > 0:
		add("make_payment", _("Post Payment"), "emphasized", "Payment Entry")

	if can("cancel"):
		add("cancel", _("Cancel"), "negative")
	return actions


@frappe.whitelist(methods=["POST"])
def run_action(doctype, name, action, args=None):
	_check_doctype(doctype)
	args = _parse(args) or {}
	doc = frappe.get_doc(doctype, name)

	if action == "submit":
		doc.check_permission("submit")
		doc.submit()
		return {"doctype": doctype, "name": doc.name, "message": _("{0} submitted").format(doc.name)}

	if action == "cancel":
		doc.check_permission("cancel")
		doc.cancel()
		return {"doctype": doctype, "name": doc.name, "message": _("{0} cancelled").format(doc.name)}

	if action == "delete":
		frappe.delete_doc(doctype, name)
		return {"deleted": True, "message": _("{0} deleted").format(name)}

	if action == "amend":
		new = frappe.copy_doc(doc)
		new.amended_from = doc.name
		new.insert()
		return {"doctype": doctype, "name": new.name, "message": _("Amendment {0} created").format(new.name)}

	if action in ("stop", "reopen") and doctype == "Material Request":
		from erpnext.stock.doctype.material_request.material_request import update_status

		update_status(name, "Stopped" if action == "stop" else "Submitted")
		return {"doctype": doctype, "name": name, "message": _("Status updated")}

	if action in ("hold", "close", "resume") and doctype == "Purchase Order":
		from erpnext.buying.doctype.purchase_order.purchase_order import update_status

		status = {"hold": "On Hold", "close": "Closed", "resume": "Draft"}[action]
		if action == "resume":
			doc.check_permission("submit")
			doc.update_status("Draft")  # recalculates the real status
			return {"doctype": doctype, "name": name, "message": _("Purchase Order re-opened")}
		update_status(status, name)
		if args.get("reason"):
			doc.add_comment("Comment", _("{0}: {1}").format(status, args.get("reason")))
		return {"doctype": doctype, "name": name, "message": _("Purchase Order set to {0}").format(status)}

	if action == "send_emails" and doctype == "Request for Quotation":
		from erpnext.buying.doctype.request_for_quotation.request_for_quotation import send_supplier_emails

		send_supplier_emails(name)
		return {"doctype": doctype, "name": name, "message": _("RFQ emailed to suppliers")}

	if action == "record_quote" and doctype == "Request for Quotation":
		from erpnext.buying.doctype.request_for_quotation.request_for_quotation import (
			make_supplier_quotation_from_rfq,
		)

		supplier = args.get("supplier")
		if not supplier or supplier not in [s.supplier for s in doc.suppliers]:
			frappe.throw(_("Choose one of the suppliers invited to this RFQ"))
		sq = make_supplier_quotation_from_rfq(name, for_supplier=supplier)
		sq.insert()
		return {"doctype": "Supplier Quotation", "name": sq.name, "message": _("Quotation {0} drafted").format(sq.name)}

	if action == "make_payment":
		from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

		pe = get_payment_entry(doctype, name)
		pe.insert()
		return {"doctype": "Payment Entry", "name": pe.name, "message": _("Payment Entry {0} drafted").format(pe.name)}

	conversion = CONVERSIONS.get((doctype, action))
	if conversion:
		path, target_dt = conversion
		mapper = frappe.get_attr(path)
		target = mapper(name)
		if isinstance(target, dict):
			target = frappe.get_doc(target)
		if target_dt == "Request for Quotation" and args.get("suppliers"):
			target.set("suppliers", [])
			for s in args["suppliers"]:
				target.append("suppliers", {"supplier": s})
		if target_dt == "Request for Quotation" and not target.get("message_for_supplier"):
			target.message_for_supplier = _("Please share your best quotation for the items below.")
		if args.get("supplier") and target.meta.has_field("supplier"):
			target.supplier = args["supplier"]
		target.insert()
		return {
			"doctype": target_dt,
			"name": target.name,
			"message": _("{0} {1} created as draft").format(_(target_dt), target.name),
		}

	frappe.throw(_("Unknown action {0}").format(action))


# --------------------------------------------------------------------------- #
# Create / save
# --------------------------------------------------------------------------- #


@frappe.whitelist(methods=["POST"])
def save_document(doc, submit=0):
	doc = _parse(doc)
	_check_doctype(doc.get("doctype"))
	if doc.get("name") and frappe.db.exists(doc["doctype"], doc["name"]):
		d = frappe.get_doc(doc["doctype"], doc["name"])
		d.update(doc)
		d.save()
	else:
		doc.pop("name", None)
		d = frappe.get_doc(doc)
		d.company = d.get("company") or _default_company()
		d.insert()
	if int(submit):
		d.submit()
	return {"doctype": d.doctype, "name": d.name, "message": _("{0} saved").format(d.name)}


@frappe.whitelist()
def item_details(item_code, supplier=None, warehouse=None):
	"""Lightweight item defaults for the item table editor."""
	item = frappe.get_cached_doc("Item", item_code)
	rate = 0
	price_list = frappe.db.get_single_value("Buying Settings", "buying_price_list")
	if price_list:
		rate = frappe.db.get_value("Item Price", {"item_code": item_code, "price_list": price_list}, "price_list_rate") or 0
	if not rate:
		rate = item.last_purchase_rate or item.valuation_rate or 0
	stock_rows = frappe.get_all(
		"Bin",
		filters={"item_code": item_code, **({"warehouse": warehouse} if warehouse else {})},
		fields=[{"SUM": "actual_qty", "as": "qty"}],
	)
	stock = stock_rows[0].qty if stock_rows else 0
	return {
		"item_code": item.name,
		"item_name": item.item_name,
		"description": item.description,
		"uom": item.stock_uom,
		"stock_uom": item.stock_uom,
		"rate": flt(rate),
		"stock_qty": flt(stock),
		"image": item.image,
	}


# --------------------------------------------------------------------------- #
# RFQ quotation comparison
# --------------------------------------------------------------------------- #


@frappe.whitelist()
def rfq_comparison(rfq):
	rfq_doc = frappe.get_doc("Request for Quotation", rfq)
	rfq_doc.check_permission("read")
	sq_names = _links_from_items("Supplier Quotation Item", "request_for_quotation", {"request_for_quotation": rfq})
	quotes = []
	for n in sq_names:
		sq = frappe.get_doc("Supplier Quotation", n)
		if sq.docstatus == 2:
			continue
		quotes.append(
			{
				"name": sq.name,
				"supplier": sq.supplier,
				"supplier_name": sq.supplier_name,
				"status": sq.status,
				"docstatus": sq.docstatus,
				"grand_total": sq.grand_total,
				"currency": sq.currency,
				"valid_till": sq.valid_till,
				"items": {
					i.item_code: {"rate": i.rate, "qty": i.qty, "amount": i.amount, "lead_time_days": i.lead_time_days}
					for i in sq.items
				},
			}
		)
	items = [{"item_code": i.item_code, "item_name": i.item_name, "qty": i.qty, "uom": i.uom} for i in rfq_doc.items]
	invited = [{"supplier": s.supplier, "quote_status": s.quote_status} for s in rfq_doc.suppliers]
	return {"rfq": rfq, "items": items, "quotes": quotes, "suppliers": invited}


# --------------------------------------------------------------------------- #
# Inventory & finance overviews
# --------------------------------------------------------------------------- #


@frappe.whitelist()
def inventory_overview(warehouse=None, search=None):
	frappe.has_permission("Bin", "read", throw=True)
	filters = {}
	warehouses = _company_warehouses()
	if warehouse:
		filters["warehouse"] = warehouse
	if warehouses is not None:
		filters["warehouse"] = ["in", [w for w in warehouses if not warehouse or w == warehouse] or [""]]
	if search:
		filters["item_code"] = ["like", f"%{search}%"]
	bins = frappe.get_list(
		"Bin",
		filters=filters,
		fields=[
			"item_code",
			"warehouse",
			"actual_qty",
			"ordered_qty",
			"reserved_qty",
			"indented_qty",
			"projected_qty",
			"stock_value",
			"valuation_rate",
		],
		order_by="stock_value desc",
		limit_page_length=300,
	)
	names = {b.item_code for b in bins}
	item_map = {
		i.name: i
		for i in frappe.get_all(
			"Item", filters={"name": ["in", list(names) or [""]]}, fields=["name", "item_name", "item_group", "stock_uom"]
		)
	}
	for b in bins:
		i = item_map.get(b.item_code)
		b.item_name = i.item_name if i else b.item_code
		b.item_group = i.item_group if i else ""
		b.uom = i.stock_uom if i else ""
	totals = {
		"stock_value": sum(flt(b.stock_value) for b in bins),
		"items": len(names),
		"warehouses": len({b.warehouse for b in bins}),
		"on_order": sum(flt(b.ordered_qty) for b in bins),
	}
	return {"bins": bins, "low_stock": _low_stock_rows(), "totals": totals}


@frappe.whitelist()
def item_stock_detail(item_code, months=6):
	"""Everything the stock detail drawer needs for one item: master data, per-warehouse
	position, reorder rules, recent movements, monthly in/out trend and purchasing pipeline."""
	frappe.has_permission("Bin", "read", throw=True)
	if not frappe.db.exists("Item", item_code):
		frappe.throw(_("Item {0} not found").format(item_code), frappe.DoesNotExistError)
	months = max(1, min(cint(months) or 6, 24))

	item = frappe.db.get_value(
		"Item",
		item_code,
		[
			"name",
			"item_name",
			"item_group",
			"stock_uom",
			"brand",
			"description",
			"image",
			"disabled",
			"is_stock_item",
			"valuation_rate",
			"last_purchase_rate",
			"safety_stock",
			"lead_time_days",
			"min_order_qty",
		],
		as_dict=True,
	)

	company = _default_company()
	bins = frappe.get_all(
		"Bin",
		filters={"item_code": item_code, "warehouse": ["in", _company_warehouses() or [""]]},
		fields=[
			"warehouse",
			"actual_qty",
			"ordered_qty",
			"reserved_qty",
			"indented_qty",
			"projected_qty",
			"stock_value",
			"valuation_rate",
		],
		order_by="actual_qty desc",
	)
	reorder = {
		r.warehouse: r
		for r in frappe.get_all(
			"Item Reorder",
			filters={"parent": item_code, "parenttype": "Item"},
			fields=["warehouse", "warehouse_reorder_level", "warehouse_reorder_qty"],
		)
	}
	for b in bins:
		r = reorder.get(b.warehouse)
		b.reorder_level = flt(r.warehouse_reorder_level) if r else 0
		b.reorder_qty = flt(r.warehouse_reorder_qty) if r else 0

	ledger = frappe.get_all(
		"Stock Ledger Entry",
		filters={"item_code": item_code, "is_cancelled": 0, "company": company},
		fields=[
			"posting_date",
			"posting_time",
			"warehouse",
			"actual_qty",
			"qty_after_transaction",
			"valuation_rate",
			"stock_value_difference",
			"voucher_type",
			"voucher_no",
		],
		order_by="posting_date desc, posting_time desc, creation desc",
		limit_page_length=30,
	)

	# monthly in/out trend
	start = add_months(getdate(nowdate()).replace(day=1), -(months - 1))
	sle = frappe.qb.DocType("Stock Ledger Entry")
	rows = (
		frappe.qb.from_(sle)
		.select(sle.posting_date, sle.actual_qty)
		.where(
			(sle.item_code == item_code)
			& (sle.is_cancelled == 0)
			& (sle.company == company)
			& (sle.posting_date >= start)
		)
		.run(as_dict=True)
	)
	buckets = {}
	for i in range(months):
		d = add_months(start, i)
		buckets[(d.year, d.month)] = {"label": d.strftime("%b"), "in": 0.0, "out": 0.0}
	for r in rows:
		d = getdate(r.posting_date)
		b = buckets.get((d.year, d.month))
		if not b:
			continue
		if flt(r.actual_qty) > 0:
			b["in"] += flt(r.actual_qty)
		else:
			b["out"] += -flt(r.actual_qty)

	# open purchase orders for this item
	po = frappe.qb.DocType("Purchase Order")
	poi = frappe.qb.DocType("Purchase Order Item")
	open_pos = (
		frappe.qb.from_(poi)
		.join(po)
		.on(po.name == poi.parent)
		.select(
			po.name,
			po.supplier,
			po.supplier_name,
			po.transaction_date,
			po.status,
			po.currency,
			poi.schedule_date,
			poi.warehouse,
			poi.qty,
			poi.received_qty,
			poi.rate,
		)
		.where(
			(poi.item_code == item_code)
			& (po.docstatus == 1)
			& (po.company == company)
			& (poi.received_qty < poi.qty)
			& (po.status.notin(["Closed", "Completed", "On Hold", "Cancelled"]))
		)
		.orderby(poi.schedule_date)
		.limit(20)
		.run(as_dict=True)
	)

	# supplier price history (latest purchase per supplier)
	history = (
		frappe.qb.from_(poi)
		.join(po)
		.on(po.name == poi.parent)
		.select(po.supplier, po.supplier_name, po.transaction_date, po.currency, poi.rate, poi.qty)
		.where((poi.item_code == item_code) & (po.docstatus == 1) & (po.company == company))
		.orderby(po.transaction_date, order=frappe.qb.desc)
		.limit(200)
		.run(as_dict=True)
	)
	suppliers = {}
	for h in history:
		s = suppliers.setdefault(
			h.supplier,
			{
				"supplier": h.supplier,
				"supplier_name": h.supplier_name,
				"last_rate": flt(h.rate),
				"last_date": h.transaction_date,
				"currency": h.currency,
				"orders": 0,
				"qty": 0.0,
			},
		)
		s["orders"] += 1
		s["qty"] += flt(h.qty)

	totals = {
		"actual_qty": sum(flt(b.actual_qty) for b in bins),
		"projected_qty": sum(flt(b.projected_qty) for b in bins),
		"ordered_qty": sum(flt(b.ordered_qty) for b in bins),
		"reserved_qty": sum(flt(b.reserved_qty) for b in bins),
		"indented_qty": sum(flt(b.indented_qty) for b in bins),
		"stock_value": sum(flt(b.stock_value) for b in bins),
		"warehouses": len([b for b in bins if flt(b.actual_qty)]),
		"below_reorder": len([b for b in bins if b.reorder_level and flt(b.projected_qty) < b.reorder_level]),
	}
	totals["valuation_rate"] = (totals["stock_value"] / totals["actual_qty"]) if totals["actual_qty"] else flt(item.valuation_rate)

	# gallery: main image first, then image files attached to the item
	images = [item.image] if item.image else []
	for f in frappe.get_all(
		"File",
		filters={"attached_to_doctype": "Item", "attached_to_name": item_code, "is_folder": 0},
		fields=["file_url", "file_name"],
		order_by="creation asc",
		limit_page_length=20,
	):
		url = f.file_url or ""
		if url.lower().rsplit(".", 1)[-1] in ("png", "jpg", "jpeg", "gif", "webp", "avif", "svg") and url not in images:
			images.append(url)

	return {
		"item": item,
		"images": images,
		"bins": bins,
		"totals": totals,
		"ledger": ledger,
		"trend": list(buckets.values()),
		"open_pos": open_pos,
		"suppliers": sorted(suppliers.values(), key=lambda s: s["last_date"] or "", reverse=True)[:10],
	}


@frappe.whitelist()
def finance_overview():
	frappe.has_permission("Purchase Invoice", "read", throw=True)
	today = getdate(nowdate())
	invoices = frappe.get_list(
		"Purchase Invoice",
		filters={"docstatus": 1, "outstanding_amount": [">", 0], "company": _default_company()},
		fields=["name", "supplier", "supplier_name", "due_date", "posting_date", "grand_total", "outstanding_amount", "currency", "status"],
		order_by="due_date asc",
		limit_page_length=500,
	)
	aging = {"Not Due": 0, "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
	for inv in invoices:
		days = (today - getdate(inv.due_date or inv.posting_date)).days
		inv.overdue_days = max(days, 0)
		bucket = "Not Due" if days <= 0 else "0-30" if days <= 30 else "31-60" if days <= 60 else "61-90" if days <= 90 else "90+"
		aging[bucket] += flt(inv.outstanding_amount)
	payments = []
	if frappe.has_permission("Payment Entry", "read"):
		payments = frappe.get_list(
			"Payment Entry",
			filters={"party_type": "Supplier", "docstatus": ["<", 2], "company": _default_company()},
			fields=["name", "party", "party_name", "posting_date", "paid_amount", "mode_of_payment", "docstatus", "status"],
			order_by="posting_date desc",
			limit_page_length=20,
		)
	return {
		"invoices": invoices,
		"aging": [{"bucket": k, "value": v} for k, v in aging.items()],
		"total_outstanding": sum(flt(i.outstanding_amount) for i in invoices),
		"overdue": sum(flt(i.outstanding_amount) for i in invoices if i.overdue_days > 0),
		"payments": payments,
	}


# --------------------------------------------------------------------------- #
# Vendor (supplier) portal
# --------------------------------------------------------------------------- #


@frappe.whitelist()
def vendor_dashboard():
	supplier = _require_supplier()
	rfq_names = frappe.get_all(
		"Request for Quotation Supplier", filters={"supplier": supplier}, pluck="parent", ignore_permissions=True
	)
	rfqs = frappe.get_all(
		"Request for Quotation",
		filters={"name": ["in", rfq_names or [""]], "docstatus": 1},
		fields=["name", "transaction_date", "schedule_date", "status", "company"],
		order_by="transaction_date desc",
		ignore_permissions=True,
	)
	quoted = {
		r.parent: r.quote_status
		for r in frappe.get_all(
			"Request for Quotation Supplier",
			filters={"supplier": supplier},
			fields=["parent", "quote_status"],
			ignore_permissions=True,
		)
	}
	for r in rfqs:
		r.quote_status = quoted.get(r.name)

	def vlist(dt, fields, order="modified desc"):
		return frappe.get_all(
			dt,
			filters={"supplier": supplier, "docstatus": ["<", 2]},
			fields=fields,
			order_by=order,
			limit=100,
			ignore_permissions=True,
		)

	return {
		"supplier": supplier,
		"supplier_name": frappe.db.get_value("Supplier", supplier, "supplier_name"),
		"rfqs": rfqs,
		"quotations": vlist("Supplier Quotation", ["name", "transaction_date", "status", "grand_total", "currency", "docstatus"]),
		"orders": vlist(
			"Purchase Order",
			["name", "transaction_date", "schedule_date", "status", "grand_total", "currency", "per_received", "per_billed"],
		),
		"invoices": vlist(
			"Purchase Invoice", ["name", "posting_date", "due_date", "status", "grand_total", "outstanding_amount", "currency"]
		),
	}


@frappe.whitelist()
def vendor_get_document(doctype, name):
	supplier = _require_supplier()
	if doctype == "Request for Quotation":
		if not frappe.db.exists("Request for Quotation Supplier", {"parent": name, "supplier": supplier}):
			frappe.throw(_("Not permitted"), frappe.PermissionError)
		doc = frappe.get_doc(doctype, name)
		d = doc.as_dict()
		d["suppliers"] = [s for s in d["suppliers"] if s.supplier == supplier]
		return d
	if doctype not in ("Purchase Order", "Supplier Quotation", "Purchase Invoice"):
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	doc = frappe.get_doc(doctype, name)
	if doc.supplier != supplier:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	return doc.as_dict()


@frappe.whitelist(methods=["POST"])
def vendor_submit_quotation(rfq, items, terms=None, valid_till=None):
	"""Supplier submits rates against an RFQ; creates and submits a Supplier Quotation.

	The Supplier role cannot read Items/Accounts, which ERPNext needs while building the
	quotation. After verifying the user is an invited supplier, the document is built with
	elevated rights and the supplier user is recorded as owner.
	"""
	from erpnext.buying.doctype.request_for_quotation.request_for_quotation import (
		add_items,
		validate_existing_supplier_quotation,
	)

	supplier = _require_supplier()
	rfq_doc = frappe.get_doc("Request for Quotation", rfq)
	if rfq_doc.docstatus != 1 or not any(s.supplier == supplier for s in rfq_doc.suppliers):
		frappe.throw(_("Not permitted"), frappe.PermissionError)

	rates = {r["name"]: r for r in _parse(items)}
	payload_items = []
	for i in rfq_doc.items:
		r = rates.get(i.name)
		if not r or flt(r.get("rate")) <= 0:
			continue
		row = i.as_dict()
		row.update({"rate": flt(r["rate"]), "qty": flt(r.get("qty") or i.qty), "parent": rfq})
		payload_items.append(row)
	if not payload_items:
		frappe.throw(_("Enter a rate for at least one item"))
	validate_existing_supplier_quotation(supplier, payload_items)

	user = frappe.session.user
	currency = frappe.db.get_value("Supplier", supplier, "default_currency") or frappe.get_cached_value(
		"Company", rfq_doc.company, "default_currency"
	)
	try:
		frappe.set_user("Administrator")
		sq = frappe.get_doc(
			{
				"doctype": "Supplier Quotation",
				"supplier": supplier,
				"company": rfq_doc.company,
				"currency": currency,
				"terms": terms,
				"valid_till": valid_till,
				"buying_price_list": frappe.db.get_single_value("Buying Settings", "buying_price_list"),
			}
		)
		add_items(sq, supplier, payload_items)
		for it in sq.items:
			r = rates.get(it.request_for_quotation_item) or {}
			it.rate = flt(r.get("rate"))
			if r.get("lead_time_days"):
				it.lead_time_days = int(r["lead_time_days"])
		sq.run_method("set_missing_values")
		for it in sq.items:  # set_missing_values may reset rates from price lists
			it.rate = flt((rates.get(it.request_for_quotation_item) or {}).get("rate"))
		sq.insert()
		sq.submit()
		sq.db_set("owner", user, update_modified=False)
		sq.add_comment("Comment", _("Quotation submitted by supplier user {0}").format(user))
	finally:
		frappe.set_user(user)
	return {"name": sq.name, "message": _("Quotation {0} submitted").format(sq.name)}


@frappe.whitelist(methods=["POST"])
def vendor_acknowledge_po(name, note=None):
	supplier = _require_supplier()
	po = frappe.get_doc("Purchase Order", name)
	if po.supplier != supplier:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	po.add_comment("Comment", _("Acknowledged by supplier {0}. {1}").format(supplier, note or ""))
	return {"message": _("Order {0} acknowledged").format(name)}


# --------------------------------------------------------------------------- #
# Per-doctype analytical dashboards
# --------------------------------------------------------------------------- #

DASHBOARDS = {
	"pr": {
		"doctype": "Material Request",
		"date": "transaction_date",
		"value": None,
		"party": "set_warehouse",
		"party_label": "Warehouse",
		"child": "Material Request Item",
		"filters": {"material_request_type": "Purchase"},
	},
	"rfq": {"doctype": "Request for Quotation", "date": "transaction_date", "value": None, "party": None, "child": "Request for Quotation Item"},
	"sq": {"doctype": "Supplier Quotation", "date": "transaction_date", "value": "base_grand_total", "party": "supplier", "child": "Supplier Quotation Item"},
	"po": {"doctype": "Purchase Order", "date": "transaction_date", "value": "base_grand_total", "party": "supplier", "child": "Purchase Order Item"},
	"grn": {"doctype": "Purchase Receipt", "date": "posting_date", "value": "base_grand_total", "party": "supplier", "child": "Purchase Receipt Item"},
	"pi": {"doctype": "Purchase Invoice", "date": "posting_date", "value": "base_grand_total", "party": "supplier", "child": "Purchase Invoice Item"},
	"payment": {
		"doctype": "Payment Entry",
		"date": "posting_date",
		"value": "base_paid_amount",
		"party": "party",
		"child": None,
		"filters": {"party_type": "Supplier"},
	},
}


def _ratio(a, b):
	return round(100.0 * flt(a) / flt(b), 1) if flt(b) else None


@frappe.whitelist()
def doctype_dashboard(module, months=12):
	cfg = DASHBOARDS.get(module)
	if not cfg:
		frappe.throw(_("Unknown dashboard"))
	dt, date_f, value_f, party_f = cfg["doctype"], cfg["date"], cfg["value"], cfg["party"]
	frappe.has_permission(dt, "read", throw=True)
	months = min(max(int(months or 12), 3), 24)
	base = _with_company(dt, dict(cfg.get("filters") or {}))
	today = getdate(nowdate())
	start = get_first_day(add_months(today, -(months - 1)))
	month_start = get_first_day(today)
	live = {**base, "docstatus": ["<", 2]}

	def count(extra=None):
		return frappe.db.count(dt, {**live, **(extra or {})}) if frappe.has_permission(dt, "read") else 0

	def total(extra=None, field=None):
		field = field or value_f
		if not field:
			return None
		return _sum(dt, field, {**base, "docstatus": 1, **(extra or {})}) or 0

	# --- monthly trend (submitted docs) ---
	fields = [date_f] + ([value_f] if value_f else [])
	rows = frappe.get_list(dt, filters={**base, "docstatus": 1, date_f: [">=", start]}, fields=fields, limit_page_length=0)
	buckets = {get_first_day(add_months(today, -(months - 1) + i)).strftime("%Y-%m"): [0, 0] for i in range(months)}
	for r in rows:
		k = getdate(r.get(date_f)).strftime("%Y-%m")
		if k in buckets:
			buckets[k][0] += 1
			buckets[k][1] += flt(r.get(value_f)) if value_f else 0
	trend = [{"month": k, "count": v[0], "value": v[1]} for k, v in buckets.items()]

	# --- status mix ---
	status = frappe.get_list(
		dt, filters=live, fields=["status", {"COUNT": "*", "as": "n"}], group_by="status", order_by="n desc", limit_page_length=20
	)

	# --- top parties ---
	parties = []
	if party_f:
		agg = {"SUM": value_f, "as": "value"} if value_f else {"COUNT": "*", "as": "value"}
		parties = frappe.get_list(
			dt,
			filters={**base, "docstatus": 1, date_f: [">=", start], party_f: ["is", "set"]},
			fields=[f"{party_f} as label", agg],
			group_by=party_f,
			order_by="value desc",
			limit_page_length=8,
		)

	# --- top items (child table) ---
	items = []
	if cfg.get("child"):
		parents = frappe.get_list(
			dt, filters={**base, "docstatus": 1, date_f: [">=", start]}, pluck="name", limit_page_length=2000
		)
		if parents:
			ch = frappe.qb.DocType(cfg["child"])
			has_amount = frappe.get_meta(cfg["child"]).has_field("base_amount")
			from frappe.query_builder.functions import Count, Sum

			q = (
				frappe.qb.from_(ch)
				.select(ch.item_code, ch.item_name, Sum(ch.qty).as_("qty"), Count(ch.parent).as_("lines"))
				.where(ch.parent.isin(parents))
				.groupby(ch.item_code, ch.item_name)
				.limit(8)
			)
			if has_amount:
				q = q.select(Sum(ch.base_amount).as_("value")).orderby(Sum(ch.base_amount), order=frappe.qb.desc)
			else:
				q = q.orderby(Sum(ch.qty), order=frappe.qb.desc)
			items = q.run(as_dict=True)

	# --- KPIs ---
	this_month = {date_f: [">=", month_start]}
	kpis = [
		{"key": "total", "label": "Documents", "value": count(), "hint": f"{count({'docstatus': 0})} drafts"},
		{"key": "month", "label": "This Month", "value": count({**this_month, "docstatus": 1}), "hint": "submitted"},
	]
	if value_f:
		v12 = sum(t["value"] for t in trend)
		n12 = sum(t["count"] for t in trend)
		kpis += [
			{"key": "value_month", "label": "Value This Month", "value": total(this_month), "money": True},
			{"key": "value_12", "label": f"Value ({months} mo)", "value": v12, "money": True, "hint": f"avg {frappe.format(v12 / n12 if n12 else 0, 'Currency')}"},
		]

	extra = []
	if module == "pr":
		sub = count({"docstatus": 1})
		ordered = count({"docstatus": 1, "per_ordered": [">=", 100]})
		extra = [
			{"label": "Pending Sourcing", "value": count({"status": ["in", ["Pending", "Partially Ordered"]]}), "tone": "critical"},
			{"label": "Conversion to PO", "value": _ratio(ordered, sub), "pct": True, "tone": "positive"},
			{"label": "Overdue (past required date)", "value": count({"status": ["in", ["Pending", "Partially Ordered"]], "schedule_date": ["<", today]}), "tone": "negative"},
		]
	elif module == "rfq":
		invited = frappe.db.count("Request for Quotation Supplier", {"docstatus": 1})
		received = frappe.db.count("Request for Quotation Supplier", {"docstatus": 1, "quote_status": "Received"})
		extra = [
			{"label": "Open RFQs", "value": count({"status": "Submitted"}), "tone": "critical"},
			{"label": "Suppliers Invited", "value": invited},
			{"label": "Supplier Response Rate", "value": _ratio(received, invited), "pct": True, "tone": "positive"},
		]
	elif module == "sq":
		sub = count({"docstatus": 1})
		won = set(
			frappe.get_all(
				"Purchase Order Item", filters={"docstatus": 1, "supplier_quotation": ["is", "set"]}, pluck="supplier_quotation"
			)
		)
		extra = [
			{"label": "Awaiting Decision", "value": count({"status": "Submitted"}), "tone": "critical"},
			{"label": "Win Rate (awarded)", "value": _ratio(len(won), sub), "pct": True, "tone": "positive"},
			{"label": "Expired", "value": count({"status": "Expired"}), "tone": "negative"},
		]
	elif module == "po":
		extra = [
			{"label": "To Approve", "value": count({"docstatus": 0}), "tone": "critical"},
			{"label": "To Receive", "value": count({"status": ["in", ["To Receive and Bill", "To Receive"]]}), "tone": "critical"},
			{"label": "To Bill", "value": count({"status": ["in", ["To Receive and Bill", "To Bill"]]})},
			{
				"label": "Late Deliveries",
				"value": count({"docstatus": 1, "per_received": ["<", 100], "schedule_date": ["<", today], "status": ["not in", ["Closed", "On Hold"]]}),
				"tone": "negative",
			},
		]
	elif module == "grn":
		rej = _sum("Purchase Receipt Item", "rejected_qty", {"docstatus": 1}) if frappe.has_permission("Purchase Receipt", "read") else 0
		rec = _sum("Purchase Receipt Item", "received_qty", {"docstatus": 1}) if frappe.has_permission("Purchase Receipt", "read") else 0
		extra = [
			{"label": "To Bill", "value": count({"status": "To Bill"}), "tone": "critical"},
			{"label": "Returns", "value": count({"is_return": 1, "docstatus": 1})},
			{"label": "Rejection Rate", "value": _ratio(rej, rec), "pct": True, "tone": "negative"},
		]
	elif module == "pi":
		extra = [
			{"label": "Outstanding", "value": total({"outstanding_amount": [">", 0]}, "outstanding_amount"), "money": True, "tone": "critical"},
			{"label": "Overdue Invoices", "value": count({"status": "Overdue"}), "tone": "negative"},
			{"label": "Overdue Amount", "value": total({"status": "Overdue"}, "outstanding_amount"), "money": True, "tone": "negative"},
		]
	elif module == "payment":
		extra = [
			{"label": "Draft Payments", "value": count({"docstatus": 0}), "tone": "critical"},
			{
				"label": "Unallocated",
				"value": total({}, "unallocated_amount"),
				"money": True,
			},
		]
		modes = frappe.get_list(
			dt,
			filters={**base, "docstatus": 1, date_f: [">=", start]},
			fields=["mode_of_payment as label", {"SUM": value_f, "as": "value"}],
			group_by="mode_of_payment",
			order_by="value desc",
		)
		items = [{"item_code": m.label or "Not set", "item_name": "", "value": m.value} for m in modes]

	recent_fields = ["name", "status", "docstatus", date_f, "modified"] + ([party_f] if party_f else []) + ([value_f] if value_f else [])
	recent = frappe.get_list(dt, filters=live, fields=recent_fields, order_by="modified desc", limit_page_length=8)
	for r in recent:
		r.date = r.get(date_f)
		r.party = r.get(party_f) if party_f else None
		r.value = r.get(value_f) if value_f else None

	return {
		"module": module,
		"doctype": dt,
		"has_value": bool(value_f),
		"has_party": bool(party_f),
		"party_label": cfg.get("party_label", "Supplier"),
		"items_label": "Payment Modes" if module == "payment" else "Top Items",
		"kpis": kpis,
		"extra": extra,
		"trend": trend,
		"status": status,
		"parties": parties,
		"items": items,
		"recent": recent,
	}


@frappe.whitelist()
def dashboard_hub():
	"""Small headline numbers for every dashboard card on the hub page."""
	out = {}
	for key, cfg in DASHBOARDS.items():
		dt = cfg["doctype"]
		if not frappe.has_permission(dt, "read"):
			continue
		base = _with_company(dt, dict(cfg.get("filters") or {}))
		start = get_first_day(add_months(getdate(nowdate()), -5))
		rows = frappe.get_list(
			dt,
			filters={**base, "docstatus": 1, cfg["date"]: [">=", start]},
			fields=[cfg["date"]] + ([cfg["value"]] if cfg["value"] else []),
			limit_page_length=0,
		)
		spark = {get_first_day(add_months(getdate(nowdate()), -5 + i)).strftime("%Y-%m"): 0 for i in range(6)}
		for r in rows:
			k = getdate(r.get(cfg["date"])).strftime("%Y-%m")
			if k in spark:
				spark[k] += flt(r.get(cfg["value"])) if cfg["value"] else 1
		out[key] = {
			"count": frappe.db.count(dt, {**base, "docstatus": ["<", 2]}),
			"drafts": frappe.db.count(dt, {**base, "docstatus": 0}),
			"money": bool(cfg["value"]),
			"spark": list(spark.values()),
		}
	return out
