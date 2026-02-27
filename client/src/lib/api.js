const BASE = '/api';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
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
  delete: (id) => request('DELETE', `/charge-outs/${id}`),
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
