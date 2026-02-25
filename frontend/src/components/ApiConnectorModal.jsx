import { useState } from 'react'
import { Card, Title, Text, Badge, Button, Callout } from '@tremor/react'
import {
  XMarkIcon,
  CheckCircleIcon,
  LinkIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'

// Catalog of supported integrations with setup instructions
const INTEGRATIONS = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models & Whisper voice transcription — used by CEO Agent and all AI-powered agents',
    category: 'AI',
    envVars: ['OPENAI_API_KEY'],
    requiredFor: ['ceo-agent', 'research-scientist', 'code-executioner'],
    docsUrl: 'https://platform.openai.com/api-keys',
    setupSteps: [
      'Go to platform.openai.com/api-keys',
      'Click "Create new secret key"',
      'Copy the key (starts with sk-proj-...)',
      'Add to Vercel: echo -n "sk-proj-..." | vercel env add OPENAI_API_KEY production'
    ]
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'PostgreSQL database with real-time subscriptions — the core data layer',
    category: 'Database',
    envVars: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    requiredFor: ['all-workflows'],
    docsUrl: 'https://app.supabase.com',
    setupSteps: [
      'Open your Supabase project dashboard',
      'Go to Settings → API',
      'Copy "Project URL" and "anon public" key',
      'Add to Vercel with echo -n "..." | vercel env add VITE_SUPABASE_URL production',
      'Repeat for VITE_SUPABASE_ANON_KEY'
    ]
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send notifications and messages to Slack channels from workflows',
    category: 'Messaging',
    envVars: ['SLACK_BOT_TOKEN', 'SLACK_WEBHOOK_URL'],
    requiredFor: ['slack-notification'],
    docsUrl: 'https://api.slack.com/apps',
    setupSteps: [
      'Go to api.slack.com/apps and create a new app',
      'Enable "Incoming Webhooks" and create a webhook URL',
      'Or add "Bot Token Scopes" (chat:write) and install to workspace',
      'Copy the webhook URL or Bot User OAuth Token',
      'Add to Vercel: echo -n "..." | vercel env add SLACK_WEBHOOK_URL production'
    ]
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM integration for contact sync, deal management, and marketing automation',
    category: 'CRM',
    envVars: ['HUBSPOT_API_KEY'],
    requiredFor: ['hubspot-contact-sync'],
    docsUrl: 'https://app.hubspot.com/settings/integrations/api-key',
    setupSteps: [
      'Log in to HubSpot and go to Settings → Integrations → API key',
      'Copy your API key (or create a Private App token)',
      'Add to Vercel: echo -n "..." | vercel env add HUBSPOT_API_KEY production'
    ]
  },
  {
    id: 'google',
    name: 'Google (Sheets / Drive)',
    description: 'Read and write Google Sheets, import from Google Drive',
    category: 'Productivity',
    envVars: ['GOOGLE_SERVICE_ACCOUNT_JSON'],
    requiredFor: ['google-sheets-sync'],
    docsUrl: 'https://console.cloud.google.com',
    setupSteps: [
      'Go to console.cloud.google.com',
      'Create a Service Account under IAM & Admin',
      'Download the JSON key file',
      'Enable Sheets API and Drive API in the project',
      'Share your Sheet/Drive with the service account email',
      'Add to Vercel: cat key.json | vercel env add GOOGLE_SERVICE_ACCOUNT_JSON production'
    ]
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Email marketing campaigns, list management, and audience sync',
    category: 'Email',
    envVars: ['MAILCHIMP_API_KEY', 'MAILCHIMP_SERVER_PREFIX'],
    requiredFor: ['mailchimp-campaign'],
    docsUrl: 'https://mailchimp.com/developer/marketing/docs/fundamentals/',
    setupSteps: [
      'Log in to Mailchimp and go to Account → Extras → API keys',
      'Create a new API key',
      'Note your server prefix (e.g., us14) from your account URL',
      'Add both to Vercel as MAILCHIMP_API_KEY and MAILCHIMP_SERVER_PREFIX'
    ]
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing, webhook handling, and subscription management',
    category: 'Payments',
    envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    requiredFor: ['stripe-payment-webhook'],
    docsUrl: 'https://dashboard.stripe.com/apikeys',
    setupSteps: [
      'Go to Stripe Dashboard → Developers → API Keys',
      'Copy "Secret key" (starts with sk_live_ or sk_test_)',
      'For webhooks, go to Developers → Webhooks → Add endpoint',
      'Add to Vercel: echo -n "sk_live_..." | vercel env add STRIPE_SECRET_KEY production'
    ]
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'Send SMS and make voice calls from workflows',
    category: 'Messaging',
    envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    requiredFor: ['twilio-sms-send'],
    docsUrl: 'https://console.twilio.com',
    setupSteps: [
      'Log in to console.twilio.com',
      'Copy Account SID and Auth Token from the dashboard',
      'Get a Twilio phone number from Phone Numbers section',
      'Add all three to Vercel as separate env vars'
    ]
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'CRM operations — lead import, contact sync, opportunity management',
    category: 'CRM',
    envVars: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET', 'SALESFORCE_USERNAME', 'SALESFORCE_PASSWORD'],
    requiredFor: ['salesforce-lead-import'],
    docsUrl: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_connected_app.htm',
    setupSteps: [
      'Create a Connected App in Salesforce Setup',
      'Enable OAuth settings and note Client ID and Secret',
      'Add all four credentials to Vercel as env vars'
    ]
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Trigger Zaps and automate cross-platform workflows via webhooks',
    category: 'Automation',
    envVars: ['ZAPIER_WEBHOOK_URL'],
    requiredFor: ['zapier-webhook-trigger'],
    docsUrl: 'https://zapier.com/apps/webhook/integrations',
    setupSteps: [
      'Create a new Zap in Zapier',
      'Choose "Webhooks by Zapier" as the trigger',
      'Select "Catch Hook" and copy the webhook URL',
      'Add to Vercel: echo -n "https://hooks.zapier.com/..." | vercel env add ZAPIER_WEBHOOK_URL production'
    ]
  }
]

const CATEGORIES = ['All', 'AI', 'Database', 'Messaging', 'CRM', 'Productivity', 'Email', 'Payments', 'Automation']

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 font-mono bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
      title="Copy env var name"
    >
      <ClipboardDocumentIcon className="h-3 w-3" />
      {copied ? 'Copied!' : text}
    </button>
  )
}

function IntegrationCard({ integration }) {
  const [expanded, setExpanded] = useState(false)

  const categoryColor = {
    'AI': 'purple',
    'Database': 'blue',
    'Messaging': 'emerald',
    'CRM': 'orange',
    'Productivity': 'yellow',
    'Email': 'pink',
    'Payments': 'indigo',
    'Automation': 'cyan'
  }[integration.category] || 'gray'

  return (
    <div className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-[#00A8E1] transition-colors">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer bg-white hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Text className="font-bold text-gray-900">{integration.name}</Text>
            <Badge color={categoryColor} size="sm">{integration.category}</Badge>
          </div>
          <Text className="text-sm text-gray-600 mt-0.5 line-clamp-1">{integration.description}</Text>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {expanded
            ? <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            : <ChevronRightIcon className="h-4 w-4 text-gray-500" />
          }
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
          {/* Description */}
          <Text className="text-sm text-gray-700">{integration.description}</Text>

          {/* Required env vars */}
          <div>
            <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Environment Variables</Text>
            <div className="flex flex-wrap gap-2">
              {integration.envVars.map(v => (
                <CopyButton key={v} text={v} />
              ))}
            </div>
          </div>

          {/* Setup steps */}
          <div>
            <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Setup Steps</Text>
            <ol className="space-y-1.5">
              {integration.setupSteps.map((step, idx) => (
                <li key={idx} className="flex gap-2 text-sm text-gray-700">
                  <span className="font-bold text-[#00A8E1] flex-shrink-0">{idx + 1}.</span>
                  <span className="font-mono text-xs bg-white border border-gray-200 rounded px-2 py-0.5 break-all">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Docs link */}
          <a
            href={integration.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#00A8E1] hover:text-[#0096C9] font-medium"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            Open {integration.name} dashboard
          </a>
        </div>
      )}
    </div>
  )
}

export default function ApiConnectorModal({ onClose }) {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = INTEGRATIONS.filter(i => {
    const matchesCategory = selectedCategory === 'All' || i.category === selectedCategory
    const matchesSearch = !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase()) ||
      i.envVars.some(v => v.toLowerCase().includes(search.toLowerCase()))
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
              <Text className="text-gray-600 text-sm">Configure APIs and services used by your workflows</Text>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* How it works callout */}
        <div className="flex-shrink-0 mt-4">
          <Callout
            title="How integrations work"
            color="blue"
            icon={ExclamationTriangleIcon}
          >
            <Text className="text-sm text-gray-800">
              Integrations are configured as <strong>Vercel environment variables</strong>.
              Click any integration below to see the required env var names and step-by-step setup instructions.
              Add secrets using <code className="bg-blue-100 px-1 rounded text-xs">echo -n "value" | vercel env add VAR_NAME production</code> (use <code className="bg-blue-100 px-1 rounded text-xs">-n</code> to avoid newlines!).
            </Text>
          </Callout>
        </div>

        {/* Search + filter */}
        <div className="flex-shrink-0 mt-4 space-y-3">
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
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <LinkIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <Text className="text-gray-500">No integrations match your search</Text>
            </div>
          ) : (
            filtered.map(integration => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pt-4 border-t border-gray-200 mt-4">
          <div className="flex items-center justify-between">
            <Text className="text-xs text-gray-500">
              {filtered.length} of {INTEGRATIONS.length} integrations shown
            </Text>
            <Button
              onClick={onClose}
              variant="secondary"
              size="sm"
            >
              Close
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
