const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/inventory.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// Migration: add is_custom to items if not present (existing DBs)
try {
  db.exec("ALTER TABLE items ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0");
} catch (e) { /* column already exists */ }

// Migration: add target_amount to items if not present (existing DBs)
try {
  db.exec("ALTER TABLE items ADD COLUMN target_amount INTEGER NOT NULL DEFAULT 0");
} catch (e) { /* column already exists */ }

// Migration: add target_amount to toner_cartridges, copying from reorder_threshold (existing DBs)
try {
  db.exec("ALTER TABLE toner_cartridges ADD COLUMN target_amount INTEGER NOT NULL DEFAULT 0");
  db.exec("UPDATE toner_cartridges SET target_amount = reorder_threshold WHERE target_amount = 0 AND reorder_threshold > 0");
} catch (e) { /* column already exists */ }

// Seed the single login_lockout row
db.exec("INSERT OR IGNORE INTO login_lockout (id) VALUES (1)");

module.exports = db;
