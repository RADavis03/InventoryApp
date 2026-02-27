const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const printers = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM toner_cartridges WHERE printer_id = p.id) AS toner_count
    FROM printers p
    ORDER BY p.model_name
  `).all();
  res.json(printers);
});

router.post('/', (req, res) => {
  const { model_name, is_color, notes } = req.body;
  if (!model_name) return res.status(400).json({ error: 'model_name is required' });

  const result = db.prepare(
    'INSERT INTO printers (model_name, is_color, notes) VALUES (?, ?, ?)'
  ).run(model_name, is_color ? 1 : 0, notes || null);

  res.status(201).json(db.prepare('SELECT * FROM printers WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { model_name, is_color, notes } = req.body;
  if (!model_name) return res.status(400).json({ error: 'model_name is required' });

  const existing = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Printer not found' });

  db.prepare('UPDATE printers SET model_name = ?, is_color = ?, notes = ? WHERE id = ?')
    .run(model_name, is_color ? 1 : 0, notes || null, req.params.id);

  res.json(db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Printer not found' });

  db.prepare('DELETE FROM printers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
