import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Minus, Pencil, Trash2, AlertTriangle, Package, ShoppingCart, Printer, RefreshCw, ChevronDown } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import * as api from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const today = () => new Date().toISOString().split('T')[0];

const ITEM_EMPTY = { name: '', description: '', unit_price: '', reorder_threshold: '' };

const SLOTS_COLOR = ['BLACK', 'CYAN', 'MAGENTA', 'YELLOW', 'BLACK_DEVELOPER', 'COLOR_DEVELOPER', 'COLOR_DRUM', 'BLACK_DRUM', 'WASTE_TONER'];
const SLOTS_BW    = ['BLACK', 'IMAGING_KIT'];

const SLOT_STYLE = {
  BLACK:           { dot: 'bg-gray-800',    badge: 'bg-gray-100 text-gray-800',      label: 'Black'           },
  CYAN:            { dot: 'bg-cyan-500',    badge: 'bg-cyan-100 text-cyan-800',      label: 'Cyan'            },
  MAGENTA:         { dot: 'bg-pink-500',    badge: 'bg-pink-100 text-pink-800',      label: 'Magenta'         },
  YELLOW:          { dot: 'bg-yellow-400',  badge: 'bg-yellow-100 text-yellow-800',  label: 'Yellow'          },
  IMAGING_KIT:     { dot: 'bg-indigo-600',  badge: 'bg-indigo-100 text-indigo-700',  label: 'Imaging Kit'     },
  BLACK_DEVELOPER: { dot: 'bg-zinc-700',    badge: 'bg-zinc-100 text-zinc-700',      label: 'Black Developer' },
  COLOR_DEVELOPER: { dot: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-700',  label: 'Color Developer' },
  COLOR_DRUM:      { dot: 'bg-teal-500',    badge: 'bg-teal-100 text-teal-700',      label: 'Color Drum'      },
  BLACK_DRUM:      { dot: 'bg-stone-600',   badge: 'bg-stone-100 text-stone-700',    label: 'Black Drum'      },
  WASTE_TONER:     { dot: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700',  label: 'Waste Toner'     },
};

const PRINTER_EMPTY  = { model_name: '', is_color: false, notes: '' };
const TONER_EMPTY    = { printer_id: '', slot: 'BLACK', part_number: '', brand: '', notes: '', reorder_threshold: '' };
const RESTOCK_EMPTY  = { quantity: '', notes: '', received_at: today() };

export default function Inventory() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'items');

  // ── Items tab ──────────────────────────────────────────
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [itemForm, setItemForm] = useState(ITEM_EMPTY);
  const [itemError, setItemError] = useState('');
  const [deleteItemConfirm, setDeleteItemConfirm] = useState(null);

  const loadItems = () => {
    if (items.length === 0) setItemsLoading(true);
    api.items.list().then(setItems).finally(() => setItemsLoading(false));
  };

  useEffect(() => { loadItems(); }, []);

  const openAddItem = () => { setEditItem(null); setItemForm(ITEM_EMPTY); setItemError(''); setShowItemModal(true); };
  const openEditItem = (item) => {
    setEditItem(item);
    setItemForm({ name: item.name, description: item.description || '', unit_price: item.unit_price, reorder_threshold: item.reorder_threshold });
    setItemError('');
    setShowItemModal(true);
  };

  const handleItemSubmit = async (e) => {
    e.preventDefault();
    setItemError('');
    try {
      if (editItem) await api.items.update(editItem.id, itemForm);
      else          await api.items.create(itemForm);
      setShowItemModal(false);
      loadItems();
    } catch (err) { setItemError(err.message); }
  };

  const handleItemDelete = async (id) => {
    try { await api.items.delete(id); setDeleteItemConfirm(null); loadItems(); }
    catch (err) { alert(err.message); }
  };

  const setItem = (k) => (e) => setItemForm(f => ({ ...f, [k]: e.target.value }));

  // ── Toner tab ──────────────────────────────────────────
  const [printers, setPrinters] = useState([]);
  const [tonerItems, setTonerItems] = useState([]);
  const [tonerLoading, setTonerLoading] = useState(false);

  // Printer CRUD
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [editPrinter, setEditPrinter] = useState(null);
  const [printerForm, setPrinterForm] = useState(PRINTER_EMPTY);
  const [printerError, setPrinterError] = useState('');
  const [deletePrinterConfirm, setDeletePrinterConfirm] = useState(null);

  // Toner cartridge CRUD
  const [showTonerModal, setShowTonerModal] = useState(false);
  const [editToner, setEditToner] = useState(null);
  const [tonerForm, setTonerForm] = useState(TONER_EMPTY);
  const [tonerError, setTonerError] = useState('');
  const [deleteTonerConfirm, setDeleteTonerConfirm] = useState(null);

  // Restock
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockForm, setRestockForm] = useState(RESTOCK_EMPTY);
  const [restockError, setRestockError] = useState('');

  // Collapsible printers — stores IDs of collapsed printers (all expanded by default)
  const [collapsedPrinters, setCollapsedPrinters] = useState(new Set());
  const togglePrinter = (id) => setCollapsedPrinters(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Quick charge-out (mini modal for − button)
  const [departments, setDepartments] = useState([]);
  const [showQuickChargeModal, setShowQuickChargeModal] = useState(false);
  const [quickChargeTarget, setQuickChargeTarget] = useState(null);
  const [quickChargeForm, setQuickChargeForm] = useState({});
  const [quickChargeError, setQuickChargeError] = useState('');

  const loadToner = (collapseAll = false) => {
    if (printers.length === 0) setTonerLoading(true);
    Promise.all([api.printers.list(), api.toner.list(), api.departments.list()])
      .then(([prins, tons, depts]) => {
        setPrinters(prins); setTonerItems(tons); setDepartments(depts);
        if (collapseAll) setCollapsedPrinters(new Set(prins.map(p => p.id)));
      })
      .finally(() => setTonerLoading(false));
  };

  useEffect(() => { if (activeTab === 'toner') loadToner(true); }, [activeTab]);

  // Printer handlers
  const openAddPrinter = () => { setEditPrinter(null); setPrinterForm(PRINTER_EMPTY); setPrinterError(''); setShowPrinterModal(true); };
  const openEditPrinter = (p) => {
    setEditPrinter(p);
    setPrinterForm({ model_name: p.model_name, is_color: !!p.is_color, notes: p.notes || '' });
    setPrinterError('');
    setShowPrinterModal(true);
  };

  const handlePrinterSubmit = async (e) => {
    e.preventDefault();
    setPrinterError('');
    try {
      if (editPrinter) await api.printers.update(editPrinter.id, printerForm);
      else             await api.printers.create(printerForm);
      setShowPrinterModal(false);
      loadToner();
    } catch (err) { setPrinterError(err.message); }
  };

  const handlePrinterDelete = async (id) => {
    try { await api.printers.delete(id); setDeletePrinterConfirm(null); loadToner(); }
    catch (err) { alert(err.message); }
  };

  const setPrinterF = (k) => (e) => setPrinterForm(f => ({ ...f, [k]: e.target.value }));

  // Toner cartridge handlers
  const openAddToner = (printer) => {
    const existingSlots = tonerItems.filter(t => t.printer_id === printer.id).map(t => t.slot);
    const available = (printer.is_color ? SLOTS_COLOR : SLOTS_BW).filter(s => !existingSlots.includes(s));
    setEditToner(null);
    setTonerForm({ ...TONER_EMPTY, printer_id: printer.id, slot: available[0] || 'BLACK' });
    setTonerError('');
    setShowTonerModal(true);
  };

  const openEditToner = (t) => {
    setEditToner(t);
    setTonerForm({ printer_id: t.printer_id, slot: t.slot, part_number: t.part_number || '', brand: t.brand || '', notes: t.notes || '', reorder_threshold: t.reorder_threshold });
    setTonerError('');
    setShowTonerModal(true);
  };

  const handleTonerSubmit = async (e) => {
    e.preventDefault();
    setTonerError('');
    try {
      if (editToner) await api.toner.update(editToner.id, tonerForm);
      else           await api.toner.create(tonerForm);
      setShowTonerModal(false);
      loadToner();
    } catch (err) { setTonerError(err.message); }
  };

  const handleTonerDelete = async (id) => {
    try { await api.toner.delete(id); setDeleteTonerConfirm(null); loadToner(); }
    catch (err) { alert(err.message); }
  };

  const setTonerF = (k) => (e) => setTonerForm(f => ({ ...f, [k]: e.target.value }));

  // Restock handlers
  const openRestock = (t) => { setRestockTarget(t); setRestockForm(RESTOCK_EMPTY); setRestockError(''); setShowRestockModal(true); };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    setRestockError('');
    try {
      await api.toner.restock(restockTarget.id, restockForm);
      setShowRestockModal(false);
      loadToner();
    } catch (err) { setRestockError(err.message); }
  };

  const setRestock = (k) => (e) => setRestockForm(f => ({ ...f, [k]: e.target.value }));

  // Quick +1 restock (no modal)
  const handleQuickRestock = async (t) => {
    try {
      await api.toner.restock(t.id, { quantity: 1, received_at: today(), notes: null });
      loadToner();
    } catch (err) { alert(err.message); }
  };

  // Quick charge-out (mini modal)
  const openQuickCharge = (t) => {
    setQuickChargeTarget(t);
    setQuickChargeForm({ department_id: '', ticket_number: '', quantity: 1, charged_by: currentUser?.name || '', charged_at: today() });
    setQuickChargeError('');
    setShowQuickChargeModal(true);
  };

  const handleQuickChargeSubmit = async (e) => {
    e.preventDefault(); setQuickChargeError('');
    if (quickChargeTarget.stock < parseInt(quickChargeForm.quantity)) {
      setQuickChargeError(`Only ${quickChargeTarget.stock} in stock.`); return;
    }
    try {
      await api.tonerChargeOuts.create({ ...quickChargeForm, toner_id: quickChargeTarget.id });
      setShowQuickChargeModal(false);
      loadToner();
    } catch (err) { setQuickChargeError(err.message); }
  };

  const setQC = (k) => (e) => setQuickChargeForm(f => ({ ...f, [k]: e.target.value }));

  // Shared part number detection — cartridges with the same part# share stock
  const partNumberCounts = {};
  tonerItems.forEach(t => { if (t.part_number) partNumberCounts[t.part_number] = (partNumberCounts[t.part_number] || 0) + 1; });
  const isShared = (pn) => pn && partNumberCounts[pn] > 1;

  // Available slots for add-toner modal
  const addTonerPrinter = printers.find(p => p.id === parseInt(tonerForm.printer_id));
  const usedSlots = tonerItems.filter(t => t.printer_id === parseInt(tonerForm.printer_id) && (!editToner || t.id !== editToner.id)).map(t => t.slot);
  const availableSlots = (addTonerPrinter?.is_color ? SLOTS_COLOR : SLOTS_BW).filter(s => !usedSlots.includes(s));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1">
            {activeTab === 'items' ? 'Manage consumable items and stock levels' : 'Manage printer toner by model'}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'items' ? (
            <>
              <button onClick={() => navigate('/purchase-orders', { state: { openBulk: true } })}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                <ShoppingCart size={16} /> Restock Items
              </button>
              <button onClick={openAddItem}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                <Plus size={16} /> Add Item
              </button>
            </>
          ) : (
            <button onClick={openAddPrinter}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
              <Plus size={16} /> Add Printer
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6">
        {[['items', 'Items'], ['toner', 'Printer Toner']].map(([val, label]) => (
          <button key={val} onClick={() => setActiveTab(val)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === val ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Items tab ── */}
      {activeTab === 'items' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {itemsLoading ? (
            <div className="py-16 text-center text-gray-400">Loading...</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="mx-auto text-gray-300 mb-3" size={40} />
              <p className="text-gray-500 font-medium">No items yet</p>
              <p className="text-gray-400 text-sm mt-1">Add your first inventory item to get started</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit Price</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reorder At</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => {
                  const low = item.stock <= item.reorder_threshold;
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50/50 ${low ? 'bg-red-50/30' : ''}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {low && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
                          <span className="font-medium text-gray-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{item.description || '—'}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded-full text-xs font-semibold ${low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {item.stock}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-gray-900">{fmt(item.unit_price)}</td>
                      <td className="px-5 py-3.5 text-center text-gray-500">{item.reorder_threshold}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditItem(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"><Pencil size={15} /></button>
                          <button onClick={() => setDeleteItemConfirm(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Toner tab ── */}
      {activeTab === 'toner' && (
        <div className="space-y-4">
          {tonerLoading ? (
            <div className="py-16 text-center text-gray-400">Loading...</div>
          ) : printers.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
              <Printer className="mx-auto text-gray-300 mb-3" size={40} />
              <p className="text-gray-500 font-medium">No printers added yet</p>
              <p className="text-gray-400 text-sm mt-1">Add a printer model to start tracking toner</p>
            </div>
          ) : (
            printers.map(printer => {
              const cartridges = tonerItems.filter(t => t.printer_id === printer.id);
              const existingSlots = cartridges.map(t => t.slot);
              const allSlots = printer.is_color ? SLOTS_COLOR : SLOTS_BW;
              const canAddMore = allSlots.some(s => !existingSlots.includes(s));

              const isCollapsed = collapsedPrinters.has(printer.id);
              return (
                <div key={printer.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Printer header */}
                  <div className={`flex items-center gap-3 px-5 py-3.5 bg-gray-50/60 ${!isCollapsed ? 'border-b border-gray-100' : ''}`}>
                    <button onClick={() => togglePrinter(printer.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <ChevronDown size={15} className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                      <Printer size={16} className="text-gray-400 flex-shrink-0" />
                      <span className="font-semibold text-gray-900">{printer.model_name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${printer.is_color ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-600'}`}>
                        {printer.is_color ? 'Color' : 'B&W'}
                      </span>
                      {printer.notes && (
                        <span className="text-xs text-gray-500 truncate max-w-xs">{printer.notes}</span>
                      )}
                      {isCollapsed && cartridges.length > 0 && (
                        <>
                          <span className="text-xs text-gray-400">{cartridges.length} slot{cartridges.length !== 1 ? 's' : ''}</span>
                          {(() => {
                            const lowCount = cartridges.filter(t => t.stock < t.reorder_threshold).length;
                            return lowCount > 0 ? (
                              <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <AlertTriangle size={11} />
                                {lowCount} low
                              </span>
                            ) : null;
                          })()}
                        </>
                      )}
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canAddMore && (
                        <button onClick={() => openAddToner(printer)}
                          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2.5 py-1.5 rounded-lg transition-colors">
                          <Plus size={13} /> Add Consumable
                        </button>
                      )}
                      <button onClick={() => openEditPrinter(printer)} className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => setDeletePrinterConfirm(printer)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </div>

                  {/* Toner cartridges */}
                  {!isCollapsed && (cartridges.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-gray-400">
                      No toner cartridges added yet.{' '}
                      {canAddMore && (
                        <button onClick={() => openAddToner(printer)} className="text-brand-600 hover:underline">Add one</button>
                      )}
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Slot</th>
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Part #</th>
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Brand</th>
                          <th className="text-center px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Stock</th>
                          <th className="text-center px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Reorder At</th>
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</th>
                          <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {cartridges.map(t => {
                          const style = SLOT_STYLE[t.slot] || SLOT_STYLE.BLACK;
                          const low = t.stock < t.reorder_threshold;
                          return (
                            <tr key={t.id} className={`hover:bg-gray-50/50 ${low ? 'bg-red-50/30' : ''}`}>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  {low && <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />}
                                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
                                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                                    {style.label}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-3 font-mono text-xs text-gray-600">
                                <div className="flex items-center gap-1.5">
                                  {t.part_number || <span className="text-gray-300">—</span>}
                                  {isShared(t.part_number) && (
                                    <span className="text-xs bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded font-medium">Shared</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-gray-600">{t.brand || <span className="text-gray-300">—</span>}</td>
                              <td className="px-5 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => openQuickCharge(t)}
                                    className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                    <Minus size={11} />
                                  </button>
                                  <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded-full text-xs font-semibold ${low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {t.stock}
                                  </span>
                                  <button onClick={() => handleQuickRestock(t)}
                                    className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                                    <Plus size={11} />
                                  </button>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-center text-gray-500 text-sm">{t.reorder_threshold}</td>
                              <td className="px-5 py-3 text-gray-500 text-xs max-w-[200px] truncate">{t.notes || <span className="text-gray-300">—</span>}</td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => openRestock(t)}
                                    className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded-lg transition-colors">
                                    <RefreshCw size={12} /> Restock
                                  </button>
                                  <button onClick={() => openEditToner(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"><Pencil size={14} /></button>
                                  <button onClick={() => setDeleteTonerConfirm(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Items modals ── */}
      {showItemModal && (
        <Modal title={editItem ? 'Edit Item' : 'Add Item'} onClose={() => setShowItemModal(false)}>
          <form onSubmit={handleItemSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={itemForm.name} onChange={setItem('name')} placeholder="e.g. HDMI Cable" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={itemForm.description} onChange={setItem('description')} placeholder="Optional details" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit Price ($)</label>
                <input type="number" min="0" step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={itemForm.unit_price} onChange={setItem('unit_price')} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Reorder Threshold</label>
                <input type="number" min="0" step="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={itemForm.reorder_threshold} onChange={setItem('reorder_threshold')} placeholder="5" />
              </div>
            </div>
            {itemError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{itemError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowItemModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">{editItem ? 'Save Changes' : 'Add Item'}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteItemConfirm && (
        <Modal title="Delete Item" onClose={() => setDeleteItemConfirm(null)} size="sm">
          <p className="text-gray-600 text-sm">Delete <strong>{deleteItemConfirm.name}</strong>? This will also delete all associated purchase orders and charge-out history.</p>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setDeleteItemConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
            <button onClick={() => handleItemDelete(deleteItemConfirm.id)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Delete</button>
          </div>
        </Modal>
      )}

      {/* ── Printer modals ── */}
      {showPrinterModal && (
        <Modal title={editPrinter ? 'Edit Printer' : 'Add Printer'} onClose={() => setShowPrinterModal(false)}>
          <form onSubmit={handlePrinterSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Model Name <span className="text-red-500">*</span></label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={printerForm.model_name} onChange={setPrinterF('model_name')} placeholder="e.g. HP LaserJet M404dn" required />
            </div>
            <div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 accent-brand-600 w-4 h-4"
                  checked={printerForm.is_color}
                  onChange={e => setPrinterForm(f => ({ ...f, is_color: e.target.checked }))} />
                <span className="text-sm font-medium text-gray-700">Color printer</span>
                <span className="text-xs text-gray-400">(supports Cyan, Magenta, Yellow toner)</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={printerForm.notes} onChange={setPrinterF('notes')} placeholder="Optional" />
            </div>
            {printerError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{printerError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowPrinterModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">{editPrinter ? 'Save Changes' : 'Add Printer'}</button>
            </div>
          </form>
        </Modal>
      )}

      {deletePrinterConfirm && (
        <Modal title="Delete Printer" onClose={() => setDeletePrinterConfirm(null)} size="sm">
          <p className="text-gray-600 text-sm">Delete <strong>{deletePrinterConfirm.model_name}</strong>? This will also delete all toner cartridges and restock history for this printer.</p>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setDeletePrinterConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
            <button onClick={() => handlePrinterDelete(deletePrinterConfirm.id)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Delete</button>
          </div>
        </Modal>
      )}

      {/* ── Toner cartridge modals ── */}
      {showTonerModal && (
        <Modal title={editToner ? 'Edit Toner Cartridge' : 'Add Toner Cartridge'} onClose={() => setShowTonerModal(false)}>
          <form onSubmit={handleTonerSubmit} className="space-y-4">
            {/* Context row: printer + slot */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Printer</label>
                {editToner ? (
                  <input className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                    value={editToner.printer_model} readOnly />
                ) : (
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    value={tonerForm.printer_id} onChange={setTonerF('printer_id')} required>
                    <option value="">Select printer...</option>
                    {printers.map(p => <option key={p.id} value={p.id}>{p.model_name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Slot <span className="text-red-500">*</span></label>
                {editToner ? (
                  <input className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                    value={SLOT_STYLE[editToner.slot]?.label || editToner.slot} readOnly />
                ) : (
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    value={tonerForm.slot} onChange={setTonerF('slot')} required disabled={!tonerForm.printer_id}>
                    {availableSlots.map(s => <option key={s} value={s}>{SLOT_STYLE[s]?.label || s}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Part Number</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={tonerForm.part_number} onChange={setTonerF('part_number')} placeholder="e.g. CF258A" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Brand</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={tonerForm.brand} onChange={setTonerF('brand')} placeholder="e.g. HP, Canon" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Reorder Threshold</label>
                <input type="number" min="0" step="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={tonerForm.reorder_threshold} onChange={setTonerF('reorder_threshold')} placeholder="2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={tonerForm.notes} onChange={setTonerF('notes')} placeholder="Optional" />
              </div>
            </div>
            {tonerError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{tonerError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowTonerModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">{editToner ? 'Save Changes' : 'Add Cartridge'}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTonerConfirm && (
        <Modal title="Delete Toner Cartridge" onClose={() => setDeleteTonerConfirm(null)} size="sm">
          <p className="text-gray-600 text-sm">Delete the <strong>{SLOT_STYLE[deleteTonerConfirm.slot]?.label}</strong> cartridge for <strong>{deleteTonerConfirm.printer_model}</strong>? All restock and charge-out history for this cartridge will also be deleted.</p>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setDeleteTonerConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
            <button onClick={() => handleTonerDelete(deleteTonerConfirm.id)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Delete</button>
          </div>
        </Modal>
      )}

      {/* ── Quick charge-out modal ── */}
      {showQuickChargeModal && quickChargeTarget && (
        <Modal title="Charge Out Toner" onClose={() => setShowQuickChargeModal(false)}>
          <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${SLOT_STYLE[quickChargeTarget.slot]?.badge}`}>
              <span className={`w-2 h-2 rounded-full ${SLOT_STYLE[quickChargeTarget.slot]?.dot}`} />
              {SLOT_STYLE[quickChargeTarget.slot]?.label}
            </span>
            <span className="text-sm font-medium text-gray-700">{quickChargeTarget.printer_model}</span>
            {quickChargeTarget.part_number && <span className="text-xs font-mono text-gray-400">{quickChargeTarget.part_number}</span>}
            <span className="ml-auto text-xs text-gray-500">In stock: <strong className="text-gray-800">{quickChargeTarget.stock}</strong></span>
          </div>
          <form onSubmit={handleQuickChargeSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department <span className="text-red-500">*</span></label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={quickChargeForm.department_id} onChange={setQC('department_id')} required>
                  <option value="">Select...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity <span className="text-red-500">*</span></label>
                <input type="number" min="1" step="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={quickChargeForm.quantity} onChange={setQC('quantity')} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ticket # <span className="text-red-500">*</span></label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={quickChargeForm.ticket_number} onChange={setQC('ticket_number')} placeholder="e.g. INC0012345" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={quickChargeForm.charged_at} onChange={setQC('charged_at')} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Charged By</label>
              <input className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                value={quickChargeForm.charged_by} readOnly />
            </div>
            {quickChargeError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{quickChargeError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowQuickChargeModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">Charge Out</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Restock modal ── */}
      {showRestockModal && restockTarget && (
        <Modal title="Add Toner Stock" onClose={() => setShowRestockModal(false)}>
          <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${SLOT_STYLE[restockTarget.slot]?.badge}`}>
              <span className={`w-2 h-2 rounded-full ${SLOT_STYLE[restockTarget.slot]?.dot}`} />
              {SLOT_STYLE[restockTarget.slot]?.label}
            </span>
            <span className="text-sm font-medium text-gray-700">{restockTarget.printer_model}</span>
            {restockTarget.part_number && <span className="text-xs font-mono text-gray-400">{restockTarget.part_number}</span>}
            <span className="ml-auto text-xs text-gray-500">Current stock: <strong className="text-gray-800">{restockTarget.stock}</strong></span>
          </div>
          {isShared(restockTarget.part_number) && (
            <p className="text-xs text-brand-700 bg-brand-50 px-3 py-2 rounded-lg mb-1">
              Stock for part # <strong>{restockTarget.part_number}</strong> is shared across multiple printers. This restock will update the shared total.
            </p>
          )}
          <form onSubmit={handleRestockSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity <span className="text-red-500">*</span></label>
                <input type="number" min="1" step="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={restockForm.quantity} onChange={setRestock('quantity')} placeholder="0" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date Received <span className="text-red-500">*</span></label>
                <input type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={restockForm.received_at} onChange={setRestock('received_at')} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={restockForm.notes} onChange={setRestock('notes')} placeholder="Optional" />
            </div>
            {restockError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{restockError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowRestockModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">Add Stock</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
