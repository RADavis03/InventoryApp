import { useState } from 'react';
import { Download, FileBarChart2, Search } from 'lucide-react';
import * as api from '../lib/api.js';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function Reports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);

  const yearOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) yearOptions.push(y);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const data = await api.reports.monthly(month, year);
      setRows(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    window.open(api.reports.csvUrl(month, year), '_blank');
  };

  // Group by department for summary
  const deptSummary = rows ? Object.values(
    rows.reduce((acc, row) => {
      if (!acc[row.gl_number]) {
        acc[row.gl_number] = { department: row.department, gl_number: row.gl_number, qty: 0, total: 0 };
      }
      acc[row.gl_number].qty += row.quantity;
      acc[row.gl_number].total += row.total;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total) : [];

  const grandTotal = rows ? rows.reduce((s, r) => s + r.total, 0) : 0;

  return (
    <div className="p-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Generate monthly charge-out reports for finance</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Month</label>
            <select
              value={month} onChange={e => { setMonth(Number(e.target.value)); setRows(null); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Year</label>
            <select
              value={year} onChange={e => { setYear(Number(e.target.value)); setRows(null); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            onClick={handlePreview}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 rounded-lg transition-colors"
          >
            <Search size={15} />
            {loading ? 'Loading...' : 'Preview Report'}
          </button>
          {rows && rows.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              <Download size={15} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {rows === null && !loading && (
        <div className="py-20 text-center">
          <FileBarChart2 className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 font-medium">Select a month and preview the report</p>
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <div className="py-16 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 font-medium">No charge-outs for {MONTH_NAMES[month - 1]} {year}</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transactions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{rows.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Departments Billed</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{deptSummary.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Grand Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(grandTotal)}</p>
            </div>
          </div>

          {/* Department Summary */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Summary by Department</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">GL Number</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Qty</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {deptSummary.map(d => (
                  <tr key={d.gl_number} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{d.department}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{d.gl_number}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center text-gray-700">{d.qty}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{fmt(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Full Transaction Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">All Transactions — {MONTH_NAMES[month - 1]} {year}</h2>
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">GL #</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit Cost</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Charged By</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticket #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(row.date)}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{row.item}</td>
                      <td className="px-5 py-3 text-gray-700">{row.department}</td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{row.gl_number}</span>
                      </td>
                      <td className="px-5 py-3 text-center text-gray-700">{row.quantity}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{fmt(row.unit_cost)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(row.total)}</td>
                      <td className="px-5 py-3 text-gray-600">{row.charged_by}</td>
                      <td className="px-5 py-3">
                        {row.ticket_number
                          ? <span className="font-mono text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded">{row.ticket_number}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
