### Purchase Module

Purchase Module

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch version-16
bench install-app purchase_module
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/purchase_module
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit

## Procurement Hub (SAP Fiori-style portal)

A Vue 3 single-page app served at **`/procure`**, styled after SAP Fiori Horizon
(Morning / Evening / High-Contrast themes). It drives the standard ERPNext procure-to-pay flow:

`Purchase Requisition (Material Request) → RFQ → Supplier Quotation → Purchase Order → Goods Receipt → Purchase Invoice → Payment`

| Area | Route | Highlights |
|---|---|---|
| Landing page | `/procure` (signed out) | Rotating dotted-globe hero, horizon-glow transition, pinned stats, scroll-scrubbed "Our modules" scene; *Sign in* opens the login screen (`/procure#signin`). Deep links go straight to sign-in. Code in `frontend/src/landing/` |
| Launchpad | `/procure` | KPI tiles, spend chart, top suppliers, "needs attention" |
| My Inbox | `/procure/inbox` | Approvals and follow-ups (master–detail) |
| List reports | `/procure/{pr,rfq,sq,po,grn,pi,payment}` | Filter bar, quick tabs with counts, saved views, column settings, CSV export, bulk submit, split-screen detail |
| Object pages | `…/<name>` | Header KPIs, document flow, items/taxes, activity and comments, context actions |
| Forms | `…/new`, `…/<name>/edit` | Item value help, live totals, step indicator |
| RFQ comparison | `/procure/rfq/<name>/compare` | Side-by-side bids, lowest-price markers, award → PO |
| Finance | `/procure/finance` | Payables aging, overdue invoices, one-click payment |
| Inventory | `/procure/inventory` | Stock by warehouse, below-reorder list → replenish |
| Supplier portal | `/procure/vendor` | Suppliers quote on RFQs, view and acknowledge POs, follow invoices |

**Access:** internal users need a buying, stock or accounts role. To give a supplier portal access,
add their user under **Supplier → Portal Users**.

**Develop / build**

```bash
cd apps/purchase_module/frontend
npm install
npm run dev     # http://localhost:8080/procure (API proxied to the bench on :8003)
npm run build   # writes purchase_module/public/procure + www/procure.html
```

Backend endpoints are in `purchase_module/api.py`.
