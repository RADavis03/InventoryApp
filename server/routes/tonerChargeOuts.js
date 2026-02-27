const express = require('express');
const router = express.Router();
const db = require('../db/database');

const enrichedSelect = `
  SELECT
    tco.*,
    tc.slot,
    tc.part_number,
    tc.brand,
    p.model_name   AS printer_model,
    d.name         AS department_name,
    d.gl_number
  FROM toner_charge_outs tco
  JOIN toner_cartridges tc ON tc.id = tco.toner_id
  JOIN printers p          ON p.id  = tc.printer_id
  JOIN departments d       ON d.id  = tco.department_id
`;

// GET /api/toner-charge-outs?month=&year=
router.get('/', (req, res) => {
  const { month, year } = req.query;
  let query = enrichedSelect;
  const params = [];

  if (month && year) {
    query += ` WHERE strftime('%m', tco.charged_at) = ? AND strftime('%Y', tco.charged_at) = ?`;
    params.push(month.toString().padStart(2, '0'), year.toString());
  }
  query += ' ORDER BY tco.charged_at ASC, tco.id ASC';

  res.json(db.prepare(query).all(...params));
});

// POST /api/toner-charge-outs
router.post('/', (req, res) => {
  const { toner_id, department_id, quantity, charged_by, ticket_number, notes, charged_at } = req.body;

  if (!toner_id || !department_id || !quantity || !charged_by || !charged_at) {
    return res.status(400).json({ error: 'toner_id, department_id, quantity, charged_by, and charged_at are required' });
  }

  const toner = db.prepare('SELECT * FROM toner_cartridges WHERE id = ?').get(toner_id);
  if (!toner) return res.status(404).json({ error: 'Toner cartridge not found' });

  const result = db.prepare(
    'INSERT INTO toner_charge_outs (toner_id, department_id, quantity, charged_by, ticket_number, notes, charged_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(toner_id, department_id, parseInt(quantity), charged_by, ticket_number || null, notes || null, charged_at);

  const created = db.prepare(enrichedSelect + ' WHERE tco.id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// DELETE /api/toner-charge-outs/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM toner_charge_outs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Toner charge-out not found' });

  db.prepare('DELETE FROM toner_charge_outs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
