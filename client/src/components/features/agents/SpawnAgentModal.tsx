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
  onSuccess?: (agent: any) => void;  // Pass full agent object, not just ID
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
    mode: 'chat', // Default to chat mode - more user friendly
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
      mode: 'chat',
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
      onSuccess?.(agent);  // Pass full agent object with mode
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
      size="md"
      closeOnBackdropClick={!isSubmitting}
      closeOnEscape={!isSubmitting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Agent Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-400 mb-2">
            AI AGENT
          </label>

          {/* Claude - Available */}
          <div
            className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-400 rounded-lg p-3 cursor-pointer transition-all hover:from-blue-500/20 hover:to-cyan-500/20 hover:shadow-lg hover:shadow-blue-500/20"
            onClick={() => setFormData({ ...formData, agentType: 'claude' })}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">C</span>
                </div>
                <div>
                  <p className="font-medium text-white text-sm">Claude Code</p>
                  <p className="text-xs text-blue-300">Anthropic's AI assistant</p>
                </div>
              </div>
              <div className="w-4 h-4 border-2 border-blue-400 rounded-full bg-blue-400" />
            </div>
          </div>

          {/* Gemini - Coming Soon */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 opacity-40 cursor-not-allowed">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400 text-sm font-bold">G</span>
                </div>
                <div>
                  <p className="font-medium text-gray-400 text-sm">Gemini</p>
                  <p className="text-xs text-gray-500">Google AI</p>
                </div>
              </div>
              <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">Soon</span>
            </div>
          </div>

          {/* Codex - Coming Soon */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 opacity-40 cursor-not-allowed">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400 text-sm font-bold">O</span>
                </div>
                <div>
                  <p className="font-medium text-gray-400 text-sm">OpenAI</p>
                  <p className="text-xs text-gray-500">GPT models</p>
                </div>
              </div>
              <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">Soon</span>
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-400 mb-2">
            MODE
          </label>

          <div className="grid grid-cols-2 gap-3">
            {/* Chat Mode (Assistant) - Default, shown first */}
            <div
              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                formData.mode === 'chat'
                  ? 'bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-400 hover:shadow-lg hover:shadow-purple-500/20'
                  : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => setFormData({ ...formData, mode: 'chat' })}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  formData.mode === 'chat'
                    ? 'bg-gradient-to-br from-purple-400 to-pink-400'
                    : 'bg-gray-700'
                }`}>
                  <span className="text-white text-sm">💬</span>
                </div>
                <div className="text-center">
                  <p className="font-medium text-white text-sm">Assistant</p>
                  <p className="text-xs text-gray-400">Chat mode</p>
                </div>
              </div>
            </div>

            {/* Terminal Mode */}
            <div
              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                formData.mode === 'terminal'
                  ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-400 hover:shadow-lg hover:shadow-green-500/20'
                  : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => setFormData({ ...formData, mode: 'terminal' })}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  formData.mode === 'terminal'
                    ? 'bg-gradient-to-br from-green-400 to-emerald-400'
                    : 'bg-gray-700'
                }`}>
                  <span className="text-white text-lg">›_</span>
                </div>
                <div className="text-center">
                  <p className="font-medium text-white text-sm">Terminal</p>
                  <p className="text-xs text-gray-400">Raw output</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            {formData.mode === 'terminal'
              ? 'See raw terminal output as commands execute. Best for debugging and system tasks.'
              : 'Clean conversation interface with full coding capabilities. Recommended for most users.'}
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