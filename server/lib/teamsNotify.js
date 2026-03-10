const cron = require('node-cron');
const db = require('../db/database');

const WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;
const COOLDOWN_DAYS = 3;

async function postToTeams(payload) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Teams webhook returned ${res.status}: ${text}`);
  }
}

function buildMessage(dueToday, overdue) {
  const sections = [];

  if (dueToday.length > 0) {
    sections.push({
      activityTitle: '📅 Due Today',
      facts: dueToday.map(l => ({
        name: l.computer_name,
        value: `${l.person_name} (${l.department_name})${l.ticket_number ? ` — Ticket #${l.ticket_number}` : ''}`,
      })),
    });
  }

  if (overdue.length > 0) {
    sections.push({
      activityTitle: '⚠️ Overdue',
      facts: overdue.map(l => ({
        name: l.computer_name,
        value: `${l.person_name} (${l.department_name}) — due ${l.due_date}${l.ticket_number ? ` — Ticket #${l.ticket_number}` : ''}`,
      })),
    });
  }

  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '580259',
    summary: 'Loaner Computer Reminders',
    title: 'GAH IT — Loaner Computer Reminders',
    sections,
  };
}

function checkLoaners() {
  const today = new Date().toISOString().slice(0, 10);
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);

  // Loaners due today (not yet returned)
  const dueToday = db.prepare(`
    SELECT l.id, lc.name AS computer_name, l.person_name, l.due_date,
           l.ticket_number, d.name AS department_name
    FROM loaners l
    JOIN loaner_computers lc ON lc.id = l.computer_id
    JOIN departments d ON d.id = l.department_id
    WHERE l.returned_date IS NULL
      AND l.due_date = ?
  `).all(today);

  // Overdue loaners — past due date, not returned, and either never notified
  // or last notified more than COOLDOWN_DAYS ago
  const overdue = db.prepare(`
    SELECT l.id, lc.name AS computer_name, l.person_name, l.due_date,
           l.ticket_number, d.name AS department_name
    FROM loaners l
    JOIN loaner_computers lc ON lc.id = l.computer_id
    JOIN departments d ON d.id = l.department_id
    LEFT JOIN loaner_notifications n ON n.loaner_id = l.id
    WHERE l.returned_date IS NULL
      AND l.due_date < ?
      AND (n.last_notified_at IS NULL OR n.last_notified_at <= ?)
  `).all(today, cooldownCutoff);

  if (dueToday.length === 0 && overdue.length === 0) {
    console.log('[Teams] No loaner reminders to send today.');
    return;
  }

  const payload = buildMessage(dueToday, overdue);

  postToTeams(payload)
    .then(() => {
      // Record notification time for overdue loaners
      const upsert = db.prepare(`
        INSERT INTO loaner_notifications (loaner_id, last_notified_at)
        VALUES (?, ?)
        ON CONFLICT(loaner_id) DO UPDATE SET last_notified_at = excluded.last_notified_at
      `);
      const upsertMany = db.transaction((loaners, ts) => {
        for (const l of loaners) upsert.run(l.id, ts);
      });
      upsertMany(overdue, today);
      console.log(`[Teams] Sent loaner reminders — due today: ${dueToday.length}, overdue: ${overdue.length}`);
    })
    .catch(err => {
      console.error('[Teams] Failed to send loaner reminder:', err.message);
    });
}

// Weekdays at 8:00 AM (server local time)
cron.schedule('0 8 * * 1-5', checkLoaners);

console.log('[Teams] Loaner reminder cron scheduled (weekdays 8:00 AM)');

module.exports = { checkLoaners };
