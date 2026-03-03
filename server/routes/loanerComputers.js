const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const computers = db.prepare(`
    SELECT lc.*,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM loaners l
          WHERE l.computer_id = lc.id AND l.returned_date IS NULL
        ) THEN 1 ELSE 0
      END AS is_loaned_out
    FROM loaner_computers lc
    ORDER BY lc.name ASC
  `).all();
  res.json(computers);
});

router.post('/', (req, res) => {
  const { name, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const result = db.prepare(
      'INSERT INTO loaner_computers (name, notes) VALUES (?, ?)'
    ).run(name.trim(), notes || null);
    const computer = db.prepare('SELECT * FROM loaner_computers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(computer);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A computer with that name already exists' });
    }
    throw err;
  }
});

router.put('/:id', (req, res) => {
  const { name, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const existing = db.prepare('SELECT * FROM loaner_computers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Computer not found' });

  try {
    db.prepare('UPDATE loaner_computers SET name = ?, notes = ? WHERE id = ?')
      .run(name.trim(), notes || null, req.params.id);
    const computer = db.prepare('SELECT * FROM loaner_computers WHERE id = ?').get(req.params.id);
    res.json(computer);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A computer with that name already exists' });
    }
    throw err;
  }
});

router.delete('/:id', (req, res) => {
  const computer = db.prepare('SELECT * FROM loaner_computers WHERE id = ?').get(req.params.id);
  if (!computer) return res.status(404).json({ error: 'Computer not found' });

  const activeLoaner = db.prepare(
    'SELECT id FROM loaners WHERE computer_id = ? AND returned_date IS NULL'
  ).get(req.params.id);
  if (activeLoaner) {
    return res.status(400).json({ error: 'Cannot delete a computer that is currently on loan' });
  }

  db.prepare('DELETE FROM loaner_computers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
