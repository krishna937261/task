// Central API layer — all backend calls go through here
const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('taskflow_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const get  = (path)        => request('GET', path);
const post = (path, body)  => request('POST', path, body);
const put  = (path, body)  => request('PUT', path, body);
const patch= (path, body)  => request('PATCH', path, body);
const del  = (path)        => request('DELETE', path);

// ─── Auth ─────────────────────────────────────────────
export const api = {
  auth: {
    login:   (email, password)      => post('/auth/login', { email, password }),
    signup:  (name, email, password, role) => post('/auth/signup', { name, email, password, role }),
    me:      ()                     => get('/auth/me'),
  },

  // ─── Projects ───────────────────────────────────────
  projects: {
    list:    ()           => get('/projects'),
    get:     (id)         => get(`/projects/${id}`),
    create:  (data)       => post('/projects', data),
    update:  (id, data)   => put(`/projects/${id}`, data),
    delete:  (id)         => del(`/projects/${id}`),
  },

  // ─── Tasks ──────────────────────────────────────────
  tasks: {
    list:    (filters={}) => {
      const q = new URLSearchParams(filters).toString();
      return get(`/tasks${q ? '?' + q : ''}`);
    },
    stats:   ()                   => get('/tasks/stats'),
    get:     (id)                 => get(`/tasks/${id}`),
    create:  (data)               => post('/tasks', data),
    update:  (id, data)           => put(`/tasks/${id}`, data),
    setStatus: (id, status)       => patch(`/tasks/${id}/status`, { status }),
    delete:  (id)                 => del(`/tasks/${id}`),
  },

  // ─── Users ──────────────────────────────────────────
  users: {
    list:    ()           => get('/users'),
    get:     (id)         => get(`/users/${id}`),
    setRole: (id, role)   => put(`/users/${id}/role`, { role }),
    delete:  (id)         => del(`/users/${id}`),
  }
};
