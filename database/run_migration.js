import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../backend/.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend/.env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration(filename) {
  console.log(`Running migration: ${filename}`)

  const sql = readFileSync(join(__dirname, 'migrations', filename), 'utf-8')

  // Split by semicolons and run each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'))

  for (const statement of statements) {
    console.log(`Executing: ${statement.substring(0, 100)}...`)
    const { error } = await supabase.rpc('exec_sql', { sql: statement })

    if (error) {
      console.error(`Error: ${error.message}`)
      // Continue with other statements
    } else {
      console.log('✓ Success')
    }
  }
}

// Run the migration
const migrationFile = process.argv[2] || 'add_workflow_task_linkage.sql'
runMigration(migrationFile)
  .then(() => {
    console.log('\n✓ Migration completed')
    process.exit(0)
  })
  .catch((err) => {
    console.error('\n✗ Migration failed:', err)
    process.exit(1)
  })
