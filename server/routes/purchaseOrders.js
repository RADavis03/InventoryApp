const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const { item_id } = req.query;
  let query = `
    SELECT po.*, i.name AS item_name
    FROM purchase_orders po
    JOIN items i ON i.id = po.item_id
  `;
  const params = [];

  if (item_id) {
    query += ' WHERE po.item_id = ?';
    params.push(item_id);
  }

  query += ' ORDER BY po.received_at DESC, po.id DESC';

  const orders = db.prepare(query).all(...params);
  res.json(orders);
});

router.post('/', (req, res) => {
  const { item_id, quantity, unit_cost, po_number, notes, received_at } = req.body;
  if (!item_id || !quantity || !unit_cost || !received_at) {
    return res.status(400).json({ error: 'item_id, quantity, unit_cost, and received_at are required' });
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const result = db.prepare(
    'INSERT INTO purchase_orders (item_id, quantity, unit_cost, po_number, notes, received_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(item_id, quantity, unit_cost, po_number || null, notes || null, received_at);

  // Update item's unit_price to reflect latest purchase cost
  db.prepare('UPDATE items SET unit_price = ? WHERE id = ?').run(unit_cost, item_id);

  const order = db.prepare(`
    SELECT po.*, i.name AS item_name
    FROM purchase_orders po
    JOIN items i ON i.id = po.item_id
    WHERE po.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(order);
});

router.delete('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Purchase order not found' });

  db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
