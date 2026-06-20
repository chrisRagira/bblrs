const BASE = '/api';

function token() { return localStorage.getItem('token'); }

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...opts.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  login:    (email, password)  => req('/auth/login',    { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password)  => req('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  keys:     ()                 => req('/keys'),
  createKey:(label,location)   => req('/keys',          { method: 'POST', body: JSON.stringify({ label,location }) }),
  revokeKey:(id)               => req(`/keys/${id}`,    { method: 'DELETE' }),
  usage:    ()                 => req('/usage'),
  proxyNodes:()                 => req('/nodes'),
  history:  ()                 => req('/usage/history'),
};

export function saveToken(t) { localStorage.setItem('token', t); }
export function clearToken()  { localStorage.removeItem('token'); localStorage.removeItem('user'); }
export function saveUser(u)   { localStorage.setItem('user', JSON.stringify(u)); }
export function getUser()     {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}
export function isLoggedIn()  { return !!token(); }