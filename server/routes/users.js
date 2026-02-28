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
  if (!/^\d{5}$/.test(pin)) return res.status(400).json({ error: 'PIN must be exactly 5 digits' });

  const pin_hash = bcrypt.hashSync(pin, 10);
  const result = db.prepare('INSERT INTO users (name, pin_hash) VALUES (?, ?)').run(name.trim(), pin_hash);
  const user = db.prepare('SELECT id, name, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// Get lockout status
router.get('/lockout', (req, res) => {
  const lockout = db.prepare('SELECT * FROM login_lockout WHERE id = 1').get();
  res.json(lockout || { id: 1, failed_attempts: 0, locked: 0, locked_at: null });
});

// Reset lockout (admin action from Users page) — must be before DELETE /:id
router.delete('/lockout', (req, res) => {
  db.prepare('UPDATE login_lockout SET failed_attempts = 0, locked = 0, locked_at = NULL WHERE id = 1').run();
  res.json({ success: true });
});

// Delete user
router.delete('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Verify PIN for a specific user
router.post('/verify', (req, res) => {
  const { id, pin } = req.body;
  if (!id || !pin) return res.status(400).json({ error: 'id and pin are required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = bcrypt.compareSync(String(pin), user.pin_hash);
  if (!valid) return res.status(401).json({ error: 'Incorrect PIN' });

  res.json({ id: user.id, name: user.name });
});

// Login by PIN only — tries PIN against all users, returns matching user
router.post('/login', (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'pin is required' });

  const lockout = db.prepare('SELECT * FROM login_lockout WHERE id = 1').get();
  if (lockout && lockout.locked) {
    return res.status(423).json({ error: 'System locked after too many failed attempts. Contact your IT administrator.', locked: true });
  }

  const users = db.prepare('SELECT * FROM users').all();
  for (const user of users) {
    if (bcrypt.compareSync(String(pin), user.pin_hash)) {
      // Successful login — reset attempt counter
      db.prepare('UPDATE login_lockout SET failed_attempts = 0, locked = 0, locked_at = NULL WHERE id = 1').run();
      return res.json({ id: user.id, name: user.name });
    }
  }

  // Wrong PIN — increment attempt count
  const newCount = (lockout ? lockout.failed_attempts : 0) + 1;
  if (newCount >= 5) {
    db.prepare('UPDATE login_lockout SET failed_attempts = ?, locked = 1, locked_at = CURRENT_TIMESTAMP WHERE id = 1').run(newCount);
    return res.status(423).json({ error: 'System locked after too many failed attempts. Contact your IT administrator.', locked: true });
  } else {
    db.prepare('UPDATE login_lockout SET failed_attempts = ? WHERE id = 1').run(newCount);
    return res.status(401).json({ error: 'Incorrect PIN', attempts_remaining: 5 - newCount });
  }
});

module.exports = router;
