import { useState, useEffect } from 'react'
import { Card, Title, Text, Badge, Button, Callout } from '@tremor/react'
import {
  XMarkIcon,
  CheckCircleIcon,
  LinkIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  ArrowTopRightOnSquareIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

// Catalog of supported integrations with setup instructions
const INTEGRATIONS = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models & Whisper voice transcription — required by CEO Agent',
    category: 'AI',
    envVars: [
      { key: 'OPENAI_API_KEY', label: 'API Key', placeholder: 'sk-proj-...', secret: true }
    ],
    docsUrl: 'https://platform.openai.com/api-keys',
    hint: 'Create at platform.openai.com → API Keys → Create new secret key'
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'PostgreSQL database with real-time — the core data layer',
    category: 'Database',
    envVars: [
      { key: 'VITE_SUPABASE_URL', label: 'Project URL', placeholder: 'https://xxxx.supabase.co', secret: false },
      { key: 'VITE_SUPABASE_ANON_KEY', label: 'Anon Key', placeholder: 'eyJhbGci...', secret: true }
    ],
    docsUrl: 'https://app.supabase.com',
    hint: 'Settings → API in your Supabase project dashboard'
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send notifications and messages to Slack channels',
    category: 'Messaging',
    envVars: [
      { key: 'SLACK_BOT_TOKEN', label: 'Bot Token', placeholder: 'xoxb-...', secret: true },
      { key: 'SLACK_WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/...', secret: true }
    ],
    docsUrl: 'https://api.slack.com/apps',
    hint: 'api.slack.com → Create App → Incoming Webhooks or Bot Token'
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM — contact sync, deal management, marketing automation',
    category: 'CRM',
    envVars: [
      { key: 'HUBSPOT_API_KEY', label: 'API Key / Private App Token', placeholder: 'pat-na1-...', secret: true }
    ],
    docsUrl: 'https://app.hubspot.com/settings/integrations/api-key',
    hint: 'Settings → Integrations → Private Apps → Create App'
  },
  {
    id: 'google',
    name: 'Google Sheets / Drive',
    description: 'Read/write Google Sheets, import from Drive',
    category: 'Productivity',
    envVars: [
      { key: 'GOOGLE_SERVICE_ACCOUNT_JSON', label: 'Service Account JSON', placeholder: '{"type":"service_account",...}', secret: true }
    ],
    docsUrl: 'https://console.cloud.google.com',
    hint: 'GCP Console → IAM → Service Accounts → Create key (JSON)'
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Email campaigns, list management, audience sync',
    category: 'Email',
    envVars: [
      { key: 'MAILCHIMP_API_KEY', label: 'API Key', placeholder: 'abc123...-us14', secret: true },
      { key: 'MAILCHIMP_SERVER_PREFIX', label: 'Server Prefix', placeholder: 'us14', secret: false }
    ],
    docsUrl: 'https://admin.mailchimp.com/account/api/',
    hint: 'Account → Extras → API Keys. Server prefix is in your account URL (e.g. us14)'
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing, webhooks, subscription management',
    category: 'Payments',
    envVars: [
      { key: 'STRIPE_SECRET_KEY', label: 'Secret Key', placeholder: 'sk_live_...', secret: true },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook Secret', placeholder: 'whsec_...', secret: true }
    ],
    docsUrl: 'https://dashboard.stripe.com/apikeys',
    hint: 'Developers → API Keys for secret key; Developers → Webhooks for webhook secret'
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'Send SMS and make voice calls from workflows',
    category: 'Messaging',
    envVars: [
      { key: 'TWILIO_ACCOUNT_SID', label: 'Account SID', placeholder: 'ACxxxxxxxx', secret: false },
      { key: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', placeholder: 'xxxxxxxx', secret: true },
      { key: 'TWILIO_PHONE_NUMBER', label: 'Phone Number', placeholder: '+15551234567', secret: false }
    ],
    docsUrl: 'https://console.twilio.com',
    hint: 'Account SID and Auth Token are on the Twilio console home page'
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'CRM — lead import, contact sync, opportunity management',
    category: 'CRM',
    envVars: [
      { key: 'SALESFORCE_CLIENT_ID', label: 'Client ID', placeholder: '3MVG9...', secret: false },
      { key: 'SALESFORCE_CLIENT_SECRET', label: 'Client Secret', placeholder: 'xxxxxxxx', secret: true },
      { key: 'SALESFORCE_USERNAME', label: 'Username', placeholder: 'user@company.com', secret: false },
      { key: 'SALESFORCE_PASSWORD', label: 'Password + Security Token', placeholder: 'PasswordToken', secret: true }
    ],
    docsUrl: 'https://developer.salesforce.com/docs',
    hint: 'Setup → Apps → App Manager → New Connected App'
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Trigger Zaps and automate cross-platform workflows via webhooks',
    category: 'Automation',
    envVars: [
      { key: 'ZAPIER_WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://hooks.zapier.com/...', secret: true }
    ],
    docsUrl: 'https://zapier.com/apps/webhook/integrations',
    hint: 'Create a Zap → Webhooks by Zapier → Catch Hook → copy webhook URL'
  }
]

const CATEGORIES = ['All', 'AI', 'Database', 'Messaging', 'CRM', 'Productivity', 'Email', 'Payments', 'Automation']

const CATEGORY_COLORS = {
  'AI': 'purple', 'Database': 'blue', 'Messaging': 'emerald',
  'CRM': 'orange', 'Productivity': 'yellow', 'Email': 'pink',
  'Payments': 'indigo', 'Automation': 'cyan'
}

function SecretInput({ value, onChange, placeholder, disabled }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00A8E1] focus:border-[#00A8E1] outline-none font-mono disabled:bg-gray-50 disabled:text-gray-400"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        tabIndex={-1}
      >
        {visible ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
    </div>
  )
}

function StatusDot({ isSet }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${isSet ? 'bg-emerald-500' : 'bg-gray-300'}`}
      title={isSet ? 'Set in Vercel' : 'Not configured'}
    />
  )
}

function IntegrationCard({ integration, envStatus, onSaveVar, saving }) {
  const [expanded, setExpanded] = useState(false)
  const [values, setValues] = useState({})
  const [results, setResults] = useState({}) // key → { success, message }

  const allSet = integration.envVars.every(v => envStatus[v.key]?.set)
  const anySet = integration.envVars.some(v => envStatus[v.key]?.set)

  const handleSave = async (envVar) => {
    const val = values[envVar.key]?.trim()
    if (!val) return

    const result = await onSaveVar(envVar.key, val)
    setResults(prev => ({ ...prev, [envVar.key]: result }))
    if (result.success) {
      setValues(prev => ({ ...prev, [envVar.key]: '' }))
    }
  }

  return (
    <div className={`border-2 rounded-xl overflow-hidden transition-colors ${
      allSet ? 'border-emerald-300' : anySet ? 'border-amber-300' : 'border-gray-200'
    }`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-white hover:bg-gray-50"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Text className="font-bold text-gray-900">{integration.name}</Text>
            <Badge color={CATEGORY_COLORS[integration.category] || 'gray'} size="sm">{integration.category}</Badge>
            {allSet && <Badge color="emerald" size="xs">Connected</Badge>}
            {anySet && !allSet && <Badge color="amber" size="xs">Partial</Badge>}
          </div>
          <Text className="text-xs text-gray-500 mt-0.5">{integration.description}</Text>
        </div>

        {/* Per-var status dots */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {integration.envVars.map(v => (
            <StatusDot key={v.key} isSet={!!envStatus[v.key]?.set} />
          ))}
        </div>
        {expanded
          ? <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
          : <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
        }
      </div>

      {expanded && (
        <div className="border-t border-gray-200 px-4 py-4 bg-gray-50 space-y-4">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <Text className="text-xs text-gray-600">{integration.hint}</Text>
            <a
              href={integration.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex-shrink-0 text-xs text-[#00A8E1] hover:underline flex items-center gap-1"
              onClick={e => e.stopPropagation()}
            >
              Docs <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            </a>
          </div>

          {integration.envVars.map(envVar => {
            const isSet = !!envStatus[envVar.key]?.set
            const result = results[envVar.key]
            const isSaving = saving === envVar.key

            return (
              <div key={envVar.key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <StatusDot isSet={isSet} />
                  <label className="text-xs font-semibold text-gray-700 font-mono">{envVar.key}</label>
                  {isSet && <Badge color="emerald" size="xs">Set</Badge>}
                </div>

                <div className="flex gap-2">
                  {envVar.secret ? (
                    <SecretInput
                      value={values[envVar.key] || ''}
                      onChange={v => setValues(prev => ({ ...prev, [envVar.key]: v }))}
                      placeholder={isSet ? '••••••••••••  (leave blank to keep current)' : envVar.placeholder}
                      disabled={isSaving}
                    />
                  ) : (
                    <input
                      type="text"
                      value={values[envVar.key] || ''}
                      onChange={e => setValues(prev => ({ ...prev, [envVar.key]: e.target.value }))}
                      placeholder={isSet ? '(leave blank to keep current)' : envVar.placeholder}
                      disabled={isSaving}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00A8E1] focus:border-[#00A8E1] outline-none disabled:bg-gray-50"
                    />
                  )}
                  <button
                    onClick={() => handleSave(envVar)}
                    disabled={!values[envVar.key]?.trim() || isSaving}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#00A8E1] text-white hover:bg-[#0096C9] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0 transition-colors"
                  >
                    {isSaving
                      ? <><ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> Saving...</>
                      : isSet ? 'Update' : 'Save'
                    }
                  </button>
                </div>

                {result && (
                  <div className={`flex items-center gap-1.5 text-xs ${result.success ? 'text-emerald-700' : 'text-red-600'}`}>
                    {result.success
                      ? <CheckCircleIcon className="h-3.5 w-3.5" />
                      : <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                    }
                    {result.message}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ApiConnectorModal({ onClose }) {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [envStatus, setEnvStatus] = useState({}) // { KEY: { set: true, id } }
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [statusError, setStatusError] = useState(null)
  const [savingKey, setSavingKey] = useState(null)
  const [redeploying, setRedeploying] = useState(false)
  const [redeployResult, setRedeployResult] = useState(null)
  const [pendingRedeploy, setPendingRedeploy] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    setLoadingStatus(true)
    setStatusError(null)
    try {
      const res = await fetch('/api/integrations')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to load integration status')
      }
      const data = await res.json()
      setEnvStatus(data.vars || {})
    } catch (err) {
      setStatusError(err.message)
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleSaveVar = async (key, value) => {
    setSavingKey(key)
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      })
      const data = await res.json()

      if (!res.ok) {
        return { success: false, message: data.error || 'Failed to save' }
      }

      // Update local status
      setEnvStatus(prev => ({ ...prev, [key]: { set: true } }))
      setPendingRedeploy(true)

      return { success: true, message: data.message }
    } catch (err) {
      return { success: false, message: err.message }
    } finally {
      setSavingKey(null)
    }
  }

  const handleRedeploy = async () => {
    setRedeploying(true)
    setRedeployResult(null)
    try {
      const res = await fetch('/api/integrations/redeploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()

      if (!res.ok) {
        setRedeployResult({ success: false, message: data.error || 'Redeploy failed' })
      } else {
        setRedeployResult({ success: true, message: data.message })
        setPendingRedeploy(false)
      }
    } catch (err) {
      setRedeployResult({ success: false, message: err.message })
    } finally {
      setRedeploying(false)
    }
  }

  const connectedCount = Object.values(envStatus).filter(v => v.set).length
  const totalVars = INTEGRATIONS.reduce((sum, i) => sum + i.envVars.length, 0)

  const filtered = INTEGRATIONS.filter(i => {
    const matchesCategory = selectedCategory === 'All' || i.category === selectedCategory
    const matchesSearch = !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase()) ||
      i.envVars.some(v => v.key.toLowerCase().includes(search.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border-2 border-gray-200">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b-2 border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <LinkIcon className="h-8 w-8 text-[#00A8E1]" />
            <div>
              <Title className="text-xl text-gray-900">Integration Connector</Title>
              <Text className="text-gray-600 text-sm">
                {loadingStatus ? 'Loading...' : `${connectedCount} of ${totalVars} credentials configured`}
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loadingStatus}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              title="Refresh status"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loadingStatus ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Status error / VERCEL_TOKEN missing */}
        {statusError && (
          <div className="flex-shrink-0 mt-4">
            <Callout title="Cannot connect to Vercel API" color="red" icon={ExclamationTriangleIcon}>
              <Text className="text-sm text-gray-800">{statusError}</Text>
              {statusError.includes('VERCEL_TOKEN') && (
                <div className="mt-2 p-2 bg-red-50 rounded font-mono text-xs text-red-800">
                  echo -n "your-vercel-token" | vercel env add VERCEL_TOKEN production
                </div>
              )}
              <Text className="text-xs text-gray-600 mt-2">
                Get your token at vercel.com → Account Settings → Tokens
              </Text>
            </Callout>
          </div>
        )}

        {/* Redeploy banner */}
        {pendingRedeploy && !redeployResult && (
          <div className="flex-shrink-0 mt-4">
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <Text className="text-sm text-amber-800 flex-1">
                Credentials saved. <strong>Redeploy to activate</strong> them in your live app.
              </Text>
              <Button
                size="xs"
                color="amber"
                icon={ArrowPathIcon}
                loading={redeploying}
                onClick={handleRedeploy}
                className="bg-amber-500 hover:bg-amber-600 text-white border-none flex-shrink-0"
              >
                Redeploy Now
              </Button>
            </div>
          </div>
        )}

        {redeployResult && (
          <div className={`flex-shrink-0 mt-4 px-4 py-3 rounded-lg border flex items-center gap-2 ${
            redeployResult.success
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}>
            {redeployResult.success
              ? <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
              : <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
            }
            <Text className="text-sm">{redeployResult.message}</Text>
          </div>
        )}

        {/* Search + category filter */}
        <div className="flex-shrink-0 mt-4 space-y-2">
          <input
            type="text"
            placeholder="Search integrations or env var names..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00A8E1] focus:border-[#00A8E1] outline-none"
          />
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#00A8E1] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Integration list */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1">
          {filtered.map(integration => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              envStatus={envStatus}
              onSaveVar={handleSaveVar}
              saving={savingKey}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pt-4 border-t border-gray-200 mt-4">
          <div className="flex items-center justify-between">
            <Text className="text-xs text-gray-500">
              Values are stored encrypted in Vercel. They are never readable back through this UI.
            </Text>
            <Button onClick={onClose} variant="secondary" size="sm">Close</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
