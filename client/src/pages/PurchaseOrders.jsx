import { useEffect, useState } from 'react';
import { Plus, Trash2, ShoppingCart, ClipboardList, X } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import * as api from '../lib/api.js';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const today = () => new Date().toISOString().split('T')[0];

const EMPTY = { item_id: '', quantity: '', unit_cost: '', po_number: '', notes: '', received_at: today() };
const newLine = () => ({ item_id: '', quantity: '', unit_cost: '' });

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Bulk PO state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkHeader, setBulkHeader] = useState({ po_number: '', received_at: today(), notes: '' });
  const [bulkLines, setBulkLines] = useState([newLine()]);
  const [bulkError, setBulkError] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.purchaseOrders.list(), api.items.list()])
      .then(([pos, its]) => { setOrders(pos); setItems(its); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(EMPTY);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.purchaseOrders.create(form);
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.purchaseOrders.delete(id);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const openBulk = () => {
    setBulkHeader({ po_number: '', received_at: today(), notes: '' });
    setBulkLines([newLine()]);
    setBulkError('');
    setBulkResult(null);
    setShowBulkModal(true);
  };

  const closeBulk = () => {
    setShowBulkModal(false);
    setBulkResult(null);
  };

  const setHeader = (k) => (e) => setBulkHeader(h => ({ ...h, [k]: e.target.value }));

  const setLine = (i, k) => (e) => {
    const val = e.target.value;
    setBulkLines(lines => {
      const next = [...lines];
      next[i] = { ...next[i], [k]: val };
      // Auto-fill unit cost from item's current price when item changes
      if (k === 'item_id') {
        const item = items.find(it => it.id === parseInt(val));
        next[i].unit_cost = item ? (item.latest_purchase_price ?? item.unit_price ?? '') : '';
      }
      return next;
    });
  };

  const addLine = () => setBulkLines(l => [...l, newLine()]);

  const removeLine = (i) => setBulkLines(l => l.filter((_, idx) => idx !== i));

  const bulkGrandTotal = bulkLines.reduce((sum, l) => {
    const q = parseFloat(l.quantity) || 0;
    const c = parseFloat(l.unit_cost) || 0;
    return sum + q * c;
  }, 0);

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setBulkError('');

    const validLines = bulkLines.filter(l => l.item_id && l.quantity && l.unit_cost);
    if (validLines.length === 0) {
      setBulkError('Add at least one complete line item.');
      return;
    }

    setBulkSubmitting(true);
    const succeeded = [];
    const failed = [];

    for (const line of validLines) {
      try {
        await api.purchaseOrders.create({
          item_id: line.item_id,
          quantity: line.quantity,
          unit_cost: line.unit_cost,
          po_number: bulkHeader.po_number || null,
          notes: bulkHeader.notes || null,
          received_at: bulkHeader.received_at,
        });
        const item = items.find(i => i.id === parseInt(line.item_id));
        succeeded.push(item?.name ?? `Item #${line.item_id}`);
      } catch (err) {
        const item = items.find(i => i.id === parseInt(line.item_id));
        failed.push({ name: item?.name ?? `Item #${line.item_id}`, reason: err.message });
      }
    }

    setBulkSubmitting(false);
    setBulkResult({ succeeded, failed });
    if (succeeded.length > 0) load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-500 mt-1">Record stock receipts and restock history</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openBulk}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <ClipboardList size={16} /> Bulk PO
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Log Purchase
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingCart className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-500 font-medium">No purchase orders yet</p>
            <p className="text-gray-400 text-sm mt-1">Log your first stock receipt to start tracking inventory</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">PO #</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit Cost</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{fmtDate(o.received_at)}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-900">{o.item_name}</td>
                  <td className="px-5 py-3.5">
                    {o.po_number
                      ? <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{o.po_number}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-center text-gray-900 font-medium">{o.quantity}</td>
                  <td className="px-5 py-3.5 text-right text-gray-900">{fmt(o.unit_cost)}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{fmt(o.quantity * o.unit_cost)}</td>
                  <td className="px-5 py-3.5 text-gray-500 max-w-[200px] truncate">{o.notes || '—'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setDeleteConfirm(o)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title="Log Purchase" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Item <span className="text-red-500">*</span></label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={form.item_id} onChange={set('item_id')} required
              >
                <option value="">Select an item...</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date Received <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={form.received_at} onChange={set('received_at')} required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">PO Number</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={form.po_number} onChange={set('po_number')} placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity <span className="text-red-500">*</span></label>
                <input
                  type="number" min="1" step="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={form.quantity} onChange={set('quantity')} placeholder="0" required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit Cost ($) <span className="text-red-500">*</span></label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={form.unit_cost} onChange={set('unit_cost')} placeholder="0.00" required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <textarea
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                value={form.notes} onChange={set('notes')} placeholder="Optional notes..."
              />
            </div>

            {form.quantity && form.unit_cost && (
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm">
                <span className="text-blue-700 font-medium">Total: {fmt(form.quantity * form.unit_cost)}</span>
              </div>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                Log Purchase
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showBulkModal && (
        <Modal title="Bulk Purchase Order" onClose={closeBulk} size="lg">
          {!bulkResult ? (
            <form onSubmit={handleBulkSubmit} className="space-y-5">
              {/* Shared PO header */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">PO Number</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={bulkHeader.po_number} onChange={setHeader('po_number')} placeholder="e.g. PO-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date Received <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={bulkHeader.received_at} onChange={setHeader('received_at')} required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={bulkHeader.notes} onChange={setHeader('notes')} placeholder="Optional notes for all line items"
                />
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Line Items</label>
                  <button type="button" onClick={addLine}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                    <Plus size={13} /> Add Item
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Qty</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Unit Cost</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bulkLines.map((line, i) => {
                        const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_cost) || 0);
                        return (
                          <tr key={i}>
                            <td className="px-2 py-1.5">
                              <select
                                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                value={line.item_id} onChange={setLine(i, 'item_id')} required
                              >
                                <option value="">Select item...</option>
                                {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number" min="1" step="1"
                                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={line.quantity} onChange={setLine(i, 'quantity')} placeholder="0" required
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number" min="0" step="0.01"
                                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={line.unit_cost} onChange={setLine(i, 'unit_cost')} placeholder="0.00" required
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right text-gray-700 font-medium whitespace-nowrap">
                              {lineTotal > 0 ? fmt(lineTotal) : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {bulkLines.length > 1 && (
                                <button type="button" onClick={() => removeLine(i)}
                                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                  <X size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {bulkGrandTotal > 0 && (
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm flex justify-between">
                  <span className="text-blue-700">{bulkLines.filter(l => l.item_id && l.quantity && l.unit_cost).length} line item(s)</span>
                  <span className="text-blue-700 font-semibold">Grand Total: {fmt(bulkGrandTotal)}</span>
                </div>
              )}

              {bulkError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{bulkError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeBulk}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={bulkSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {bulkSubmitting ? 'Saving…' : 'Submit PO'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {bulkResult.succeeded.length > 0 && (
                <div className="bg-green-50 rounded-lg px-4 py-3">
                  <p className="text-sm font-medium text-green-700 mb-1">{bulkResult.succeeded.length} line item{bulkResult.succeeded.length !== 1 ? 's' : ''} recorded</p>
                  <p className="text-sm text-green-600">{bulkResult.succeeded.join(', ')}</p>
                </div>
              )}
              {bulkResult.failed.length > 0 && (
                <div className="bg-red-50 rounded-lg px-4 py-3">
                  <p className="text-sm font-medium text-red-700 mb-2">{bulkResult.failed.length} failed:</p>
                  <ul className="space-y-1">
                    {bulkResult.failed.map((f, i) => (
                      <li key={i} className="text-sm text-red-600">{f.name}: {f.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={closeBulk}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  Done
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {deleteConfirm && (
        <Modal title="Delete Purchase Order" onClose={() => setDeleteConfirm(null)} size="sm">
          <p className="text-gray-600 text-sm">
            Delete this purchase of <strong>{deleteConfirm.quantity}x {deleteConfirm.item_name}</strong> received on <strong>{fmtDate(deleteConfirm.received_at)}</strong>? This will reduce stock accordingly.
          </p>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={() => handleDelete(deleteConfirm.id)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
