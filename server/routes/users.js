const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');

// List all users (no PINs)
router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, name, created_at FROM users ORDER BY name').all();
  res.json(users);
});

// Create user
router.post('/', (req, res) => {
  const { name, pin } = req.body;
  if (!name || !pin) return res.status(400).json({ error: 'name and pin are required' });
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' });

  const pin_hash = bcrypt.hashSync(pin, 10);
  const result = db.prepare('INSERT INTO users (name, pin_hash) VALUES (?, ?)').run(name.trim(), pin_hash);
  const user = db.prepare('SELECT id, name, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// Delete user
router.delete('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Verify PIN — returns user info on success, 401 on wrong PIN
router.post('/verify', (req, res) => {
  const { id, pin } = req.body;
  if (!id || !pin) return res.status(400).json({ error: 'id and pin are required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = bcrypt.compareSync(String(pin), user.pin_hash);
  if (!valid) return res.status(401).json({ error: 'Incorrect PIN' });

  res.json({ id: user.id, name: user.name });
});

module.exports = router;
