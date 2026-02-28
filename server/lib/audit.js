const db = require('../db/database');

function logAudit(table_name, record_id, action, changed_by, old_values, new_values) {
  try {
    db.prepare(`
      INSERT INTO audit_log (table_name, record_id, action, changed_by, old_values, new_values)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      table_name,
      record_id,
      action,
      changed_by || null,
      old_values != null ? JSON.stringify(old_values) : null,
      new_values != null ? JSON.stringify(new_values) : null,
    );
  } catch (e) {
    // Never let audit failures break the main operation
    console.error('Audit log error:', e.message);
  }
}

module.exports = { logAudit };
