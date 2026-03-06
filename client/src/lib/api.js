import { getUser } from './auth.js';

const BASE = '/api';

async function request(method, path, body) {
  const user = getUser();
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (user?.name) headers['X-Changed-By'] = user.name;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

export const users = {
  list: () => request('GET', '/users'),
  create: (data) => request('POST', '/users', data),
  delete: (id) => request('DELETE', `/users/${id}`),
  login: (pin) => request('POST', '/users/login', { pin }),
  getLockout: () => request('GET', '/users/lockout'),
  resetLockout: () => request('DELETE', '/users/lockout'),
};

export const items = {
  list: () => request('GET', '/items'),
  create: (data) => request('POST', '/items', data),
  update: (id, data) => request('PUT', `/items/${id}`, data),
  delete: (id) => request('DELETE', `/items/${id}`),
};

export const departments = {
  list: () => request('GET', '/departments'),
  create: (data) => request('POST', '/departments', data),
  update: (id, data) => request('PUT', `/departments/${id}`, data),
  delete: (id) => request('DELETE', `/departments/${id}`),
};

export const purchaseOrders = {
  list: (params) => request('GET', `/purchase-orders${params ? '?' + new URLSearchParams(params) : ''}`),
  create: (data) => request('POST', '/purchase-orders', data),
  delete: (id) => request('DELETE', `/purchase-orders/${id}`),
};

export const chargeOuts = {
  list: (params) => request('GET', `/charge-outs${params ? '?' + new URLSearchParams(params) : ''}`),
  create: (data) => request('POST', '/charge-outs', data),
  bulkCreate: (data) => request('POST', '/charge-outs/bulk', data),
  delete: (id) => request('DELETE', `/charge-outs/${id}`),
};

export const printers = {
  list:   ()         => request('GET',    '/printers'),
  create: (data)     => request('POST',   '/printers', data),
  update: (id, data) => request('PUT',    `/printers/${id}`, data),
  delete: (id)       => request('DELETE', `/printers/${id}`),
};

export const toner = {
  list:    (params)  => request('GET',    `/toner${params ? '?' + new URLSearchParams(params) : ''}`),
  create:  (data)    => request('POST',   '/toner', data),
  update:  (id, data)=> request('PUT',    `/toner/${id}`, data),
  delete:  (id)      => request('DELETE', `/toner/${id}`),
  restock: (id, data)=> request('POST',   `/toner/${id}/restock`, data),
};

export const tonerChargeOuts = {
  list:       (params) => request('GET',    `/toner-charge-outs${params ? '?' + new URLSearchParams(params) : ''}`),
  create:     (data)   => request('POST',   '/toner-charge-outs', data),
  bulkCreate: (data)   => request('POST',   '/toner-charge-outs/bulk', data),
  delete:     (id)     => request('DELETE', `/toner-charge-outs/${id}`),
};

export const glSwaps = {
  list:   (params) => request('GET', `/gl-swaps${params ? '?' + new URLSearchParams(params) : ''}`),
  create: (data)   => request('POST', '/gl-swaps', data),
  delete: (id)     => request('DELETE', `/gl-swaps/${id}`),
  csvUrl: (month, year) => `${BASE}/gl-swaps/csv?month=${month}&year=${year}`,
};

export const reports = {
  monthly: (month, year) => request('GET', `/reports/monthly?month=${month}&year=${year}`),
  csvUrl: (month, year) => `${BASE}/reports/monthly/csv?month=${month}&year=${year}`,
};

export const loanerComputers = {
  list: () => request('GET', '/loaner-computers'),
  create: (data) => request('POST', '/loaner-computers', data),
  update: (id, data) => request('PUT', `/loaner-computers/${id}`, data),
  remove: (id) => request('DELETE', `/loaner-computers/${id}`),
};

export const loaners = {
  list: (params) => request('GET', `/loaners${params ? '?' + new URLSearchParams(params) : ''}`),
  create: (data) => request('POST', '/loaners', data),
  update: (id, data) => request('PUT', `/loaners/${id}`, data),
  logReturn: (id, data) => request('PUT', `/loaners/${id}/return`, data),
  remove: (id) => request('DELETE', `/loaners/${id}`),
};

export const auditLog = {
  list:    (params) => request('GET', `/audit-log${params ? '?' + new URLSearchParams(params) : ''}`),
  users:   ()       => request('GET', '/audit-log/users'),
  csvUrl:  (params) => `${BASE}/audit-log/csv${params ? '?' + new URLSearchParams(params) : ''}`,
};
