const router = require('express').Router();
const { pool } = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// All project routes require auth
router.use(authMiddleware);

// GET /api/projects - get all projects for current user
router.get('/', async (req, res) => {
  try {
    let query, params;

    if (req.user.role === 'admin') {
      // Admins see all projects
      query = `
        SELECT p.*,
          u.name AS created_by_name,
          json_agg(DISTINCT jsonb_build_object('id', usr.id, 'name', usr.name, 'email', usr.email, 'avatar', usr.avatar, 'color', usr.color)) AS members
        FROM projects p
        JOIN users u ON u.id = p.created_by
        LEFT JOIN project_members pm ON pm.project_id = p.id
        LEFT JOIN users usr ON usr.id = pm.user_id
        GROUP BY p.id, u.name
        ORDER BY p.created_at DESC
      `;
      params = [];
    } else {
      // Members only see their projects
      query = `
        SELECT p.*,
          u.name AS created_by_name,
          json_agg(DISTINCT jsonb_build_object('id', usr.id, 'name', usr.name, 'email', usr.email, 'avatar', usr.avatar, 'color', usr.color)) AS members
        FROM projects p
        JOIN users u ON u.id = p.created_by
        JOIN project_members pm2 ON pm2.project_id = p.id AND pm2.user_id = $1
        LEFT JOIN project_members pm ON pm.project_id = p.id
        LEFT JOIN users usr ON usr.id = pm.user_id
        GROUP BY p.id, u.name
        ORDER BY p.created_at DESC
      `;
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id - get single project
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name AS created_by_name,
        json_agg(DISTINCT jsonb_build_object('id', usr.id, 'name', usr.name, 'avatar', usr.avatar, 'color', usr.color)) AS members
       FROM projects p
       JOIN users u ON u.id = p.created_by
       LEFT JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN users usr ON usr.id = pm.user_id
       WHERE p.id = $1
       GROUP BY p.id, u.name`,
      [req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const project = result.rows[0];

    // Check access: admin or member of project
    const isMember = project.members.some(m => m.id === req.user.id);
    if (req.user.role !== 'admin' && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects - create project (admin only)
router.post('/', adminOnly, async (req, res) => {
  const { name, description, color, members } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const projectResult = await client.query(
      `INSERT INTO projects (name, description, color, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), description || null, color || '#6c63ff', req.user.id]
    );

    const project = projectResult.rows[0];

    // Add members (always include creator)
    const memberIds = [...new Set([req.user.id, ...(members || [])])];
    for (const userId of memberIds) {
      await client.query(
        'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [project.id, userId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(project);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  } finally {
    client.release();
  }
});

// PUT /api/projects/:id - update project (admin only)
router.put('/:id', adminOnly, async (req, res) => {
  const { name, description, color, members } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE projects SET name = COALESCE($1, name), description = COALESCE($2, description),
       color = COALESCE($3, color) WHERE id = $4 RETURNING *`,
      [name || null, description || null, color || null, req.params.id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }

    // Update members if provided
    if (members) {
      await client.query('DELETE FROM project_members WHERE project_id = $1', [req.params.id]);
      const memberIds = [...new Set([req.user.id, ...members])];
      for (const userId of memberIds) {
        await client.query(
          'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, userId]
        );
      }
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update project' });
  } finally {
    client.release();
  }
});

// DELETE /api/projects/:id - delete project (admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
