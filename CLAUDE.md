# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development (both servers simultaneously)
```bash
npm run install:all   # first-time setup — installs all dependencies
npm run dev           # starts server (port 3001) + client (port 5173) concurrently
```

### Individual servers
```bash
npm run server        # Express API only (nodemon)
npm run client        # Vite dev server only
```

### Production
```bash
npm run build         # builds client to client/dist/
npm start             # runs Express server in production mode (serves built client)
```

## Architecture

**Monorepo** with two packages:
- `server/` — Node.js + Express REST API, SQLite database
- `client/` — React + Vite + Tailwind SPA

In production, Express serves the built client from `client/dist/`. In development, Vite proxies `/api/*` to `http://localhost:3001`.

### Server

| File | Purpose |
|---|---|
| `server/index.js` | Express entry point, mounts all route modules |
| `server/db/database.js` | Opens SQLite (`data/inventory.db`), runs schema, exports `db` |
| `server/db/schema.sql` | Four tables: `items`, `departments`, `purchase_orders`, `charge_outs` |
| `server/routes/*.js` | One file per resource: items, departments, purchaseOrders, chargeOuts, reports |

**Stock calculation**: There is no `stock` column — it's always computed as `SUM(purchase_orders.quantity) - SUM(charge_outs.quantity)` per item. The items GET endpoint calculates this via subqueries and also returns `latest_purchase_price` (most recent PO unit cost).

**Price behavior**: When a purchase order is logged, `items.unit_price` is updated to that PO's `unit_cost`. Charge-outs record their own `unit_cost` at time of deployment (defaults to latest purchase price, user-editable).

### Client

| Path | Page |
|---|---|
| `/dashboard` | Stats overview, low stock alerts, recent charge-outs, quick New Charge-Out button |
| `/inventory` | Item CRUD, stock badges (red when `stock <= reorder_threshold`), Restock Items button |
| `/departments` | Department + GL number CRUD, bulk import (paste `Name, GL Number` per line) |
| `/purchase-orders` | Log single or bulk restocks, view PO history |
| `/charge-outs` | Log deployments with month/year filter |
| `/reports` | Monthly preview + department summary + CSV export |

`client/src/lib/api.js` — all API calls in one file, grouped by resource. Uses `/api` base path (works via Vite proxy in dev, same-origin in prod).

### Key UI patterns
- **Bulk PO** (`/purchase-orders`) — shared PO header (PO #, date, notes) + dynamic line-item table. Each line auto-fills unit cost from item's latest purchase price. Accessed directly or via the "Restock Items" button on the Inventory page (navigates with `{ state: { openBulk: true } }`).
- **Quick Charge-Out** (Dashboard) — full charge-out form in a modal without leaving the dashboard. Refreshes dashboard stats on save.
- **Bulk Department Import** — textarea input, one `Name, GL Number` per line; validates all lines before submitting, reports per-item success/failure.

### Database location
SQLite file is created at `data/inventory.db` (relative to repo root). The `data/` directory is gitignored.

## Branding & Theme
- App name: **GAH IT Inventory** / **GAH IT Department**
- Primary brand color: `#580259` (deep purple/plum)
- Custom Tailwind color scale: `brand-50` through `brand-900` defined in `client/tailwind.config.js`
- All interactive elements (buttons, focus rings, active nav, links) use `brand-*` classes — do NOT use `blue-*`

## Docker
```bash
docker compose up -d          # build image and start (http://localhost:3001)
docker compose up -d --build  # rebuild after code changes
docker compose down           # stop
```
- SQLite database is volume-mounted from `./data` — persists across rebuilds
- Two-stage Dockerfile: stage 1 builds React client, stage 2 runs Express and serves `client/dist/`

## Git / GitHub
- Repo: `RADavis03/InventoryApp` (private)
- Git identity: name `RADavis03`, email `davis.rylan03@gmail.com`
- Remote: `origin` → GitHub, branch `master`
- Run `gh auth setup-git` if push fails with credential errors

