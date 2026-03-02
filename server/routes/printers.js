const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { logAudit } = require('../lib/audit');

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

  const created = db.prepare('SELECT * FROM printers WHERE id = ?').get(result.lastInsertRowid);
  logAudit('printers', result.lastInsertRowid, 'CREATE', req.headers['x-changed-by'], null, created);
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const { model_name, is_color, notes } = req.body;
  if (!model_name) return res.status(400).json({ error: 'model_name is required' });

  const existing = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Printer not found' });

  db.prepare('UPDATE printers SET model_name = ?, is_color = ?, notes = ? WHERE id = ?')
    .run(model_name, is_color ? 1 : 0, notes || null, req.params.id);

  const updated = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id);
  logAudit('printers', req.params.id, 'UPDATE', req.headers['x-changed-by'], existing, updated);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Printer not found' });

  db.prepare('DELETE FROM printers WHERE id = ?').run(req.params.id);
  logAudit('printers', req.params.id, 'DELETE', req.headers['x-changed-by'], existing, null);
  res.json({ success: true });
});

module.exports = router;
