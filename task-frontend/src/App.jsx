import { useState, useEffect, useCallback } from 'react'
import { api } from './api.js'

// ─── Token helpers ────────────────────────────────────
const saveToken = (t) => localStorage.setItem('taskflow_token', t)
const clearToken = () => localStorage.removeItem('taskflow_token')
const hasToken = () => !!localStorage.getItem('taskflow_token')

// ─── Tiny helpers ─────────────────────────────────────
const isOverdue = (task) =>
  task.status !== 'done' && task.due_date && new Date(task.due_date) < new Date()

const STATUS_LABEL = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' }
const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' }
const AVATAR_COLORS = ['#6c63ff','#22c55e','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#ec4899']

function Avatar({ user, size = 28 }) {
  if (!user) return null
  const color = user.color || AVATAR_COLORS[0]
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: color }}>
      {user.avatar || '?'}
    </div>
  )
}

function Badge({ type, text }) {
  return <span className={`badge badge-${type}`}>{text}</span>
}

function Spinner() {
  return <div className="loading"><div className="spinner" /><span>Loading...</span></div>
}

// ─── Modal wrapper ────────────────────────────────────
function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ─── AUTH SCREEN ─────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleLogin() {
    if (!form.email || !form.password) return setErr('Email and password required.')
    setLoading(true); setErr('')
    try {
      const res = await api.auth.login(form.email, form.password)
      saveToken(res.token)
      onLogin(res.user)
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  async function handleSignup() {
    if (!form.name || !form.email || !form.password) return setErr('All fields are required.')
    if (form.password.length < 6) return setErr('Password must be at least 6 characters.')
    setLoading(true); setErr('')
    try {
      const res = await api.auth.signup(form.name, form.email, form.password, form.role)
      saveToken(res.token)
      onLogin(res.user)
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  const onKey = fn => e => e.key === 'Enter' && fn()

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">⚡ TaskFlow</div>
        <p className="auth-tagline">Team task management, simplified.</p>
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setErr('') }}>Sign In</button>
          <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setErr('') }}>Sign Up</button>
        </div>

        {tab === 'login' ? (
          <>
            <div className="form-group"><label>Email</label><input type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} onKeyDown={onKey(handleLogin)} /></div>
            <div className="form-group"><label>Password</label><input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} onKeyDown={onKey(handleLogin)} /></div>
            {err && <div className="error-msg">{err}</div>}
            <button className="auth-btn" onClick={handleLogin} disabled={loading}>{loading ? 'Signing in...' : 'Sign In →'}</button>
          </>
        ) : (
          <>
            <div className="form-group"><label>Full Name</label><input type="text" placeholder="Your name" value={form.name} onChange={set('name')} /></div>
            <div className="form-group"><label>Email</label><input type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} /></div>
            <div className="form-group"><label>Password</label><input type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} /></div>
            <div className="form-group">
              <label>Role</label>
              <select value={form.role} onChange={set('role')}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {err && <div className="error-msg">{err}</div>}
            <button className="auth-btn" onClick={handleSignup} disabled={loading}>{loading ? 'Creating account...' : 'Create Account →'}</button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── TASK MODAL ───────────────────────────────────────
function TaskModal({ onClose, onSave, task, projects, users, currentUser, defaultProjectId }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assigned_to: task?.assigned_to || currentUser.id,
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    project_id: task?.project_id || defaultProjectId || projects[0]?.id || '',
    due_date: task?.due_date ? task.due_date.split('T')[0] : ''
  })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const proj = projects.find(p => p.id == form.project_id)
  const members = proj
    ? users.filter(u => proj.members?.some(m => m.id == u.id))
    : users

  async function save() {
    if (!form.title.trim()) return
    setLoading(true)
    await onSave(form)
    setLoading(false)
  }

  return (
    <Modal title={task ? 'Edit Task' : 'New Task'} onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save Task'}</button>
      </>
    }>
      <div className="form-group"><label>Title</label><input type="text" placeholder="Task title..." value={form.title} onChange={set('title')} /></div>
      <div className="form-group"><label>Description</label><textarea placeholder="Details..." value={form.description} onChange={set('description')} /></div>
      <div className="grid2">
        <div className="form-group">
          <label>Project</label>
          <select value={form.project_id} onChange={set('project_id')}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Assign To</label>
          <select value={form.assigned_to} onChange={set('assigned_to')}>
            {(members.length ? members : users).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid2">
        <div className="form-group">
          <label>Status</label>
          <select value={form.status} onChange={set('status')}>
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div className="form-group">
          <label>Priority</label>
          <select value={form.priority} onChange={set('priority')}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      <div className="form-group"><label>Due Date</label><input type="date" value={form.due_date} onChange={set('due_date')} /></div>
    </Modal>
  )
}

// ─── PROJECT MODAL ────────────────────────────────────
function ProjectModal({ onClose, onSave, users, currentUser }) {
  const [form, setForm] = useState({ name: '', description: '', members: [currentUser.id] })
  const [loading, setLoading] = useState(false)

  const toggle = uid => {
    if (uid == currentUser.id) return
    setForm(f => ({
      ...f,
      members: f.members.includes(uid) ? f.members.filter(x => x !== uid) : [...f.members, uid]
    }))
  }

  async function save() {
    if (!form.name.trim()) return
    setLoading(true)
    await onSave(form)
    setLoading(false)
  }

  return (
    <Modal title="New Project" onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Creating...' : 'Create Project'}</button>
      </>
    }>
      <div className="form-group"><label>Project Name</label><input type="text" placeholder="e.g. Website Redesign" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
      <div className="form-group"><label>Description</label><textarea placeholder="What is this project about?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
      <div className="form-group">
        <label>Add Members</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {users.map(u => (
            <div key={u.id} onClick={() => toggle(u.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
              borderRadius: 6, cursor: u.id == currentUser.id ? 'default' : 'pointer',
              border: `1px solid ${form.members.includes(u.id) ? 'var(--accent)' : 'var(--border)'}`,
              background: form.members.includes(u.id) ? 'var(--accent-bg)' : 'transparent'
            }}>
              <Avatar user={u} size={22} />
              <span style={{ fontSize: 13 }}>{u.name}</span>
              {u.id == currentUser.id && <span style={{ fontSize: 11, color: 'var(--text3)' }}>(you)</span>}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ─── DASHBOARD ────────────────────────────────────────
function Dashboard({ currentUser, onNav, projects, tasks, users }) {
  const myTasks = tasks.filter(t => t.assigned_to == currentUser.id)
  const total = myTasks.length
  const done = myTasks.filter(t => t.status === 'done').length
  const inProg = myTasks.filter(t => t.status === 'in-progress').length
  const overdue = myTasks.filter(isOverdue).length
  const myProjects = projects.filter(p => p.members?.some(m => m.id == currentUser.id))
  const recent = [...tasks].reverse().slice(0, 6)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Welcome back, {currentUser.name.split(' ')[0]} 👋</div>
          <div className="page-sub">Here's what's happening across your projects</div>
        </div>
      </div>
      <div className="content">
        <div className="stats">
          <div className="stat"><div className="stat-label">My Tasks</div><div className="stat-val" style={{ color: 'var(--accent2)' }}>{total}</div><div className="stat-sub">assigned to you</div></div>
          <div className="stat"><div className="stat-label">In Progress</div><div className="stat-val" style={{ color: 'var(--blue)' }}>{inProg}</div><div className="stat-sub">active now</div></div>
          <div className="stat"><div className="stat-label">Completed</div><div className="stat-val" style={{ color: 'var(--green)' }}>{done}</div><div className="stat-sub">finished</div></div>
          <div className="stat"><div className="stat-label">Overdue</div><div className="stat-val" style={{ color: 'var(--red)' }}>{overdue}</div><div className="stat-sub">need attention</div></div>
        </div>

        <div className="grid2" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">My Projects</div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNav('projects')}>View all</button>
            </div>
            <div className="card-body">
              {myProjects.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>No projects yet</div>}
              {myProjects.map(p => {
                const ptasks = tasks.filter(t => t.project_id == p.id)
                const pdone = ptasks.filter(t => t.status === 'done').length
                const pct = ptasks.length ? Math.round(pdone / ptasks.length * 100) : 0
                return (
                  <div key={p.id} style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => onNav('tasks', p.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color || 'var(--accent)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                      <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 'auto' }}>{pdone}/{ptasks.length}</span>
                    </div>
                    <div className="progress"><div className="progress-fill" style={{ width: pct + '%', background: p.color || 'var(--accent)' }} /></div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent Tasks</div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNav('tasks')}>All tasks</button>
            </div>
            <div className="card-body">
              {recent.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>No tasks yet</div>}
              {recent.map(t => {
                const u = users.find(x => x.id == t.assigned_to)
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Avatar user={u} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.project_name}</div>
                    </div>
                    <Badge type={t.status} text={STATUS_LABEL[t.status]} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PROJECTS PAGE ────────────────────────────────────
function ProjectsPage({ currentUser, onSelectProject, projects, tasks, users, onProjectCreated }) {
  const [showModal, setShowModal] = useState(false)

  async function createProject(form) {
    try {
      await api.projects.create(form)
      setShowModal(false)
      onProjectCreated()
    } catch (e) { alert(e.message) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Projects</div>
          <div className="page-sub">{projects.length} project{projects.length !== 1 ? 's' : ''}</div>
        </div>
        {currentUser.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Project</button>
        )}
      </div>
      <div className="content">
        {projects.length === 0 ? (
          <div className="empty"><div className="empty-icon">📁</div><h3>No projects yet</h3><p>Create your first project to get started</p></div>
        ) : (
          <div className="grid3">
            {projects.map(p => {
              const ptasks = tasks.filter(t => t.project_id == p.id)
              const pdone = ptasks.filter(t => t.status === 'done').length
              const pct = ptasks.length ? Math.round(pdone / ptasks.length * 100) : 0
              const members = p.members || []
              return (
                <div key={p.id} className="proj-card" onClick={() => onSelectProject(p.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: p.color || 'var(--accent)' }} />
                    <span className="badge badge-member" style={{ marginLeft: 'auto' }}>{members.length} members</span>
                  </div>
                  <div className="proj-name">{p.name}</div>
                  <div className="proj-desc">{p.description || 'No description'}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                    <span>{ptasks.length} tasks</span>
                    <span>{pdone} done</span>
                    <span style={{ color: 'var(--red)' }}>{ptasks.filter(isOverdue).length} overdue</span>
                  </div>
                  <div className="progress"><div className="progress-fill" style={{ width: pct + '%', background: p.color || 'var(--accent)' }} /></div>
                  <div style={{ display: 'flex', marginTop: 10 }}>
                    {members.slice(0, 4).map((m, i) => (
                      <div key={m.id} style={{ marginLeft: i ? -6 : 0 }}><Avatar user={m} size={24} /></div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {showModal && <ProjectModal onClose={() => setShowModal(false)} onSave={createProject} users={users} currentUser={currentUser} />}
    </div>
  )
}

// ─── TASKS PAGE ───────────────────────────────────────
function TasksPage({ currentUser, filterProjectId, projects, users, tasks, onTasksChanged }) {
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [filter, setFilter] = useState({ status: 'all', priority: 'all', assignee: 'all', project: filterProjectId || 'all' })

  const proj = filterProjectId ? projects.find(p => p.id == filterProjectId) : null
  const canEdit = t => currentUser.role === 'admin' || t.created_by == currentUser.id || t.assigned_to == currentUser.id

  let filtered = tasks
  if (filter.project !== 'all') filtered = filtered.filter(t => t.project_id == filter.project)
  if (filter.status === 'overdue') filtered = filtered.filter(isOverdue)
  else if (filter.status !== 'all') filtered = filtered.filter(t => t.status === filter.status)
  if (filter.priority !== 'all') filtered = filtered.filter(t => t.priority === filter.priority)
  if (filter.assignee !== 'all') filtered = filtered.filter(t => t.assigned_to == filter.assignee)

  async function saveTask(form) {
    try {
      if (editTask) {
        await api.tasks.update(editTask.id, form)
      } else {
        await api.tasks.create(form)
      }
      setShowModal(false); setEditTask(null)
      onTasksChanged()
    } catch (e) { alert(e.message) }
  }

  async function deleteTask(t) {
    if (!window.confirm('Delete this task?')) return
    try { await api.tasks.delete(t.id); onTasksChanged() }
    catch (e) { alert(e.message) }
  }

  async function toggleDone(t) {
    const next = t.status === 'done' ? 'todo' : 'done'
    try { await api.tasks.setStatus(t.id, next); onTasksChanged() }
    catch (e) { alert(e.message) }
  }

  const setF = k => e => setFilter(f => ({ ...f, [k]: e.target.value }))

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{proj ? proj.name : 'All Tasks'}</div>
          <div className="page-sub">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditTask(null); setShowModal(true) }}>+ New Task</button>
      </div>
      <div className="content">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <select value={filter.status} onChange={setF('status')} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
            <option value="all">All Status</option>
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
            <option value="overdue">Overdue</option>
          </select>
          <select value={filter.priority} onChange={setF('priority')} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
            <option value="all">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {!filterProjectId && (
            <select value={filter.project} onChange={setF('project')} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <select value={filter.assignee} onChange={setF('assignee')} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
            <option value="all">All Members</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {/* Task list */}
        {filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">✅</div><h3>No tasks found</h3><p>Create a task or adjust your filters</p></div>
        ) : (
          filtered.map(t => {
            const assignee = users.find(u => u.id == t.assigned_to)
            const over = isOverdue(t)
            return (
              <div key={t.id} className="task-item">
                <div className={`task-check ${t.status === 'done' ? 'done' : ''}`} onClick={() => toggleDone(t)}>
                  {t.status === 'done' && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                </div>
                <div className="task-body">
                  <div className={`task-title-text ${t.status === 'done' ? 'done' : ''}`}>{t.title}</div>
                  {t.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t.description}</div>}
                  <div className="task-meta">
                    <Badge type={over ? 'overdue' : t.status} text={over ? 'Overdue' : STATUS_LABEL[t.status]} />
                    <Badge type={t.priority} text={PRIORITY_LABEL[t.priority]} />
                    {t.project_name && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t.project_name}</span>}
                    {t.due_date && <span style={{ fontSize: 12, color: over ? 'var(--red)' : 'var(--text3)' }}>Due {t.due_date?.split('T')[0]}</span>}
                    {assignee && <Avatar user={assignee} size={20} />}
                  </div>
                </div>
                {canEdit(t) && (
                  <div className="task-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditTask(t); setShowModal(true) }}>Edit</button>
                    {(currentUser.role === 'admin' || t.created_by == currentUser.id) && (
                      <button className="btn btn-danger btn-sm" onClick={() => deleteTask(t)}>Del</button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {showModal && (
        <TaskModal
          onClose={() => { setShowModal(false); setEditTask(null) }}
          onSave={saveTask}
          task={editTask}
          projects={projects}
          users={users}
          currentUser={currentUser}
          defaultProjectId={filterProjectId}
        />
      )}
    </div>
  )
}

// ─── TEAM PAGE ────────────────────────────────────────
function TeamPage({ users, tasks }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Team Members</div>
          <div className="page-sub">{users.length} members</div>
        </div>
      </div>
      <div className="content">
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Member</th><th>Email</th><th>Role</th><th>Tasks</th><th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const myT = tasks.filter(t => t.assigned_to == u.id)
                const done = myT.filter(t => t.status === 'done').length
                const pct = myT.length ? Math.round(done / myT.length * 100) : 0
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar user={u} size={30} />
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><Badge type={u.role} text={u.role} /></td>
                    <td>{myT.length}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress" style={{ flex: 1 }}><div className="progress-fill" style={{ width: pct + '%' }} /></div>
                        <span style={{ fontSize: 12, color: 'var(--text2)', minWidth: 36 }}>{done}/{myT.length}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── APP SHELL ────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [selectedProject, setSelectedProject] = useState(null)
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [booting, setBooting] = useState(true)

  // On mount: try to restore session from token
  useEffect(() => {
    if (hasToken()) {
      api.auth.me()
        .then(user => { setCurrentUser(user) })
        .catch(() => { clearToken() })
        .finally(() => setBooting(false))
    } else {
      setBooting(false)
    }
  }, [])

  // Load all data whenever user changes
  const loadData = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const [p, t, u] = await Promise.all([
        api.projects.list(),
        api.tasks.list(),
        api.users.list()
      ])
      setProjects(p)
      setTasks(t)
      setUsers(u)
    } catch (e) {
      console.error('Load error:', e.message)
    }
    setLoading(false)
  }, [currentUser])

  useEffect(() => { loadData() }, [loadData])

  function handleLogin(user) {
    setCurrentUser(user)
    setPage('dashboard')
  }

  function handleLogout() {
    clearToken()
    setCurrentUser(null)
    setProjects([]); setTasks([]); setUsers([])
    setPage('dashboard')
  }

  function nav(p, projId = null) {
    setPage(p)
    setSelectedProject(projId)
  }

  if (booting) return <div className="loading" style={{ minHeight: '100vh' }}><div className="spinner" /><span>Loading...</span></div>
  if (!currentUser) return <AuthScreen onLogin={handleLogin} />

  const navItems = [
    { id: 'dashboard', icon: '⊞', label: 'Dashboard' },
    { id: 'projects', icon: '📁', label: 'Projects' },
    { id: 'tasks', icon: '✓', label: 'All Tasks' },
    ...(currentUser.role === 'admin' ? [{ id: 'team', icon: '👥', label: 'Team' }] : [])
  ]

  let pageContent
  if (loading) {
    pageContent = <Spinner />
  } else if (page === 'dashboard') {
    pageContent = <Dashboard currentUser={currentUser} onNav={nav} projects={projects} tasks={tasks} users={users} />
  } else if (page === 'projects') {
    pageContent = <ProjectsPage currentUser={currentUser} onSelectProject={id => nav('tasks', id)} projects={projects} tasks={tasks} users={users} onProjectCreated={loadData} />
  } else if (page === 'tasks') {
    pageContent = <TasksPage currentUser={currentUser} filterProjectId={selectedProject} projects={projects} tasks={tasks} users={users} onTasksChanged={loadData} />
  } else if (page === 'team') {
    pageContent = <TeamPage users={users} tasks={tasks} />
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo"><h1>⚡ TaskFlow</h1><span>Team Task Manager</span></div>
        <nav className="nav">
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => nav(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-pill">
            <Avatar user={currentUser} />
            <div className="user-info">
              <div className="user-name">{currentUser.name}</div>
              <div className="user-role">{currentUser.role}</div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">→</button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="main">{pageContent}</div>
    </div>
  )
}
