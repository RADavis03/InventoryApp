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
| `/dashboard` | Stats overview, low stock alerts, recent charge-outs |
| `/inventory` | Item CRUD, stock badges (red when `stock <= reorder_threshold`) |
| `/departments` | Department + GL number CRUD |
| `/purchase-orders` | Log restocks, view PO history |
| `/charge-outs` | Log deployments with month/year filter |
| `/reports` | Monthly preview + department summary + CSV export |

`client/src/lib/api.js` — all API calls in one file, grouped by resource. Uses `/api` base path (works via Vite proxy in dev, same-origin in prod).

### Database location
SQLite file is created at `data/inventory.db` (relative to repo root). The `data/` directory is gitignored.

