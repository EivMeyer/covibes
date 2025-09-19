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
    mode: 'terminal', // Default to terminal mode
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

  const { spawnAgent } = useAgents();
  const { team } = useAuth();
  const { addNotification } = useNotification();

  const resetForm = () => {
    setFormData({
      task: '',
      agentType: 'claude',
      terminalLocation: 'local',
      terminalIsolation: 'tmux',
      mode: 'terminal',
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
    // No validation needed anymore since we removed the task field
    return true;
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

      addNotification({
        message: `Claude agent started successfully!`,
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
        handleSubmit();
      }
      
      // Escape to close modal
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, handleSubmit, handleClose]);


  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Choose AI Assistant"
      size="lg"
      closeOnBackdropClick={!isSubmitting}
      closeOnEscape={!isSubmitting}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Agent Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Choose AI Agent
          </label>

          {/* Claude - Available */}
          <div
            className="bg-blue-500 bg-opacity-10 border-2 border-blue-500 rounded-lg p-4 cursor-pointer transition-all hover:bg-opacity-20"
            onClick={() => setFormData({ ...formData, agentType: 'claude' })}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🤖</span>
                <div>
                  <p className="font-semibold text-white">Claude Code</p>
                  <p className="text-xs text-blue-300">Advanced AI coding assistant</p>
                </div>
              </div>
              <div className="w-5 h-5 border-2 border-blue-500 rounded-full bg-blue-500" />
            </div>
          </div>

          {/* Gemini - Coming Soon */}
          <div className="bg-gray-800 bg-opacity-50 border border-gray-600 rounded-lg p-4 opacity-50 cursor-not-allowed">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">✨</span>
                <div>
                  <p className="font-semibold text-gray-400">Gemini CLI</p>
                  <p className="text-xs text-gray-500">Google's AI assistant (Coming soon)</p>
                </div>
              </div>
              <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">Soon</span>
            </div>
          </div>

          {/* Codex - Coming Soon */}
          <div className="bg-gray-800 bg-opacity-50 border border-gray-600 rounded-lg p-4 opacity-50 cursor-not-allowed">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="font-semibold text-gray-400">Codex</p>
                  <p className="text-xs text-gray-500">OpenAI code model (Coming soon)</p>
                </div>
              </div>
              <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">Soon</span>
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Agent Mode
          </label>

          <div className="grid grid-cols-2 gap-3">
            {/* Terminal Mode */}
            <div
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                formData.mode === 'terminal'
                  ? 'bg-green-500 bg-opacity-10 border-green-500 hover:bg-opacity-20'
                  : 'bg-gray-800 bg-opacity-50 border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => setFormData({ ...formData, mode: 'terminal' })}
            >
              <div className="flex flex-col items-center space-y-2">
                <span className="text-2xl">💻</span>
                <div className="text-center">
                  <p className="font-semibold text-white">Terminal Mode</p>
                  <p className="text-xs text-gray-400">Full VM access with sudo & Docker</p>
                </div>
                <div className={`w-4 h-4 border-2 rounded-full ${
                  formData.mode === 'terminal'
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-500'
                }`} />
              </div>
            </div>

            {/* Chat Mode */}
            <div
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                formData.mode === 'chat'
                  ? 'bg-purple-500 bg-opacity-10 border-purple-500 hover:bg-opacity-20'
                  : 'bg-gray-800 bg-opacity-50 border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => setFormData({ ...formData, mode: 'chat' })}
            >
              <div className="flex flex-col items-center space-y-2">
                <span className="text-2xl">💬</span>
                <div className="text-center">
                  <p className="font-semibold text-white">Chat Mode</p>
                  <p className="text-xs text-gray-400">Clean discussion & planning</p>
                </div>
                <div className={`w-4 h-4 border-2 rounded-full ${
                  formData.mode === 'chat'
                    ? 'border-purple-500 bg-purple-500'
                    : 'border-gray-500'
                }`} />
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 italic">
            {formData.mode === 'terminal'
              ? 'Terminal mode runs with your full VM permissions including sudo, Docker, and system package installation.'
              : 'Chat mode provides clean conversation for planning and discussion while still able to coordinate with other agents.'}
          </p>
        </div>

        <ModalFooter
          onCancel={handleClose}
          onConfirm={handleSubmit}
          cancelText="Cancel"
          confirmText="Spawn"
          confirmVariant="primary"
          isLoading={isSubmitting}
        />
      </form>
    </Modal>
  );
};