import { Router } from 'express'
import { pool } from '../db/pool.js'

const router = Router()

// Helper — formats a DB row into the engine response shape
function formatEngine(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    connectedAt: row.connected_at ?? undefined,
    lastSeen: row.last_seen ?? undefined,
  }
}

/**
 * POST /api/engines
 * Register a new engine instance.
 * Body: { name: string }
 * Returns the created engine with its UUID token.
 */
router.post('/', async (req, res) => {
  const { name } = req.body

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  const client = await pool.connect()
  try {
    const result = await client.query(
      `INSERT INTO engines (name, status, connected_at, last_seen)
       VALUES ($1, 'connected', NOW(), NOW())
       RETURNING *`,
      [name.trim()]
    )
    res.status(201).json(formatEngine(result.rows[0]))
  } catch (error) {
    console.error('Register engine error:', error)
    res.status(500).json({ error: 'Failed to register engine' })
  } finally {
    client.release()
  }
})

/**
 * GET /api/engines
 * List all registered engine instances.
 */
router.get('/', async (_req, res) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      'SELECT * FROM engines ORDER BY connected_at DESC'
    )
    res.json(result.rows.map(formatEngine))
  } catch (error) {
    console.error('List engines error:', error)
    res.status(500).json({ error: 'Failed to list engines' })
  } finally {
    client.release()
  }
})

/**
 * GET /api/engines/:id
 * Get a single engine by its UUID.
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const client = await pool.connect()
  try {
    const result = await client.query('SELECT * FROM engines WHERE id = $1', [id])
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Engine not found' })
      return
    }
    res.json(formatEngine(result.rows[0]))
  } catch (error) {
    console.error('Get engine error:', error)
    res.status(500).json({ error: 'Failed to get engine' })
  } finally {
    client.release()
  }
})

/**
 * POST /api/engines/:id/heartbeat
 * Engine calls this to signal it is still alive.
 * Updates lastSeen and sets status to 'connected'.
 */
router.post('/:id/heartbeat', async (req, res) => {
  const { id } = req.params
  const client = await pool.connect()
  try {
    const result = await client.query(
      `UPDATE engines
       SET status = 'connected', last_seen = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Engine not found' })
      return
    }
    res.json(formatEngine(result.rows[0]))
  } catch (error) {
    console.error('Heartbeat error:', error)
    res.status(500).json({ error: 'Failed to update heartbeat' })
  } finally {
    client.release()
  }
})

/**
 * POST /api/engines/:id/disconnect
 * Mark an engine as disconnected.
 */
router.post('/:id/disconnect', async (req, res) => {
  const { id } = req.params
  const client = await pool.connect()
  try {
    const result = await client.query(
      `UPDATE engines
       SET status = 'disconnected', last_seen = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Engine not found' })
      return
    }
    res.json(formatEngine(result.rows[0]))
  } catch (error) {
    console.error('Disconnect engine error:', error)
    res.status(500).json({ error: 'Failed to disconnect engine' })
  } finally {
    client.release()
  }
})

/**
 * DELETE /api/engines/:id
 * Remove an engine instance.
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  const client = await pool.connect()
  try {
    const result = await client.query(
      'DELETE FROM engines WHERE id = $1 RETURNING id',
      [id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Engine not found' })
      return
    }
    res.json({ message: 'Engine removed', id })
  } catch (error) {
    console.error('Delete engine error:', error)
    res.status(500).json({ error: 'Failed to remove engine' })
  } finally {
    client.release()
  }
})

export default router
