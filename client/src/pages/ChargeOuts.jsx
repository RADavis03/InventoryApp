import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowRightLeft, Download, Printer } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import * as api from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const today = () => new Date().toISOString().split('T')[0];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const SLOT_BADGE = {
  BLACK:   'bg-gray-100 text-gray-800',
  CYAN:    'bg-cyan-100 text-cyan-800',
  MAGENTA: 'bg-pink-100 text-pink-800',
  YELLOW:  'bg-yellow-100 text-yellow-800',
};
const SLOT_DOT = {
  BLACK: 'bg-gray-800', CYAN: 'bg-cyan-500', MAGENTA: 'bg-pink-500', YELLOW: 'bg-yellow-400',
};
const SLOT_LABEL = { BLACK: 'Black', CYAN: 'Cyan', MAGENTA: 'Magenta', YELLOW: 'Yellow' };

export default function ChargeOuts() {
  const { currentUser } = useAuth();
  const emptyForm     = () => ({ item_id: '', department_id: '', quantity: '', unit_cost: '', charged_by: currentUser?.name || '', ticket_number: '', notes: '', charged_at: today() });
  const emptySwapForm = () => ({ purchase_order_id: '', item_id: '', from_department_id: '', to_department_id: '', price: '', swapped_by: currentUser?.name || '', notes: '', swapped_at: today() });
  const emptyTonerForm= () => ({ toner_id: '', department_id: '', quantity: '', charged_by: currentUser?.name || '', ticket_number: '', notes: '', charged_at: today() });

  // ── Shared ─────────────────────────────────────────────
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear,  setFilterYear]  = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState('chargeOuts');

  const [items,       setItems]       = useState([]);
  const [departments, setDepartments] = useState([]);

  const yearOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) yearOptions.push(y);

  // ── Charge-Outs tab ────────────────────────────────────
  const [chargeOuts,     setChargeOuts]     = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [showModal,      setShowModal]      = useState(false);
  const [form,           setForm]           = useState(emptyForm);
  const [error,          setError]          = useState('');
  const [deleteConfirm,  setDeleteConfirm]  = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.chargeOuts.list({ month: filterMonth, year: filterYear }),
      api.items.list(),
      api.departments.list(),
    ]).then(([cos, its, depts]) => {
      setChargeOuts(cos); setItems(its); setDepartments(depts);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterMonth, filterYear]);

  const openAdd = () => { setForm(emptyForm()); setError(''); setShowModal(true); };

  const selectedItem = items.find(i => i.id === parseInt(form.item_id));

  const handleItemChange = (e) => {
    const item = items.find(i => i.id === parseInt(e.target.value));
    setForm(f => ({ ...f, item_id: e.target.value, unit_cost: item ? (item.latest_purchase_price ?? item.unit_price) : '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (selectedItem && parseInt(form.quantity) > selectedItem.stock) {
      setError(`Insufficient stock. Only ${selectedItem.stock} units available.`); return;
    }
    try { await api.chargeOuts.create(form); setShowModal(false); load(); }
    catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    try { await api.chargeOuts.delete(id); setDeleteConfirm(null); load(); }
    catch (err) { alert(err.message); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // ── GL Swaps tab ───────────────────────────────────────
  const [glSwapList,       setGlSwapList]       = useState([]);
  const [swapLoading,      setSwapLoading]      = useState(false);
  const [showSwapModal,    setShowSwapModal]    = useState(false);
  const [swapDeleteConfirm,setSwapDeleteConfirm]= useState(null);
  const [swapError,        setSwapError]        = useState('');
  const [swapForm,         setSwapForm]         = useState(emptySwapForm());
  const [purchaseOrders,   setPurchaseOrders]   = useState([]);

  const loadSwaps = () => {
    setSwapLoading(true);
    Promise.all([
      api.glSwaps.list({ month: filterMonth, year: filterYear }),
      api.purchaseOrders.list(),
    ]).then(([swaps, pos]) => {
      setGlSwapList(swaps); setPurchaseOrders(pos);
    }).finally(() => setSwapLoading(false));
  };

  useEffect(() => { if (activeTab === 'glSwaps') loadSwaps(); }, [activeTab, filterMonth, filterYear]);

  useEffect(() => {
    if (activeTab === 'glSwaps' && departments.length === 0)
      api.departments.list().then(setDepartments);
  }, [activeTab]);

  const handleSwapPoChange = (e) => {
    const po = purchaseOrders.find(p => p.id === parseInt(e.target.value));
    setSwapForm(f => ({ ...f, purchase_order_id: e.target.value, item_id: po ? po.item_id : '' }));
  };

  const handleSwapSubmit = async (e) => {
    e.preventDefault(); setSwapError('');
    try { await api.glSwaps.create(swapForm); setShowSwapModal(false); loadSwaps(); }
    catch (err) { setSwapError(err.message); }
  };

  const handleSwapDelete = async (id) => {
    try { await api.glSwaps.delete(id); setSwapDeleteConfirm(null); loadSwaps(); }
    catch (err) { alert(err.message); }
  };

  const setSwap = (k) => (e) => setSwapForm(f => ({ ...f, [k]: e.target.value }));
  const selectedSwapItem = items.find(i => i.id === parseInt(swapForm.item_id));

  // ── Toner Charge-Outs tab ──────────────────────────────
  const [tonerCOList,       setTonerCOList]       = useState([]);
  const [tonerLoading,      setTonerLoading]      = useState(false);
  const [showTonerModal,    setShowTonerModal]    = useState(false);
  const [tonerDeleteConfirm,setTonerDeleteConfirm]= useState(null);
  const [tonerError,        setTonerError]        = useState('');
  const [tonerForm,         setTonerForm]         = useState(emptyTonerForm());
  const [tonerCartridges,   setTonerCartridges]   = useState([]);

  const loadTonerCOs = () => {
    setTonerLoading(true);
    Promise.all([
      api.tonerChargeOuts.list({ month: filterMonth, year: filterYear }),
      api.toner.list(),
      departments.length ? Promise.resolve(departments) : api.departments.list(),
    ]).then(([tcos, tons, depts]) => {
      setTonerCOList(tcos); setTonerCartridges(tons);
      if (depts !== departments) setDepartments(depts);
    }).finally(() => setTonerLoading(false));
  };

  useEffect(() => { if (activeTab === 'toner') loadTonerCOs(); }, [activeTab, filterMonth, filterYear]);

  const openTonerModal = () => { setTonerForm(emptyTonerForm()); setTonerError(''); setShowTonerModal(true); };

  const handleTonerSubmit = async (e) => {
    e.preventDefault(); setTonerError('');
    try { await api.tonerChargeOuts.create(tonerForm); setShowTonerModal(false); loadTonerCOs(); }
    catch (err) { setTonerError(err.message); }
  };

  const handleTonerDelete = async (id) => {
    try { await api.tonerChargeOuts.delete(id); setTonerDeleteConfirm(null); loadTonerCOs(); }
    catch (err) { alert(err.message); }
  };

  const setToner = (k) => (e) => setTonerForm(f => ({ ...f, [k]: e.target.value }));

  // Totals
  const monthTotal = chargeOuts.reduce((s, c) => s + c.quantity * c.unit_cost, 0);
  const swapTotal  = glSwapList.reduce((s, g) => s + g.price, 0);

  const TABS = [
    ['chargeOuts', 'Charge-Outs'],
    ['glSwaps',    'GL Swaps'],
    ['toner',      'Toner'],
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Charge-Outs</h1>
          <p className="text-gray-500 mt-1">Record and track deployments to departments</p>
        </div>
        {activeTab === 'chargeOuts' && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> New Charge-Out
          </button>
        )}
        {activeTab === 'glSwaps' && (
          <button onClick={() => { setSwapForm(emptySwapForm()); setSwapError(''); setShowSwapModal(true); }}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> New GL Swap
          </button>
        )}
        {activeTab === 'toner' && (
          <button onClick={openTonerModal} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> New Toner Charge-Out
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-5">
        {TABS.map(([val, label]) => (
          <button key={val} onClick={() => setActiveTab(val)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === val ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters + summary */}
      <div className="flex items-center justify-between mb-5 gap-4">
        <div className="flex items-center gap-3">
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {activeTab === 'chargeOuts' && chargeOuts.length > 0 && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">{chargeOuts.length}</span> transactions &mdash; Total: <span className="font-semibold text-gray-900">{fmt(monthTotal)}</span>
          </div>
        )}
        {activeTab === 'glSwaps' && glSwapList.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{glSwapList.length}</span> swaps &mdash; <span className="font-semibold text-gray-900">{fmt(swapTotal)}</span>
            </div>
            <a href={api.glSwaps.csvUrl(filterMonth, filterYear)}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 border border-brand-200 hover:border-brand-300 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors">
              <Download size={14} /> Export CSV
            </a>
          </div>
        )}
        {activeTab === 'toner' && tonerCOList.length > 0 && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">{tonerCOList.length}</span> toner deployment{tonerCOList.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Charge-Outs table ── */}
      {activeTab === 'chargeOuts' && (
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
                    {['Date','Item','Department','GL #','Qty','Unit Cost','Total','Charged By','Ticket #','Actions'].map((h, i) => (
                      <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i >= 4 && i <= 6 ? 'text-center' : i >= 7 ? 'text-left' : 'text-left'} ${i === 9 ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {chargeOuts.map(co => (
                    <tr key={co.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{fmtDate(co.charged_at)}</td>
                      <td className="px-5 py-3.5 font-medium text-gray-900">{co.item_name}</td>
                      <td className="px-5 py-3.5 text-gray-700">{co.department_name}</td>
                      <td className="px-5 py-3.5"><span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{co.gl_number}</span></td>
                      <td className="px-5 py-3.5 text-center text-gray-900">{co.quantity}</td>
                      <td className="px-5 py-3.5 text-right text-gray-700">{fmt(co.unit_cost)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{fmt(co.quantity * co.unit_cost)}</td>
                      <td className="px-5 py-3.5 text-gray-600">{co.charged_by}</td>
                      <td className="px-5 py-3.5">
                        {co.ticket_number ? <span className="font-mono text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded">{co.ticket_number}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => setDeleteConfirm(co)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── GL Swaps table ── */}
      {activeTab === 'glSwaps' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {swapLoading ? (
            <div className="py-16 text-center text-gray-400">Loading...</div>
          ) : glSwapList.length === 0 ? (
            <div className="py-16 text-center">
              <ArrowRightLeft className="mx-auto text-gray-300 mb-3" size={40} />
              <p className="text-gray-500 font-medium">No GL swaps for {MONTH_NAMES[filterMonth - 1]} {filterYear}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Date','PO #','Item','From Dept / GL','To Dept / GL','Price','Swapped By','Notes','Actions'].map((h, i) => (
                      <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 5 ? 'text-right' : i === 8 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {glSwapList.map(gs => (
                    <tr key={gs.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{fmtDate(gs.swapped_at)}</td>
                      <td className="px-5 py-3.5">{gs.po_number ? <span className="font-mono text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded">{gs.po_number}</span> : <span className="text-gray-400">—</span>}</td>
                      <td className="px-5 py-3.5 font-medium text-gray-900">{gs.item_name}</td>
                      <td className="px-5 py-3.5"><div className="text-gray-700">{gs.from_department_name}</div><span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{gs.from_gl_number}</span></td>
                      <td className="px-5 py-3.5"><div className="text-gray-700">{gs.to_department_name}</div><span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{gs.to_gl_number}</span></td>
                      <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{fmt(gs.price)}</td>
                      <td className="px-5 py-3.5 text-gray-600">{gs.swapped_by}</td>
                      <td className="px-5 py-3.5 text-gray-500">{gs.notes || <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => setSwapDeleteConfirm(gs)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Toner Charge-Outs table ── */}
      {activeTab === 'toner' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {tonerLoading ? (
            <div className="py-16 text-center text-gray-400">Loading...</div>
          ) : tonerCOList.length === 0 ? (
            <div className="py-16 text-center">
              <Printer className="mx-auto text-gray-300 mb-3" size={40} />
              <p className="text-gray-500 font-medium">No toner deployments for {MONTH_NAMES[filterMonth - 1]} {filterYear}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Printer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Slot</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">GL #</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Charged By</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticket #</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tonerCOList.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{fmtDate(t.charged_at)}</td>
                      <td className="px-5 py-3.5 font-medium text-gray-900">{t.printer_model}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${SLOT_BADGE[t.slot] || SLOT_BADGE.BLACK}`}>
                          <span className={`w-2 h-2 rounded-full ${SLOT_DOT[t.slot] || SLOT_DOT.BLACK}`} />
                          {SLOT_LABEL[t.slot] || t.slot}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">{t.department_name}</td>
                      <td className="px-5 py-3.5"><span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{t.gl_number}</span></td>
                      <td className="px-5 py-3.5 text-center text-gray-900">{t.quantity}</td>
                      <td className="px-5 py-3.5 text-gray-600">{t.charged_by}</td>
                      <td className="px-5 py-3.5">
                        {t.ticket_number ? <span className="font-mono text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded">{t.ticket_number}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{t.notes || <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => setTonerDeleteConfirm(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── New Charge-Out Modal ── */}
      {showModal && (
        <Modal title="New Charge-Out" onClose={() => setShowModal(false)} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Item <span className="text-red-500">*</span></label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={form.item_id} onChange={handleItemChange} required>
                  <option value="">Select an item...</option>
                  {items.map(i => <option key={i.id} value={i.id} disabled={i.stock <= 0}>{i.name} ({i.stock} available)</option>)}
                </select>
                {selectedItem && (
                  <p className={`text-xs mt-1 ${selectedItem.stock <= selectedItem.reorder_threshold ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    {selectedItem.stock} units in stock{selectedItem.stock <= selectedItem.reorder_threshold && ' — low stock'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department <span className="text-red-500">*</span></label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={form.department_id} onChange={set('department_id')} required>
                  <option value="">Select a department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} — {d.gl_number}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity <span className="text-red-500">*</span></label>
                <input type="number" min="1" step="1" max={selectedItem?.stock || undefined}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.quantity} onChange={set('quantity')} placeholder="0" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit Cost ($) <span className="text-red-500">*</span></label>
                <input type="number" min="0" step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.unit_cost} onChange={set('unit_cost')} placeholder="0.00" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Charged By</label>
                <input className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" value={form.charged_by} readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ticket # <span className="text-red-500">*</span></label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.ticket_number} onChange={set('ticket_number')} placeholder="e.g. INC-12345" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.charged_at} onChange={set('charged_at')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.notes} onChange={set('notes')} placeholder="Optional" />
              </div>
            </div>
            {form.quantity && form.unit_cost && (
              <div className="bg-brand-50 rounded-lg px-4 py-3 text-sm">
                <span className="text-brand-700 font-medium">Total charge: {fmt(form.quantity * form.unit_cost)}</span>
              </div>
            )}
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">Record Charge-Out</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── New GL Swap Modal ── */}
      {showSwapModal && (
        <Modal title="New GL Swap" onClose={() => setShowSwapModal(false)} size="lg">
          <form onSubmit={handleSwapSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Purchase Order <span className="text-red-500">*</span></label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={swapForm.purchase_order_id} onChange={handleSwapPoChange} required>
                  <option value="">Select a PO...</option>
                  {purchaseOrders.map(po => <option key={po.id} value={po.id}>{po.po_number || '(no PO #)'} — {po.item_name} — {po.received_at}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Item</label>
                <input className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                  value={selectedSwapItem?.name || (swapForm.purchase_order_id ? 'Loading...' : '— select a PO first —')} readOnly />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">From Department <span className="text-red-500">*</span></label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={swapForm.from_department_id} onChange={setSwap('from_department_id')} required>
                  <option value="">Select a department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} — {d.gl_number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">To Department <span className="text-red-500">*</span></label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={swapForm.to_department_id} onChange={setSwap('to_department_id')} required>
                  <option value="">Select a department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} — {d.gl_number}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Price ($) <span className="text-red-500">*</span></label>
                <input type="number" min="0.01" step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={swapForm.price} onChange={setSwap('price')} placeholder="0.00" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={swapForm.swapped_at} onChange={setSwap('swapped_at')} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Swapped By</label>
                <input className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" value={swapForm.swapped_by} readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={swapForm.notes} onChange={setSwap('notes')} placeholder="Optional" />
              </div>
            </div>
            {swapError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{swapError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowSwapModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">Record GL Swap</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── New Toner Charge-Out Modal ── */}
      {showTonerModal && (
        <Modal title="New Toner Charge-Out" onClose={() => setShowTonerModal(false)} size="lg">
          <form onSubmit={handleTonerSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Toner Cartridge <span className="text-red-500">*</span></label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={tonerForm.toner_id} onChange={setToner('toner_id')} required>
                  <option value="">Select toner...</option>
                  {tonerCartridges.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.printer_model} — {SLOT_LABEL[t.slot] || t.slot}{t.part_number ? ` (${t.part_number})` : ''} · {t.stock} in stock
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department <span className="text-red-500">*</span></label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={tonerForm.department_id} onChange={setToner('department_id')} required>
                  <option value="">Select a department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} — {d.gl_number}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity <span className="text-red-500">*</span></label>
                <input type="number" min="1" step="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={tonerForm.quantity} onChange={setToner('quantity')} placeholder="1" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={tonerForm.charged_at} onChange={setToner('charged_at')} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Charged By</label>
                <input className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" value={tonerForm.charged_by} readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ticket # <span className="text-red-500">*</span></label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={tonerForm.ticket_number} onChange={setToner('ticket_number')} placeholder="e.g. INC-12345" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={tonerForm.notes} onChange={setToner('notes')} placeholder="Optional" />
            </div>
            {tonerError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{tonerError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowTonerModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">Record Toner Charge-Out</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete confirmations ── */}
      {deleteConfirm && (
        <Modal title="Delete Charge-Out" onClose={() => setDeleteConfirm(null)} size="sm">
          <p className="text-gray-600 text-sm">Delete this charge-out of <strong>{deleteConfirm.quantity}x {deleteConfirm.item_name}</strong> to <strong>{deleteConfirm.department_name}</strong>? Stock will be returned.</p>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
            <button onClick={() => handleDelete(deleteConfirm.id)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Delete</button>
          </div>
        </Modal>
      )}

      {swapDeleteConfirm && (
        <Modal title="Delete GL Swap" onClose={() => setSwapDeleteConfirm(null)} size="sm">
          <p className="text-gray-600 text-sm">Delete this GL Swap of <strong>{swapDeleteConfirm.item_name}</strong> from <strong>{swapDeleteConfirm.from_department_name}</strong> to <strong>{swapDeleteConfirm.to_department_name}</strong> on <strong>{fmtDate(swapDeleteConfirm.swapped_at)}</strong>?</p>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setSwapDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
            <button onClick={() => handleSwapDelete(swapDeleteConfirm.id)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Delete</button>
          </div>
        </Modal>
      )}

      {tonerDeleteConfirm && (
        <Modal title="Delete Toner Charge-Out" onClose={() => setTonerDeleteConfirm(null)} size="sm">
          <p className="text-gray-600 text-sm">Delete this toner charge-out of <strong>{SLOT_LABEL[tonerDeleteConfirm.slot] || tonerDeleteConfirm.slot}</strong> for <strong>{tonerDeleteConfirm.printer_model}</strong> to <strong>{tonerDeleteConfirm.department_name}</strong>?</p>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setTonerDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
            <button onClick={() => handleTonerDelete(tonerDeleteConfirm.id)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
