import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Building2, Upload } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import * as api from '../lib/api.js';

const EMPTY = { name: '', gl_number: '' };

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.departments.list().then(setDepartments).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditDept(null);
    setForm(EMPTY);
    setError('');
    setShowModal(true);
  };

  const openEdit = (dept) => {
    setEditDept(dept);
    setForm({ name: dept.name, gl_number: dept.gl_number });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editDept) {
        await api.departments.update(editDept.id, form);
      } else {
        await api.departments.create(form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.departments.delete(id);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const openBulk = () => {
    setBulkText('');
    setBulkResult(null);
    setShowBulkModal(true);
  };

  const handleBulkImport = async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const parsed = [];
    const parseErrors = [];
    lines.forEach((line, i) => {
      const comma = line.indexOf(',');
      if (comma === -1) {
        parseErrors.push(`Line ${i + 1}: missing comma separator — "${line}"`);
        return;
      }
      const name = line.slice(0, comma).trim();
      const gl_number = line.slice(comma + 1).trim();
      if (!name) { parseErrors.push(`Line ${i + 1}: department name is empty`); return; }
      if (!gl_number) { parseErrors.push(`Line ${i + 1}: GL number is empty`); return; }
      parsed.push({ name, gl_number });
    });

    if (parseErrors.length > 0) {
      setBulkResult({ parseErrors });
      return;
    }

    setBulkLoading(true);
    const succeeded = [];
    const failed = [];
    for (const dept of parsed) {
      try {
        await api.departments.create(dept);
        succeeded.push(dept.name);
      } catch (err) {
        failed.push({ name: dept.name, reason: err.message });
      }
    }
    setBulkLoading(false);
    setBulkResult({ succeeded, failed });
    if (succeeded.length > 0) load();
  };

  const closeBulk = () => {
    setShowBulkModal(false);
    setBulkText('');
    setBulkResult(null);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-500 mt-1">Manage departments and their GL numbers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openBulk}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Upload size={16} /> Bulk Import
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Add Department
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading...</div>
        ) : departments.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-500 font-medium">No departments yet</p>
            <p className="text-gray-400 text-sm mt-1">Add departments before logging charge-outs</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">GL Number</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {departments.map(dept => (
                <tr key={dept.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{dept.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-gray-100 text-gray-700">
                      {dept.gl_number}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(dept)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(dept)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title={editDept ? 'Edit Department' : 'Add Department'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Department Name <span className="text-red-500">*</span></label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                value={form.name} onChange={set('name')} placeholder="e.g. Human Resources" required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">GL Number <span className="text-red-500">*</span></label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                value={form.gl_number} onChange={set('gl_number')} placeholder="e.g. 5100-200" required
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
                {editDept ? 'Save Changes' : 'Add Department'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showBulkModal && (
        <Modal title="Bulk Import Departments" onClose={closeBulk}>
          {!bulkResult ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Enter one department per line as <span className="font-mono bg-gray-100 px-1 rounded">Name, GL Number</span>
              </p>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                rows={10}
                placeholder={"Human Resources, 5100-200\nIT Department, 5200-100\nFinance, 5300-400"}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
              />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeBulk}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleBulkImport}
                  disabled={!bulkText.trim() || bulkLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkLoading ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          ) : bulkResult.parseErrors ? (
            <div className="space-y-4">
              <div className="bg-red-50 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-red-700 mb-2">Fix these errors before importing:</p>
                <ul className="space-y-1">
                  {bulkResult.parseErrors.map((e, i) => (
                    <li key={i} className="text-sm text-red-600 font-mono">{e}</li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-end">
                <button onClick={() => setBulkResult(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Go Back
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {bulkResult.succeeded.length > 0 && (
                <div className="bg-green-50 rounded-lg px-4 py-3">
                  <p className="text-sm font-medium text-green-700 mb-1">{bulkResult.succeeded.length} department{bulkResult.succeeded.length !== 1 ? 's' : ''} added</p>
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
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
                  Done
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {deleteConfirm && (
        <Modal title="Delete Department" onClose={() => setDeleteConfirm(null)} size="sm">
          <p className="text-gray-600 text-sm">
            Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This will also delete all associated charge-out history.
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
