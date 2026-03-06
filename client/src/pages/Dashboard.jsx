import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, AlertTriangle, ArrowRightLeft, DollarSign, ChevronRight, Plus, Printer, Laptop, Layers, X } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import * as api from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const SLOT_LABEL = {
  BLACK: 'Black', CYAN: 'Cyan', MAGENTA: 'Magenta', YELLOW: 'Yellow',
  IMAGING_KIT: 'Imaging Kit', BLACK_DEVELOPER: 'Black Developer',
  COLOR_DEVELOPER: 'Color Developer', COLOR_DRUM: 'Color Drum',
  BLACK_DRUM: 'Black Drum', WASTE_TONER: 'Waste Toner',
};

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
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const today = () => new Date().toISOString().split('T')[0];

function StatCard({ icon: Icon, label, value, color, sub }) {
  const colors = {
    blue: 'bg-brand-50 text-brand-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-amber-50 text-amber-600',
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
  const { currentUser } = useAuth();
  const [itemsList, setItemsList] = useState([]);
  const [tonerList, setTonerList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [recentChargeOuts, setRecentChargeOuts] = useState([]);
  const [monthCoCount, setMonthCoCount] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [activeLoaners, setActiveLoaners] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Bulk Charge-Out modal ─────────────────────────────
  const emptyBulkHeader = () => ({ department_id: '', ticket_number: '', notes: '', charged_at: today(), charged_by: currentUser?.name || '' });
  const newItemLine  = () => ({ item_id: '', quantity: '', unit_cost: '' });
  const newTonerLine = () => ({ toner_id: '', quantity: '' });

  const [showBulkModal,    setShowBulkModal]    = useState(false);
  const [bulkTab,          setBulkTab]          = useState('items');
  const [bulkHeader,       setBulkHeader]       = useState(emptyBulkHeader);
  const [bulkItemLines,    setBulkItemLines]    = useState([newItemLine()]);
  const [bulkTonerLines,   setBulkTonerLines]   = useState([newTonerLine()]);
  const [bulkError,        setBulkError]        = useState('');
  const [bulkSubmitting,   setBulkSubmitting]   = useState(false);

  const openBulkModal = () => {
    setBulkHeader(emptyBulkHeader());
    setBulkItemLines([newItemLine()]);
    setBulkTonerLines([newTonerLine()]);
    setBulkError('');
    setBulkTab('items');
    setShowBulkModal(true);
  };
  const setBH = (k) => (e) => setBulkHeader(f => ({ ...f, [k]: e.target.value }));

  const handleBulkItemSelect = (i, itemId) => {
    const item = itemsList.find(it => it.id === parseInt(itemId));
    setBulkItemLines(ls => ls.map((l, idx) => idx === i ? { ...l, item_id: itemId, unit_cost: item ? (item.latest_purchase_price ?? item.unit_price ?? '') : '' } : l));
  };
  const updateItemLine  = (i, k, val) => setBulkItemLines(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: val } : l));
  const removeItemLine  = (i) => setBulkItemLines(ls => ls.filter((_, idx) => idx !== i));
  const addItemLine     = () => setBulkItemLines(ls => [...ls, newItemLine()]);

  const updateTonerLine = (i, k, val) => setBulkTonerLines(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: val } : l));
  const removeTonerLine = (i) => setBulkTonerLines(ls => ls.filter((_, idx) => idx !== i));
  const addTonerLine    = () => setBulkTonerLines(ls => [...ls, newTonerLine()]);

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setBulkError('');
    const validItems = bulkItemLines.filter(l => l.item_id && l.quantity && l.unit_cost !== '');
    const validToner = bulkTonerLines.filter(l => l.toner_id && l.quantity);
    if (validItems.length === 0 && validToner.length === 0) {
      setBulkError('Add at least one item or toner line.'); return;
    }
    setBulkSubmitting(true);
    try {
      const calls = [];
      if (validItems.length > 0) {
        calls.push(api.chargeOuts.bulkCreate({
          ...bulkHeader,
          lines: validItems.map(l => ({ item_id: parseInt(l.item_id), quantity: parseInt(l.quantity), unit_cost: parseFloat(l.unit_cost) })),
        }));
      }
      if (validToner.length > 0) {
        calls.push(api.tonerChargeOuts.bulkCreate({
          ...bulkHeader,
          lines: validToner.map(l => ({ toner_id: parseInt(l.toner_id), quantity: parseInt(l.quantity) })),
        }));
      }
      await Promise.all(calls);
      setShowBulkModal(false);
      loadDashboard();
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkSubmitting(false);
    }
  };

  // ── Quick Issue Loaner modal ──────────────────────────
  const emptyLoanerForm = () => ({
    computer_id: '', department_id: '', person_name: '',
    ticket_number: '', loaned_date: today(), due_date: '', notes: '',
  });
  const [showLoanerModal,    setShowLoanerModal]    = useState(false);
  const [loanerForm,         setLoanerForm]         = useState(emptyLoanerForm);
  const [loanerError,        setLoanerError]        = useState('');
  const [loanerSubmitting,   setLoanerSubmitting]   = useState(false);
  const [computers,          setComputers]          = useState([]);

  const openLoanerModal = () => {
    setLoanerForm(emptyLoanerForm());
    setLoanerError('');
    setShowLoanerModal(true);
    if (computers.length === 0) api.loanerComputers.list().then(setComputers);
  };
  const setlf = (k) => (e) => setLoanerForm(f => ({ ...f, [k]: e.target.value }));
  const availableComputers = computers.filter(c => !c.is_loaned_out);

  const handleLoanerSubmit = async (e) => {
    e.preventDefault();
    setLoanerError('');
    setLoanerSubmitting(true);
    try {
      await api.loaners.create(loanerForm);
      setShowLoanerModal(false);
      loadDashboard();
    } catch (err) {
      setLoanerError(err.message);
    } finally {
      setLoanerSubmitting(false);
    }
  };

  const now = new Date();

  const loadDashboard = () => {
    Promise.all([
      api.items.list(),
      api.chargeOuts.list({ month: now.getMonth() + 1, year: now.getFullYear() }),
      api.departments.list(),
      api.toner.list(),
      api.loaners.list({ status: 'active' }),
    ]).then(([its, cos, depts, tons, loans]) => {
      setItemsList(its);
      setTonerList(tons);
      setDepartments(depts);
      const sorted = [...cos].sort((a, b) => b.id - a.id).slice(0, 10);
      setRecentChargeOuts(sorted);
      setMonthCoCount(cos.length);
      setMonthTotal(cos.reduce((sum, c) => sum + c.quantity * c.unit_cost, 0));
      setActiveLoaners(loans);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadDashboard(); }, []);

  const lowStockItems = itemsList.filter(i => i.stock <= i.reorder_threshold);
  const lowTonerItems = tonerList.filter(t => t.stock < t.reorder_threshold);
  const monthName = now.toLocaleString('en-US', { month: 'long' });

  const loanerStatusOf = (due_date) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const due = new Date(due_date + 'T00:00:00');
    const days = Math.ceil((due - d) / (1000 * 60 * 60 * 24));
    return days < 0 ? 'overdue' : days <= 3 ? 'due_soon' : 'ok';
  };
  const overdueLoaners = activeLoaners.filter(l => loanerStatusOf(l.due_date) === 'overdue');
  const dueSoonLoaners = activeLoaners.filter(l => loanerStatusOf(l.due_date) === 'due_soon');
  const loanerCardColor = overdueLoaners.length > 0 ? 'red' : dueSoonLoaners.length > 0 ? 'yellow' : 'blue';
  const warnedLoaners = [...overdueLoaners, ...dueSoonLoaners];

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
        <div className="flex items-center gap-2">
          <button
            onClick={openLoanerModal}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-brand-700 border border-brand-200 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Laptop size={16} /> Issue Loaner
          </button>
          <button
            onClick={openBulkModal}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Layers size={16} /> Bulk Charge-Out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-5 mb-8">
        <StatCard icon={Package} label="Total Items" value={itemsList.length} color="blue" sub="in catalog" />
        <StatCard icon={AlertTriangle} label="Low Stock" value={lowStockItems.length} color="red" sub="at or below threshold" />
        <Link to="/charge-outs" className="block hover:opacity-80 transition-opacity">
          <StatCard icon={ArrowRightLeft} label={`${monthName} Transactions`} value={monthCoCount} color="purple" sub="charge-outs this month" />
        </Link>
        <StatCard icon={DollarSign} label={`${monthName} Total`} value={fmt(monthTotal)} color="green" sub="charged out this month" />
        <Link to="/loaners" className="block hover:opacity-80 transition-opacity">
          <StatCard icon={Laptop} label="Active Loaners" value={activeLoaners.length} color={loanerCardColor} sub={overdueLoaners.length > 0 ? `${overdueLoaners.length} overdue` : dueSoonLoaners.length > 0 ? `${dueSoonLoaners.length} due soon` : 'all on schedule'} />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Loaner Warnings */}
        {warnedLoaners.length > 0 && (
          <div className="col-span-4 bg-white rounded-xl border border-amber-100 shadow-sm">
            <div className="px-5 py-4 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop size={15} className="text-amber-500" />
                <h2 className="font-semibold text-gray-900">Loaner Alerts</h2>
              </div>
              <Link to="/loaners" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-0.5">
                View all <ChevronRight size={13} />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {warnedLoaners.map(l => {
                const isOverdue = loanerStatusOf(l.due_date) === 'overdue';
                return (
                  <div key={l.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{l.computer_name} — {l.person_name}</p>
                      <p className="text-xs text-gray-400">{l.department_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isOverdue ? 'Overdue' : 'Due Soon'}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">Due {new Date(l.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Low Stock Alerts — Consumables */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Low Stock</h2>
            <Link to="/inventory" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-0.5">
              View all <ChevronRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {lowStockItems.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">All items well stocked</div>
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

        {/* Low Toner Alerts */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer size={15} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900">Low Toner</h2>
            </div>
            <Link to="/inventory" state={{ tab: 'toner' }} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-0.5">
              View all <ChevronRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {lowTonerItems.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">All toner well stocked</div>
            ) : (
              lowTonerItems.map(t => {
                const style = SLOT_STYLE[t.slot] || SLOT_STYLE.BLACK;
                return (
                  <div key={t.id} className="px-5 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.printer_model}</p>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${style.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {style.label}
                      </span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex-shrink-0">
                      {t.stock} left
                    </span>
                  </div>
                );
              })
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

      {/* ── Bulk Charge-Out Modal ── */}
      {showBulkModal && (
        <Modal title="Bulk Charge-Out" onClose={() => setShowBulkModal(false)} size="xl">
          <form onSubmit={handleBulkSubmit} className="space-y-5">
            {/* Shared header */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department <span className="text-red-500">*</span></label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={bulkHeader.department_id} onChange={setBH('department_id')} required>
                  <option value="">Select a department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} — {d.gl_number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ticket # <span className="text-red-500">*</span></label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={bulkHeader.ticket_number} onChange={setBH('ticket_number')} placeholder="e.g. INC-12345" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={bulkHeader.charged_at} onChange={setBH('charged_at')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={bulkHeader.notes} onChange={setBH('notes')} placeholder="Optional" />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {[['items', 'Items'], ['toner', 'Toner']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => setBulkTab(val)}
                  className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    bulkTab === val ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Items tab */}
            {bulkTab === 'items' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Items to charge out</span>
                  <button type="button" onClick={addItemLine}
                    className="flex items-center gap-1 text-xs font-medium text-brand-700 border border-brand-200 bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors">
                    <Plus size={12} /> Add Item
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Qty</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Unit Cost ($)</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bulkItemLines.map((line, i) => {
                        const sel = itemsList.find(it => it.id === parseInt(line.item_id));
                        return (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <select className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                value={line.item_id} onChange={e => handleBulkItemSelect(i, e.target.value)}>
                                <option value="">Select item...</option>
                                {itemsList.map(it => <option key={it.id} value={it.id} disabled={it.stock <= 0}>{it.name} ({it.stock} avail.)</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="1" step="1" max={sel?.stock || undefined}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                value={line.quantity} onChange={e => updateItemLine(i, 'quantity', e.target.value)} placeholder="0" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="0" step="0.01"
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                value={line.unit_cost} onChange={e => updateItemLine(i, 'unit_cost', e.target.value)} placeholder="0.00" />
                            </td>
                            <td className="px-2 py-2 text-center">
                              {bulkItemLines.length > 1 && (
                                <button type="button" onClick={() => removeItemLine(i)}
                                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
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
            )}

            {/* Toner tab */}
            {bulkTab === 'toner' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Toner cartridges to charge out</span>
                  <button type="button" onClick={addTonerLine}
                    className="flex items-center gap-1 text-xs font-medium text-brand-700 border border-brand-200 bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors">
                    <Plus size={12} /> Add Toner
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Toner Cartridge</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Qty</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bulkTonerLines.map((line, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">
                            <select className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                              value={line.toner_id} onChange={e => updateTonerLine(i, 'toner_id', e.target.value)}>
                              <option value="">Select toner...</option>
                              {tonerList.map(t => (
                                <option key={t.id} value={t.id}>
                                  {t.printer_model} — {SLOT_LABEL[t.slot] || t.slot}{t.part_number ? ` (${t.part_number})` : ''} · {t.stock} in stock
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="1" step="1"
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                              value={line.quantity} onChange={e => updateTonerLine(i, 'quantity', e.target.value)} placeholder="1" />
                          </td>
                          <td className="px-2 py-2 text-center">
                            {bulkTonerLines.length > 1 && (
                              <button type="button" onClick={() => removeTonerLine(i)}
                                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                <X size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {bulkError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{bulkError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="submit" disabled={bulkSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50">
                {bulkSubmitting ? 'Saving…' : 'Record Charge-Outs'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Quick Issue Loaner Modal ── */}
      {showLoanerModal && (
        <Modal title="Issue Loaner" onClose={() => setShowLoanerModal(false)} size="lg">
          <form onSubmit={handleLoanerSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Computer <span className="text-red-500">*</span></label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={loanerForm.computer_id} onChange={setlf('computer_id')} required>
                  <option value="">Select computer...</option>
                  {availableComputers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {computers.length > 0 && availableComputers.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">All computers are currently on loan.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department <span className="text-red-500">*</span></label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={loanerForm.department_id} onChange={setlf('department_id')} required>
                  <option value="">Select department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Person Name <span className="text-red-500">*</span></label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={loanerForm.person_name} onChange={setlf('person_name')} placeholder="Who is borrowing it?" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ticket # <span className="text-red-500">*</span></label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={loanerForm.ticket_number} onChange={setlf('ticket_number')} placeholder="e.g. INC-12345" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Loaned Date <span className="text-red-500">*</span></label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={loanerForm.loaned_date} onChange={setlf('loaned_date')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date <span className="text-red-500">*</span></label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={loanerForm.due_date} onChange={setlf('due_date')} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={loanerForm.notes} onChange={setlf('notes')} placeholder="Optional" />
            </div>
            {loanerError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{loanerError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowLoanerModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="submit" disabled={loanerSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50">
                {loanerSubmitting ? 'Saving…' : 'Issue Loaner'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
