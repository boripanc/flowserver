import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import workflowRoutes from './routes/workflows.js'
import engineRoutes from './routes/engine.js'

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

app.listen(PORT, () => {
  console.log(`Workflow backend running on http://localhost:${PORT}`)
  console.log(`Deploy endpoint: POST http://localhost:${PORT}/api/workflows/deploy`)
})
