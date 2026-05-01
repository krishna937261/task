const router = require('express').Router();
const { pool } = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/users - get all users (admin sees all, members see project teammates)
router.get('/', async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query(`
        SELECT u.id, u.name, u.email, u.role, u.avatar, u.color, u.created_at,
          COUNT(t.id) AS tasks_assigned,
          COUNT(t.id) FILTER (WHERE t.status = 'done') AS tasks_done
        FROM users u
        LEFT JOIN tasks t ON t.assigned_to = u.id
        GROUP BY u.id
        ORDER BY u.created_at ASC
      `);
    } else {
      // Members only see teammates from shared projects
      result = await pool.query(`
        SELECT DISTINCT u.id, u.name, u.email, u.role, u.avatar, u.color
        FROM users u
        JOIN project_members pm ON pm.user_id = u.id
        WHERE pm.project_id IN (
          SELECT project_id FROM project_members WHERE user_id = $1
        )
        ORDER BY u.name
      `, [req.user.id]);
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id - get user by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, avatar, color, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/users/:id/role - change user role (admin only)
router.put('/:id/role', adminOnly, async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or member' });
  }
  try {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
      [role, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/users/:id - delete user (admin only, cannot delete self)
router.delete('/:id', adminOnly, async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
