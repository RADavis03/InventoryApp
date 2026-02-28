CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  unit_price REAL NOT NULL DEFAULT 0,
  reorder_threshold INTEGER NOT NULL DEFAULT 0,
  is_custom INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gl_number TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  po_number TEXT,
  notes TEXT,
  received_at TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS charge_outs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  charged_by TEXT NOT NULL,
  ticket_number TEXT,
  notes TEXT,
  charged_at TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS printers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  model_name TEXT NOT NULL,
  is_color   INTEGER NOT NULL DEFAULT 0,
  notes      TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS toner_cartridges (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_id        INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  slot              TEXT NOT NULL, -- BLACK | CYAN | MAGENTA | YELLOW | IMAGING_KIT | BLACK_DEVELOPER | COLOR_DEVELOPER | COLOR_DRUM | BLACK_DRUM | WASTE_TONER
  part_number       TEXT,
  brand             TEXT,
  notes             TEXT,
  reorder_threshold INTEGER NOT NULL DEFAULT 0,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS toner_restocks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  toner_id    INTEGER NOT NULL REFERENCES toner_cartridges(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL,
  notes       TEXT,
  received_at TEXT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS toner_charge_outs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  toner_id      INTEGER NOT NULL REFERENCES toner_cartridges(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  quantity      INTEGER NOT NULL,
  charged_by    TEXT NOT NULL,
  ticket_number TEXT,
  notes         TEXT,
  charged_at    TEXT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_lockout (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked          INTEGER NOT NULL DEFAULT 0,
  locked_at       DATETIME
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name  TEXT NOT NULL,       -- 'items' | 'purchase_orders'
  record_id   INTEGER NOT NULL,
  action      TEXT NOT NULL,       -- 'CREATE' | 'UPDATE' | 'DELETE'
  changed_by  TEXT,
  old_values  TEXT,                -- JSON snapshot before change
  new_values  TEXT,                -- JSON snapshot after change
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gl_swaps (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id  INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  item_id            INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  from_department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  to_department_id   INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  price              REAL NOT NULL,
  swapped_by         TEXT NOT NULL,
  notes              TEXT,
  swapped_at         TEXT NOT NULL,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);
