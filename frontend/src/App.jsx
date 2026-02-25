import { useState, useEffect } from 'react'
import { Card, Title, Text, Badge, Button, Grid, TabGroup, TabList, Tab, TabPanels, TabPanel, TextInput } from '@tremor/react'
import { Play, RefreshCw, Kanban, LayoutGrid, Info, Sparkles, Search, Plus, Link } from 'lucide-react'
import { supabase } from './services/supabase'
import KanbanBoard from './components/KanbanBoard'
import ExecutionLog from './components/ExecutionLog'
import AgentDetailModal from './components/AgentDetailModal'
import AgentChatModal from './components/AgentChatModal'
import WorkflowCreator from './components/WorkflowCreator'
import WorkflowMonitor from './components/WorkflowMonitor'
import NotificationCenter from './components/NotificationCenter'
import ApiConnectorModal from './components/ApiConnectorModal'
import ApprovalGate from './components/ApprovalGate'

function App() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(new Set())
  const [selectedTab, setSelectedTab] = useState(0)
  const [selectedExecution, setSelectedExecution] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [chatAgent, setChatAgent] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [sortOption, setSortOption] = useState('name')
  const [showApiConnector, setShowApiConnector] = useState(false)
  const [globalPendingApproval, setGlobalPendingApproval] = useState(null)

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('agents')
        .select(`
          *,
          project:projects(name, github_repo)
        `)
        .order('name')

      if (error) throw error
      setAgents(data || [])
    } catch (err) {
      console.error('Error fetching agents:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async (agent) => {
    setExecuting(prev => new Set(prev).add(agent.id))

    try {
      // Create execution record
      const { data, error } = await supabase
        .from('agent_executions')
        .insert({
          agent_id: agent.id,
          status: 'pending',
          triggered_by: 'manual',
          parameters_used: agent.parameters || {},
        })
        .select()
        .single()

      if (error) throw error

      // Trigger execution via API
      try {
        const response = await fetch(`/api/agents/${agent.id}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parameters: agent.parameters || {} }),
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`)
        }

        const result = await response.json()
        console.log('Execution started:', result)

        // Switch to Kanban view and show execution log
        setSelectedTab(1)
        setSelectedExecution(result.execution_id)
      } catch (apiErr) {
        console.error('API execution error:', apiErr)
        // Execution record created but API call failed - still switch to Kanban
        setSelectedTab(1)
      }
    } catch (err) {
      console.error('Error executing agent:', err)
      alert(`Failed to execute agent: ${err.message}`)
    } finally {
      setExecuting(prev => {
        const next = new Set(prev)
        next.delete(agent.id)
        return next
      })
    }
  }

  const getTagColor = (tag) => {
    const colorMap = {
      'python': 'blue',
      'enrichment': 'amber',
      'import': 'emerald',
      'debugging': 'red',
      'monitoring': 'purple',
      'deployment': 'indigo',
      'orchestration': 'cyan',
      'ai-powered': 'rose',
    }
    return colorMap[tag] || 'gray'
  }

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const sortedFilteredAgents = agents
    .filter(agent => {
      const term = searchTerm.toLowerCase()
      const matchesSearch =
        !term ||
        agent.name?.toLowerCase().includes(term) ||
        agent.description?.toLowerCase().includes(term) ||
        agent.project?.name?.toLowerCase().includes(term)

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every(tag => (agent.tags || []).includes(tag))

      return matchesSearch && matchesTags
    })
    .sort((a, b) => {
      if (sortOption === 'runs') {
        return (b.execution_count || 0) - (a.execution_count || 0)
      }
      if (sortOption === 'success') {
        return (b.success_rate || 0) - (a.success_rate || 0)
      }
      return (a.name || '').localeCompare(b.name || '')
    })

  const handleGlobalApprovalResponse = async (approvalId, approved, notes) => {
    if (!globalPendingApproval) return
    try {
      const response = await fetch(
        `/api/ceo/workflows/${globalPendingApproval.workflow_id}/approvals/${approvalId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: approved ? 'approved' : 'rejected',
            notes,
            approved_by: 'user'
          })
        }
      )
      if (!response.ok) throw new Error('Failed to update approval')
      setGlobalPendingApproval(null)
    } catch (err) {
      console.error('Error updating approval:', err)
      alert('Failed to update approval: ' + err.message)
    }
  }

  const allTags = Array.from(new Set(agents.flatMap(a => a.tags || [])))

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Text>Loading agents...</Text>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-0 bg-[var(--mc-surface-muted)]">
      <div className="mc-header mb-8">
        <div className="mc-header-bar max-w-6xl mx-auto">
          {/* Left cluster */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--mc-primary)] flex items-center justify-center shadow-lg">
                <Sparkles className="h-6 w-6 text-[var(--mc-dark)]" strokeWidth={2.2} />
              </div>
              <div>
                <Title className="mc-header-title">Mission Control Center</Title>
                <Text className="mc-header-subtitle">Autonomous AI orchestration powered by CEO Agent</Text>
              </div>
            </div>
            <div className="mc-header-chip">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live operations • Approve, monitor, optimize
            </div>
          </div>

          {/* Search / filters */}
          <div className="flex flex-col gap-2">
            <Text className="text-sm text-gray-100">Quick search across agents & projects</Text>
            <TextInput
              icon={Search}
              placeholder="Search agents, descriptions, projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/90"
            />
          </div>

          {/* Actions */}
          <div className="mc-header-controls">
            <NotificationCenter onApprovalClick={(approval) => setGlobalPendingApproval(approval)} />
            <Button
              size="md"
              variant="secondary"
              icon={Link}
              onClick={() => setShowApiConnector(true)}
              className="bg-white/15 text-white border border-white/30 hover:bg-white/25 hover:text-white focus:ring-white/60"
            >
              Integrations
            </Button>
            <Button
              size="md"
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchAgents}
              className="bg-white/15 text-white border border-white/30 hover:bg-white/25 hover:text-white focus:ring-white/60"
            >
              Refresh
            </Button>
            <Button
              size="md"
              icon={Plus}
              onClick={() => setSelectedTab(0)}
              className="bg-[var(--mc-primary)] text-[var(--mc-dark)] hover:bg-[var(--mc-primary-dark)] border-none"
            >
              New Workflow
            </Button>
            <Badge color="emerald" size="lg" className="mc-badge-count">
              {agents.length} Agents
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {/* Tabs */}
        <TabGroup index={selectedTab} onIndexChange={setSelectedTab}>
          <TabList className="mb-6 overflow-x-auto whitespace-nowrap gap-2">
            <Tab icon={Sparkles}>CEO Agent</Tab>
            <Tab icon={Kanban}>Execution Board</Tab>
            <Tab icon={LayoutGrid}>Agent Catalog</Tab>
          </TabList>

          <TabPanels>
            {/* CEO Agent View */}
            <TabPanel>
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <WorkflowCreator />
                </div>
                <div className="space-y-6">
                  <WorkflowMonitor />
                </div>
              </div>
            </TabPanel>

            {/* Kanban View */}
            <TabPanel>
              <KanbanBoard />
            </TabPanel>

            {/* Catalog View */}
            <TabPanel>
              {agents.length === 0 ? (
                <Card>
                  <Text>No agents found. Run <code>python database/seed_agents.py</code> to discover agents.</Text>
                </Card>
              ) : (
                <div className="space-y-4">
                  <Card className="mc-surface">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="mc-section-title">Agent Catalog</span>
                        <Text className="text-sm text-gray-600">Search, filter by tags, and sort.</Text>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <select
                          value={sortOption}
                          onChange={(e) => setSortOption(e.target.value)}
                          className="px-3 py-2 border rounded-md text-sm"
                        >
                          <option value="name">Sort: Name A→Z</option>
                          <option value="runs">Sort: Runs</option>
                          <option value="success">Sort: Success %</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {allTags.length === 0 && (
                        <Text className="text-sm text-gray-500">No tags available</Text>
                      )}
                      {allTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`mc-pill ${selectedTags.includes(tag) ? 'bg-[var(--mc-secondary)] text-white border border-[var(--mc-secondary-dark)]' : ''}`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </Card>

                  <Grid numItemsSm={1} numItemsMd={2} numItemsLg={3} className="gap-6">
                    {sortedFilteredAgents.map(agent => {
                      const runs = agent.execution_count || agent.total_runs || 0
                      const successRate = agent.success_rate ?? agent.success_rate_pct
                      const avgDuration = agent.avg_duration_seconds ?? agent.average_duration_seconds

                      return (
                        <Card
                          key={agent.id}
                          className="mc-agent-card mc-fade-in overflow-hidden"
                          onClick={() => setSelectedAgent(agent)}
                        >
                          <div className="h-2 w-full bg-gradient-to-r from-[#00A8E1] via-[#F5EC1E] to-[#2B7383]" />
                          <div className="space-y-3 mt-3">
                            <div>
                              <Title className="text-lg font-semibold">{agent.name}</Title>
                              <Text className="text-sm text-gray-500 mt-1">
                                {agent.project?.name || 'Unknown Project'}
                              </Text>
                            </div>

                            <Text className="text-sm line-clamp-2">
                              {agent.description || 'No description'}
                            </Text>

                            <div className="flex flex-wrap gap-2">
                              {(agent.tags || []).map(tag => (
                                <Badge key={tag} color={getTagColor(tag)} size="sm">
                                  {tag}
                                </Badge>
                              ))}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <span className="mc-pill">Runs: {runs}</span>
                              <span className="mc-pill">Success: {successRate != null ? `${Math.round(successRate)}%` : '—'}</span>
                              <span className="mc-pill">Avg: {avgDuration ? `${Math.round(avgDuration)}s` : '—'}</span>
                            </div>

                            <div className="pt-2 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                              <Text className="text-xs text-gray-500 mb-2">
                                {agent.script_path}
                              </Text>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  icon={Play}
                                  onClick={() => handleExecute(agent)}
                                  disabled={executing.has(agent.id)}
                                  className="flex-1"
                                >
                                  {executing.has(agent.id) ? 'Running...' : 'Run'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={Info}
                                  onClick={() => setSelectedAgent(agent)}
                                >
                                  Info
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </Grid>
                </div>
              )}
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>

      {/* Execution Log Modal */}
      {selectedExecution && (
        <ExecutionLog
          executionId={selectedExecution}
          onClose={() => setSelectedExecution(null)}
        />
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onExecute={handleExecute}
          onOpenChat={(agent) => {
            setSelectedAgent(null)
            setChatAgent(agent)
          }}
        />
      )}

      {/* Agent Chat Modal */}
      {chatAgent && (
        <AgentChatModal
          agent={chatAgent}
          onClose={() => setChatAgent(null)}
          onExecute={(agent, executionId) => {
            setChatAgent(null)
            setSelectedTab(1)
            setSelectedExecution(executionId)
          }}
        />
      )}

      {/* Global Approval Gate (triggered via notification center) */}
      {globalPendingApproval && (
        <ApprovalGate
          approval={globalPendingApproval}
          onApprove={(notes) => handleGlobalApprovalResponse(globalPendingApproval.id, true, notes)}
          onReject={(notes) => handleGlobalApprovalResponse(globalPendingApproval.id, false, notes)}
          onClose={() => setGlobalPendingApproval(null)}
        />
      )}

      {/* API Connector Modal */}
      {showApiConnector && (
        <ApiConnectorModal onClose={() => setShowApiConnector(false)} />
      )}
    </div>
  )
}

export default App
