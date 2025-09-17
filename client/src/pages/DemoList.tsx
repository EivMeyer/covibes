import React, { useState, useEffect } from 'react'
import { apiService } from '../services/api'

export const DemoList: React.FC = () => {
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const response = await apiService.getAgents()
        setAgents(response.agents || [])
      } catch (err: any) {
        setError(err.message || 'Failed to load agents')
      } finally {
        setLoading(false)
      }
    }

    loadAgents()
    // Refresh every 5 seconds
    const interval = setInterval(loadAgents, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Terminal Demo - Agent List</h1>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Spawn an agent from the main dashboard first</li>
            <li>Click on any agent below to open the demo terminal</li>
            <li>The terminal will connect to the agent's output stream</li>
            <li>Features: Canvas rendering, large scrollback, smart resize handling</li>
          </ol>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-gray-400">Loading agents...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900 text-red-200 p-4 rounded-lg mb-6">
            Error: {error}
          </div>
        )}

        {!loading && agents.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">No agents found</p>
            <p className="text-sm text-gray-500">
              Please spawn an agent from the main dashboard first
            </p>
          </div>
        )}

        {agents.length > 0 && (
          <div className="grid gap-4">
            <h2 className="text-xl font-semibold">Active Agents ({agents.length})</h2>
            {agents.map((agent) => (
              <a
                key={agent.id}
                href={`/demo?agentId=${agent.id}`}
                className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 transition-colors block"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{agent.task}</h3>
                    <p className="text-sm text-gray-400">
                      ID: {agent.id.slice(0, 8)} | User: {agent.userName} | Status: {agent.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      agent.status === 'running' ? 'bg-green-900 text-green-300' :
                      agent.status === 'completed' ? 'bg-blue-900 text-blue-300' :
                      agent.status === 'failed' ? 'bg-red-900 text-red-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {agent.status}
                    </span>
                    <span className="text-blue-400">Open Terminal →</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-gray-700">
          <h3 className="text-lg font-semibold mb-2">Direct Terminal Test</h3>
          <div className="flex gap-4">
            <a
              href="/demo"
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
            >
              Open Standalone Terminal (No Agent)
            </a>
            <a
              href="/"
              className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition-colors"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}