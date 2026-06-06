import { pool } from './pool.js'

async function migrate() {
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL DEFAULT 'Untitled Workflow',
        nodes JSONB NOT NULL DEFAULT '[]',
        edges JSONB NOT NULL DEFAULT '[]',
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deployed_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
      CREATE INDEX IF NOT EXISTS idx_workflows_updated_at ON workflows(updated_at DESC);

      CREATE TABLE IF NOT EXISTS workflow_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        trigger_input JSONB,
        node_results JSONB NOT NULL DEFAULT '{}',
        logs JSONB NOT NULL DEFAULT '[]',
        error TEXT,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_runs_workflow_id ON workflow_runs(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_runs_status ON workflow_runs(status);
      CREATE INDEX IF NOT EXISTS idx_runs_started_at ON workflow_runs(started_at DESC);

      CREATE TABLE IF NOT EXISTS engines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'unknown',
        connected_at TIMESTAMP WITH TIME ZONE,
        last_seen TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_engines_status ON engines(status);
    `)

    console.log('Migration completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
