import { useState } from 'react'
import { Card, Title, Text, Button, Badge, Callout } from '@tremor/react'
import { ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon, CodeBracketIcon } from '@heroicons/react/24/outline'

export default function ApprovalGate({ approval, onApprove, onReject, onClose }) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [showFullCode, setShowFullCode] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    try {
      await onApprove(notes)
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    setLoading(true)
    try {
      await onReject(notes)
    } finally {
      setLoading(false)
    }
  }

  const getApprovalTypeInfo = () => {
    const types = {
      'pre_execution': {
        title: 'Pre-Execution Approval',
        color: 'blue',
        icon: ExclamationTriangleIcon,
        description: 'Review this step before execution'
      },
      'post_validation': {
        title: 'Post-Validation Approval',
        color: 'amber',
        icon: CheckCircleIcon,
        description: 'Validate the results of the previous step'
      },
      'critical_action': {
        title: 'Critical Action Approval',
        color: 'red',
        icon: ExclamationTriangleIcon,
        description: 'This action requires extra caution'
      },
      'agent_creation': {
        title: 'Agent Creation Approval',
        color: 'purple',
        icon: CodeBracketIcon,
        description: 'Review the generated agent code before deployment'
      }
    }
    return types[approval.approval_type] || types.pre_execution
  }

  const typeInfo = getApprovalTypeInfo()
  const TypeIcon = typeInfo.icon
  const isAgentCreation = approval.approval_type === 'agent_creation'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fade-in shadow-2xl border-4 border-amber-400">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b-2 border-gray-200">
            <div className="flex items-center gap-3">
              <TypeIcon className="h-10 w-10 text-amber-600" />
              <div>
                <Title className="text-2xl text-gray-900">{typeInfo.title}</Title>
                <Text className="text-gray-700 text-base">{typeInfo.description}</Text>
              </div>
            </div>
            <Badge color={typeInfo.color} size="xl" className="text-base px-4 py-2">
              {approval.approval_type.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>

          {/* Prompt */}
          <Callout
            title="Approval Required"
            color="amber"
            icon={ExclamationTriangleIcon}
            className="border-2 border-amber-400"
          >
            <p className="text-gray-900 text-base font-medium">{approval.prompt}</p>
          </Callout>

          {/* Agent Creation Details */}
          {isAgentCreation && approval.context && (
            <div className="space-y-4">
              {/* Agent Info */}
              {approval.context.agent_name && (
                <div className="p-5 bg-purple-50 rounded-lg border-2 border-purple-300">
                  <Text className="font-bold text-purple-900 mb-2 text-lg">
                    New Agent: {approval.context.agent_name}
                  </Text>
                  {approval.context.description && (
                    <Text className="text-base text-purple-800 mb-3">
                      {approval.context.description}
                    </Text>
                  )}
                  {approval.context.capabilities && approval.context.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {approval.context.capabilities.map((cap, idx) => (
                        <Badge key={idx} color="purple" size="md" className="text-sm">{cap}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Code Preview */}
              {approval.context.code_preview && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Title className="text-sm">Generated Code Preview</Title>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => setShowFullCode(!showFullCode)}
                    >
                      {showFullCode ? 'Show Less' : 'Show Full Code'}
                    </Button>
                  </div>
                  <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto font-mono">
                    {showFullCode
                      ? approval.context.full_code || approval.context.code_preview
                      : approval.context.code_preview}
                  </pre>
                </div>
              )}

              {/* Safety Validation */}
              {approval.context.validation_status && (
                <Callout
                  title={approval.context.validation_status === 'safe' ? 'Safety Check Passed' : 'Safety Check Warning'}
                  color={approval.context.validation_status === 'safe' ? 'emerald' : 'red'}
                  icon={approval.context.validation_status === 'safe' ? CheckCircleIcon : XCircleIcon}
                >
                  {approval.context.validation_status === 'safe'
                    ? 'The generated code passed automated safety checks (no destructive operations, no shell injection patterns).'
                    : 'Warning: The generated code contains potentially unsafe patterns. Review carefully before approving.'}
                </Callout>
              )}
            </div>
          )}

          {/* Context Details (non-agent-creation) */}
          {!isAgentCreation && approval.context && Object.keys(approval.context).length > 0 && (
            <details className="cursor-pointer">
              <summary className="text-sm font-medium text-gray-700 hover:text-gray-900">
                View Context Details
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                {JSON.stringify(approval.context, null, 2)}
              </pre>
            </details>
          )}

          {/* Notes Input */}
          <div>
            <label className="block text-base font-semibold text-gray-900 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes or comments about this decision..."
              className="w-full h-24 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00A8E1] focus:border-[#00A8E1] resize-none text-gray-900 text-base"
              disabled={loading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6 border-t-2 border-gray-300">
            <Button
              onClick={handleReject}
              loading={loading}
              disabled={loading}
              color="red"
              icon={XCircleIcon}
              size="xl"
              className="flex-1 text-lg py-4 bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {loading ? 'Rejecting...' : 'Reject'}
            </Button>
            <Button
              onClick={handleApprove}
              loading={loading}
              disabled={loading}
              color="emerald"
              icon={CheckCircleIcon}
              size="xl"
              className="flex-1 text-lg py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {loading ? 'Approving...' : 'Approve & Continue'}
            </Button>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-gray-200">
            <Text className="text-xs text-gray-500">
              Approval ID: {approval.id}
              {' • '}
              Workflow ID: {approval.workflow_id}
              {approval.step_order && ` • Step ${approval.step_order}`}
              {' • '}
              Created: {new Date(approval.created_at).toLocaleString()}
            </Text>
          </div>
        </div>
      </Card>
    </div>
  )
}
