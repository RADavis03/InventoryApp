import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Trash2, ShoppingCart, ClipboardList, X, ChevronRight } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import * as api from '../lib/api.js';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const today = () => new Date().toISOString().split('T')[0];

const EMPTY = {
  type: 'inventory', item_id: '', custom_item_name: '', add_to_inventory: false,
  quantity: '', unit_cost: '', po_number: '', notes: '', received_at: today(),
};
const newLine = () => ({
  type: 'inventory', item_id: '', custom_item_name: '', add_to_inventory: false,
  quantity: '', unit_cost: '',
});

// Build the payload sent to the API for a single line
const linePayload = (line, header = {}) => {
  const base = { quantity: line.quantity, unit_cost: line.unit_cost, ...header };
  if (line.type === 'inventory') {
    base.item_id = line.item_id;
  } else {
    base.custom_item_name = line.custom_item_name;
    base.add_to_inventory = line.add_to_inventory;
  }
  return base;
};

// Small inline toggle used in both modals
function TypeToggle({ value, onChange }) {
  return (
    <span className="inline-flex rounded border border-gray-200 overflow-hidden text-xs font-medium select-none">
      <button
        type="button"
        onClick={() => onChange('inventory')}
        className={`px-2 py-1 transition-colors ${value === 'inventory' ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
      >
        Inventory
      </button>
      <button
        type="button"
        onClick={() => onChange('custom')}
        className={`px-2 py-1 border-l border-gray-200 transition-colors ${value === 'custom' ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
      >
        Custom
      </button>
    </span>
  );
}

function ItemPicker({ line, items, onTypeChange, onInventoryChange, onCustomNameChange, onAddToInvChange }) {
  return (
    <div className="space-y-1.5">
      <TypeToggle value={line.type} onChange={onTypeChange} />
      {line.type === 'inventory' ? (
        <select
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          value={line.item_id} onChange={onInventoryChange} required
        >
          <option value="">Select item...</option>
          {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
      ) : (
        <div className="space-y-1">
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={line.custom_item_name} onChange={onCustomNameChange}
            placeholder="Item name..." required
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox" className="rounded border-gray-300 accent-brand-600"
              checked={line.add_to_inventory} onChange={onAddToInvChange}
            />
            Add to inventory (track stock)
          </label>
        </div>
      )}
    </div>
  );
}

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedPOs, setExpandedPOs] = useState(new Set());

  // Bulk PO state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkHeader, setBulkHeader] = useState({ po_number: '', received_at: today(), notes: '' });
  const [bulkLines, setBulkLines] = useState([newLine()]);
  const [bulkError, setBulkError] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const location = useLocation();

  const load = () => {
    if (orders.length === 0) setLoading(true);
    Promise.all([api.purchaseOrders.list(), api.items.list()])
      .then(([pos, its]) => { setOrders(pos); setItems(its); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (location.state?.openBulk) {
      openBulk();
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Group orders by PO number, sorted by most recent date (unnamed group at end)
  const groups = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      const key = o.po_number || '(no PO #)';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    return [...map.entries()].sort(([keyA, linesA], [keyB, linesB]) => {
      if (keyA === '(no PO #)') return 1;
      if (keyB === '(no PO #)') return -1;
      return linesB[0].received_at.localeCompare(linesA[0].received_at);
    });
  }, [orders]);

  const togglePO = (key) => setExpandedPOs(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const openAdd = () => { setForm(EMPTY); setError(''); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.purchaseOrders.create(linePayload(form, {
        po_number: form.po_number || null,
        notes: form.notes || null,
        received_at: form.received_at,
      }));
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
  const setCheck = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.checked }));

  const openBulk = () => {
    setBulkHeader({ po_number: '', received_at: today(), notes: '' });
    setBulkLines([newLine()]);
    setBulkError('');
    setBulkResult(null);
    setShowBulkModal(true);
  };

  const closeBulk = () => { setShowBulkModal(false); setBulkResult(null); };

  const setHeader = (k) => (e) => setBulkHeader(h => ({ ...h, [k]: e.target.value }));

  const setLine = (i, k, val) => {
    setBulkLines(lines => {
      const next = [...lines];
      next[i] = { ...next[i], [k]: val };
      if (k === 'item_id') {
        const item = items.find(it => it.id === parseInt(val));
        next[i].unit_cost = item ? (item.latest_purchase_price ?? item.unit_price ?? '') : '';
      }
      // Switching to inventory mode clears custom name, and vice versa
      if (k === 'type' && val === 'inventory') next[i].custom_item_name = '';
      if (k === 'type' && val === 'custom') next[i].item_id = '';
      return next;
    });
  };

  const addLine = () => setBulkLines(l => [...l, newLine()]);
  const removeLine = (i) => setBulkLines(l => l.filter((_, idx) => idx !== i));

  const bulkGrandTotal = bulkLines.reduce((sum, l) => {
    return sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0);
  }, 0);

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setBulkError('');

    const validLines = bulkLines.filter(l => {
      if (l.type === 'inventory') return l.item_id && l.quantity && l.unit_cost;
      return l.custom_item_name.trim() && l.quantity && l.unit_cost;
    });
    if (validLines.length === 0) {
      setBulkError('Add at least one complete line item.');
      return;
    }

    setBulkSubmitting(true);
    const succeeded = [];
    const failed = [];

    for (const line of validLines) {
      const displayName = line.type === 'inventory'
        ? (items.find(i => i.id === parseInt(line.item_id))?.name ?? `Item #${line.item_id}`)
        : line.custom_item_name;
      try {
        await api.purchaseOrders.create(linePayload(line, {
          po_number: bulkHeader.po_number || null,
          notes: bulkHeader.notes || null,
          received_at: bulkHeader.received_at,
        }));
        succeeded.push(displayName);
      } catch (err) {
        failed.push({ name: displayName, reason: err.message });
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
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit Cost</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([key, lines]) => {
                  const isExpanded = expandedPOs.has(key);
                  const groupTotal = lines.reduce((s, o) => s + o.quantity * o.unit_cost, 0);
                  const isUnnamed = key === '(no PO #)';
                  const groupDate = !isUnnamed ? lines[0].received_at : null;

                  return (
                    <tr
                      key={`group-${key}`}
                      onClick={() => togglePO(key)}
                      className="cursor-pointer select-none"
                    >
                      <td colSpan={7} className="p-0">
                        {/* Group header */}
                        <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 transition-colors ${isExpanded ? 'bg-brand-50/60' : 'bg-gray-50 hover:bg-gray-100/70'}`}>
                          <ChevronRight
                            size={15}
                            className={`text-gray-400 flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                          />
                          {isUnnamed ? (
                            <span className="text-sm text-gray-400 italic">(no PO #)</span>
                          ) : (
                            <span className="font-mono text-sm font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{key}</span>
                          )}
                          {groupDate && (
                            <span className="text-xs text-gray-500">{fmtDate(groupDate)}</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {lines.length} item{lines.length !== 1 ? 's' : ''}
                          </span>
                          <span className="ml-auto text-sm font-semibold text-gray-900">{fmt(groupTotal)}</span>
                        </div>

                        {/* Expanded line items */}
                        {isExpanded && (
                          <table className="w-full text-sm">
                            <tbody className="divide-y divide-gray-50">
                              {lines.map(o => (
                                <tr key={o.id} className="hover:bg-gray-50/50" onClick={e => e.stopPropagation()}>
                                  <td className="pl-10 pr-5 py-3 text-gray-500 whitespace-nowrap w-32">{fmtDate(o.received_at)}</td>
                                  <td className="px-5 py-3 font-medium text-gray-900">
                                    {o.item_name}
                                  </td>
                                  <td className="px-5 py-3 text-center text-gray-900 font-medium w-16">{o.quantity}</td>
                                  <td className="px-5 py-3 text-right text-gray-900 w-24">{fmt(o.unit_cost)}</td>
                                  <td className="px-5 py-3 text-right font-semibold text-gray-900 w-24">{fmt(o.quantity * o.unit_cost)}</td>
                                  <td className="px-5 py-3 text-gray-500 max-w-[180px] truncate">{o.notes || '—'}</td>
                                  <td className="px-5 py-3 text-right w-16">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Purchase Modal */}
      {showModal && (
        <Modal title="Log Purchase" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Item <span className="text-red-500">*</span></label>
              <ItemPicker
                line={form}
                items={items}
                onTypeChange={v => setForm(f => ({ ...f, type: v, item_id: '', custom_item_name: '' }))}
                onInventoryChange={e => {
                  const item = items.find(i => i.id === parseInt(e.target.value));
                  setForm(f => ({
                    ...f,
                    item_id: e.target.value,
                    unit_cost: item ? (item.latest_purchase_price ?? item.unit_price ?? '') : f.unit_cost,
                  }));
                }}
                onCustomNameChange={e => setForm(f => ({ ...f, custom_item_name: e.target.value }))}
                onAddToInvChange={e => setForm(f => ({ ...f, add_to_inventory: e.target.checked }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date Received <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.received_at} onChange={set('received_at')} required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">PO Number</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.po_number} onChange={set('po_number')} placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity <span className="text-red-500">*</span></label>
                <input
                  type="number" min="1" step="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.quantity} onChange={set('quantity')} placeholder="0" required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit Cost ($) <span className="text-red-500">*</span></label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.unit_cost} onChange={set('unit_cost')} placeholder="0.00" required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <textarea
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                value={form.notes} onChange={set('notes')} placeholder="Optional notes..."
              />
            </div>

            {form.quantity && form.unit_cost && (
              <div className="bg-brand-50 rounded-lg px-4 py-3 text-sm">
                <span className="text-brand-700 font-medium">Total: {fmt(form.quantity * form.unit_cost)}</span>
              </div>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
                Log Purchase
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Bulk PO Modal */}
      {showBulkModal && (
        <Modal title="Bulk Purchase Order" onClose={closeBulk} size="lg">
          {!bulkResult ? (
            <form onSubmit={handleBulkSubmit} className="space-y-5">
              {/* Shared header */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">PO Number</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={bulkHeader.po_number} onChange={setHeader('po_number')} placeholder="e.g. PO-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date Received <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={bulkHeader.received_at} onChange={setHeader('received_at')} required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={bulkHeader.notes} onChange={setHeader('notes')} placeholder="Optional notes for all line items"
                />
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Line Items</label>
                  <button type="button" onClick={addLine}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                    <Plus size={13} /> Add Item
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Qty</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Unit Cost</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bulkLines.map((line, i) => {
                        const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_cost) || 0);
                        return (
                          <tr key={i} className="align-top">
                            <td className="px-2 py-2">
                              <div className="space-y-1">
                                <TypeToggle
                                  value={line.type}
                                  onChange={v => setLine(i, 'type', v)}
                                />
                                {line.type === 'inventory' ? (
                                  <select
                                    className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                    value={line.item_id} onChange={e => setLine(i, 'item_id', e.target.value)} required
                                  >
                                    <option value="">Select item...</option>
                                    {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                                  </select>
                                ) : (
                                  <div className="space-y-1">
                                    <input
                                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                      value={line.custom_item_name}
                                      onChange={e => setLine(i, 'custom_item_name', e.target.value)}
                                      placeholder="Item name..." required
                                    />
                                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                                      <input
                                        type="checkbox" className="rounded border-gray-300 accent-brand-600"
                                        checked={line.add_to_inventory}
                                        onChange={e => setLine(i, 'add_to_inventory', e.target.checked)}
                                      />
                                      Add to inventory
                                    </label>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number" min="1" step="1"
                                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                value={line.quantity} onChange={e => setLine(i, 'quantity', e.target.value)} placeholder="0" required
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number" min="0" step="0.01"
                                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                value={line.unit_cost} onChange={e => setLine(i, 'unit_cost', e.target.value)} placeholder="0.00" required
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700 font-medium whitespace-nowrap">
                              {lineTotal > 0 ? fmt(lineTotal) : '—'}
                            </td>
                            <td className="px-2 py-2 text-center">
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
                <div className="bg-brand-50 rounded-lg px-4 py-3 text-sm flex justify-between">
                  <span className="text-brand-700">
                    {bulkLines.filter(l => (l.type === 'inventory' ? l.item_id : l.custom_item_name) && l.quantity && l.unit_cost).length} line item(s)
                  </span>
                  <span className="text-brand-700 font-semibold">Grand Total: {fmt(bulkGrandTotal)}</span>
                </div>
              )}

              {bulkError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{bulkError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeBulk}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={bulkSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
                    {bulkResult.failed.map((f, fi) => (
                      <li key={fi} className="text-sm text-red-600">{f.name}: {f.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={closeBulk}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
                  Done
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Delete confirmation */}
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
