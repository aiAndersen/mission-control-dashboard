// API configuration for development and production
const isDevelopment = import.meta.env.DEV
const API_BASE_URL = isDevelopment ? 'http://localhost:3001' : ''

export const API_ENDPOINTS = {
  // CEO Agent endpoints
  ceo: {
    plan: `${API_BASE_URL}/api/ceo/plan`,
    save: `${API_BASE_URL}/api/ceo/save`,
    create: `${API_BASE_URL}/api/ceo/create`,
    execute: `${API_BASE_URL}/api/ceo/execute`,
    transcribe: `${API_BASE_URL}/api/ceo/transcribe`,
    workflowExecute: (workflowId) => `${API_BASE_URL}/api/ceo/workflows/${workflowId}/execute`,
    workflowApproval: (workflowId, approvalId) => `${API_BASE_URL}/api/ceo/workflows/${workflowId}/approvals/${approvalId}`
  },

  // Agent endpoints
  agents: {
    list: `${API_BASE_URL}/api/agents`,
    execute: (agentId) => `${API_BASE_URL}/api/agents/${agentId}/execute`
  },

  // Workflow management endpoints
  workflows: {
    list: `${API_BASE_URL}/api/workflows`,
    get: (workflowId) => `${API_BASE_URL}/api/workflows/${workflowId}`,
    delete: (workflowId) => `${API_BASE_URL}/api/workflows/${workflowId}`,
    cancel: (workflowId) => `${API_BASE_URL}/api/workflows/${workflowId}/cancel`,
    duplicate: (workflowId) => `${API_BASE_URL}/api/workflows/${workflowId}/duplicate`,
    update: (workflowId) => `${API_BASE_URL}/api/workflows/${workflowId}`
  },

  // Execution control endpoints
  executionControl: {
    pause: (executionId) => `${API_BASE_URL}/api/execution-control/pause/${executionId}`,
    resume: (executionId) => `${API_BASE_URL}/api/execution-control/resume/${executionId}`,
    cancel: (executionId) => `${API_BASE_URL}/api/execution-control/cancel/${executionId}`,
    stop: (executionId) => `${API_BASE_URL}/api/execution-control/stop/${executionId}`
  },

  // Executions endpoints
  executions: {
    list: `${API_BASE_URL}/api/executions`,
    byAgent: (agentId) => `${API_BASE_URL}/api/executions?agent_id=${agentId}`,
    byWorkflow: (workflowId) => `${API_BASE_URL}/api/executions?workflow_id=${workflowId}`
  }
}

export default API_BASE_URL
