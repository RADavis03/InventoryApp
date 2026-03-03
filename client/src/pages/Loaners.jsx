import { useEffect, useState, Fragment } from 'react';
import { Laptop, Plus, RotateCcw, Trash2, Pencil, StickyNote } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import * as api from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const today = () => new Date().toISOString().split('T')[0];

function loanerStatus(due_date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(due_date + 'T00:00:00');
  const daysUntilDue = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 3) return 'due_soon';
  return 'ok';
}

function StatusBadge({ due_date }) {
  const status = loanerStatus(due_date);
  if (status === 'overdue') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Overdue</span>;
  }
  if (status === 'due_soon') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Due Soon</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Active</span>;
}

function TicketLink({ ticket_number }) {
  if (!ticket_number) return <span className="text-gray-400">—</span>;
  return (
    <a
      href={`https://k1000.gibsonhospital.org/adminui/ticket.php?ID=${ticket_number}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded hover:bg-brand-100 hover:underline"
    >
      {ticket_number}
    </a>
  );
}

const TABS = ['Active Loaners', 'Loaner History', 'Manage Computers'];

export default function Loaners() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState(0);
  const [expandedNote, setExpandedNote] = useState(null);
  const [expandedHistoryNote, setExpandedHistoryNote] = useState(null);

  // Data
  const [activeLoaners, setActiveLoaners] = useState([]);
  const [history, setHistory] = useState([]);
  const [computers, setComputers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New Loaner modal
  const emptyLoanerForm = () => ({
    computer_id: '', department_id: '', person_name: '',
    ticket_number: '', loaned_date: today(), due_date: '', notes: '',
  });
  const [showLoanerModal, setShowLoanerModal] = useState(false);
  const [loanerForm, setLoanerForm] = useState(emptyLoanerForm());
  const [loanerError, setLoanerError] = useState('');
  const [loanerSubmitting, setLoanerSubmitting] = useState(false);

  // Return modal
  const [returnLoaner, setReturnLoaner] = useState(null);
  const [returnedBy, setReturnedBy] = useState('');
  const [returnError, setReturnError] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  // Edit loaner modal
  const [editingLoaner, setEditingLoaner] = useState(null);
  const [editLoanerForm, setEditLoanerForm] = useState({});
  const [editLoanerError, setEditLoanerError] = useState('');
  const [editLoanerSubmitting, setEditLoanerSubmitting] = useState(false);

  // Computer modal
  const emptyComputerForm = () => ({ name: '', notes: '' });
  const [showComputerModal, setShowComputerModal] = useState(false);
  const [editingComputer, setEditingComputer] = useState(null);
  const [computerForm, setComputerForm] = useState(emptyComputerForm());
  const [computerError, setComputerError] = useState('');
  const [computerSubmitting, setComputerSubmitting] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.loaners.list({ status: 'active' }),
      api.loaners.list({ status: 'returned' }),
      api.loanerComputers.list(),
      api.departments.list(),
    ]).then(([active, returned, comps, depts]) => {
      setActiveLoaners(active);
      setHistory(returned);
      setComputers(comps);
      setDepartments(depts);
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  // New Loaner
  const openLoanerModal = () => {
    setLoanerForm(emptyLoanerForm());
    setLoanerError('');
    setShowLoanerModal(true);
  };
  const setlf = (k) => (e) => setLoanerForm(f => ({ ...f, [k]: e.target.value }));
  const handleLoanerSubmit = async (e) => {
    e.preventDefault();
    setLoanerError('');
    setLoanerSubmitting(true);
    try {
      await api.loaners.create(loanerForm);
      setShowLoanerModal(false);
      loadData();
    } catch (err) {
      setLoanerError(err.message);
    } finally {
      setLoanerSubmitting(false);
    }
  };

  // Return
  const openReturnModal = (loaner) => {
    setReturnLoaner(loaner);
    setReturnedBy(currentUser?.name || '');
    setReturnError('');
  };
  const handleReturn = async () => {
    setReturnSubmitting(true);
    setReturnError('');
    try {
      await api.loaners.logReturn(returnLoaner.id, { returned_by: returnedBy });
      setReturnLoaner(null);
      loadData();
    } catch (err) {
      setReturnError(err.message);
    } finally {
      setReturnSubmitting(false);
    }
  };

  // Edit loaner
  const openEditLoaner = (l) => {
    setEditingLoaner(l);
    setEditLoanerForm({
      computer_id: String(l.computer_id),
      department_id: String(l.department_id),
      person_name: l.person_name,
      ticket_number: l.ticket_number || '',
      loaned_date: l.loaned_date,
      due_date: l.due_date,
      notes: l.notes || '',
    });
    setEditLoanerError('');
  };
  const setel = (k) => (e) => setEditLoanerForm(f => ({ ...f, [k]: e.target.value }));
  const handleEditLoanerSubmit = async (e) => {
    e.preventDefault();
    setEditLoanerError('');
    setEditLoanerSubmitting(true);
    try {
      await api.loaners.update(editingLoaner.id, editLoanerForm);
      setEditingLoaner(null);
      loadData();
    } catch (err) {
      setEditLoanerError(err.message);
    } finally {
      setEditLoanerSubmitting(false);
    }
  };

  // Delete loaner (history)
  const handleDeleteLoaner = async (loaner) => {
    if (!window.confirm(`Delete loaner record for ${loaner.computer_name} / ${loaner.person_name}?`)) return;
    try {
      await api.loaners.remove(loaner.id);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Computer CRUD
  const openAddComputer = () => {
    setEditingComputer(null);
    setComputerForm(emptyComputerForm());
    setComputerError('');
    setShowComputerModal(true);
  };
  const openEditComputer = (c) => {
    setEditingComputer(c);
    setComputerForm({ name: c.name, notes: c.notes || '' });
    setComputerError('');
    setShowComputerModal(true);
  };
  const setcf = (k) => (e) => setComputerForm(f => ({ ...f, [k]: e.target.value }));
  const handleComputerSubmit = async (e) => {
    e.preventDefault();
    setComputerError('');
    setComputerSubmitting(true);
    try {
      if (editingComputer) {
        await api.loanerComputers.update(editingComputer.id, computerForm);
      } else {
        await api.loanerComputers.create(computerForm);
      }
      setShowComputerModal(false);
      loadData();
    } catch (err) {
      setComputerError(err.message);
    } finally {
      setComputerSubmitting(false);
    }
  };
  const handleDeleteComputer = async (c) => {
    if (!window.confirm(`Delete computer "${c.name}"? This cannot be undone.`)) return;
    try {
      await api.loanerComputers.remove(c.id);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Computers available for new loaner (not currently on active loan)
  const availableComputers = computers.filter(c => !c.is_loaned_out);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-gray-400">Loading...</div></div>;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loaners</h1>
          <p className="text-gray-500 mt-1">Track loaned computers and due dates</p>
        </div>
        {tab === 0 && (
          <button
            onClick={openLoanerModal}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> New Loaner
          </button>
        )}
        {tab === 2 && (
          <button
            onClick={openAddComputer}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Add Computer
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-3 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((label, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              tab === i
                ? 'bg-white border border-b-white border-gray-200 text-brand-700 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {i === 0 && activeLoaners.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-700">
                {activeLoaners.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 0: Active Loaners */}
      {tab === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {activeLoaners.length === 0 ? (
            <div className="px-5 py-12 text-center text-gray-400">
              <Laptop size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No active loaners</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Computer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Person</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticket #</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Loaned</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeLoaners.map(l => (
                    <Fragment key={l.id}>
                      <tr
                        className={`hover:bg-gray-50/50 transition-colors ${l.notes ? 'cursor-pointer' : ''}`}
                        onClick={() => l.notes && setExpandedNote(expandedNote === l.id ? null : l.id)}
                      >
                        <td className="px-5 py-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            {l.computer_name}
                            {l.notes && (
                              <StickyNote size={13} fill="currentColor" className={`flex-shrink-0 transition-colors ${expandedNote === l.id ? 'text-yellow-400' : 'text-yellow-200'}`} />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-700">{l.person_name}</td>
                        <td className="px-5 py-3 text-gray-600">{l.department_name}</td>
                        <td className="px-5 py-3" onClick={e => e.stopPropagation()}><TicketLink ticket_number={l.ticket_number} /></td>
                        <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(l.loaned_date)}</td>
                        <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(l.due_date)}</td>
                        <td className="px-5 py-3"><StatusBadge due_date={l.due_date} /></td>
                        <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditLoaner(l)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => openReturnModal(l)}
                              className="flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <RotateCcw size={13} /> Log Return
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedNote === l.id && l.notes && (
                        <tr className="bg-yellow-50/60">
                          <td colSpan={8} className="px-5 py-2.5">
                            <div className="flex items-start gap-2 text-sm text-gray-700">
                              <StickyNote size={14} fill="currentColor" className="text-yellow-400 flex-shrink-0 mt-0.5" />
                              <span>{l.notes}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Loaner History */}
      {tab === 1 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {history.length === 0 ? (
            <div className="px-5 py-12 text-center text-gray-400">
              <p className="text-sm">No returned loaners yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Computer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Person</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticket #</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Loaned</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Returned</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Returned By</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {history.map(l => (
                    <Fragment key={l.id}>
                      <tr
                        className={`hover:bg-gray-50/50 transition-colors ${l.notes ? 'cursor-pointer' : ''}`}
                        onClick={() => l.notes && setExpandedHistoryNote(expandedHistoryNote === l.id ? null : l.id)}
                      >
                        <td className="px-5 py-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            {l.computer_name}
                            {l.notes && (
                              <StickyNote size={13} fill="currentColor" className={`flex-shrink-0 transition-colors ${expandedHistoryNote === l.id ? 'text-yellow-400' : 'text-yellow-200'}`} />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-700">{l.person_name}</td>
                        <td className="px-5 py-3 text-gray-600">{l.department_name}</td>
                        <td className="px-5 py-3" onClick={e => e.stopPropagation()}><TicketLink ticket_number={l.ticket_number} /></td>
                        <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(l.loaned_date)}</td>
                        <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(l.due_date)}</td>
                        <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(l.returned_date)}</td>
                        <td className="px-5 py-3 text-gray-600">{l.returned_by || '—'}</td>
                        <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleDeleteLoaner(l)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                      {expandedHistoryNote === l.id && l.notes && (
                        <tr className="bg-yellow-50/60">
                          <td colSpan={9} className="px-5 py-2.5">
                            <div className="flex items-start gap-2 text-sm text-gray-700">
                              <StickyNote size={14} fill="currentColor" className="text-yellow-400 flex-shrink-0 mt-0.5" />
                              <span>{l.notes}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Manage Computers */}
      {tab === 2 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {computers.length === 0 ? (
            <div className="px-5 py-12 text-center text-gray-400">
              <Laptop size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No computers added yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {computers.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-5 py-3 text-gray-500">{c.notes || '—'}</td>
                    <td className="px-5 py-3">
                      {c.is_loaned_out
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Currently Loaned</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Available</span>
                      }
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditComputer(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteComputer(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                          disabled={!!c.is_loaned_out}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* New Loaner Modal */}
      {showLoanerModal && (
        <Modal title="New Loaner" onClose={() => setShowLoanerModal(false)} size="lg">
          <form onSubmit={handleLoanerSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Computer <span className="text-red-500">*</span></label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={loanerForm.computer_id} onChange={setlf('computer_id')} required
                >
                  <option value="">Select a computer...</option>
                  {availableComputers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {availableComputers.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No computers available — all are currently loaned out.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department <span className="text-red-500">*</span></label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={loanerForm.department_id} onChange={setlf('department_id')} required
                >
                  <option value="">Select a department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Person Name <span className="text-red-500">*</span></label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={loanerForm.person_name} onChange={setlf('person_name')} placeholder="Full name" required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ticket # <span className="text-red-500">*</span></label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={loanerForm.ticket_number} onChange={setlf('ticket_number')} placeholder="e.g. 12345" required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Loaned Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={loanerForm.loaned_date} onChange={setlf('loaned_date')} required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={loanerForm.due_date} onChange={setlf('due_date')} required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={loanerForm.notes} onChange={setlf('notes')} placeholder="Optional"
              />
            </div>

            {loanerError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{loanerError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowLoanerModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loanerSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {loanerSubmitting ? 'Saving…' : 'Create Loaner'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Loaner Modal */}
      {editingLoaner && (
        <Modal title="Edit Loaner" onClose={() => setEditingLoaner(null)} size="lg">
          <form onSubmit={handleEditLoanerSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Computer <span className="text-red-500">*</span></label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={editLoanerForm.computer_id} onChange={setel('computer_id')} required
                >
                  {computers
                    .filter(c => !c.is_loaned_out || String(c.id) === String(editingLoaner.computer_id))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  }
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department <span className="text-red-500">*</span></label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={editLoanerForm.department_id} onChange={setel('department_id')} required
                >
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Person Name <span className="text-red-500">*</span></label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={editLoanerForm.person_name} onChange={setel('person_name')} placeholder="Full name" required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ticket # <span className="text-red-500">*</span></label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={editLoanerForm.ticket_number} onChange={setel('ticket_number')} placeholder="e.g. 12345" required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Loaned Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={editLoanerForm.loaned_date} onChange={setel('loaned_date')} required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={editLoanerForm.due_date} onChange={setel('due_date')} required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={editLoanerForm.notes} onChange={setel('notes')} placeholder="Optional"
              />
            </div>

            {editLoanerError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editLoanerError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditingLoaner(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={editLoanerSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {editLoanerSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Log Return Modal */}
      {returnLoaner && (
        <Modal title="Log Return" onClose={() => setReturnLoaner(null)}>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1">
              <div><span className="text-gray-500">Computer:</span> <span className="font-medium text-gray-900">{returnLoaner.computer_name}</span></div>
              <div><span className="text-gray-500">Person:</span> <span className="font-medium text-gray-900">{returnLoaner.person_name}</span></div>
              <div><span className="text-gray-500">Due:</span> <span className="font-medium text-gray-900">{fmtDate(returnLoaner.due_date)}</span></div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Returned By</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={returnedBy} onChange={e => setReturnedBy(e.target.value)} placeholder="Name"
              />
            </div>

            {returnError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{returnError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setReturnLoaner(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleReturn} disabled={returnSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {returnSubmitting ? 'Saving…' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add/Edit Computer Modal */}
      {showComputerModal && (
        <Modal title={editingComputer ? 'Edit Computer' : 'Add Computer'} onClose={() => setShowComputerModal(false)}>
          <form onSubmit={handleComputerSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={computerForm.name} onChange={setcf('name')} placeholder="e.g. Loaner Laptop 1" required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={computerForm.notes} onChange={setcf('notes')} placeholder="Optional (e.g. model, serial number)"
              />
            </div>

            {computerError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{computerError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowComputerModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={computerSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {computerSubmitting ? 'Saving…' : editingComputer ? 'Save Changes' : 'Add Computer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
