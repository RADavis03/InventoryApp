const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const items = db.prepare(`
    SELECT
      i.*,
      (
        COALESCE((SELECT SUM(quantity) FROM purchase_orders WHERE item_id = i.id), 0) -
        COALESCE((SELECT SUM(quantity) FROM charge_outs WHERE item_id = i.id), 0)
      ) AS stock,
      (SELECT unit_cost FROM purchase_orders WHERE item_id = i.id ORDER BY received_at DESC, id DESC LIMIT 1) AS latest_purchase_price
    FROM items i
    WHERE i.is_custom = 0
    ORDER BY i.name
  `).all();
  res.json(items);
});

router.post('/', (req, res) => {
  const { name, description, unit_price, reorder_threshold } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(
    'INSERT INTO items (name, description, unit_price, reorder_threshold) VALUES (?, ?, ?, ?)'
  ).run(name, description || null, unit_price || 0, reorder_threshold || 0);

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

router.put('/:id', (req, res) => {
  const { name, description, unit_price, reorder_threshold } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  db.prepare(
    'UPDATE items SET name = ?, description = ?, unit_price = ?, reorder_threshold = ? WHERE id = ?'
  ).run(name, description || null, unit_price || 0, reorder_threshold || 0, req.params.id);

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  res.json(item);
});

router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
