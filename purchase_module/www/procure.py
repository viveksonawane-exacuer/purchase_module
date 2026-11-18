import frappe

no_cache = 1


def get_context(context):
	# Guests get the SPA too: it renders the portal's own (3D) login screen.
	context.no_cache = 1
	try:
		context.csrf_token = frappe.sessions.get_csrf_token()
	except Exception:
		context.csrf_token = ""
	frappe.db.commit()
