"""Install / migrate hooks: roles the procurement portal relies on."""

import frappe

VENDOR_ROLE = "Vendor User"


def ensure_roles():
	"""Vendor User: portal-only role for supplier contacts (no Desk access).
	A user with this role who is listed under Supplier > Portal Users sees only that
	supplier's RFQs, quotations, purchase orders and invoices in /procure/vendor."""
	if not frappe.db.exists("Role", VENDOR_ROLE):
		frappe.get_doc(
			{
				"doctype": "Role",
				"role_name": VENDOR_ROLE,
				"desk_access": 0,
				"home_page": "/procure/vendor",
				"description": "Supplier contact using the Procurement Hub vendor portal",
			}
		).insert(ignore_permissions=True)


def after_install():
	ensure_roles()


def after_migrate():
	ensure_roles()
