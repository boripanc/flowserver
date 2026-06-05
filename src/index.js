import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import workflowRoutes from './routes/workflows.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Routes
app.use('/api/workflows', workflowRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Workflow backend running on http://localhost:${PORT}`)
  console.log(`Deploy endpoint: POST http://localhost:${PORT}/api/workflows/deploy`)
})
