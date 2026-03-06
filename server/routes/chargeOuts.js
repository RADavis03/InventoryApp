const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { logAudit } = require('../lib/audit');

router.get('/', (req, res) => {
  const { item_id, department_id, month, year } = req.query;

  let query = `
    SELECT co.*, i.name AS item_name, d.name AS department_name, d.gl_number
    FROM charge_outs co
    JOIN items i ON i.id = co.item_id
    JOIN departments d ON d.id = co.department_id
    WHERE 1=1
  `;
  const params = [];

  if (item_id) { query += ' AND co.item_id = ?'; params.push(item_id); }
  if (department_id) { query += ' AND co.department_id = ?'; params.push(department_id); }
  if (month && year) {
    query += ` AND strftime('%m', co.charged_at) = ? AND strftime('%Y', co.charged_at) = ?`;
    params.push(month.toString().padStart(2, '0'), year.toString());
  }

  query += ' ORDER BY co.charged_at DESC, co.id DESC';

  const chargeOuts = db.prepare(query).all(...params);
  res.json(chargeOuts);
});

router.post('/', (req, res) => {
  const { item_id, department_id, quantity, unit_cost, charged_by, ticket_number, notes, charged_at } = req.body;

  if (!item_id || !department_id || !quantity || unit_cost == null || !charged_by || !charged_at) {
    return res.status(400).json({ error: 'item_id, department_id, quantity, unit_cost, charged_by, and charged_at are required' });
  }

  const stockData = db.prepare(`
    SELECT
      COALESCE((SELECT SUM(quantity) FROM purchase_orders WHERE item_id = ?), 0) -
      COALESCE((SELECT SUM(quantity) FROM charge_outs WHERE item_id = ?), 0) AS available
  `).get(item_id, item_id);

  if (stockData.available < quantity) {
    return res.status(400).json({ error: `Insufficient stock. Available: ${stockData.available}` });
  }

  const result = db.prepare(
    'INSERT INTO charge_outs (item_id, department_id, quantity, unit_cost, charged_by, ticket_number, notes, charged_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(item_id, department_id, quantity, unit_cost, charged_by, ticket_number || null, notes || null, charged_at);

  const chargeOut = db.prepare(`
    SELECT co.*, i.name AS item_name, d.name AS department_name, d.gl_number
    FROM charge_outs co
    JOIN items i ON i.id = co.item_id
    JOIN departments d ON d.id = co.department_id
    WHERE co.id = ?
  `).get(result.lastInsertRowid);

  logAudit('charge_outs', result.lastInsertRowid, 'CREATE', req.headers['x-changed-by'], null, chargeOut);
  res.status(201).json(chargeOut);
});

router.post('/bulk', (req, res) => {
  const { department_id, charged_by, ticket_number, notes, charged_at, lines } = req.body;

  if (!department_id || !charged_by || !charged_at || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'department_id, charged_by, charged_at, and lines are required' });
  }

  const insertStmt = db.prepare(
    'INSERT INTO charge_outs (item_id, department_id, quantity, unit_cost, charged_by, ticket_number, notes, charged_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const created = [];

  try {
    db.transaction(() => {
      for (const line of lines) {
        const { item_id, quantity, unit_cost } = line;
        if (!item_id || !quantity || unit_cost == null) {
          throw new Error('Each line requires item_id, quantity, and unit_cost');
        }
        const stockData = db.prepare(`
          SELECT
            COALESCE((SELECT SUM(quantity) FROM purchase_orders WHERE item_id = ?), 0) -
            COALESCE((SELECT SUM(quantity) FROM charge_outs WHERE item_id = ?), 0) AS available
        `).get(item_id, item_id);
        if (stockData.available < quantity) {
          const item = db.prepare('SELECT name FROM items WHERE id = ?').get(item_id);
          throw new Error(`Insufficient stock for "${item?.name || 'item'}". Available: ${stockData.available}`);
        }
        const result = insertStmt.run(item_id, department_id, quantity, unit_cost, charged_by, ticket_number || null, notes || null, charged_at);
        created.push(result.lastInsertRowid);
      }
    })();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  for (const id of created) {
    const co = db.prepare(`
      SELECT co.*, i.name AS item_name, d.name AS department_name, d.gl_number
      FROM charge_outs co
      JOIN items i ON i.id = co.item_id
      JOIN departments d ON d.id = co.department_id
      WHERE co.id = ?
    `).get(id);
    logAudit('charge_outs', id, 'CREATE', req.headers['x-changed-by'], null, co);
  }

  res.status(201).json({ created: created.length });
});

router.delete('/:id', (req, res) => {
  const chargeOut = db.prepare('SELECT * FROM charge_outs WHERE id = ?').get(req.params.id);
  if (!chargeOut) return res.status(404).json({ error: 'Charge-out not found' });

  db.prepare('DELETE FROM charge_outs WHERE id = ?').run(req.params.id);
  logAudit('charge_outs', req.params.id, 'DELETE', req.headers['x-changed-by'], chargeOut, null);
  res.json({ success: true });
});

module.exports = router;
