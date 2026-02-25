/**
 * /api/integrations - Vercel Environment Variable management
 *
 * GET  /api/integrations          → list which env var keys are currently set
 * POST /api/integrations          → set (create or update) a single env var
 * POST /api/integrations/redeploy → trigger a new Vercel deployment
 *
 * Requires:
 *   VERCEL_TOKEN      - Vercel API token (set once via CLI)
 *   VERCEL_PROJECT_ID - auto-populated from .vercel/project.json (hardcoded below as fallback)
 */

const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_z7qr8NAjmp8AegWvVJYAgPjCaz2X'
const VERCEL_API = 'https://api.vercel.com'

// Strict allowlist — only these keys can be managed via this API
const ALLOWED_KEYS = new Set([
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'SLACK_BOT_TOKEN',
  'SLACK_WEBHOOK_URL',
  'HUBSPOT_API_KEY',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'MAILCHIMP_API_KEY',
  'MAILCHIMP_SERVER_PREFIX',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'SALESFORCE_CLIENT_ID',
  'SALESFORCE_CLIENT_SECRET',
  'SALESFORCE_USERNAME',
  'SALESFORCE_PASSWORD',
  'ZAPIER_WEBHOOK_URL',
])

function vercelHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

/**
 * List all env var keys currently set on the project (no values returned).
 * Returns { keys: Set<string> } keyed by env var name → envId for updating.
 */
async function listEnvVars(token) {
  const res = await fetch(`${VERCEL_API}/v9/projects/${PROJECT_ID}/env`, {
    headers: vercelHeaders(token)
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Vercel API error listing env vars: ${res.status} ${body}`)
  }

  const data = await res.json()
  const map = {}

  for (const env of (data.envs || [])) {
    // Only expose names we manage, and only production/all targets
    if (ALLOWED_KEYS.has(env.key)) {
      const targets = env.target || []
      if (targets.includes('production') || targets.includes('all') || targets.length === 0) {
        map[env.key] = { id: env.id, target: targets }
      }
    }
  }

  return map
}

/**
 * Create or update a single env var (encrypted, production target).
 */
async function setEnvVar(token, key, value, existingId) {
  const payload = {
    key,
    value,
    type: 'encrypted',
    target: ['production']
  }

  if (existingId) {
    // Update existing
    const res = await fetch(`${VERCEL_API}/v9/projects/${PROJECT_ID}/env/${existingId}`, {
      method: 'PATCH',
      headers: vercelHeaders(token),
      body: JSON.stringify({ value, type: 'encrypted', target: ['production'] })
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Vercel API error updating env var: ${res.status} ${body}`)
    }
    return { action: 'updated' }
  } else {
    // Create new
    const res = await fetch(`${VERCEL_API}/v9/projects/${PROJECT_ID}/env`, {
      method: 'POST',
      headers: vercelHeaders(token),
      body: JSON.stringify([payload])
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Vercel API error creating env var: ${res.status} ${body}`)
    }
    return { action: 'created' }
  }
}

/**
 * Trigger a new deployment by redeploying the latest deployment.
 */
async function triggerRedeploy(token) {
  // Get the latest deployment for this project
  const listRes = await fetch(
    `${VERCEL_API}/v6/deployments?projectId=${PROJECT_ID}&limit=1&target=production`,
    { headers: vercelHeaders(token) }
  )

  if (!listRes.ok) {
    const body = await listRes.text()
    throw new Error(`Vercel API error fetching deployments: ${listRes.status} ${body}`)
  }

  const listData = await listRes.json()
  const latest = (listData.deployments || [])[0]

  if (!latest) {
    throw new Error('No production deployments found to redeploy')
  }

  // Trigger redeploy using the latest deployment's UID
  const deployRes = await fetch(`${VERCEL_API}/v13/deployments`, {
    method: 'POST',
    headers: vercelHeaders(token),
    body: JSON.stringify({
      name: latest.name,
      deploymentId: latest.uid,
      target: 'production'
    })
  })

  if (!deployRes.ok) {
    const body = await deployRes.text()
    throw new Error(`Vercel API error triggering redeploy: ${deployRes.status} ${body}`)
  }

  const deployData = await deployRes.json()
  return { deploymentId: deployData.id || deployData.uid, url: deployData.url }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = process.env.VERCEL_TOKEN
  if (!token) {
    return res.status(503).json({
      error: 'VERCEL_TOKEN is not configured. Set it once via: echo -n "your-token" | vercel env add VERCEL_TOKEN production'
    })
  }

  const path = (req.url || '').split('?')[0]

  try {
    // GET /api/integrations — list which env vars are currently set
    if (req.method === 'GET' && path === '/api/integrations') {
      const envMap = await listEnvVars(token)
      // Return just the key names and whether they exist (never values)
      const result = {}
      for (const [key, meta] of Object.entries(envMap)) {
        result[key] = { set: true, id: meta.id }
      }
      return res.status(200).json({ vars: result })
    }

    // POST /api/integrations — set a single env var
    if (req.method === 'POST' && path === '/api/integrations') {
      const { key, value } = req.body || {}

      if (!key || !value) {
        return res.status(400).json({ error: 'key and value are required' })
      }

      if (!ALLOWED_KEYS.has(key)) {
        return res.status(403).json({ error: `Key "${key}" is not in the allowed list` })
      }

      if (typeof value !== 'string' || value.trim().length === 0) {
        return res.status(400).json({ error: 'value must be a non-empty string' })
      }

      // Check if key already exists so we can update vs create
      const existing = await listEnvVars(token)
      const existingId = existing[key]?.id || null

      const result = await setEnvVar(token, key, value.trim(), existingId)
      console.log(`[Integrations] ${result.action} env var: ${key}`)

      return res.status(200).json({
        success: true,
        action: result.action,
        key,
        message: `${key} was ${result.action} successfully. Redeploy to activate.`
      })
    }

    // POST /api/integrations/redeploy — trigger new deployment
    if (req.method === 'POST' && path === '/api/integrations/redeploy') {
      const result = await triggerRedeploy(token)
      console.log('[Integrations] Redeploy triggered:', result.deploymentId)

      return res.status(200).json({
        success: true,
        deploymentId: result.deploymentId,
        message: 'Redeployment triggered. New env vars will be active in ~30-60 seconds.'
      })
    }

    return res.status(404).json({ error: 'Not found' })

  } catch (err) {
    console.error('[Integrations] Error:', err.message)
    // Don't leak Vercel token info in error messages
    const clientMsg = err.message.replace(/(Bearer\s+)[^\s]+/, '$1[REDACTED]')
    return res.status(500).json({ error: clientMsg })
  }
}
