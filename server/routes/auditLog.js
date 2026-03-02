const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Build filtered rows (shared by JSON and CSV endpoints)
function getEntries({ table_name, action, changed_by, date_from, date_to, limit = 200, offset = 0 }) {
  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];

  if (table_name)  { query += ' AND table_name = ?';                    params.push(table_name); }
  if (action)      { query += ' AND action = ?';                         params.push(action); }
  if (changed_by)  { query += ' AND changed_by = ?';                     params.push(changed_by); }
  if (date_from)   { query += ' AND date(created_at) >= date(?)';        params.push(date_from); }
  if (date_to)     { query += ' AND date(created_at) <= date(?)';        params.push(date_to); }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  return db.prepare(query).all(...params);
}

// Distinct users that have ever made a change
router.get('/users', (req, res) => {
  const rows = db.prepare(
    "SELECT DISTINCT changed_by FROM audit_log WHERE changed_by IS NOT NULL ORDER BY changed_by"
  ).all();
  res.json(rows.map(r => r.changed_by));
});

// JSON list
router.get('/', (req, res) => {
  const entries = getEntries(req.query);
  const parsed = entries.map(e => ({
    ...e,
    old_values: e.old_values ? JSON.parse(e.old_values) : null,
    new_values: e.new_values ? JSON.parse(e.new_values) : null,
  }));
  res.json(parsed);
});

// CSV export
router.get('/csv', (req, res) => {
  const entries = getEntries({ ...req.query, limit: 10000, offset: 0 });

  const escape = (val) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const summarize = (entry) => {
    const oldV = entry.old_values ? JSON.parse(entry.old_values) : null;
    const newV = entry.new_values ? JSON.parse(entry.new_values) : null;

    if (entry.action === 'CREATE' && newV) {
      return Object.entries(newV).map(([k, v]) => `${k}: ${v ?? ''}`).join('; ');
    }
    if (entry.action === 'DELETE' && oldV) {
      return Object.entries(oldV).map(([k, v]) => `${k}: ${v ?? ''}`).join('; ');
    }
    if (entry.action === 'UPDATE' && oldV && newV) {
      const changed = Object.keys(newV).filter(k => newV[k] !== oldV[k]);
      if (changed.length === 0) return '(no field changes)';
      return changed.map(k => `${k}: ${oldV[k] ?? ''} → ${newV[k] ?? ''}`).join('; ');
    }
    return '';
  };

  const TABLE_LABEL = {
    items:             'Inventory Item',
    purchase_orders:   'Purchase Order',
    charge_outs:       'Charge-Out',
    printers:          'Printer',
    toner_cartridges:  'Toner Cartridge',
    toner_restocks:    'Toner Restock',
    toner_charge_outs: 'Toner Charge-Out',
  };
  const ACTION_LABEL = { CREATE: 'Created', UPDATE: 'Updated', DELETE: 'Deleted' };

  const headers = ['Timestamp', 'Resource', 'Action', 'Changed By', 'Summary'];
  const rows = entries.map(e => [
    escape(e.created_at),
    escape(TABLE_LABEL[e.table_name] ?? e.table_name),
    escape(ACTION_LABEL[e.action] ?? e.action),
    escape(e.changed_by ?? ''),
    escape(summarize(e)),
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  const ts = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="audit-log-${ts}.csv"`);
  res.send(csv);
});

module.exports = router;
