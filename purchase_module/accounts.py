"""Financial accounting API for the Procurement Hub portal (/procure/accounts/...).

All statements are computed straight from posted GL Entries of the active
company, so they always agree with each other:

* Chart of Accounts  - account tree with closing balances
* Trial Balance      - opening / period debit & credit / closing per account
* Balance Sheet      - assets vs liabilities + equity (+ unclosed profit)
* Profit and Loss    - income and expenses per period, gross / net profit
* Cash Flow          - indirect method, reconciled to cash & bank balances
* General Ledger     - line items with running balance

Conventions
* ``is_opening = 'Yes'`` entries are treated as opening balances, never as
  movement of the period (same rule as ERPNext's Trial Balance).
* Period Closing Vouchers are ignored for P&L style figures; the cumulative
  balance of P&L accounts is always "profit not yet closed to equity".
"""

import frappe
from frappe import _
from frappe.utils import add_days, add_months, cint, flt, get_first_day, get_last_day, getdate, nowdate

from purchase_module.api import _companies, _default_company

PCV = "Period Closing Voucher"
GL_LIMIT = 2000


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #


def _company(company=None):
	frappe.has_permission("GL Entry", "read", throw=True)
	if company:
		if company not in [c.name for c in _companies()]:
			frappe.throw(_("Not permitted for company {0}").format(company), frappe.PermissionError)
		return company
	company = _default_company()
	if not company:
		frappe.throw(_("No company found"))
	return company


def _fiscal_year(date, company):
	from erpnext.accounts.utils import get_fiscal_year

	try:
		fy = get_fiscal_year(date, company=company, as_dict=True)
		return fy.name, getdate(fy.year_start_date), getdate(fy.year_end_date)
	except Exception:
		d = getdate(date)
		start = getdate(f"{d.year if d.month >= 4 else d.year - 1}-04-01")
		return None, start, add_days(add_months(start, 12), -1)


def _accounts(company):
	rows = frappe.get_all(
		"Account",
		filters={"company": company},
		fields=[
			"name", "account_name", "account_number", "parent_account", "root_type", "report_type",
			"account_type", "is_group", "lft", "rgt", "freeze_account", "disabled", "account_currency",
		],
		order_by="lft asc",
	)
	by = {a.name: a for a in rows}
	for a in rows:
		a.depth = 0
		p = by.get(a.parent_account)
		while p:
			a.depth += 1
			p = by.get(p.parent_account)
		a.path = []
		p = by.get(a.parent_account)
		while p:
			a.path.insert(0, p.account_name)
			p = by.get(p.parent_account)
	return rows, by


def _nature(a):
	"""+1 when the account normally carries a debit balance."""
	return 1 if a.root_type in ("Asset", "Expense") else -1


def _in_path(a, *words):
	names = [n.lower() for n in a.path + [a.account_name]]
	return any(w in n for n in names for w in words)


def _rollup(accounts, values, keys):
	"""Sum leaf values up the tree. values: {account: {key: amount}} (leaves)."""
	out = {a.name: {k: 0.0 for k in keys} for a in accounts}
	by = {a.name: a for a in accounts}
	for name, v in values.items():
		node = by.get(name)
		while node:
			for k in keys:
				out[node.name][k] += flt(v.get(k))
			node = by.get(node.parent_account)
	return out


def _row(a, vals, **extra):
	return {
		"account": a.name,
		"account_name": a.account_name,
		"account_number": a.account_number,
		"parent": a.parent_account,
		"is_group": cint(a.is_group),
		"depth": a.depth,
		"root_type": a.root_type,
		"account_type": a.account_type,
		**vals,
		**extra,
	}


def _prune(rows, keys):
	"""Drop accounts whose every value is zero (keeps groups with non-zero children)."""
	return [r for r in rows if any(abs(flt(r.get(k))) >= 0.005 for k in keys)]


def _cur(company):
	return frappe.get_cached_value("Company", company, "default_currency")


@frappe.whitelist()
def context():
	"""Company, currency, fiscal years and the current FY range for the filter bars."""
	company = _company()
	fy_name, start, end = _fiscal_year(nowdate(), company)
	years = frappe.get_all(
		"Fiscal Year", filters={"disabled": 0}, fields=["name", "year_start_date", "year_end_date"], order_by="year_start_date desc"
	)
	return {
		"company": company,
		"currency": _cur(company),
		"today": nowdate(),
		"fiscal_year": fy_name,
		"fy_start": start,
		"fy_end": end,
		"fiscal_years": years,
	}


# --------------------------------------------------------------------------- #
# Chart of Accounts
# --------------------------------------------------------------------------- #


@frappe.whitelist()
def chart_of_accounts(as_on=None, company=None):
	company = _company(company)
	as_on = getdate(as_on or nowdate())
	accounts, by = _accounts(company)
	sums = frappe.db.sql(
		"""select account, sum(debit) dr, sum(credit) cr, count(*) n, max(posting_date) last_date
		from `tabGL Entry` where company=%s and is_cancelled=0 and posting_date<=%s group by account""",
		(company, as_on),
		as_dict=True,
	)
	leaf = {s.account: {"dr": s.dr, "cr": s.cr, "entries": s.n} for s in sums}
	last = {s.account: s.last_date for s in sums}
	tot = _rollup(accounts, leaf, ["dr", "cr", "entries"])
	rows = []
	for a in accounts:
		t = tot[a.name]
		bal = flt(t["dr"]) - flt(t["cr"])
		rows.append(
			_row(
				a,
				{
					"debit": t["dr"],
					"credit": t["cr"],
					"balance": bal,  # signed: + debit / - credit
					"entries": cint(t["entries"]),
				},
				report_type=a.report_type,
				frozen=a.freeze_account == "Yes",
				disabled=cint(a.disabled),
				currency=a.account_currency,
				last_posting=last.get(a.name),
				children=0,
			)
		)
	kids = {}
	for a in accounts:
		kids[a.parent_account] = kids.get(a.parent_account, 0) + 1
	for r in rows:
		r["children"] = kids.get(r["account"], 0)
	roots = {}
	for r in rows:
		if r["depth"] == 0:
			roots[r["root_type"]] = roots.get(r["root_type"], 0) + r["balance"]
	return {
		"company": company,
		"currency": _cur(company),
		"as_on": as_on,
		"rows": rows,
		"stats": {
			"total": len(accounts),
			"groups": sum(1 for a in accounts if a.is_group),
			"ledgers": sum(1 for a in accounts if not a.is_group),
			"used": sum(1 for a in accounts if not a.is_group and leaf.get(a.name)),
			"frozen": sum(1 for a in accounts if a.freeze_account == "Yes"),
			"by_root": roots,
		},
	}


@frappe.whitelist()
def account_detail(account):
	frappe.has_permission("Account", "read", account, throw=True)
	a = frappe.get_doc("Account", account)
	company = _company(a.company)
	lft, rgt = a.lft, a.rgt
	recent = frappe.db.sql(
		"""select gle.posting_date, gle.voucher_type, gle.voucher_no, gle.debit, gle.credit, gle.party, gle.remarks, gle.account
		from `tabGL Entry` gle join tabAccount acc on acc.name=gle.account
		where gle.company=%s and gle.is_cancelled=0 and acc.lft>=%s and acc.rgt<=%s
		order by gle.posting_date desc, gle.creation desc limit 8""",
		(company, lft, rgt),
		as_dict=True,
	)
	monthly = frappe.db.sql(
		"""select date_format(gle.posting_date,'%%Y-%%m') m, sum(gle.debit) dr, sum(gle.credit) cr
		from `tabGL Entry` gle join tabAccount acc on acc.name=gle.account
		where gle.company=%s and gle.is_cancelled=0 and acc.lft>=%s and acc.rgt<=%s
		and gle.posting_date > %s group by m order by m""",
		(company, lft, rgt, add_months(getdate(nowdate()), -12)),
		as_dict=True,
	)
	return {
		"name": a.name,
		"account_name": a.account_name,
		"account_number": a.account_number,
		"parent_account": a.parent_account,
		"root_type": a.root_type,
		"report_type": a.report_type,
		"account_type": a.account_type,
		"is_group": a.is_group,
		"currency": a.account_currency,
		"frozen": a.freeze_account == "Yes",
		"balance_must_be": a.balance_must_be,
		"recent": recent,
		"monthly": monthly,
	}


# --------------------------------------------------------------------------- #
# Trial Balance
# --------------------------------------------------------------------------- #


@frappe.whitelist()
def trial_balance(from_date=None, to_date=None, show_zero=0, company=None):
	company = _company(company)
	to_date = getdate(to_date or nowdate())
	_, fy_start, _ = _fiscal_year(to_date, company)
	from_date = getdate(from_date or fy_start)
	if from_date > to_date:
		frappe.throw(_("From Date must be before To Date"))
	_, pl_start, _ = _fiscal_year(from_date, company)
	accounts, by = _accounts(company)

	sums = frappe.db.sql(
		"""select gle.account,
			sum(case when gle.posting_date < %(from)s or gle.is_opening='Yes' then gle.debit - gle.credit else 0 end) ob_bs,
			sum(case when gle.posting_date >= %(pl_start)s and (gle.posting_date < %(from)s or gle.is_opening='Yes')
				and gle.voucher_type != %(pcv)s then gle.debit - gle.credit else 0 end) ob_pl,
			sum(case when gle.posting_date >= %(from)s and gle.is_opening='No' and gle.voucher_type != %(pcv)s then gle.debit else 0 end) dr,
			sum(case when gle.posting_date >= %(from)s and gle.is_opening='No' and gle.voucher_type != %(pcv)s then gle.credit else 0 end) cr
		from `tabGL Entry` gle
		where gle.company=%(company)s and gle.is_cancelled=0 and gle.posting_date <= %(to)s
		group by gle.account""",
		{"company": company, "from": from_date, "to": to_date, "pl_start": pl_start, "pcv": PCV},
		as_dict=True,
	)
	leaf = {}
	for s in sums:
		a = by.get(s.account)
		if not a:
			continue
		ob = flt(s.ob_bs) if a.report_type == "Balance Sheet" else flt(s.ob_pl)
		cb = ob + flt(s.dr) - flt(s.cr)
		leaf[s.account] = {
			"opening_debit": max(ob, 0),
			"opening_credit": max(-ob, 0),
			"debit": flt(s.dr),
			"credit": flt(s.cr),
			"closing_debit": max(cb, 0),
			"closing_credit": max(-cb, 0),
		}
	keys = ["opening_debit", "opening_credit", "debit", "credit", "closing_debit", "closing_credit"]
	tot = _rollup(accounts, leaf, keys)
	rows = []
	for a in accounts:
		t = dict(tot[a.name])
		if a.is_group:
			# groups show net opening / closing, like a statement
			ob = t["opening_debit"] - t["opening_credit"]
			cb = t["closing_debit"] - t["closing_credit"]
			t.update(opening_debit=max(ob, 0), opening_credit=max(-ob, 0), closing_debit=max(cb, 0), closing_credit=max(-cb, 0))
		rows.append(_row(a, t, report_type=a.report_type))
	if not cint(show_zero):
		rows = _prune(rows, keys)
	total = {k: sum(flt(v.get(k)) for v in leaf.values()) for k in keys}
	return {
		"company": company,
		"currency": _cur(company),
		"from_date": from_date,
		"to_date": to_date,
		"rows": rows,
		"total": total,
		"balanced": abs(total["closing_debit"] - total["closing_credit"]) < 0.5
		and abs(total["debit"] - total["credit"]) < 0.5,
	}


# --------------------------------------------------------------------------- #
# Balance Sheet
# --------------------------------------------------------------------------- #


def _balances_as_on(company, date):
	return {
		s.account: flt(s.bal)
		for s in frappe.db.sql(
			"""select account, sum(debit - credit) bal from `tabGL Entry`
			where company=%s and is_cancelled=0 and posting_date<=%s group by account""",
			(company, date),
			as_dict=True,
		)
	}


@frappe.whitelist()
def balance_sheet(as_on=None, compare_to=None, company=None):
	company = _company(company)
	as_on = getdate(as_on or nowdate())
	compare_to = getdate(compare_to) if compare_to else get_last_day(add_months(as_on, -1))
	accounts, by = _accounts(company)
	cur, prev = _balances_as_on(company, as_on), _balances_as_on(company, compare_to)

	def side(bal):
		leaf = {}
		profit = 0.0
		for acc, v in bal.items():
			a = by.get(acc)
			if not a:
				continue
			if a.report_type == "Profit and Loss":
				profit += -v  # income (credit) - expense (debit)
			else:
				leaf[acc] = {"v": v * _nature(a)}
		return _rollup(accounts, leaf, ["v"]), profit

	tc, pc = side(cur)
	tp, pp = side(prev)
	sections = {"Asset": [], "Liability": [], "Equity": []}
	for a in accounts:
		if a.report_type != "Balance Sheet" or a.root_type not in sections:
			continue
		c, p = tc[a.name]["v"], tp[a.name]["v"]
		sections[a.root_type].append(_row(a, {"current": c, "previous": p, "change": c - p}))
	for k in sections:
		sections[k] = _prune(sections[k], ["current", "previous"])

	def root_total(rt, t):
		return sum(t[a.name]["v"] for a in accounts if a.root_type == rt and not a.parent_account)

	assets_c, assets_p = root_total("Asset", tc), root_total("Asset", tp)
	liab_c, liab_p = root_total("Liability", tc), root_total("Liability", tp)
	eq_c, eq_p = root_total("Equity", tc), root_total("Equity", tp)

	# group totals used for ratios (India CoA: "Current Assets", "Current Liabilities", "Capital Account")
	def find(word, rt):
		return [a for a in accounts if a.root_type == rt and a.is_group and word in a.account_name.lower()]

	def gsum(lst, t):
		return sum(t[a.name]["v"] for a in lst)

	ca, cl = find("current assets", "Asset"), find("current liabilities", "Liability")
	capital = [a for a in accounts if a.root_type == "Liability" and a.is_group and "capital" in a.account_name.lower()]
	ca_c, cl_c = gsum(ca, tc), gsum(cl, tc)
	equity_c = eq_c + gsum(capital, tc) + pc
	return {
		"company": company,
		"currency": _cur(company),
		"as_on": as_on,
		"compare_to": compare_to,
		"assets": sections["Asset"],
		"liabilities": sections["Liability"],
		"equity": sections["Equity"],
		"profit": {"current": pc, "previous": pp, "change": pc - pp},
		"totals": {
			"assets": {"current": assets_c, "previous": assets_p},
			"liabilities": {"current": liab_c, "previous": liab_p},
			"equity": {"current": eq_c, "previous": eq_p},
			"liabilities_equity": {"current": liab_c + eq_c + pc, "previous": liab_p + eq_p + pp},
		},
		"difference": round(assets_c - (liab_c + eq_c + pc), 2),
		"ratios": {
			"current_assets": ca_c,
			"current_liabilities": cl_c,
			"working_capital": ca_c - cl_c,
			"current_ratio": (ca_c / cl_c) if cl_c else None,
			"equity": equity_c,
			"debt_to_equity": ((liab_c - gsum(capital, tc)) / equity_c) if equity_c else None,
		},
	}


# --------------------------------------------------------------------------- #
# Profit and Loss
# --------------------------------------------------------------------------- #


def _periods(from_date, to_date, periodicity):
	if periodicity not in ("Monthly", "Quarterly"):
		return [{"key": "total", "label": "Total", "from": from_date, "to": to_date}]
	step = 1 if periodicity == "Monthly" else 3
	out, start = [], getdate(from_date)
	while start <= to_date:
		end = min(get_last_day(add_months(start, step - 1)), to_date)
		key = start.strftime("%Y%m")
		label = start.strftime("%b %Y") if step == 1 else f"{start.strftime('%b')}–{end.strftime('%b %Y')}"
		out.append({"key": "p" + key, "label": label, "from": start, "to": end})
		start = add_days(end, 1)
	return out


@frappe.whitelist()
def profit_and_loss(from_date=None, to_date=None, periodicity="Monthly", company=None):
	company = _company(company)
	to_date = getdate(to_date or nowdate())
	_, fy_start, _ = _fiscal_year(to_date, company)
	from_date = getdate(from_date or fy_start)
	if from_date > to_date:
		frappe.throw(_("From Date must be before To Date"))
	periods = _periods(from_date, to_date, periodicity)
	accounts, by = _accounts(company)
	multi = periodicity in ("Monthly", "Quarterly")
	cases = "".join(
		f"sum(case when gle.posting_date between '{p['from']}' and '{p['to']}' then gle.credit - gle.debit else 0 end) `{p['key']}`, "
		for p in periods
		if multi
	)
	sums = frappe.db.sql(
		f"""select gle.account, {cases}sum(gle.credit - gle.debit) total
		from `tabGL Entry` gle join tabAccount acc on acc.name = gle.account
		where gle.company=%(company)s and gle.is_cancelled=0 and acc.report_type='Profit and Loss'
			and gle.posting_date between %(from)s and %(to)s and gle.voucher_type != %(pcv)s
		group by gle.account""",
		{"company": company, "from": from_date, "to": to_date, "pcv": PCV},
		as_dict=True,
	)
	keys = ([p["key"] for p in periods] if multi else []) + ["total"]
	leaf = {}
	for s in sums:
		a = by.get(s.account)
		if not a:
			continue
		sign = 1 if a.root_type == "Income" else -1  # show expenses as positive numbers
		leaf[s.account] = {k: sign * flt(s.get(k)) for k in keys}
	tot = _rollup(accounts, leaf, keys)
	income, expense = [], []
	for a in accounts:
		if a.report_type != "Profit and Loss":
			continue
		(income if a.root_type == "Income" else expense).append(_row(a, tot[a.name], direct=_in_path(a, "direct income", "direct expense") and not _in_path(a, "indirect")))
	income, expense = _prune(income, keys), _prune(expense, keys)

	def agg(pred):
		return {k: sum(v[k] for acc, v in leaf.items() if pred(by[acc])) for k in keys}

	def is_direct(a):
		return _in_path(a, "direct") and not _in_path(a, "indirect")

	revenue = agg(lambda a: a.root_type == "Income")
	direct_inc = agg(lambda a: a.root_type == "Income" and is_direct(a))
	cogs = agg(lambda a: a.root_type == "Expense" and is_direct(a))
	opex = agg(lambda a: a.root_type == "Expense" and not is_direct(a))
	gross = {k: direct_inc[k] - cogs[k] for k in keys}
	net = {k: revenue[k] - cogs[k] - opex[k] for k in keys}
	return {
		"company": company,
		"currency": _cur(company),
		"from_date": from_date,
		"to_date": to_date,
		"periodicity": periodicity,
		"periods": [{"key": p["key"], "label": p["label"], "from": p["from"], "to": p["to"]} for p in periods] if len(keys) > 1 else [],
		"income": income,
		"expense": expense,
		"summary": {
			"revenue": revenue,
			"direct_income": direct_inc,
			"other_income": {k: revenue[k] - direct_inc[k] for k in keys},
			"cogs": cogs,
			"gross_profit": gross,
			"opex": opex,
			"net_profit": net,
		},
	}


# --------------------------------------------------------------------------- #
# Cash Flow (indirect method)
# --------------------------------------------------------------------------- #


def _cf_bucket(a):
	"""Section and line for a non-cash balance sheet account."""
	t = a.account_type or ""
	if t == "Accumulated Depreciation":
		return "operating", "Depreciation & amortisation (non-cash)"
	if t in ("Fixed Asset", "Capital Work in Progress") or _in_path(a, "fixed asset", "investment"):
		return "investing", "Purchase / sale of fixed assets" if not _in_path(a, "investment") else "Investments"
	if a.root_type == "Equity" or _in_path(a, "capital account", "share capital", "shareholders", "reserves"):
		return "financing", "Share capital & reserves"
	if _in_path(a, "loans (liabilities)", "secured loan", "unsecured loan", "overdraft"):
		return "financing", "Borrowings (net)"
	if t == "Receivable":
		return "operating", "(Increase) / decrease in trade receivables"
	if t == "Payable":
		return "operating", "Increase / (decrease) in trade payables"
	if t == "Stock" or _in_path(a, "stock assets"):
		return "operating", "(Increase) / decrease in inventories"
	if t == "Stock Received But Not Billed":
		return "operating", "Goods received not yet invoiced"
	if t == "Tax" or _in_path(a, "duties and taxes", "tax assets"):
		return "operating", "Taxes payable / recoverable"
	return "operating", "Other current assets & liabilities"


@frappe.whitelist()
def cash_flow(from_date=None, to_date=None, company=None):
	company = _company(company)
	to_date = getdate(to_date or nowdate())
	_, fy_start, _ = _fiscal_year(to_date, company)
	from_date = getdate(from_date or fy_start)
	if from_date > to_date:
		frappe.throw(_("From Date must be before To Date"))
	accounts, by = _accounts(company)
	is_cash = lambda a: a.account_type in ("Cash", "Bank") and not a.is_group  # noqa: E731

	sums = frappe.db.sql(
		"""select account,
			sum(case when posting_date < %(from)s or is_opening='Yes' then debit - credit else 0 end) ob,
			sum(case when posting_date >= %(from)s and is_opening='No' and voucher_type != %(pcv)s then debit else 0 end) dr,
			sum(case when posting_date >= %(from)s and is_opening='No' and voucher_type != %(pcv)s then credit else 0 end) cr
		from `tabGL Entry` where company=%(company)s and is_cancelled=0 and posting_date <= %(to)s
		group by account""",
		{"company": company, "from": from_date, "to": to_date, "pcv": PCV},
		as_dict=True,
	)
	net_profit = 0.0
	lines = {}
	cash_accounts = []
	for s in sums:
		a = by.get(s.account)
		if not a:
			continue
		move = flt(s.dr) - flt(s.cr)
		if a.report_type == "Profit and Loss":
			net_profit -= move
		elif is_cash(a):
			cash_accounts.append(
				{
					"account": a.name,
					"account_name": a.account_name,
					"account_type": a.account_type,
					"opening": flt(s.ob),
					"inflow": flt(s.dr),
					"outflow": flt(s.cr),
					"closing": flt(s.ob) + move,
				}
			)
		elif abs(move) >= 0.005:
			sec, line = _cf_bucket(a)
			key = (sec, line)
			lines.setdefault(key, {"section": sec, "label": line, "amount": 0.0, "accounts": []})
			lines[key]["amount"] += -move  # cash effect: credit increases cash
			lines[key]["accounts"].append({"account": a.name, "account_name": a.account_name, "amount": -move})

	order = {
		"operating": [
			"Depreciation & amortisation (non-cash)",
			"(Increase) / decrease in trade receivables",
			"(Increase) / decrease in inventories",
			"Increase / (decrease) in trade payables",
			"Goods received not yet invoiced",
			"Taxes payable / recoverable",
			"Other current assets & liabilities",
		],
		"investing": ["Purchase / sale of fixed assets", "Investments"],
		"financing": ["Share capital & reserves", "Borrowings (net)"],
	}
	sections = []
	for sec, title in (("operating", "Operating activities"), ("investing", "Investing activities"), ("financing", "Financing activities")):
		items = [v for v in lines.values() if v["section"] == sec]
		items.sort(key=lambda v: order[sec].index(v["label"]) if v["label"] in order[sec] else 99)
		if sec == "operating":
			items.insert(0, {"section": sec, "label": "Net profit for the period", "amount": net_profit, "accounts": [], "profit": True})
		sections.append({"key": sec, "title": title, "lines": items, "total": sum(i["amount"] for i in items)})

	opening = sum(c["opening"] for c in cash_accounts)
	closing = sum(c["closing"] for c in cash_accounts)
	net_change = sum(s["total"] for s in sections)

	# monthly cash movement on cash & bank accounts
	cash_names = [a.name for a in accounts if is_cash(a)] or [""]
	monthly = frappe.db.sql(
		"""select date_format(posting_date, '%%Y-%%m') m, sum(debit) inflow, sum(credit) outflow
		from `tabGL Entry` where company=%s and is_cancelled=0 and is_opening='No' and account in %s
		and posting_date between %s and %s group by m order by m""",
		(company, cash_names, from_date, to_date),
		as_dict=True,
	)
	run = opening
	for m in monthly:
		run += flt(m.inflow) - flt(m.outflow)
		m.closing = run
		m.label = getdate(m.m + "-01").strftime("%b %y")
	return {
		"company": company,
		"currency": _cur(company),
		"from_date": from_date,
		"to_date": to_date,
		"sections": sections,
		"net_profit": net_profit,
		"net_change": net_change,
		"opening_cash": opening,
		"closing_cash": closing,
		"difference": round(opening + net_change - closing, 2),
		"cash_accounts": sorted(cash_accounts, key=lambda c: -c["closing"]),
		"monthly": monthly,
	}


# --------------------------------------------------------------------------- #
# General Ledger
# --------------------------------------------------------------------------- #


@frappe.whitelist()
def general_ledger(
	account=None, from_date=None, to_date=None, party_type=None, party=None, voucher_type=None, voucher_no=None, company=None
):
	company = _company(company)
	to_date = getdate(to_date or nowdate())
	_, fy_start, _ = _fiscal_year(to_date, company)
	from_date = getdate(from_date or fy_start)
	cond, args = ["gle.company=%(company)s", "gle.is_cancelled=0"], {"company": company, "from": from_date, "to": to_date}
	acc = None
	if account:
		acc = frappe.db.get_value("Account", account, ["name", "lft", "rgt", "root_type", "report_type", "is_group", "account_name"], as_dict=True)
		if not acc:
			frappe.throw(_("Account {0} not found").format(account))
		cond.append("acc.lft >= %(lft)s and acc.rgt <= %(rgt)s")
		args.update(lft=acc.lft, rgt=acc.rgt)
	if party_type and party:
		cond.append("gle.party_type=%(party_type)s and gle.party=%(party)s")
		args.update(party_type=party_type, party=party)
	if voucher_type:
		cond.append("gle.voucher_type=%(voucher_type)s")
		args["voucher_type"] = voucher_type
	if voucher_no:
		cond.append("gle.voucher_no like %(voucher_no)s")
		args["voucher_no"] = f"%{voucher_no}%"
	where = " and ".join(cond)

	# opening: P&L accounts only carry the current fiscal year
	_, pl_start, _ = _fiscal_year(from_date, company)
	args["pl_start"] = pl_start
	ob = frappe.db.sql(
		f"""select sum(gle.debit) dr, sum(gle.credit) cr from `tabGL Entry` gle join tabAccount acc on acc.name=gle.account
		where {where} and (gle.posting_date < %(from)s or (gle.is_opening='Yes' and gle.posting_date <= %(to)s))
		and (acc.report_type='Balance Sheet' or gle.posting_date >= %(pl_start)s)""",
		args,
		as_dict=True,
	)[0]
	entries = frappe.db.sql(
		f"""select gle.name, gle.posting_date, gle.account, acc.account_name, gle.voucher_type, gle.voucher_no,
			gle.party_type, gle.party, gle.against, gle.debit, gle.credit,
			coalesce(nullif(je.user_remark, ''), gle.remarks) remarks, gle.cost_center
		from `tabGL Entry` gle join tabAccount acc on acc.name=gle.account
		left join `tabJournal Entry` je on gle.voucher_type='Journal Entry' and je.name=gle.voucher_no
		where {where} and gle.posting_date between %(from)s and %(to)s and gle.is_opening='No'
		order by gle.posting_date, gle.creation, gle.name limit {GL_LIMIT + 1}""",
		args,
		as_dict=True,
	)
	truncated = len(entries) > GL_LIMIT
	entries = entries[:GL_LIMIT]
	run = flt(ob.dr) - flt(ob.cr)
	for e in entries:
		run += flt(e.debit) - flt(e.credit)
		e.balance = run
		if e.remarks and len(e.remarks) > 140:
			e.remarks = e.remarks[:140] + "…"
	dr = sum(flt(e.debit) for e in entries)
	cr = sum(flt(e.credit) for e in entries)
	by_type = {}
	for e in entries:
		t = by_type.setdefault(e.voucher_type, {"voucher_type": e.voucher_type, "count": 0, "debit": 0.0, "credit": 0.0})
		t["count"] += 1
		t["debit"] += flt(e.debit)
		t["credit"] += flt(e.credit)
	return {
		"company": company,
		"currency": _cur(company),
		"from_date": from_date,
		"to_date": to_date,
		"account": acc,
		"opening": flt(ob.dr) - flt(ob.cr),
		"debit": dr,
		"credit": cr,
		"closing": flt(ob.dr) - flt(ob.cr) + dr - cr,
		"entries": entries,
		"truncated": truncated,
		"by_voucher_type": sorted(by_type.values(), key=lambda t: -t["count"]),
	}
