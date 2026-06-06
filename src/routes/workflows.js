import { Router } from 'express'
import { pool } from '../db/pool.js'

const router = Router()

// Save (create or update) a workflow
router.post('/save', async (req, res) => {
  const { id, name, nodes, edges } = req.body

  if (!nodes || !edges) {
    res.status(400).json({ error: 'nodes and edges are required' })
    return
  }

  const client = await pool.connect()

  try {
    let result

    if (id) {
      // Update existing workflow
      result = await client.query(
        `UPDATE workflows
         SET name = $1, nodes = $2, edges = $3, status = 'saved', updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [name || 'Untitled Workflow', JSON.stringify(nodes), JSON.stringify(edges), id]
      )

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Workflow not found' })
        return
      }
    } else {
      // Create new workflow
      result = await client.query(
        `INSERT INTO workflows (name, nodes, edges, status)
         VALUES ($1, $2, $3, 'saved')
         RETURNING *`,
        [name || 'Untitled Workflow', JSON.stringify(nodes), JSON.stringify(edges)]
      )
    }

    const workflow = result.rows[0]
    console.log(`Workflow saved: ${workflow.id} - ${workflow.name}`)

    res.status(200).json({
      message: 'Workflow saved successfully',
      workflow: {
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
        nodesCount: nodes.length,
        edgesCount: edges.length,
        updatedAt: workflow.updated_at,
      },
    })
  } catch (error) {
    console.error('Save error:', error)
    res.status(500).json({ error: 'Failed to save workflow' })
  } finally {
    client.release()
  }
})

// Get all workflows
router.get('/', async (_req, res) => {
  const client = await pool.connect()

  try {
    const result = await client.query(
      'SELECT id, name, status, created_at, updated_at, deployed_at FROM workflows ORDER BY updated_at DESC'
    )
    res.json(result.rows)
  } catch (error) {
    console.error('List error:', error)
    res.status(500).json({ error: 'Failed to list workflows' })
  } finally {
    client.release()
  }
})

// Get a single workflow by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const client = await pool.connect()

  try {
    const result = await client.query('SELECT * FROM workflows WHERE id = $1', [id])

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Workflow not found' })
      return
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Get error:', error)
    res.status(500).json({ error: 'Failed to get workflow' })
  } finally {
    client.release()
  }
})

// Update a workflow by ID
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { name, nodes, edges, status } = req.body

  if (!nodes || !edges) {
    res.status(400).json({ error: 'nodes and edges are required' })
    return
  }

  const client = await pool.connect()

  try {
    const result = await client.query(
      `UPDATE workflows
       SET name = $1, nodes = $2, edges = $3, status = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        name || 'Untitled Workflow',
        JSON.stringify(nodes),
        JSON.stringify(edges),
        status || 'saved',
        id,
      ]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Workflow not found' })
      return
    }

    const workflow = result.rows[0]
    console.log(`Workflow updated: ${workflow.id} - ${workflow.name}`)

    res.json({
      message: 'Workflow updated successfully',
      workflow: {
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
        nodesCount: nodes.length,
        edgesCount: edges.length,
        updatedAt: workflow.updated_at,
      },
    })
  } catch (error) {
    console.error('Update error:', error)
    res.status(500).json({ error: 'Failed to update workflow' })
  } finally {
    client.release()
  }
})

// Delete a workflow
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  const client = await pool.connect()

  try {
    const result = await client.query('DELETE FROM workflows WHERE id = $1 RETURNING id', [id])

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Workflow not found' })
      return
    }

    res.json({ message: 'Workflow deleted', id })
  } catch (error) {
    console.error('Delete error:', error)
    res.status(500).json({ error: 'Failed to delete workflow' })
  } finally {
    client.release()
  }
})

export default router
