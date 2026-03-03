const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { logAudit } = require('../lib/audit');

router.get('/', (req, res) => {
  const { status } = req.query;

  let query = `
    SELECT l.*,
      lc.name AS computer_name,
      d.name AS department_name
    FROM loaners l
    JOIN loaner_computers lc ON lc.id = l.computer_id
    JOIN departments d ON d.id = l.department_id
    WHERE 1=1
  `;

  if (status === 'active') query += ' AND l.returned_date IS NULL';
  else if (status === 'returned') query += ' AND l.returned_date IS NOT NULL';

  query += ' ORDER BY l.due_date ASC, l.id DESC';

  const loaners = db.prepare(query).all();
  res.json(loaners);
});

router.post('/', (req, res) => {
  const { computer_id, department_id, person_name, ticket_number, loaned_date, due_date, notes } = req.body;
  const created_by = req.headers['x-changed-by'] || null;

  if (!computer_id || !department_id || !person_name || !loaned_date || !due_date || !ticket_number) {
    return res.status(400).json({ error: 'computer_id, department_id, person_name, loaned_date, due_date, and ticket_number are required' });
  }

  const activeLoaner = db.prepare(
    'SELECT id FROM loaners WHERE computer_id = ? AND returned_date IS NULL'
  ).get(computer_id);
  if (activeLoaner) {
    return res.status(400).json({ error: 'This computer is already on active loan' });
  }

  const result = db.prepare(`
    INSERT INTO loaners (computer_id, department_id, person_name, ticket_number, loaned_date, due_date, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(computer_id, department_id, person_name.trim(), ticket_number || null, loaned_date, due_date, notes || null, created_by);

  const loaner = db.prepare(`
    SELECT l.*, lc.name AS computer_name, d.name AS department_name
    FROM loaners l
    JOIN loaner_computers lc ON lc.id = l.computer_id
    JOIN departments d ON d.id = l.department_id
    WHERE l.id = ?
  `).get(result.lastInsertRowid);

  logAudit('loaners', result.lastInsertRowid, 'CREATE', created_by, null, loaner);
  res.status(201).json(loaner);
});

router.put('/:id', (req, res) => {
  const changed_by = req.headers['x-changed-by'] || null;
  const { computer_id, department_id, person_name, ticket_number, loaned_date, due_date, notes } = req.body;

  if (!computer_id || !department_id || !person_name || !loaned_date || !due_date || !ticket_number) {
    return res.status(400).json({ error: 'computer_id, department_id, person_name, loaned_date, due_date, and ticket_number are required' });
  }

  const loaner = db.prepare('SELECT * FROM loaners WHERE id = ?').get(req.params.id);
  if (!loaner) return res.status(404).json({ error: 'Loaner not found' });

  // If the computer changed, make sure the new computer isn't already on active loan
  if (String(computer_id) !== String(loaner.computer_id)) {
    const conflict = db.prepare(
      'SELECT id FROM loaners WHERE computer_id = ? AND returned_date IS NULL AND id != ?'
    ).get(computer_id, req.params.id);
    if (conflict) return res.status(400).json({ error: 'That computer is already on active loan' });
  }

  db.prepare(`
    UPDATE loaners SET computer_id=?, department_id=?, person_name=?, ticket_number=?, loaned_date=?, due_date=?, notes=?
    WHERE id=?
  `).run(computer_id, department_id, person_name.trim(), ticket_number || null, loaned_date, due_date, notes || null, req.params.id);

  const updated = db.prepare(`
    SELECT l.*, lc.name AS computer_name, d.name AS department_name
    FROM loaners l
    JOIN loaner_computers lc ON lc.id = l.computer_id
    JOIN departments d ON d.id = l.department_id
    WHERE l.id = ?
  `).get(req.params.id);

  logAudit('loaners', req.params.id, 'UPDATE', changed_by, loaner, updated);
  res.json(updated);
});

router.put('/:id/return', (req, res) => {
  const changed_by = req.headers['x-changed-by'] || null;
  const returned_by = req.body.returned_by || changed_by;
  const returned_date = new Date().toISOString().split('T')[0];

  const loaner = db.prepare('SELECT * FROM loaners WHERE id = ?').get(req.params.id);
  if (!loaner) return res.status(404).json({ error: 'Loaner not found' });
  if (loaner.returned_date) return res.status(400).json({ error: 'This loaner has already been returned' });

  db.prepare('UPDATE loaners SET returned_date = ?, returned_by = ? WHERE id = ?')
    .run(returned_date, returned_by || null, req.params.id);

  const updated = db.prepare(`
    SELECT l.*, lc.name AS computer_name, d.name AS department_name
    FROM loaners l
    JOIN loaner_computers lc ON lc.id = l.computer_id
    JOIN departments d ON d.id = l.department_id
    WHERE l.id = ?
  `).get(req.params.id);

  logAudit('loaners', req.params.id, 'UPDATE', changed_by, loaner, updated);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const loaner = db.prepare('SELECT * FROM loaners WHERE id = ?').get(req.params.id);
  if (!loaner) return res.status(404).json({ error: 'Loaner not found' });

  db.prepare('DELETE FROM loaners WHERE id = ?').run(req.params.id);
  logAudit('loaners', req.params.id, 'DELETE', req.headers['x-changed-by'] || null, loaner, null);
  res.json({ success: true });
});

module.exports = router;
