import { useEffect, useState } from 'react';
import { ClipboardList, Package, ShoppingCart, Download } from 'lucide-react';
import * as api from '../lib/api.js';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtDateTime = (ts) => {
  const d = new Date(ts + (ts.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const ACTION_STYLE = {
  CREATE: { badge: 'bg-green-100 text-green-700', label: 'Created' },
  UPDATE: { badge: 'bg-blue-100 text-blue-700',   label: 'Updated' },
  DELETE: { badge: 'bg-red-100 text-red-700',     label: 'Deleted' },
};

const TABLE_LABEL = {
  items:           { label: 'Inventory Item', Icon: Package },
  purchase_orders: { label: 'Purchase Order', Icon: ShoppingCart },
};

function ValuePill({ label, value }) {
  if (value == null || value === '') return null;
  const isPrice = label.toLowerCase().includes('price') || label.toLowerCase().includes('cost');
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">
      <span className="text-gray-400">{label}:</span>
      <span className="font-medium">{isPrice && typeof value === 'number' ? fmt(value) : String(value)}</span>
    </span>
  );
}

function DiffRow({ oldVals, newVals, action }) {
  if (action === 'CREATE' && newVals) {
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {Object.entries(newVals).map(([k, v]) => (
          <ValuePill key={k} label={k.replace(/_/g, ' ')} value={v} />
        ))}
      </div>
    );
  }

  if (action === 'DELETE' && oldVals) {
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {Object.entries(oldVals).map(([k, v]) => (
          <ValuePill key={k} label={k.replace(/_/g, ' ')} value={v} />
        ))}
      </div>
    );
  }

  if (action === 'UPDATE' && oldVals && newVals) {
    const changedKeys = Object.keys(newVals).filter(k => newVals[k] !== oldVals[k]);
    if (changedKeys.length === 0) {
      return <p className="text-xs text-gray-400 mt-1">No field changes detected</p>;
    }
    return (
      <div className="mt-1 space-y-0.5">
        {changedKeys.map(k => (
          <div key={k} className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}:</span>
            <span className="line-through text-gray-400">
              {oldVals[k] == null ? '—' : String(oldVals[k])}
            </span>
            <span className="text-gray-400">→</span>
            <span className="font-medium text-gray-800">
              {newVals[k] == null ? '—' : String(newVals[k])}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

const isoDate = (d) => d.toISOString().slice(0, 10);

const PRESETS = [
  { label: 'Today',        getDates: () => { const t = isoDate(new Date()); return [t, t]; } },
  { label: 'Last 7 days',  getDates: () => { const t = new Date(); const f = new Date(t); f.setDate(f.getDate() - 6); return [isoDate(f), isoDate(t)]; } },
  { label: 'Last 30 days', getDates: () => { const t = new Date(); const f = new Date(t); f.setDate(f.getDate() - 29); return [isoDate(f), isoDate(t)]; } },
  { label: 'This month',   getDates: () => { const t = new Date(); return [isoDate(new Date(t.getFullYear(), t.getMonth(), 1)), isoDate(t)]; } },
  { label: 'Last month',   getDates: () => { const t = new Date(); const f = new Date(t.getFullYear(), t.getMonth() - 1, 1); const e = new Date(t.getFullYear(), t.getMonth(), 0); return [isoDate(f), isoDate(e)]; } },
];

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [auditUsers, setAuditUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [preset, setPreset] = useState('');

  const activeFilters = () => {
    const p = {};
    if (tableFilter)  p.table_name  = tableFilter;
    if (actionFilter) p.action      = actionFilter;
    if (userFilter)   p.changed_by  = userFilter;
    if (dateFrom)     p.date_from   = dateFrom;
    if (dateTo)       p.date_to     = dateTo;
    return p;
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = activeFilters();
      const data = await api.auditLog.list(Object.keys(params).length ? params : undefined);
      setEntries(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Load distinct users once on mount
  useEffect(() => {
    api.auditLog.users().then(setAuditUsers).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [tableFilter, actionFilter, userFilter, dateFrom, dateTo]);

  const applyPreset = (label) => {
    setPreset(label);
    if (!label) { setDateFrom(''); setDateTo(''); return; }
    const found = PRESETS.find(p => p.label === label);
    if (found) { const [f, t] = found.getDates(); setDateFrom(f); setDateTo(t); }
  };

  const handleDateFrom = (val) => { setDateFrom(val); setPreset(''); };
  const handleDateTo   = (val) => { setDateTo(val);   setPreset(''); };

  const handleExport = () => {
    const params = activeFilters();
    window.location.href = api.auditLog.csvUrl(Object.keys(params).length ? params : undefined);
  };

  const clearAll = () => { setTableFilter(''); setActionFilter(''); setUserFilter(''); setDateFrom(''); setDateTo(''); setPreset(''); };
  const hasFilters = tableFilter || actionFilter || userFilter || dateFrom || dateTo;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-500 mt-1">Track changes to inventory items and purchase orders</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={tableFilter}
          onChange={e => setTableFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All resources</option>
          <option value="items">Inventory Items</option>
          <option value="purchase_orders">Purchase Orders</option>
        </select>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All actions</option>
          <option value="CREATE">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
        </select>

        <select
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          disabled={auditUsers.length === 0}
        >
          <option value="">All users</option>
          {auditUsers.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {/* Date range — preset or custom */}
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <select
            value={preset}
            onChange={e => applyPreset(e.target.value)}
            className="text-sm bg-transparent focus:outline-none text-gray-700 pr-1"
          >
            <option value="">Custom range</option>
            {PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
          </select>
          <span className="text-gray-300 select-none">|</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => handleDateFrom(e.target.value)}
            className="text-sm bg-transparent focus:outline-none text-gray-700 w-32"
            placeholder="From"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => handleDateTo(e.target.value)}
            className="text-sm bg-transparent focus:outline-none text-gray-700 w-32"
            placeholder="To"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium px-2"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-500 font-medium">No audit entries yet</p>
            <p className="text-gray-400 text-sm mt-1">Changes to inventory items and purchase orders will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map(entry => {
              const actionStyle = ACTION_STYLE[entry.action] ?? { badge: 'bg-gray-100 text-gray-600', label: entry.action };
              const tableInfo = TABLE_LABEL[entry.table_name] ?? { label: entry.table_name, Icon: ClipboardList };
              const { Icon } = tableInfo;

              return (
                <div key={entry.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon size={15} className="text-gray-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${actionStyle.badge}`}>
                        {actionStyle.label}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{tableInfo.label}</span>
                      {entry.changed_by && (
                        <span className="text-xs text-gray-500">
                          by{' '}
                          <button
                            className="font-medium text-gray-700 hover:text-brand-600 transition-colors"
                            onClick={() => setUserFilter(entry.changed_by)}
                          >
                            {entry.changed_by}
                          </button>
                        </span>
                      )}
                    </div>

                    <DiffRow oldVals={entry.old_values} newVals={entry.new_values} action={entry.action} />
                  </div>

                  <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5 whitespace-nowrap">
                    {fmtDateTime(entry.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
