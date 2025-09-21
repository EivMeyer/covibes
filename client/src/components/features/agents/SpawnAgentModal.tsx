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
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
            AI AGENT
          </label>

          {/* Claude - Available */}
          <div
            className={`relative group bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-cyan-500/10 border-2 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${
              formData.agentType === 'claude'
                ? 'border-blue-400 shadow-lg shadow-blue-500/25 animate-pulse-slow'
                : 'border-gray-700 hover:border-blue-400/60'
            }`}
            onClick={() => setFormData({ ...formData, agentType: 'claude' })}
          >
            {formData.agentType === 'claude' && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl animate-pulse" />
            )}
            <div className="relative flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg transform group-hover:rotate-3 transition-transform duration-300">
                    <span className="text-white text-lg font-bold">C</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800 animate-pulse" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Claude Code</p>
                  <p className="text-xs text-gray-400 group-hover:text-blue-300 transition-colors">Anthropic's AI assistant</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${
                formData.agentType === 'claude'
                  ? 'bg-blue-400 border-blue-400 shadow-lg shadow-blue-400/50'
                  : 'border-gray-600 group-hover:border-blue-400'
              }`}>
                {formData.agentType === 'claude' && (
                  <svg className="w-full h-full text-white p-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Gemini - Coming Soon */}
          <div className="relative bg-gray-800/30 border-2 border-gray-700/50 rounded-xl p-4 opacity-50 cursor-not-allowed">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl flex items-center justify-center">
                  <span className="text-gray-500 text-lg font-bold">G</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-400 text-sm">Gemini</p>
                  <p className="text-xs text-gray-600">Google AI</p>
                </div>
              </div>
              <span className="text-xs text-amber-400/70 bg-amber-400/10 border border-amber-400/30 px-2 py-1 rounded-full font-medium animate-pulse">Coming Soon</span>
            </div>
          </div>

          {/* OpenAI - Coming Soon */}
          <div className="relative bg-gray-800/30 border-2 border-gray-700/50 rounded-xl p-4 opacity-50 cursor-not-allowed">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl flex items-center justify-center">
                  <span className="text-gray-500 text-lg font-bold">O</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-400 text-sm">OpenAI</p>
                  <p className="text-xs text-gray-600">GPT models</p>
                </div>
              </div>
              <span className="text-xs text-amber-400/70 bg-amber-400/10 border border-amber-400/30 px-2 py-1 rounded-full font-medium animate-pulse">Coming Soon</span>
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
            MODE
          </label>

          <div className="grid grid-cols-2 gap-4">
            {/* Chat Mode (Assistant) - Default, shown first */}
            <div
              className={`relative group border-2 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                formData.mode === 'chat'
                  ? 'bg-gradient-to-br from-purple-500/15 via-purple-500/10 to-pink-500/15 border-purple-400 shadow-lg shadow-purple-500/20'
                  : 'bg-gray-800/40 border-gray-700 hover:border-purple-400/50 hover:bg-gray-800/60'
              }`}
              onClick={() => setFormData({ ...formData, mode: 'chat' })}
            >
              {formData.mode === 'chat' && (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl animate-pulse" />
              )}
              <div className="relative flex flex-col items-center space-y-3">
                <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                  formData.mode === 'chat'
                    ? 'bg-gradient-to-br from-purple-400 to-pink-400 shadow-lg'
                    : 'bg-gradient-to-br from-gray-700 to-gray-800'
                }`}>
                  <span className="text-2xl">💬</span>
                  {formData.mode === 'chat' && (
                    <div className="absolute -inset-1 bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl opacity-20 animate-pulse blur-sm" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-semibold text-white text-sm">Assistant</p>
                  <p className={`text-xs transition-colors ${
                    formData.mode === 'chat' ? 'text-purple-300' : 'text-gray-500 group-hover:text-gray-400'
                  }`}>Chat mode</p>
                </div>
              </div>
            </div>

            {/* Terminal Mode */}
            <div
              className={`relative group border-2 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                formData.mode === 'terminal'
                  ? 'bg-gradient-to-br from-green-500/15 via-green-500/10 to-emerald-500/15 border-green-400 shadow-lg shadow-green-500/20'
                  : 'bg-gray-800/40 border-gray-700 hover:border-green-400/50 hover:bg-gray-800/60'
              }`}
              onClick={() => setFormData({ ...formData, mode: 'terminal' })}
            >
              {formData.mode === 'terminal' && (
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl animate-pulse" />
              )}
              <div className="relative flex flex-col items-center space-y-3">
                <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                  formData.mode === 'terminal'
                    ? 'bg-gradient-to-br from-green-400 to-emerald-400 shadow-lg'
                    : 'bg-gradient-to-br from-gray-700 to-gray-800'
                }`}>
                  <span className="text-white text-xl font-mono font-bold">›_</span>
                  {formData.mode === 'terminal' && (
                    <div className="absolute -inset-1 bg-gradient-to-br from-green-400 to-emerald-400 rounded-xl opacity-20 animate-pulse blur-sm" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-semibold text-white text-sm">Terminal</p>
                  <p className={`text-xs transition-colors ${
                    formData.mode === 'terminal' ? 'text-green-300' : 'text-gray-500 group-hover:text-gray-400'
                  }`}>Raw output</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 mt-3">
            <p className="text-xs text-gray-400 leading-relaxed">
              {formData.mode === 'terminal'
                ? '🖥️ See raw terminal output as commands execute. Best for debugging and system tasks.'
                : '✨ Clean conversation interface with full coding capabilities. Recommended for most users.'}
            </p>
          </div>
        </div>

        <ModalFooter
          onCancel={handleClose}
          onConfirm={handleSubmit}
          cancelText="Cancel"
          confirmText={isSubmitting ? "Spawning..." : "🚀 Spawn Agent"}
          confirmVariant="primary"
          isLoading={isSubmitting}
        />
      </form>
    </Modal>
  );
};