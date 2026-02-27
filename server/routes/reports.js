const express = require('express');
const router = express.Router();
const db = require('../db/database');

const getRows = (month, year) => db.prepare(`
  SELECT
    co.charged_at AS date,
    i.name AS item,
    d.name AS department,
    d.gl_number,
    co.quantity,
    co.unit_cost,
    ROUND(co.quantity * co.unit_cost, 2) AS total,
    co.charged_by,
    COALESCE(co.ticket_number, '') AS ticket_number,
    COALESCE(co.notes, '') AS notes
  FROM charge_outs co
  JOIN items i ON i.id = co.item_id
  JOIN departments d ON d.id = co.department_id
  WHERE strftime('%m', co.charged_at) = ? AND strftime('%Y', co.charged_at) = ?
  ORDER BY co.charged_at ASC, co.id ASC
`).all(month.toString().padStart(2, '0'), year.toString());

router.get('/monthly', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year are required' });
  res.json(getRows(month, year));
});

router.get('/monthly/csv', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year are required' });

  const rows = getRows(month, year);

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = MONTH_NAMES[parseInt(month) - 1];

  const escape = (val) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = ['Date', 'Item', 'Department', 'GL Number', 'Quantity', 'Unit Cost', 'Total', 'Charged By', 'Ticket Number', 'Notes'];

  const csv = [
    headers.join(','),
    ...rows.map(row => [
      escape(row.date),
      escape(row.item),
      escape(row.department),
      escape(row.gl_number),
      escape(row.quantity),
      escape(row.unit_cost),
      escape(row.total),
      escape(row.charged_by),
      escape(row.ticket_number),
      escape(row.notes),
    ].join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="IT-Inventory-${monthName}-${year}.csv"`);
  res.send(csv);
});

module.exports = router;
