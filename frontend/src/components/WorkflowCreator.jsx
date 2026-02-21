import { useState, useRef } from 'react'
import { Card, Title, Text, Button, Badge, Callout } from '@tremor/react'
import { PlayIcon, SparklesIcon, ClockIcon, CurrencyDollarIcon, ExclamationTriangleIcon, CheckCircleIcon, MicrophoneIcon, BookmarkIcon } from '@heroicons/react/24/outline'
import WorkflowCanvas from './workflow-editor/WorkflowCanvas'
import '../styles/workflow-editor.css'

export default function WorkflowCreator() {
  const [userPrompt, setUserPrompt] = useState('')
  const [isPlanning, setIsPlanning] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [plan, setPlan] = useState(null)
  const [workflowId, setWorkflowId] = useState(null)
  const [error, setError] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [planViewMode, setPlanViewMode] = useState('list') // 'list' or 'canvas'
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const handleGeneratePlan = async () => {
    if (!userPrompt.trim()) {
      setError('Please enter a task description')
      return
    }

    setIsPlanning(true)
    setError(null)
    setPlan(null)

    try {
      const response = await fetch('/api/ceo/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate plan')
      }

      setPlan(data.plan)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsPlanning(false)
    }
  }

  const handleSaveWorkflow = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/ceo/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userPrompt })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save workflow')
      }

      setWorkflowId(data.workflowId)
      setPlan(null) // Clear plan after saving
      setUserPrompt('') // Clear input
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleExecuteWorkflow = async () => {
    setIsExecuting(true)
    setError(null)

    try {
      const response = await fetch('/api/ceo/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userPrompt })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute workflow')
      }

      setWorkflowId(data.workflowId)
      setPlan(null) // Clear plan after execution
      setUserPrompt('') // Clear input
    } catch (err) {
      setError(err.message)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleMicrophoneClick = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
      }
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        }

        mediaRecorder.onstop = async () => {
          setIsRecording(false)
          setIsTranscribing(true)

          try {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
            const formData = new FormData()
            formData.append('audio', audioBlob, 'recording.webm')

            const response = await fetch('/api/ceo/transcribe', {
              method: 'POST',
              body: formData
            })

            const data = await response.json()

            if (!response.ok) {
              throw new Error(data.error || 'Failed to transcribe audio')
            }

            // Append transcribed text to existing prompt
            setUserPrompt(prev => prev ? `${prev}\n\n${data.text}` : data.text)
          } catch (err) {
            setError(err.message)
          } finally {
            setIsTranscribing(false)
            // Stop all tracks to release microphone
            stream.getTracks().forEach(track => track.stop())
          }
        }

        mediaRecorder.start()
        setIsRecording(true)
      } catch (err) {
        setError('Microphone access denied or not available')
        console.error('Error accessing microphone:', err)
      }
    }
  }

  return (
    <div className="mc-fade-in space-y-6">
      {/* Success Message */}
      {workflowId && (
        <Callout
          title={isSaving ? "Workflow Saved Successfully" : "Workflow Started Successfully"}
          color={isSaving ? "blue" : "emerald"}
          icon={isSaving ? BookmarkIcon : CheckCircleIcon}
          className="animate-fade-in"
        >
          <div className="text-gray-900 font-medium">Workflow ID: {workflowId.substring(0, 8)}...</div>
          <div className="text-gray-700 mt-1">
            {isSaving
              ? "Workflow has been saved. View and execute it from the 'Active Workflows' section below."
              : "The CEO Agent is now orchestrating your workflow. Monitor progress in the 'Execution Board' tab or scroll down to see live status updates."
            }
          </div>
        </Callout>
      )}

      {/* Error Message */}
      {error && (
        <Callout
          title="Error"
          icon={ExclamationTriangleIcon}
          color="red"
        >
          <div className="text-gray-900">{error}</div>
        </Callout>
      )}

      {/* Main Input Card */}
      {!plan && (
        <Card className="shadow-lg border-2 border-[#00A8E1]/20">
          <div className="flex items-center gap-3 mb-4">
            <SparklesIcon className="h-7 w-7 text-[#00A8E1]" />
            <Title className="text-2xl text-gray-900">What would you like to accomplish?</Title>
          </div>

          <Text className="mb-4 text-gray-700 text-base leading-relaxed">
            Describe your task in plain English. The CEO Agent will analyze your request, identify the best approach,
            create new specialized agents if needed, and coordinate existing agents to complete your task.
          </Text>

          <div className="relative">
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Example: Check system health and fix any issues found&#10;&#10;Example: Import all content from Google Drive and enrich it&#10;&#10;Example: Analyze user queries and identify content gaps"
              className="w-full h-40 px-4 py-3 pr-16 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00A8E1] focus:border-[#00A8E1] resize-none text-gray-900 text-base placeholder-gray-500"
              disabled={isPlanning || isExecuting || isRecording || isTranscribing}
            />
            <button
              onClick={handleMicrophoneClick}
              disabled={isPlanning || isExecuting || isTranscribing}
              className={`absolute right-3 top-3 p-3 rounded-full transition-all ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                  : isTranscribing
                  ? 'bg-blue-400 cursor-wait'
                  : 'bg-[#00A8E1] hover:bg-[#0096C9]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isRecording ? 'Click to stop recording' : isTranscribing ? 'Transcribing...' : 'Click to record'}
            >
              <MicrophoneIcon className="h-6 w-6 text-white" />
            </button>
          </div>

          {isRecording && (
            <div className="flex items-center gap-2 text-red-600 font-semibold animate-pulse">
              <span className="h-3 w-3 bg-red-600 rounded-full"></span>
              Recording... Click microphone to stop
            </div>
          )}

          {isTranscribing && (
            <div className="flex items-center gap-2 text-blue-600 font-semibold">
              <span className="h-3 w-3 bg-blue-600 rounded-full animate-spin"></span>
              Transcribing audio...
            </div>
          )}

          <div className="mt-6">
            <Button
              onClick={handleGeneratePlan}
              loading={isPlanning}
              disabled={!userPrompt.trim() || isExecuting}
              icon={SparklesIcon}
              color="blue"
              size="xl"
              className="w-full text-lg py-4 bg-[#00A8E1] hover:bg-[#0096C9]"
            >
              {isPlanning ? 'CEO Agent Planning...' : 'Generate Plan'}
            </Button>
            <Text className="text-center text-gray-600 text-sm mt-3">
              The CEO Agent will create a detailed execution plan for your review
            </Text>
          </div>
        </Card>
      )}

      {/* Plan Review & Approval */}
      {plan && (
        <div className="space-y-6 animate-fade-in">
          {/* Approval Header */}
          <Card className="shadow-lg border-2 border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="flex items-center gap-3 mb-3">
              <ExclamationTriangleIcon className="h-8 w-8 text-amber-600" />
              <Title className="text-2xl text-gray-900">Review & Approve Plan</Title>
            </div>
            <Text className="text-gray-800 text-base leading-relaxed">
              The CEO Agent has created an execution plan. Please review the steps below carefully and approve to proceed.
            </Text>
          </Card>

          {/* Plan Overview */}
          <Card className="shadow-md">
            <div className="space-y-4">
              <div>
                <Title className="text-xl text-gray-900 mb-2">{plan.workflow_name}</Title>
                <Text className="text-gray-700 text-base leading-relaxed">{plan.reasoning}</Text>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-center">
                  <Badge color="blue" size="xl" className="text-base px-4 py-2">
                    {plan.steps?.length || 0} Steps
                  </Badge>
                  <Text className="text-gray-600 text-sm mt-2">Total Actions</Text>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <ClockIcon className="h-5 w-5 text-gray-600" />
                    <Text className="font-bold text-gray-900 text-lg">~{plan.estimated_duration_minutes || 0} min</Text>
                  </div>
                  <Text className="text-gray-600 text-sm mt-2">Est. Duration</Text>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <CurrencyDollarIcon className="h-5 w-5 text-gray-600" />
                    <Text className="font-bold text-gray-900 text-lg">${(plan.estimated_cost || 0).toFixed(2)}</Text>
                  </div>
                  <Text className="text-gray-600 text-sm mt-2">Est. API Cost</Text>
                </div>
              </div>
            </div>
          </Card>

          {/* New Agents Section */}
          {plan.new_agents_needed && plan.new_agents_needed.length > 0 && (
            <Card className="shadow-md border-2 border-purple-300 bg-purple-50">
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="h-6 w-6 text-purple-600" />
                <Title className="text-lg text-gray-900">New Agents Will Be Created</Title>
              </div>
              <Text className="text-gray-800 mb-4 text-base">
                The CEO Agent identified capability gaps and will create {plan.new_agents_needed.length} specialized {plan.new_agents_needed.length === 1 ? 'agent' : 'agents'}.
                You'll approve the generated code before deployment.
              </Text>
              <div className="space-y-3">
                {plan.new_agents_needed.map((agent, idx) => (
                  <div key={idx} className="p-4 bg-white rounded-lg border-2 border-purple-200 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <Text className="font-bold text-gray-900 text-base">{agent.name}</Text>
                      <Badge color="purple" size="sm">New Agent</Badge>
                    </div>
                    <Text className="text-gray-700 mb-3">{agent.description}</Text>
                    <div className="flex flex-wrap gap-2">
                      <Text className="text-xs text-gray-600 font-semibold">Capabilities:</Text>
                      {agent.capabilities?.map((cap, capIdx) => (
                        <Badge key={capIdx} size="sm" color="purple" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Workflow Steps */}
          <Card className="shadow-md">
            <div className="flex items-center justify-between mb-4">
              <Title className="text-xl text-gray-900">Execution Plan ({plan.steps?.length || 0} Steps)</Title>
              {/* View Mode Toggle */}
              <div className="canvas-view-toggle">
                <button
                  className={planViewMode === 'list' ? 'active' : ''}
                  onClick={() => setPlanViewMode('list')}
                >
                  List View
                </button>
                <button
                  className={planViewMode === 'canvas' ? 'active' : ''}
                  onClick={() => setPlanViewMode('canvas')}
                >
                  Canvas View
                </button>
              </div>
            </div>

            {planViewMode === 'canvas' ? (
              /* Canvas View */
              <WorkflowCanvas
                workflow={{
                  workflow_plan: {
                    title: plan.workflow_name,
                    description: plan.reasoning,
                    steps: plan.steps
                  }
                }}
                executionStatus={{}}
                readOnly={true}
              />
            ) : (
              /* List View */
              <div className="space-y-3">
                {plan.steps?.map((step) => (
                <div
                  key={step.step_number}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-[#00A8E1] hover:shadow-md transition-all bg-white"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3 flex-1">
                      <Badge color="blue" size="lg" className="text-base px-3">
                        {step.step_number}
                      </Badge>
                      <div className="flex-1">
                        <Text className="font-bold text-gray-900 text-base">{step.agent}</Text>
                        {step.requires_approval && (
                          <Badge color="amber" icon={ExclamationTriangleIcon} className="mt-1">
                            Requires Your Approval
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Text className="text-gray-700 ml-14">{step.description}</Text>

                  {/* Parameters */}
                  {step.parameters && Object.keys(step.parameters).length > 0 && (
                    <div className="mt-3 ml-14 flex flex-wrap gap-2">
                      {Object.entries(step.parameters).map(([key, value]) => (
                        <Badge key={key} size="sm" color="gray" className="text-xs">
                          {key}: <span className="font-semibold">{String(value)}</span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              </div>
            )}
          </Card>

          {/* Approval Notice */}
          {plan.steps?.some(s => s.requires_approval) && (
            <Callout
              title="Human Approval Required"
              color="amber"
              icon={ExclamationTriangleIcon}
            >
              <div className="text-gray-900 font-medium">
                {plan.steps.filter(s => s.requires_approval).length} step(s) require your approval before execution.
              </div>
              <div className="text-gray-700 mt-1">
                The CEO Agent will pause at each approval gate and wait for your decision. You can approve or reject each critical action.
              </div>
            </Callout>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              onClick={() => {
                setPlan(null)
                setError(null)
              }}
              variant="secondary"
              size="xl"
              className="flex-1 text-lg py-4"
              disabled={isExecuting || isSaving}
            >
              Cancel & Edit Task
            </Button>
            <Button
              onClick={handleSaveWorkflow}
              loading={isSaving}
              icon={BookmarkIcon}
              color="blue"
              size="xl"
              className="flex-1 text-lg py-4 bg-[#00A8E1] hover:bg-[#0096C9]"
              disabled={isExecuting}
            >
              {isSaving ? 'Saving Workflow...' : 'Approve & Save'}
            </Button>
            <Button
              onClick={handleExecuteWorkflow}
              loading={isExecuting}
              icon={PlayIcon}
              color="emerald"
              size="xl"
              className="flex-1 text-lg py-4 bg-emerald-600 hover:bg-emerald-700"
              disabled={isSaving}
            >
              {isExecuting ? 'Starting Workflow...' : 'Approve & Execute'}
            </Button>
          </div>

          {/* Help Text */}
          <Card className="bg-blue-50 border-blue-200">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <BookmarkIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <Text className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-900">Approve & Save:</span> Save this workflow for later execution. View and manage saved workflows in the "Active Workflows" section below.
                </Text>
                <Text className="text-sm text-gray-700 mt-2">
                  <span className="font-semibold text-gray-900">Approve & Execute:</span> Start workflow execution immediately.
                </Text>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
