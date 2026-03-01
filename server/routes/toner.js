const express = require('express');
const router = express.Router();
const db = require('../db/database');

const BW_SLOTS    = ['BLACK', 'IMAGING_KIT', 'BLACK_DRUM'];
const COLOR_SLOTS = ['BLACK', 'CYAN', 'MAGENTA', 'YELLOW', 'BLACK_DEVELOPER', 'COLOR_DEVELOPER', 'COLOR_DRUM', 'BLACK_DRUM', 'WASTE_TONER'];

const SLOT_ORDER = `CASE tc.slot
  WHEN 'BLACK'           THEN 1
  WHEN 'CYAN'            THEN 2
  WHEN 'MAGENTA'         THEN 3
  WHEN 'YELLOW'          THEN 4
  WHEN 'BLACK_DEVELOPER' THEN 5
  WHEN 'COLOR_DEVELOPER' THEN 6
  WHEN 'BLACK_DRUM'      THEN 7
  WHEN 'COLOR_DRUM'      THEN 8
  WHEN 'IMAGING_KIT'     THEN 9
  WHEN 'WASTE_TONER'     THEN 10
  ELSE 11 END`;

// Stock is shared across all cartridges with the same part_number.
// If part_number is null/empty, stock is calculated per individual cartridge.
const withStock = (where = '', params = []) => db.prepare(`
  SELECT
    tc.*,
    p.model_name AS printer_model,
    p.is_color   AS printer_is_color,
    CASE
      WHEN tc.part_number IS NOT NULL AND tc.part_number != '' THEN
        COALESCE((SELECT SUM(tr.quantity) FROM toner_restocks tr
                  JOIN toner_cartridges tc2 ON tc2.id = tr.toner_id
                  WHERE tc2.part_number = tc.part_number), 0) -
        COALESCE((SELECT SUM(tco.quantity) FROM toner_charge_outs tco
                  JOIN toner_cartridges tc2 ON tc2.id = tco.toner_id
                  WHERE tc2.part_number = tc.part_number), 0)
      ELSE
        COALESCE((SELECT SUM(quantity) FROM toner_restocks    WHERE toner_id = tc.id), 0) -
        COALESCE((SELECT SUM(quantity) FROM toner_charge_outs WHERE toner_id = tc.id), 0)
    END AS stock
  FROM toner_cartridges tc
  JOIN printers p ON p.id = tc.printer_id
  ${where}
  ORDER BY p.model_name ASC, ${SLOT_ORDER}
`).all(...params);

// GET /api/toner?printer_id=X
router.get('/', (req, res) => {
  const { printer_id } = req.query;
  if (printer_id) {
    res.json(withStock('WHERE tc.printer_id = ?', [printer_id]));
  } else {
    res.json(withStock());
  }
});

// POST /api/toner
router.post('/', (req, res) => {
  const { printer_id, slot, part_number, brand, notes, target_amount } = req.body;
  if (!printer_id || !slot) return res.status(400).json({ error: 'printer_id and slot are required' });

  const printer = db.prepare('SELECT * FROM printers WHERE id = ?').get(printer_id);
  if (!printer) return res.status(404).json({ error: 'Printer not found' });

  const VALID_SLOTS = printer.is_color ? COLOR_SLOTS : BW_SLOTS;
  if (!VALID_SLOTS.includes(slot)) {
    return res.status(400).json({ error: `Invalid slot for this printer type. Valid: ${VALID_SLOTS.join(', ')}` });
  }

  const duplicate = db.prepare('SELECT id FROM toner_cartridges WHERE printer_id = ? AND slot = ?').get(printer_id, slot);
  if (duplicate) return res.status(409).json({ error: `A ${slot} cartridge already exists for this printer` });

  const result = db.prepare(
    'INSERT INTO toner_cartridges (printer_id, slot, part_number, brand, notes, target_amount) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(printer_id, slot, part_number || null, brand || null, notes || null, target_amount || 0);

  res.status(201).json(withStock('WHERE tc.id = ?', [result.lastInsertRowid])[0]);
});

// PUT /api/toner/:id
router.put('/:id', (req, res) => {
  const { part_number, brand, notes, target_amount } = req.body;
  const existing = db.prepare('SELECT * FROM toner_cartridges WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Toner cartridge not found' });

  db.prepare('UPDATE toner_cartridges SET part_number = ?, brand = ?, notes = ?, target_amount = ? WHERE id = ?')
    .run(part_number || null, brand || null, notes || null, target_amount || 0, req.params.id);

  res.json(withStock('WHERE tc.id = ?', [req.params.id])[0]);
});

// DELETE /api/toner/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM toner_cartridges WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Toner cartridge not found' });

  db.prepare('DELETE FROM toner_cartridges WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/toner/:id/restock
router.post('/:id/restock', (req, res) => {
  const { quantity, notes, received_at } = req.body;
  if (!quantity || !received_at) return res.status(400).json({ error: 'quantity and received_at are required' });
  if (parseInt(quantity) <= 0) return res.status(400).json({ error: 'quantity must be greater than 0' });

  const existing = db.prepare('SELECT * FROM toner_cartridges WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Toner cartridge not found' });

  db.prepare('INSERT INTO toner_restocks (toner_id, quantity, notes, received_at) VALUES (?, ?, ?, ?)')
    .run(req.params.id, parseInt(quantity), notes || null, received_at);

  res.status(201).json(withStock('WHERE tc.id = ?', [req.params.id])[0]);
});

module.exports = router;
