const express = require('express');
const router = express.Router();
const db = require('../db/database');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const escape = (val) => {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const enrichedSelect = `
  SELECT
    gs.id,
    gs.purchase_order_id,
    gs.item_id,
    gs.from_department_id,
    gs.to_department_id,
    gs.price,
    gs.swapped_by,
    gs.notes,
    gs.swapped_at,
    gs.created_at,
    po.po_number,
    i.name AS item_name,
    fd.name AS from_department_name,
    fd.gl_number AS from_gl_number,
    td.name AS to_department_name,
    td.gl_number AS to_gl_number
  FROM gl_swaps gs
  JOIN purchase_orders po ON po.id = gs.purchase_order_id
  JOIN items i ON i.id = gs.item_id
  JOIN departments fd ON fd.id = gs.from_department_id
  JOIN departments td ON td.id = gs.to_department_id
`;

// GET /api/gl-swaps?month=&year=
router.get('/', (req, res) => {
  const { month, year } = req.query;
  let query = enrichedSelect;
  const params = [];

  if (month && year) {
    query += ` WHERE strftime('%m', gs.swapped_at) = ? AND strftime('%Y', gs.swapped_at) = ?`;
    params.push(month.toString().padStart(2, '0'), year.toString());
  }
  query += ` ORDER BY gs.swapped_at ASC, gs.id ASC`;

  res.json(db.prepare(query).all(...params));
});

// GET /api/gl-swaps/csv?month=&year= (must be before /:id)
router.get('/csv', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year are required' });

  const rows = db.prepare(
    enrichedSelect +
    ` WHERE strftime('%m', gs.swapped_at) = ? AND strftime('%Y', gs.swapped_at) = ?` +
    ` ORDER BY gs.swapped_at ASC, gs.id ASC`
  ).all(month.toString().padStart(2, '0'), year.toString());

  const monthName = MONTH_NAMES[parseInt(month) - 1];

  const headers = ['Date', 'PO Number', 'Item', 'From Department', 'From GL Number',
    'To Department', 'To GL Number', 'Price', 'Swapped By', 'Notes'];

  const csv = [
    headers.join(','),
    ...rows.map(row => [
      escape(row.swapped_at),
      escape(row.po_number || ''),
      escape(row.item_name),
      escape(row.from_department_name),
      escape(row.from_gl_number),
      escape(row.to_department_name),
      escape(row.to_gl_number),
      escape(row.price),
      escape(row.swapped_by),
      escape(row.notes || ''),
    ].join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="GL-Swaps-${monthName}-${year}.csv"`);
  res.send(csv);
});

// POST /api/gl-swaps
router.post('/', (req, res) => {
  const { purchase_order_id, item_id, from_department_id, to_department_id,
    price, swapped_by, notes, swapped_at } = req.body;

  if (!purchase_order_id || !item_id || !from_department_id || !to_department_id
    || !price || !swapped_by || !swapped_at) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (parseFloat(price) <= 0) {
    return res.status(400).json({ error: 'Price must be greater than 0' });
  }
  if (parseInt(from_department_id) === parseInt(to_department_id)) {
    return res.status(400).json({ error: 'From and To departments must be different' });
  }

  const po = db.prepare('SELECT id FROM purchase_orders WHERE id = ?').get(purchase_order_id);
  if (!po) return res.status(404).json({ error: 'Purchase order not found' });

  const result = db.prepare(`
    INSERT INTO gl_swaps
      (purchase_order_id, item_id, from_department_id, to_department_id, price, swapped_by, notes, swapped_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(purchase_order_id, item_id, from_department_id, to_department_id,
    parseFloat(price), swapped_by, notes || null, swapped_at);

  const created = db.prepare(enrichedSelect + ' WHERE gs.id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// DELETE /api/gl-swaps/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM gl_swaps WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'GL Swap not found' });

  db.prepare('DELETE FROM gl_swaps WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
