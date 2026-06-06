/**
 * WebSocket Manager
 *
 * Tracks two types of WebSocket connections:
 *   - "engine"  — engine instances, authenticated by their UUID token
 *   - "client"  — flow client UIs, receive broadcasts
 *
 * Message protocol (all messages are JSON):
 *
 * Engine → Server:
 *   { type: "heartbeat" }
 *   { type: "status_update", status: "connected" | "disconnected" }
 *
 * Server → Client (broadcasts):
 *   { type: "engine_connected",    engine: { id, name, status, connectedAt, lastSeen } }
 *   { type: "engine_disconnected", engine: { id, name, status, connectedAt, lastSeen } }
 *   { type: "engine_heartbeat",    engine: { id, name, status, connectedAt, lastSeen } }
 *   { type: "engine_list",         engines: [...] }
 *
 * Server → Engine (acknowledgements):
 *   { type: "ack", message: string }
 *   { type: "error", message: string }
 *
 * Server → Client (on initial connect):
 *   { type: "engine_list", engines: [...] }
 */

import { WebSocketServer } from 'ws'
import { pool } from '../db/pool.js'

// Map of engineId → { ws, engineRow }
const engineSockets = new Map()

// Set of client WebSocket connections
const clientSockets = new Set()

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

function broadcastToClients(payload) {
  for (const ws of clientSockets) {
    send(ws, payload)
  }
}

function formatEngine(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    connectedAt: row.connected_at ?? undefined,
    lastSeen: row.last_seen ?? undefined,
  }
}

async function updateEngineStatus(engineId, status) {
  const client = await pool.connect()
  try {
    const setConnectedAt = status === 'connected' ? ', connected_at = NOW()' : ''
    const result = await client.query(
      `UPDATE engines
       SET status = $1, last_seen = NOW() ${setConnectedAt}
       WHERE id = $2
       RETURNING *`,
      [status, engineId]
    )
    return result.rows[0] ?? null
  } finally {
    client.release()
  }
}

async function getEngineById(engineId) {
  const client = await pool.connect()
  try {
    const result = await client.query('SELECT * FROM engines WHERE id = $1', [engineId])
    return result.rows[0] ?? null
  } finally {
    client.release()
  }
}

async function getAllEngines() {
  const client = await pool.connect()
  try {
    const result = await client.query('SELECT * FROM engines ORDER BY connected_at DESC')
    return result.rows.map(formatEngine)
  } finally {
    client.release()
  }
}

// ─── Engine connection handler ────────────────────────────────────────────────

async function handleEngineConnection(ws, engineId) {
  const engine = await getEngineById(engineId)

  if (!engine) {
    send(ws, { type: 'error', message: 'Unknown engine token. Register via POST /api/engines first.' })
    ws.close()
    return
  }

  console.log(`[ws] Engine connected: ${engine.name} (${engine.id})`)

  // Update DB + broadcast to clients
  const updated = await updateEngineStatus(engineId, 'connected')
  engineSockets.set(engineId, { ws, engine: updated })

  send(ws, { type: 'ack', message: `Connected as engine "${engine.name}"` })
  broadcastToClients({ type: 'engine_connected', engine: formatEngine(updated) })

  ws.on('message', async (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      send(ws, { type: 'error', message: 'Invalid JSON' })
      return
    }

    if (msg.type === 'heartbeat') {
      const row = await updateEngineStatus(engineId, 'connected')
      if (row) {
        engineSockets.get(engineId).engine = row
        broadcastToClients({ type: 'engine_heartbeat', engine: formatEngine(row) })
        send(ws, { type: 'ack', message: 'heartbeat received' })
      }
    } else {
      send(ws, { type: 'error', message: `Unknown message type: ${msg.type}` })
    }
  })

  ws.on('close', async () => {
    console.log(`[ws] Engine disconnected: ${engine.name} (${engine.id})`)
    engineSockets.delete(engineId)
    const row = await updateEngineStatus(engineId, 'disconnected')
    if (row) {
      broadcastToClients({ type: 'engine_disconnected', engine: formatEngine(row) })
    }
  })

  ws.on('error', (err) => {
    console.error(`[ws] Engine socket error (${engineId}):`, err.message)
  })
}

// ─── Client connection handler ────────────────────────────────────────────────

async function handleClientConnection(ws) {
  console.log(`[ws] Client connected (total: ${clientSockets.size + 1})`)
  clientSockets.add(ws)

  // Send current engine list on connect
  const engines = await getAllEngines()
  send(ws, { type: 'engine_list', engines })

  ws.on('close', () => {
    clientSockets.delete(ws)
    console.log(`[ws] Client disconnected (total: ${clientSockets.size})`)
  })

  ws.on('error', (err) => {
    console.error('[ws] Client socket error:', err.message)
  })
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const pathname = url.pathname

    if (pathname === '/ws/engine') {
      const token = url.searchParams.get('token')
      if (!token) {
        send(ws, { type: 'error', message: 'Missing token query param: ?token=<engine-uuid>' })
        ws.close()
        return
      }
      handleEngineConnection(ws, token)

    } else if (pathname === '/ws/client') {
      handleClientConnection(ws)

    } else {
      send(ws, { type: 'error', message: `Unknown WebSocket path: ${pathname}` })
      ws.close()
    }
  })

  console.log('[ws] WebSocket server ready')
  console.log('[ws]   Engine path : ws://host/ws/engine?token=<engine-uuid>')
  console.log('[ws]   Client path : ws://host/ws/client')

  return wss
}
