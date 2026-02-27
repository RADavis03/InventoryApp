const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const departments = db.prepare('SELECT * FROM departments ORDER BY name').all();
  res.json(departments);
});

router.post('/', (req, res) => {
  const { name, gl_number } = req.body;
  if (!name || !gl_number) return res.status(400).json({ error: 'Name and GL number are required' });

  const result = db.prepare(
    'INSERT INTO departments (name, gl_number) VALUES (?, ?)'
  ).run(name, gl_number);

  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(dept);
});

router.put('/:id', (req, res) => {
  const { name, gl_number } = req.body;
  if (!name || !gl_number) return res.status(400).json({ error: 'Name and GL number are required' });

  const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Department not found' });

  db.prepare('UPDATE departments SET name = ?, gl_number = ? WHERE id = ?')
    .run(name, gl_number, req.params.id);

  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  res.json(dept);
});

router.delete('/:id', (req, res) => {
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!dept) return res.status(404).json({ error: 'Department not found' });

  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
