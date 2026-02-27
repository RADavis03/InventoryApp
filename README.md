# GAH IT Inventory

A self-hosted inventory management system for IT departments. Track consumable stock levels, log purchase orders, record deployments to departments, and generate monthly charge-back reports — all in one place.

---

## Features

- **Inventory** — Manage items with reorder thresholds and low-stock alerts
- **Departments** — Manage departments and GL numbers (bulk import supported)
- **Purchase Orders** — Log single or bulk restocks; stock auto-updates
- **Charge-Outs** — Record item deployments to departments with ticket numbers
- **Reports** — Monthly cost summaries per department with CSV export
- **Dashboard** — At-a-glance stats, low stock alerts, and quick charge-out entry

---

## Running with Docker (Recommended)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- [Docker Compose](https://docs.docker.com/compose/install/) (included with Docker Desktop)

### 1. Clone the repository

```bash
git clone https://github.com/RADavis03/InventoryApp.git
cd InventoryApp
```

### 2. Start the app

```bash
docker compose up -d
```

This will:
- Build the React frontend
- Start the Express API server
- Create the SQLite database automatically on first run

The app will be available at **http://localhost:3001**

### 3. Stop the app

```bash
docker compose down
```

### Data persistence

The SQLite database is stored in a `data/` folder in the project root, mounted as a volume. Your data is preserved across container restarts and rebuilds.

```
InventoryApp/
└── data/
    └── inventory.db   ← your database lives here
```

### Rebuilding after updates

If you pull new changes and need to rebuild the image:

```bash
docker compose up -d --build
```

---

## Running Locally (Development)

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- npm

### 1. Install all dependencies

```bash
npm run install:all
```

### 2. Start both servers

```bash
npm run dev
```

| Service | URL |
|---|---|
| React frontend (Vite) | http://localhost:5173 |
| Express API | http://localhost:3001 |

The Vite dev server proxies `/api/*` requests to the Express server automatically.

### Individual servers

```bash
npm run server    # API only (with nodemon hot-reload)
npm run client    # Frontend only
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | SQLite (via better-sqlite3) |
| Container | Docker, Docker Compose |

---

## Project Structure

```
InventoryApp/
├── client/               # React + Vite frontend
│   └── src/
│       ├── components/   # Layout, Modal
│       ├── lib/api.js    # All API calls
│       └── pages/        # One file per route
├── server/               # Express API
│   ├── db/
│   │   ├── database.js   # SQLite connection
│   │   └── schema.sql    # Table definitions
│   └── routes/           # items, departments, purchaseOrders, chargeOuts, reports
├── data/                 # SQLite database (auto-created, gitignored)
├── Dockerfile
└── docker-compose.yml
```

---

## First-Time Setup Tips

1. **Add departments first** — Charge-outs require a department. Use **Bulk Import** on the Departments page to add multiple at once (`Name, GL Number` per line).
2. **Add inventory items** — Go to the Inventory page and add your items with reorder thresholds.
3. **Log your opening stock** — Use **Bulk PO** on the Purchase Orders page (or **Restock Items** from the Inventory page) to enter your starting quantities.
4. **Start logging charge-outs** — Use the Charge-Outs page or the quick **New Charge-Out** button on the Dashboard.
