const router = require('express').Router();
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Helper: check if user has access to a project
async function hasProjectAccess(userId, projectId, role) {
  if (role === 'admin') return true;
  const result = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
  return result.rows.length > 0;
}

// GET /api/tasks - get tasks (filtered by project, status, priority, assignee)
router.get('/', async (req, res) => {
  const { project_id, status, priority, assigned_to } = req.query;

  try {
    let conditions = [];
    let params = [];
    let idx = 1;

    // Role-based filter: members only see tasks in their projects
    if (req.user.role !== 'admin') {
      conditions.push(`p.id IN (SELECT project_id FROM project_members WHERE user_id = $${idx})`);
      params.push(req.user.id);
      idx++;
    }

    if (project_id) { conditions.push(`t.project_id = $${idx}`); params.push(project_id); idx++; }
    if (status) { conditions.push(`t.status = $${idx}`); params.push(status); idx++; }
    if (priority) { conditions.push(`t.priority = $${idx}`); params.push(priority); idx++; }
    if (assigned_to) { conditions.push(`t.assigned_to = $${idx}`); params.push(assigned_to); idx++; }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await pool.query(`
      SELECT t.*,
        p.name AS project_name, p.color AS project_color,
        u.name AS assigned_to_name, u.avatar AS assigned_to_avatar, u.color AS assigned_to_color,
        cu.name AS created_by_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN users cu ON cu.id = t.created_by
      ${where}
      ORDER BY
        CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/stats - dashboard stats for current user
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE t.assigned_to = $1) AS my_tasks,
        COUNT(*) FILTER (WHERE t.assigned_to = $1 AND t.status = 'done') AS my_done,
        COUNT(*) FILTER (WHERE t.assigned_to = $1 AND t.status = 'in-progress') AS my_in_progress,
        COUNT(*) FILTER (WHERE t.assigned_to = $1 AND t.status != 'done' AND t.due_date < CURRENT_DATE) AS my_overdue,
        COUNT(*) AS total_tasks,
        COUNT(*) FILTER (WHERE t.status = 'done') AS total_done
      FROM tasks t
      JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $1
    `, [req.user.id]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/tasks/:id - get single task
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, p.name AS project_name,
        u.name AS assigned_to_name, u.avatar AS assigned_to_avatar
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    const task = result.rows[0];
    const access = await hasProjectAccess(req.user.id, task.project_id, req.user.role);
    if (!access) return res.status(403).json({ error: 'Access denied' });

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// POST /api/tasks - create task
router.post('/', async (req, res) => {
  const { title, description, status, priority, due_date, project_id, assigned_to } = req.body;

  if (!title || !title.trim()) return res.status(400).json({ error: 'Task title is required' });
  if (!project_id) return res.status(400).json({ error: 'Project ID is required' });

  const validStatus = ['todo', 'in-progress', 'done'];
  const validPriority = ['high', 'medium', 'low'];
  if (status && !validStatus.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (priority && !validPriority.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });

  try {
    const access = await hasProjectAccess(req.user.id, project_id, req.user.role);
    if (!access) return res.status(403).json({ error: 'You are not a member of this project' });

    const result = await pool.query(`
      INSERT INTO tasks (title, description, status, priority, due_date, project_id, assigned_to, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      title.trim(),
      description || null,
      status || 'todo',
      priority || 'medium',
      due_date || null,
      project_id,
      assigned_to || req.user.id,
      req.user.id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - update task
router.put('/:id', async (req, res) => {
  const { title, description, status, priority, due_date, assigned_to, project_id } = req.body;

  try {
    // Get existing task
    const existing = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    const task = existing.rows[0];

    // Check permission: admin, creator, or assignee can edit
    const canEdit = req.user.role === 'admin'
      || task.created_by === req.user.id
      || task.assigned_to === req.user.id;
    if (!canEdit) return res.status(403).json({ error: 'You cannot edit this task' });

    const result = await pool.query(`
      UPDATE tasks SET
        title       = COALESCE($1, title),
        description = COALESCE($2, description),
        status      = COALESCE($3, status),
        priority    = COALESCE($4, priority),
        due_date    = COALESCE($5, due_date),
        assigned_to = COALESCE($6, assigned_to),
        updated_at  = NOW()
      WHERE id = $7
      RETURNING *
    `, [
      title?.trim() || null,
      description !== undefined ? description : null,
      status || null,
      priority || null,
      due_date || null,
      assigned_to || null,
      req.params.id
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// PATCH /api/tasks/:id/status - quick status update
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const validStatus = ['todo', 'in-progress', 'done'];
  if (!validStatus.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    const result = await pool.query(
      'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/tasks/:id - delete task (admin or creator)
router.delete('/:id', async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    const task = existing.rows[0];
    const canDelete = req.user.role === 'admin' || task.created_by === req.user.id;
    if (!canDelete) return res.status(403).json({ error: 'You cannot delete this task' });

    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Task deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
