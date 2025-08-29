import { useState, useEffect, useCallback } from 'react';
import { apiService, ApiError, type SpawnAgentRequest, type AgentDetails } from '@/services/api';
import type { Agent } from '@/types';

export interface AgentsState {
  agents: AgentDetails[];
  isLoading: boolean;
  error: string | null;
}

export interface AgentsHook extends AgentsState {
  loadAgents: () => Promise<void>;
  getAgentDetails: (agentId: string) => Promise<AgentDetails>;
  spawnAgent: (agentData: SpawnAgentRequest) => Promise<AgentDetails>;
  killAgent: (agentId: string) => Promise<void>;
  deleteAllAgents: () => Promise<number>;
  sendInputToAgent: (agentId: string, input: string) => Promise<void>;
  updateAgentStatus: (agentId: string, status: Agent['status']) => void;
  updateAgentOutput: (agentId: string, output: string) => void;
  clearError: () => void;
  refresh: () => Promise<void>;
}

export function useAgents(): AgentsHook {
  const [agents, setAgents] = useState<AgentDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiService.getAgents();
      setAgents(response.agents);
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to load agents';
      setError(errorMessage);
      console.error('Failed to load agents:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAgentDetails = useCallback(async (agentId: string): Promise<AgentDetails> => {
    try {
      const response = await apiService.getAgentDetails(agentId);
      
      // Update the agent in the list with fresh details
      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? response.agent : agent
      ));
      
      return response.agent;
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to get agent details';
      setError(errorMessage);
      throw error;
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const spawnAgent = useCallback(async (agentData: SpawnAgentRequest): Promise<AgentDetails> => {
    try {
      const response = await apiService.spawnAgent(agentData);
      
      // Add the new agent to the list
      setAgents(prev => [response.agent, ...prev]);
      
      return response.agent;
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to spawn agent';
      setError(errorMessage);
      throw error;
    }
  }, []);

  const killAgent = useCallback(async (agentId: string): Promise<void> => {
    try {
      await apiService.killAgent(agentId);
      
      // Remove the agent from the list
      setAgents(prev => prev.filter(agent => agent.id !== agentId));
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to delete agent';
      setError(errorMessage);
      throw error;
    }
  }, []);

  const deleteAllAgents = useCallback(async (): Promise<number> => {
    try {
      const response = await apiService.deleteAllAgents();
      
      // Clear all agents from the list
      setAgents([]);
      
      return response.deletedCount;
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to delete all agents';
      setError(errorMessage);
      throw error;
    }
  }, []);

  const sendInputToAgent = useCallback(async (agentId: string, input: string): Promise<void> => {
    try {
      await apiService.sendInputToAgent(agentId, input);
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to send input to agent';
      setError(errorMessage);
      throw error;
    }
  }, []);

  const updateAgentStatus = useCallback((agentId: string, status: Agent['status']) => {
    setAgents(prev => prev.map(agent => 
      agent.id === agentId ? { ...agent, status, lastActivity: new Date().toISOString() } : agent
    ));
  }, []);

  const updateAgentOutput = useCallback((agentId: string, output: string) => {
    setAgents(prev => prev.map(agent => {
      if (agent.id === agentId) {
        const currentOutput = agent.output || [];
        const newOutput = [...currentOutput, {
          timestamp: new Date().toISOString(),
          line: output
        }];
        
        // Keep only last 1000 lines
        const trimmedOutput = newOutput.length > 1000 ? newOutput.slice(-1000) : newOutput;
        
        return {
          ...agent,
          output: trimmedOutput,
          outputLines: trimmedOutput.length,
          lastActivity: new Date().toISOString()
        };
      }
      return agent;
    }));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    await loadAgents();
  }, [loadAgents]);

  return {
    agents,
    isLoading,
    error,
    loadAgents,
    getAgentDetails,
    spawnAgent,
    killAgent,
    deleteAllAgents,
    sendInputToAgent,
    updateAgentStatus,
    updateAgentOutput,
    clearError,
    refresh,
  };
}