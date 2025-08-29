import React, { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/components/ui/Notification';
import { apiService } from '@/services/api';
import { GitHubRepoSelector } from './GitHubRepoSelector';

interface RepoConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  team?: any; // Team object passed from Dashboard
}

export const RepoConfigModal: React.FC<RepoConfigModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  team,
}) => {
  const { getCurrentUser } = useAuth();
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [configMethod, setConfigMethod] = useState<'github' | 'manual'>('github');
  const [showGitHubSelector, setShowGitHubSelector] = useState(false);
  const { addNotification } = useNotification();

  // Update repositoryUrl when modal opens or team changes
  useEffect(() => {
    if (isOpen && team?.repositoryUrl) {
      setRepositoryUrl(team.repositoryUrl);
    }
  }, [isOpen, team?.repositoryUrl]);

  // Check GitHub connection status when modal opens
  useEffect(() => {
    const checkGitHubStatus = async () => {
      if (isOpen) {
        try {
          const status = await apiService.checkGitHubStatus();
          setGithubConnected(status.connected);
          
          // Default to GitHub method if connected, otherwise manual
          setConfigMethod(status.connected ? 'github' : 'manual');
        } catch (error) {
          console.error('Failed to check GitHub status:', error);
          setGithubConnected(false);
          setConfigMethod('manual');
        }
      }
    };

    checkGitHubStatus();
  }, [isOpen]);

  const resetForm = () => {
    setRepositoryUrl(team?.repositoryUrl || '');
    setError('');
    setIsSubmitting(false);
    setShowGitHubSelector(false);
  };

  const handleGitHubRepoSelected = async (repository: any) => {
    try {
      // Refresh user data to get updated team info
      await getCurrentUser();
      
      addNotification({
        message: `Repository "${repository.full_name}" configured successfully!`,
        type: 'success',
      });

      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error after repository selection:', error);
      addNotification({
        message: 'Repository configured but failed to refresh data',
        type: 'warning',
      });
    }
  };

  const validateUrl = (url: string) => {
    if (!url.trim()) {
      return 'Repository URL is required';
    }

    // Basic URL validation
    try {
      const parsedUrl = new URL(url.trim());
      
      // Check if it's GitHub or GitLab
      if (!parsedUrl.hostname.includes('github.com') && !parsedUrl.hostname.includes('gitlab.com')) {
        return 'Only GitHub and GitLab repositories are supported';
      }

      // Check for proper path structure (should have at least user/repo)
      const pathParts = parsedUrl.pathname.split('/').filter(part => part);
      if (pathParts.length < 2) {
        return 'Invalid repository URL format. Expected: https://github.com/user/repo';
      }

      return '';
    } catch {
      return 'Please enter a valid URL';
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const validationError = validateUrl(repositoryUrl);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await apiService.configureRepository({ repositoryUrl: repositoryUrl.trim() });
      
      // Refresh user data to get updated team info
      await getCurrentUser();
      
      addNotification({
        message: 'Repository configured successfully!',
        type: 'success',
      });

      onClose();
      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to configure repository';
      setError(errorMessage);
      addNotification({
        message: errorMessage,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRepositoryUrl(e.target.value);
    if (error) {
      setError('');
    }
  };

  const fillExampleUrls = (provider: 'github' | 'gitlab') => {
    const examples = {
      github: 'https://github.com/username/repository-name',
      gitlab: 'https://gitlab.com/username/repository-name'
    };
    setRepositoryUrl(examples[provider]);
    setError('');
  };

  // Extract repo name from URL for display
  const getRepoDisplayName = (url: string) => {
    try {
      const match = url.match(/(?:github|gitlab)\.com\/([^\/]+\/[^\/]+)/);
      return match ? match[1].replace(/\.git$/, '') : '';
    } catch {
      return '';
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !showGitHubSelector}
        onClose={handleClose}
        title="Configure Project Repository"
        size="md"
        closeOnBackdropClick={!isSubmitting}
        closeOnEscape={!isSubmitting}
      >
        <div className="space-y-6">
          {/* Method Selection Tabs */}
          {githubConnected && (
            <div className="flex space-x-1 p-1 bg-midnight-700 rounded-lg">
              <button
                type="button"
                onClick={() => setConfigMethod('github')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  configMethod === 'github'
                    ? 'bg-electric text-midnight-900'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub Repositories
              </button>
              <button
                type="button"
                onClick={() => setConfigMethod('manual')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  configMethod === 'manual'
                    ? 'bg-electric text-midnight-900'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Manual URL
              </button>
            </div>
          )}

          {configMethod === 'github' && githubConnected ? (
            // GitHub Repository Selection
            <div className="space-y-4">
              <div className="bg-green-900 bg-opacity-30 border border-green-600 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-400 mb-1">
                      GitHub Integration Active
                    </p>
                    <p className="text-xs text-green-200">
                      Select a repository from your GitHub account. Both public and private repositories are supported.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGitHubSelector(true)}
                className="w-full p-4 bg-midnight-700 hover:bg-midnight-600 border border-midnight-600 hover:border-electric/50 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <svg className="w-8 h-8 text-electric" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    <div className="text-left">
                      <p className="font-medium text-white">Browse GitHub Repositories</p>
                      <p className="text-sm text-gray-400">Select from your personal and organization repos</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>
          ) : (
            // Manual URL Entry Form
            <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info banner */}
        <div className="bg-green-900 bg-opacity-30 border border-green-600 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-400 mb-1">
                Repository Configuration
              </p>
              <p className="text-xs text-green-200">
                Link your project repository so agents can access and work on your code. 
                Supports both public and private GitHub/GitLab repositories.
              </p>
            </div>
          </div>
        </div>

        {/* Current repository display */}
        {team?.repositoryUrl && (
          <div className="bg-blue-900 bg-opacity-30 border border-blue-600 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-400 mb-1">Currently configured:</p>
            <p className="text-xs font-mono text-blue-200 break-all">{team.repositoryUrl}</p>
            <p className="text-xs text-blue-300 mt-1">
              Repository: {getRepoDisplayName(team.repositoryUrl)}
            </p>
          </div>
        )}

        {/* Repository URL input */}
        <div className="space-y-3">
          <Input
            id="repositoryUrl"
            name="repositoryUrl"
            type="url"
            label="Repository URL"
            value={repositoryUrl}
            onChange={handleInputChange}
            error={error}
            required
            disabled={isSubmitting}
            placeholder="https://github.com/username/repository-name"
            className="font-mono"
          />

          {/* Quick fill buttons */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Paste the full URL from GitHub or GitLab
            </p>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => fillExampleUrls('github')}
                disabled={isSubmitting}
                className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
              >
                GitHub example
              </button>
              <span className="text-xs text-gray-500">|</span>
              <button
                type="button"
                onClick={() => fillExampleUrls('gitlab')}
                disabled={isSubmitting}
                className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
              >
                GitLab example
              </button>
            </div>
          </div>
        </div>

        {/* Repository display preview */}
        {repositoryUrl && !error && (
          <div className="bg-gray-900 border border-gray-600 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Repository preview:</p>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-300 font-mono">
                {getRepoDisplayName(repositoryUrl) || 'Repository name will appear here'}
              </span>
            </div>
          </div>
        )}

        {/* Repository access information */}
        <div className="bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-400 mb-2">
                Repository Access
              </p>
              <ul className="text-xs text-yellow-200 space-y-1">
                <li>• <strong>Public repositories:</strong> Work immediately</li>
                <li>• <strong>Private repositories:</strong> Ensure your VM has proper git credentials configured</li>
                <li>• <strong>SSH keys:</strong> Configure SSH keys on your VM for private repo access</li>
                <li>• <strong>HTTPS access:</strong> May require personal access tokens</li>
              </ul>
            </div>
          </div>
        </div>

            </form>
          )}

          {configMethod === 'manual' && (
            <ModalFooter
              onCancel={handleClose}
              onConfirm={handleSubmit}
              cancelText="Cancel"
              confirmText={team?.repositoryUrl ? "Update Repository" : "Save Repository"}
              confirmVariant="success"
              isLoading={isSubmitting}
            />
          )}

          {/* GitHub Not Connected Case */}
          {!githubConnected && (
            <div className="text-center py-8 space-y-4">
              <div className="text-yellow-400">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.382 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">GitHub Integration</h3>
                <p className="text-gray-400 mb-4">
                  For the best experience, connect your GitHub account to easily select repositories
                </p>
                <div className="flex justify-center space-x-3">
                  <a
                    href={`${import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/github`}
                    className="inline-flex items-center px-4 py-2 bg-electric hover:bg-electric/80 text-midnight-900 font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    Connect GitHub
                  </a>
                  <button
                    type="button"
                    onClick={() => setConfigMethod('manual')}
                    className="inline-flex items-center px-4 py-2 bg-midnight-600 hover:bg-midnight-500 text-white rounded-lg transition-colors"
                  >
                    Use Manual URL Instead
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* GitHub Repository Selector Modal */}
      <GitHubRepoSelector
        isOpen={showGitHubSelector}
        onClose={() => setShowGitHubSelector(false)}
        onSuccess={handleGitHubRepoSelected}
        team={team}
      />
    </>
  );
};