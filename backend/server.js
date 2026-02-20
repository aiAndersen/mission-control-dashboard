import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import agentsRouter from './routes/agents.js'
import executionsRouter from './routes/executions.js'
import executionControlRouter from './routes/executionControl.js'
import ceoRouter from './routes/ceo.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/agents', agentsRouter)
app.use('/api/executions', executionsRouter)
app.use('/api/execution-control', executionControlRouter)
app.use('/api/ceo', ceoRouter)

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Mission Control API Server + CEO Agent`)
  console.log(`${'='.repeat(60)}`)
  console.log(`  Running on: http://localhost:${PORT}`)
  console.log(`  Health: http://localhost:${PORT}/api/health`)
  console.log(`  Agents: http://localhost:${PORT}/api/agents`)
  console.log(`  CEO Agent: http://localhost:${PORT}/api/ceo/plan`)
  console.log(`${'='.repeat(60)}\n`)
})

export default app
