import React, { useState } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useAgents } from '@/hooks/useAgents';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/components/ui/Notification';
import type { SpawnAgentRequest, ContainerSpawnOptions } from '@/types';

interface SpawnAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (agentId: string) => void;
}

export const SpawnAgentModal: React.FC<SpawnAgentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<SpawnAgentRequest>({
    task: '',
    agentType: 'claude',
    terminalLocation: 'local',
    terminalIsolation: 'tmux',
    containerOptions: {
      resources: {
        memory: '2GB',
        cpu: '1.0',
      },
      workspaceMount: true,
      environment: {},
    },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const { spawnAgent } = useAgents();
  const { team } = useAuth();
  const { addNotification } = useNotification();

  const resetForm = () => {
    setFormData({
      task: '',
      agentType: 'claude',
      terminalLocation: 'local',
      terminalIsolation: 'tmux',
      containerOptions: {
        resources: {
          memory: '2GB',
          cpu: '1.0',
        },
        workspaceMount: true,
        environment: {},
      },
    });
    setErrors({});
    setIsSubmitting(false);
    setShowAdvancedOptions(false);
  };

  // Helper function to update container options
  const updateContainerOption = (path: string, value: any) => {
    const newContainerOptions = { ...formData.containerOptions };
    const keys = path.split('.');
    let current: any = newContainerOptions;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setFormData({ ...formData, containerOptions: newContainerOptions });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Task is now optional - if provided, validate length
    if (formData.task.trim() && formData.task.length < 10) {
      newErrors.task = 'Task description must be at least 10 characters';
    } else if (formData.task.length > 500) {
      newErrors.task = 'Task description must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const agent = await spawnAgent({
        ...formData,
        task: formData.task.trim(),
      });

      const taskSummary = formData.task.trim() 
        ? `Task: "${formData.task.slice(0, 50)}${formData.task.length > 50 ? '...' : ''}"`
        : 'Ready for interactive session';
        
      addNotification({
        message: `Agent spawned successfully! ${taskSummary}`,
        type: 'success',
      });

      resetForm();
      onClose();
      onSuccess?.(agent.id);
    } catch (error) {
      console.error('Failed to spawn agent:', error);
      addNotification({
        message: error instanceof Error ? error.message : 'Failed to spawn agent',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof SpawnAgentRequest) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [field]: e.target.value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  // Handle keyboard shortcuts within the modal
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter to submit form (but not if in textarea to allow line breaks)
      if (e.key === 'Enter' && !e.shiftKey && e.target !== document.querySelector('#task')) {
        e.preventDefault();
        console.log('🎹 Enter pressed - submitting agent form');
        handleSubmit();
      }
      
      // Escape to close modal
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        console.log('🎹 Escape pressed - closing modal');
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, handleSubmit, handleClose]);

  const taskExamples = [
    "Fix the login form validation bug",
    "Add a dark mode toggle to the navigation bar",
    "Create a responsive mobile menu component",
    "Optimize the database queries in the user service",
    "Write unit tests for the authentication module",
    "Implement infinite scroll for the messages list",
    "Add error boundaries to prevent crashes",
    "Create a loading skeleton for the dashboard",
  ];

  const getRandomExample = () => {
    return taskExamples[Math.floor(Math.random() * taskExamples.length)];
  };

  const fillExample = () => {
    if (!isSubmitting) {
      setFormData({ ...formData, task: getRandomExample() });
      setErrors({ ...errors, task: '' });
    }
  };

  const characterCount = formData.task.length;
  const characterLimit = 500;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Spawn New Agent"
      size="lg"
      closeOnBackdropClick={!isSubmitting}
      closeOnEscape={!isSubmitting}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Repository info */}
        {team?.repositoryUrl && (
          <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-green-400">Repository Connected</span>
            </div>
            <p className="text-xs text-gray-400 break-all">
              {team.repositoryUrl}
            </p>
          </div>
        )}

        {/* Agent type - Claude AI only */}
        <div className="bg-blue-500 bg-opacity-10 border border-blue-500 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🤖</span>
            <div>
              <p className="font-semibold text-white text-lg">Claude AI Agent</p>
              <p className="text-sm text-blue-300">Advanced coding assistant ready to help with your tasks</p>
            </div>
          </div>
        </div>

        {/* Terminal Configuration */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Terminal Configuration
          </label>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Location</label>
              <select
                value={formData.terminalLocation || 'local'}
                onChange={(e) => setFormData({ ...formData, terminalLocation: e.target.value as 'local' | 'remote' })}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="local">Local - This machine</option>
                <option value="remote" disabled>Remote - VM (Coming soon)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Isolation</label>
              <select
                value={formData.terminalIsolation || 'tmux'}
                onChange={(e) => setFormData({ ...formData, terminalIsolation: e.target.value as 'none' | 'docker' | 'tmux' })}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="tmux">Persistent Tmux - Claude sessions (Default)</option>
                <option value="none">Simple PTY - Direct access</option>
                <option value="docker">Docker Container - Isolated environment</option>
              </select>
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              {formData.terminalIsolation === 'docker' ? (
                <>
                  <span className="text-lg">🐳</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-200">Docker Container Mode</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Agent runs in isolated Docker environment with dedicated resources and full container management.
                    </p>
                  </div>
                </>
              ) : formData.terminalIsolation === 'tmux' ? (
                <>
                  <span className="text-lg">🖥️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-200">Persistent Tmux Mode</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Agent runs Claude commands in persistent tmux sessions that survive disconnections and restarts. Recommended for most tasks.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-lg">⚡</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-200">Simple PTY Mode</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Agent runs directly on the host system with fast startup and minimal overhead. No session persistence.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Task description */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-300">
              Task Description <span className="text-gray-500">(optional)</span>
            </label>
            <button
              type="button"
              onClick={fillExample}
              disabled={isSubmitting}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              Use example
            </button>
          </div>
          
          <Textarea
            id="task"
            name="task"
            value={formData.task}
            onChange={handleInputChange('task') as any}
            error={errors.task}
            disabled={isSubmitting}
            rows={3}
            placeholder="What would you like Claude to help you with? (Leave empty for interactive chat)"
          />
          
          <div className="flex justify-between items-center text-xs">
            <div className="text-gray-500">
              <span>💡 Leave empty to start an interactive chat with Claude</span>
            </div>
            <span className={`${
              characterCount > characterLimit 
                ? 'text-red-400' 
                : characterCount > characterLimit * 0.8 
                  ? 'text-yellow-400' 
                  : 'text-gray-500'
            }`}>
              {characterCount}/{characterLimit}
            </span>
          </div>
        </div>

        {/* Container Options - Only show when Docker mode is selected */}
        {formData.terminalIsolation === 'docker' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-300">
                Container Options
              </label>
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                disabled={isSubmitting}
                className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 flex items-center gap-1"
              >
                {showAdvancedOptions ? 'Hide Advanced' : 'Show Advanced'}
                <svg 
                  className={`w-3 h-3 transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Basic Container Info */}
            <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-2xl">🐳</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-200">Docker Container</p>
                  <p className="text-xs text-gray-400">Isolated environment with dedicated resources</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="text-center">
                  <div className="text-gray-400">Memory</div>
                  <div className="text-gray-200 font-mono">{formData.containerOptions?.resources?.memory || '2GB'}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">CPU</div>
                  <div className="text-gray-200 font-mono">{formData.containerOptions?.resources?.cpu || '1.0'}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">Workspace</div>
                  <div className={`${formData.containerOptions?.workspaceMount ? 'text-green-400' : 'text-red-400'}`}>
                    {formData.containerOptions?.workspaceMount ? 'Mounted' : 'Isolated'}
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Options */}
            {showAdvancedOptions && (
              <div className="space-y-4 bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 border-b border-gray-700 pb-2">
                  Resource Allocation
                </h4>
                
                {/* Memory Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Memory Limit</label>
                  <select
                    value={formData.containerOptions?.resources?.memory || '2GB'}
                    onChange={(e) => updateContainerOption('resources.memory', e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="1GB">1GB - Light tasks</option>
                    <option value="2GB">2GB - Standard (Recommended)</option>
                    <option value="4GB">4GB - Heavy processing</option>
                    <option value="8GB">8GB - Large projects</option>
                  </select>
                </div>

                {/* CPU Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">CPU Allocation</label>
                  <select
                    value={formData.containerOptions?.resources?.cpu || '1.0'}
                    onChange={(e) => updateContainerOption('resources.cpu', e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="0.5">0.5 Core - Light tasks</option>
                    <option value="1.0">1.0 Core - Standard (Recommended)</option>
                    <option value="2.0">2.0 Cores - Heavy processing</option>
                    <option value="4.0">4.0 Cores - Maximum performance</option>
                  </select>
                </div>

                {/* Workspace Mount */}
                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.containerOptions?.workspaceMount || false}
                      onChange={(e) => updateContainerOption('workspaceMount', e.target.checked)}
                      disabled={isSubmitting}
                      className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm text-gray-300">Mount Team Workspace</span>
                      <p className="text-xs text-gray-500">Allow agent to access and modify shared team files</p>
                    </div>
                  </label>
                </div>

                {/* Estimated Resources */}
                <div className="mt-4 pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-400 mb-2">Estimated startup time: ~15-30 seconds</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Resource allocation:</span>
                    <span className="text-gray-300">
                      {formData.containerOptions?.resources?.memory || '2GB'} RAM, 
                      {formData.containerOptions?.resources?.cpu || '1.0'} CPU
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <ModalFooter
          onCancel={handleClose}
          onConfirm={handleSubmit}
          cancelText="Cancel"
          confirmText="🚀 Spawn Claude"
          confirmVariant="primary"
          isLoading={isSubmitting}
        />
      </form>
    </Modal>
  );
};