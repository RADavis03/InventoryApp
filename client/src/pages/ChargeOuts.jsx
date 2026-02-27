import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowRightLeft } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import * as api from '../lib/api.js';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const today = () => new Date().toISOString().split('T')[0];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const EMPTY = { item_id: '', department_id: '', quantity: '', unit_cost: '', charged_by: '', ticket_number: '', notes: '', charged_at: today() };

export default function ChargeOuts() {
  const [chargeOuts, setChargeOuts] = useState([]);
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  const load = () => {
    setLoading(true);
    Promise.all([
      api.chargeOuts.list({ month: filterMonth, year: filterYear }),
      api.items.list(),
      api.departments.list(),
    ]).then(([cos, its, depts]) => {
      setChargeOuts(cos);
      setItems(its);
      setDepartments(depts);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterMonth, filterYear]);

  const openAdd = () => {
    setForm(EMPTY);
    setError('');
    setShowModal(true);
  };

  const selectedItem = items.find(i => i.id === parseInt(form.item_id));

  const handleItemChange = (e) => {
    const item = items.find(i => i.id === parseInt(e.target.value));
    setForm(f => ({
      ...f,
      item_id: e.target.value,
      unit_cost: item ? (item.latest_purchase_price ?? item.unit_price) : '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (selectedItem && parseInt(form.quantity) > selectedItem.stock) {
      setError(`Insufficient stock. Only ${selectedItem.stock} units available.`);
      return;
    }

    try {
      await api.chargeOuts.create(form);
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.chargeOuts.delete(id);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const yearOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) yearOptions.push(y);

  const monthTotal = chargeOuts.reduce((s, c) => s + c.quantity * c.unit_cost, 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Charge-Outs</h1>
          <p className="text-gray-500 mt-1">Record and track deployments to departments</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Charge-Out
        </button>
      </div>

      {/* Filters + Summary */}
      <div className="flex items-center justify-between mb-5 gap-4">
        <div className="flex items-center gap-3">
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {chargeOuts.length > 0 && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">{chargeOuts.length}</span> transactions &mdash; Total: <span className="font-semibold text-gray-900">{fmt(monthTotal)}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading...</div>
        ) : chargeOuts.length === 0 ? (
          <div className="py-16 text-center">
            <ArrowRightLeft className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-500 font-medium">No charge-outs for {MONTH_NAMES[filterMonth - 1]} {filterYear}</p>
          </div>
        ) : (
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
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {chargeOuts.map(co => (
                  <tr key={co.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{fmtDate(co.charged_at)}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-900">{co.item_name}</td>
                    <td className="px-5 py-3.5 text-gray-700">{co.department_name}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{co.gl_number}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center text-gray-900">{co.quantity}</td>
                    <td className="px-5 py-3.5 text-right text-gray-700">{fmt(co.unit_cost)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{fmt(co.quantity * co.unit_cost)}</td>
                    <td className="px-5 py-3.5 text-gray-600">{co.charged_by}</td>
                    <td className="px-5 py-3.5">
                      {co.ticket_number
                        ? <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{co.ticket_number}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setDeleteConfirm(co)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Charge-Out Modal */}
      {showModal && (
        <Modal title="New Charge-Out" onClose={() => setShowModal(false)} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Item <span className="text-red-500">*</span></label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={form.item_id} onChange={handleItemChange} required
                >
                  <option value="">Select an item...</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id} disabled={i.stock <= 0}>
                      {i.name} ({i.stock} available)
                    </option>
                  ))}
                </select>
                {selectedItem && (
                  <p className={`text-xs mt-1 ${selectedItem.stock <= selectedItem.reorder_threshold ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    {selectedItem.stock} units in stock
                    {selectedItem.stock <= selectedItem.reorder_threshold && ' — low stock'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department <span className="text-red-500">*</span></label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={form.department_id} onChange={set('department_id')} required
                >
                  <option value="">Select a department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} — {d.gl_number}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity <span className="text-red-500">*</span></label>
                <input
                  type="number" min="1" step="1"
                  max={selectedItem?.stock || undefined}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.quantity} onChange={set('quantity')} placeholder="0" required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Unit Cost ($) <span className="text-red-500">*</span>
                  {selectedItem?.latest_purchase_price && (
                    <span className="text-xs text-gray-400 font-normal ml-1">(defaults to last purchase price)</span>
                  )}
                </label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.unit_cost} onChange={set('unit_cost')} placeholder="0.00" required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Charged By <span className="text-red-500">*</span></label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.charged_by} onChange={set('charged_by')} placeholder="Your name" required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ticket #</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.ticket_number} onChange={set('ticket_number')} placeholder="e.g. INC-12345"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.charged_at} onChange={set('charged_at')} required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.notes} onChange={set('notes')} placeholder="Optional"
                />
              </div>
            </div>

            {form.quantity && form.unit_cost && (
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm">
                <span className="text-blue-700 font-medium">Total charge: {fmt(form.quantity * form.unit_cost)}</span>
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
                Record Charge-Out
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal title="Delete Charge-Out" onClose={() => setDeleteConfirm(null)} size="sm">
          <p className="text-gray-600 text-sm">
            Delete this charge-out of <strong>{deleteConfirm.quantity}x {deleteConfirm.item_name}</strong> to <strong>{deleteConfirm.department_name}</strong>? Stock will be returned.
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
