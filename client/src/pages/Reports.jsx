import { useState } from 'react';
import { Download, FileBarChart2, Search, Package, Printer } from 'lucide-react';
import * as api from '../lib/api.js';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtNow = () => new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const SLOT_STYLE = {
  BLACK:           { dot: 'bg-gray-800',   badge: 'bg-gray-100 text-gray-800',     label: 'Black'           },
  CYAN:            { dot: 'bg-cyan-500',   badge: 'bg-cyan-100 text-cyan-800',     label: 'Cyan'            },
  MAGENTA:         { dot: 'bg-pink-500',   badge: 'bg-pink-100 text-pink-800',     label: 'Magenta'         },
  YELLOW:          { dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-800', label: 'Yellow'          },
  IMAGING_KIT:     { dot: 'bg-indigo-600', badge: 'bg-indigo-100 text-indigo-700', label: 'Imaging Kit'     },
  BLACK_DEVELOPER: { dot: 'bg-zinc-700',   badge: 'bg-zinc-100 text-zinc-700',     label: 'Black Developer' },
  COLOR_DEVELOPER: { dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700', label: 'Color Developer' },
  COLOR_DRUM:      { dot: 'bg-teal-500',   badge: 'bg-teal-100 text-teal-700',     label: 'Color Drum'      },
  BLACK_DRUM:      { dot: 'bg-stone-600',  badge: 'bg-stone-100 text-stone-700',   label: 'Black Drum'      },
  WASTE_TONER:     { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', label: 'Waste Toner'     },
};

// Build and trigger a CSV download from arrays of data
const downloadCsv = (filename, headers, rows) => {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const TABS = [
  { id: 'chargeOuts',  label: 'Charge-Outs',        snapshot: false },
  { id: 'glSwaps',     label: 'GL Swaps',            snapshot: false },
  { id: 'lowItems',    label: 'Low Item Inventory',  snapshot: true  },
  { id: 'lowToner',    label: 'Low Toner Inventory', snapshot: true  },
];

export default function Reports() {
  const now = new Date();
  const [month, setMonth]         = useState(now.getMonth() + 1);
  const [year, setYear]           = useState(now.getFullYear());
  const [reportType, setReportType] = useState('chargeOuts');
  const [loading, setLoading]     = useState(false);

  // Charge-outs state
  const [rows, setRows]           = useState(null);
  // GL Swaps state
  const [swapRows, setSwapRows]   = useState(null);
  // Low items state
  const [lowItems, setLowItems]   = useState(null);
  const [lowItemsAt, setLowItemsAt] = useState(null);
  // Low toner state
  const [lowToner, setLowToner]   = useState(null);
  const [lowTonerAt, setLowTonerAt] = useState(null);

  const yearOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) yearOptions.push(y);

  const clearMonthlyResults = () => { setRows(null); setSwapRows(null); };

  const isSnapshot = TABS.find(t => t.id === reportType)?.snapshot;

  const handleRun = async () => {
    setLoading(true);
    try {
      if (reportType === 'chargeOuts') {
        setRows(await api.reports.monthly(month, year));
      } else if (reportType === 'glSwaps') {
        setSwapRows(await api.glSwaps.list({ month, year }));
      } else if (reportType === 'lowItems') {
        const all = await api.items.list();
        setLowItems(all.filter(i => i.stock <= i.reorder_threshold));
        setLowItemsAt(fmtNow());
      } else if (reportType === 'lowToner') {
        const all = await api.toner.list();
        setLowToner(all.filter(t => t.stock < t.target_amount));
        setLowTonerAt(fmtNow());
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (reportType === 'chargeOuts') {
      window.open(api.reports.csvUrl(month, year), '_blank');
    } else if (reportType === 'glSwaps') {
      window.open(api.glSwaps.csvUrl(month, year), '_blank');
    } else if (reportType === 'lowItems' && lowItems) {
      downloadCsv(
        `low-items-${new Date().toISOString().slice(0,10)}.csv`,
        ['Item Name', 'Description', 'Current Stock', 'Reorder At', 'Target Amount', 'Need to Order'],
        lowItems.map(i => [i.name, i.description || '', i.stock, i.reorder_threshold, i.target_amount || '', Math.max(0, (i.target_amount || i.reorder_threshold) - i.stock)])
      );
    } else if (reportType === 'lowToner' && lowToner) {
      downloadCsv(
        `low-toner-${new Date().toISOString().slice(0,10)}.csv`,
        ['Printer Model', 'Slot', 'Part Number', 'Brand', 'Current Stock', 'Target Amount', 'Need to Order'],
        lowToner.map(t => [t.printer_model, SLOT_STYLE[t.slot]?.label || t.slot, t.part_number || '', t.brand || '', t.stock, t.target_amount, Math.max(0, t.target_amount - t.stock)])
      );
    }
  };

  // Derived data
  const deptSummary = rows ? Object.values(
    rows.reduce((acc, row) => {
      if (!acc[row.gl_number]) acc[row.gl_number] = { department: row.department, gl_number: row.gl_number, qty: 0, total: 0 };
      acc[row.gl_number].qty += row.quantity;
      acc[row.gl_number].total += row.total;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total) : [];

  const grandTotal    = rows      ? rows.reduce((s, r) => s + r.total, 0) : 0;
  const swapTotal     = swapRows  ? swapRows.reduce((s, r) => s + r.price, 0) : 0;
  const swapDeptCount = swapRows
    ? new Set([...swapRows.map(r => r.from_department_name), ...swapRows.map(r => r.to_department_name)]).size : 0;

  const hasMonthlyData  = (reportType === 'chargeOuts' && rows !== null) || (reportType === 'glSwaps' && swapRows !== null);
  const hasMonthlyResults = (reportType === 'chargeOuts' && rows?.length > 0) || (reportType === 'glSwaps' && swapRows?.length > 0);
  const hasSnapshotData = (reportType === 'lowItems' && lowItems !== null) || (reportType === 'lowToner' && lowToner !== null);
  const currentSnapshot = reportType === 'lowItems' ? lowItems : reportType === 'lowToner' ? lowToner : null;
  const snapshotHasResults = currentSnapshot?.length > 0;
  const canExport = hasMonthlyResults || snapshotHasResults;

  return (
    <div className="p-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Generate reports for finance and inventory management</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-end gap-4">
          {!isSnapshot && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Month</label>
                <select value={month} onChange={e => { setMonth(Number(e.target.value)); clearMonthlyResults(); }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Year</label>
                <select value={year} onChange={e => { setYear(Number(e.target.value)); clearMonthlyResults(); }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}
          <button onClick={handleRun} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 rounded-lg transition-colors">
            <Search size={15} />
            {loading ? 'Loading...' : isSnapshot ? 'Run Report' : 'Preview Report'}
          </button>
          {canExport && (
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
              <Download size={15} /> Export CSV
            </button>
          )}
          {isSnapshot && (reportType === 'lowItems' ? lowItemsAt : lowTonerAt) && (
            <span className="text-xs text-gray-400">Snapshot taken {reportType === 'lowItems' ? lowItemsAt : lowTonerAt}</span>
          )}
        </div>
      </div>

      {/* Report type tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setReportType(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              reportType === tab.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty states */}
      {!hasMonthlyData && !hasSnapshotData && !loading && (
        <div className="py-20 text-center">
          <FileBarChart2 className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 font-medium">
            {isSnapshot ? 'Click "Run Report" to generate a current snapshot' : 'Select a month and preview the report'}
          </p>
        </div>
      )}

      {hasMonthlyData && !hasMonthlyResults && (
        <div className="py-16 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 font-medium">
            No {reportType === 'chargeOuts' ? 'charge-outs' : 'GL swaps'} for {MONTH_NAMES[month - 1]} {year}
          </p>
        </div>
      )}

      {hasSnapshotData && !snapshotHasResults && (
        <div className="py-16 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 font-medium">
            {reportType === 'lowItems' ? 'All items are well stocked' : 'All toner is well stocked'} — nothing below reorder threshold
          </p>
        </div>
      )}

      {/* ── Charge-Outs Report ── */}
      {reportType === 'chargeOuts' && rows && rows.length > 0 && (
        <>
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
                    <td className="px-5 py-3.5"><span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{d.gl_number}</span></td>
                    <td className="px-5 py-3.5 text-center text-gray-700">{d.qty}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{fmt(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">All Transactions — {MONTH_NAMES[month - 1]} {year}</h2>
              <button onClick={handleExport} className="flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700">
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
                      <td className="px-5 py-3"><span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{row.gl_number}</span></td>
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

      {/* ── GL Swaps Report ── */}
      {reportType === 'glSwaps' && swapRows && swapRows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Swaps</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{swapRows.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Departments Involved</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{swapDeptCount}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Reclassified</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(swapTotal)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">GL Swaps — {MONTH_NAMES[month - 1]} {year}</h2>
              <button onClick={handleExport} className="flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700">
                <Download size={14} /> Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">PO #</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">From Dept / GL</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">To Dept / GL</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Swapped By</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {swapRows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(row.swapped_at)}</td>
                      <td className="px-5 py-3">
                        {row.po_number ? <span className="font-mono text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded">{row.po_number}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-900">{row.item_name}</td>
                      <td className="px-5 py-3">
                        <div className="text-gray-700">{row.from_department_name}</div>
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{row.from_gl_number}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-gray-700">{row.to_department_name}</div>
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{row.to_gl_number}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(row.price)}</td>
                      <td className="px-5 py-3 text-gray-600">{row.swapped_by}</td>
                      <td className="px-5 py-3 text-gray-500">{row.notes || <span className="text-gray-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Low Item Inventory Report ── */}
      {reportType === 'lowItems' && lowItems && lowItems.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items Below Threshold</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{lowItems.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Units to Order</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {lowItems.reduce((s, i) => s + Math.max(0, (i.target_amount || i.reorder_threshold) - i.stock), 0)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <Package size={20} className="text-red-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Report Type</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">Low Item Inventory</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Items Below Reorder Threshold</h2>
              <button onClick={handleExport} className="flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700">
                <Download size={14} /> Export CSV
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Stock</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reorder At</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Target Amt</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Need to Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lowItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50 bg-red-50/20">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{item.name}</td>
                    <td className="px-5 py-3.5 text-gray-500">{item.description || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        {item.stock}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center text-gray-500">{item.reorder_threshold}</td>
                    <td className="px-5 py-3.5 text-center text-gray-500">{item.target_amount || '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                        {Math.max(0, (item.target_amount || item.reorder_threshold) - item.stock)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Low Toner Inventory Report ── */}
      {reportType === 'lowToner' && lowToner && lowToner.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cartridges Below Threshold</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{lowToner.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Units to Order</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {lowToner.reduce((s, t) => s + Math.max(0, t.target_amount - t.stock), 0)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <Printer size={20} className="text-brand-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Report Type</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">Low Toner Inventory</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Toner Below Reorder Threshold</h2>
              <button onClick={handleExport} className="flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700">
                <Download size={14} /> Export CSV
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Printer</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Slot</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Part #</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Stock</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Target Amt</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Need to Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lowToner.map(t => {
                  const style = SLOT_STYLE[t.slot] || SLOT_STYLE.BLACK;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50/50 bg-red-50/20">
                      <td className="px-5 py-3.5 font-medium text-gray-900">{t.printer_model}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
                          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{t.part_number || <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3.5 text-gray-600">{t.brand || <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          {t.stock}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-gray-500">{t.target_amount}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                          {Math.max(0, t.target_amount - t.stock)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
