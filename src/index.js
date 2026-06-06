import http from 'http'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import workflowRoutes from './routes/workflows.js'
import engineRoutes from './routes/engine.js'
import { setupWebSocket } from './ws/manager.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// CORS — set CORS_ORIGIN in .env as a comma-separated list of allowed origins.
// Leave unset (or use *) to allow all origins.
const rawOrigins = process.env.CORS_ORIGIN || '*'
const corsOptions = {
  origin:
    rawOrigins === '*'
      ? '*'
      : rawOrigins.split(',').map((o) => o.trim()),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))

// Routes
app.use('/api/workflows', workflowRoutes)
app.use('/api/engines', engineRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Create HTTP server and attach WebSocket
const server = http.createServer(app)
setupWebSocket(server)

server.listen(PORT, () => {
  console.log(`Workflow backend running on http://localhost:${PORT}`)
  console.log(`WebSocket (engine) : ws://localhost:${PORT}/ws/engine?token=<uuid>`)
  console.log(`WebSocket (client) : ws://localhost:${PORT}/ws/client`)
})
