import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, AlertTriangle, ArrowRightLeft, DollarSign, ChevronRight, Plus } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import * as api from '../lib/api.js';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const today = () => new Date().toISOString().split('T')[0];

const EMPTY_CO = { item_id: '', department_id: '', quantity: '', unit_cost: '', charged_by: '', ticket_number: '', notes: '', charged_at: today() };

function StatCard({ icon: Icon, label, value, color, sub }) {
  const colors = {
    blue: 'bg-brand-50 text-brand-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${colors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [itemsList, setItemsList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [recentChargeOuts, setRecentChargeOuts] = useState([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCoModal, setShowCoModal] = useState(false);
  const [coForm, setCoForm] = useState(EMPTY_CO);
  const [coError, setCoError] = useState('');
  const [coSubmitting, setCoSubmitting] = useState(false);

  const now = new Date();

  const loadDashboard = () => {
    Promise.all([
      api.items.list(),
      api.chargeOuts.list({ month: now.getMonth() + 1, year: now.getFullYear() }),
      api.departments.list(),
    ]).then(([its, cos, depts]) => {
      setItemsList(its);
      setDepartments(depts);
      const sorted = [...cos].sort((a, b) => b.id - a.id).slice(0, 10);
      setRecentChargeOuts(sorted);
      setMonthTotal(cos.reduce((sum, c) => sum + c.quantity * c.unit_cost, 0));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadDashboard(); }, []);

  const selectedCoItem = itemsList.find(i => i.id === parseInt(coForm.item_id));

  const handleCoItemChange = (e) => {
    const item = itemsList.find(i => i.id === parseInt(e.target.value));
    setCoForm(f => ({
      ...f,
      item_id: e.target.value,
      unit_cost: item ? (item.latest_purchase_price ?? item.unit_price) : '',
    }));
  };

  const openCoModal = () => {
    setCoForm(EMPTY_CO);
    setCoError('');
    setShowCoModal(true);
  };

  const handleCoSubmit = async (e) => {
    e.preventDefault();
    setCoError('');
    if (selectedCoItem && parseInt(coForm.quantity) > selectedCoItem.stock) {
      setCoError(`Insufficient stock. Only ${selectedCoItem.stock} units available.`);
      return;
    }
    setCoSubmitting(true);
    try {
      await api.chargeOuts.create(coForm);
      setShowCoModal(false);
      loadDashboard();
    } catch (err) {
      setCoError(err.message);
    } finally {
      setCoSubmitting(false);
    }
  };

  const setco = (k) => (e) => setCoForm(f => ({ ...f, [k]: e.target.value }));

  const lowStockItems = itemsList.filter(i => i.stock <= i.reorder_threshold);
  const monthName = now.toLocaleString('en-US', { month: 'long' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">GAH IT Inventory overview</p>
        </div>
        <button
          onClick={openCoModal}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Charge-Out
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        <StatCard icon={Package} label="Total Items" value={itemsList.length} color="blue" sub="in catalog" />
        <StatCard icon={AlertTriangle} label="Low Stock" value={lowStockItems.length} color="red" sub="at or below threshold" />
        <StatCard icon={ArrowRightLeft} label={`${monthName} Transactions`} value={recentChargeOuts.length <= 10 && recentChargeOuts.length > 0 ? 'View all →' : recentChargeOuts.length} color="purple" sub="charge-outs this month" />
        <StatCard icon={DollarSign} label={`${monthName} Total`} value={fmt(monthTotal)} color="green" sub="charged out this month" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Low Stock Alerts</h2>
            <Link to="/inventory" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-0.5">
              View all <ChevronRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {lowStockItems.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">All items are well stocked</div>
            ) : (
              lowStockItems.map(item => (
                <div key={item.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-400">Threshold: {item.reorder_threshold}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    {item.stock} left
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Charge-Outs */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Charge-Outs</h2>
            <Link to="/charge-outs" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-0.5">
              View all <ChevronRight size={13} />
            </Link>
          </div>
          {recentChargeOuts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No charge-outs this month</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentChargeOuts.map(co => (
                    <tr key={co.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(co.charged_at)}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{co.item_name}</td>
                      <td className="px-5 py-3 text-gray-600">{co.department_name}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">{fmt(co.quantity * co.unit_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCoModal && (
        <Modal title="New Charge-Out" onClose={() => setShowCoModal(false)} size="lg">
          <form onSubmit={handleCoSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Item <span className="text-red-500">*</span></label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={coForm.item_id} onChange={handleCoItemChange} required
                >
                  <option value="">Select an item...</option>
                  {itemsList.map(i => (
                    <option key={i.id} value={i.id} disabled={i.stock <= 0}>
                      {i.name} ({i.stock} available)
                    </option>
                  ))}
                </select>
                {selectedCoItem && (
                  <p className={`text-xs mt-1 ${selectedCoItem.stock <= selectedCoItem.reorder_threshold ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    {selectedCoItem.stock} units in stock
                    {selectedCoItem.stock <= selectedCoItem.reorder_threshold && ' — low stock'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department <span className="text-red-500">*</span></label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={coForm.department_id} onChange={setco('department_id')} required
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
                  max={selectedCoItem?.stock || undefined}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={coForm.quantity} onChange={setco('quantity')} placeholder="0" required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Unit Cost ($) <span className="text-red-500">*</span>
                  {selectedCoItem?.latest_purchase_price && (
                    <span className="text-xs text-gray-400 font-normal ml-1">(defaults to last purchase price)</span>
                  )}
                </label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={coForm.unit_cost} onChange={setco('unit_cost')} placeholder="0.00" required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Charged By <span className="text-red-500">*</span></label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={coForm.charged_by} onChange={setco('charged_by')} placeholder="Your name" required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ticket #</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={coForm.ticket_number} onChange={setco('ticket_number')} placeholder="e.g. INC-12345"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={coForm.charged_at} onChange={setco('charged_at')} required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={coForm.notes} onChange={setco('notes')} placeholder="Optional"
                />
              </div>
            </div>

            {coForm.quantity && coForm.unit_cost && (
              <div className="bg-brand-50 rounded-lg px-4 py-3 text-sm">
                <span className="text-brand-700 font-medium">Total charge: {fmt(coForm.quantity * coForm.unit_cost)}</span>
              </div>
            )}

            {coError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{coError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCoModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={coSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {coSubmitting ? 'Saving…' : 'Record Charge-Out'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
