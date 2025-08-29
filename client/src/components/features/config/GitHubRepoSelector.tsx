import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import { useNotification } from '@/components/ui/Notification';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  updated_at: string;
  language: string;
  stargazers_count: number;
  owner: {
    login: string;
    avatar_url: string;
  };
}

interface GitHubRepoSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (repository: Repository) => void;
  team?: any;
}

export const GitHubRepoSelector: React.FC<GitHubRepoSelectorProps> = ({
  isOpen,
  onClose,
  onSuccess,
  team
}) => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [githubConnected, setGitHubConnected] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [confirming, setConfirming] = useState(false);
  
  const { addNotification } = useNotification();

  // Check GitHub status when modal opens
  useEffect(() => {
    if (isOpen) {
      checkGitHubStatus();
    }
  }, [isOpen]);

  const checkGitHubStatus = async () => {
    try {
      const status = await apiService.checkGitHubStatus();
      setGitHubConnected(status.connected);
      
      if (status.connected) {
        loadRepositories();
      }
    } catch (error: any) {
      console.error('Failed to check GitHub status:', error);
      addNotification({
        message: 'Failed to check GitHub connection',
        type: 'error'
      });
    }
  };

  const loadRepositories = async () => {
    setLoading(true);
    try {
      const response = await apiService.getGitHubRepositories({
        sort: 'updated',
        per_page: 50
      });
      setRepositories(response.repositories);
    } catch (error: any) {
      console.error('Failed to load repositories:', error);
      addNotification({
        message: 'Failed to load repositories: ' + error.message,
        type: 'error'
      });
      
      if (error.message.includes('GitHub not connected')) {
        setGitHubConnected(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const searchRepositories = async () => {
    if (!searchQuery.trim()) {
      loadRepositories();
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.searchGitHubRepositories(searchQuery, {
        per_page: 30
      });
      setRepositories(response.repositories);
    } catch (error: any) {
      console.error('Failed to search repositories:', error);
      addNotification({
        message: 'Search failed: ' + error.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRepository = async (repo: Repository) => {
    setSelectedRepo(repo);
    setConfirming(true);
  };

  const handleConfirmSelection = async () => {
    if (!selectedRepo) return;

    try {
      await apiService.setTeamRepository(selectedRepo.html_url);
      
      addNotification({
        message: `Repository "${selectedRepo.full_name}" configured successfully!`,
        type: 'success'
      });
      
      onSuccess(selectedRepo);
      onClose();
    } catch (error: any) {
      console.error('Failed to set repository:', error);
      addNotification({
        message: 'Failed to configure repository: ' + error.message,
        type: 'error'
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchRepositories();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-midnight-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden border border-midnight-600">
        {/* Header */}
        <div className="p-6 border-b border-midnight-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Select GitHub Repository</h2>
              <p className="text-gray-400 text-sm mt-1">
                Choose a repository for your team to work with
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!githubConnected ? (
            <div className="text-center py-12">
              <div className="text-red-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.382 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">GitHub Not Connected</h3>
              <p className="text-gray-400 mb-4">
                Please login with GitHub to access your repositories
              </p>
              <a
                href={`${import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/github`}
                className="inline-flex items-center px-4 py-2 bg-electric hover:bg-electric/80 text-midnight-900 font-medium rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Connect GitHub
              </a>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="flex gap-3 mb-6">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full px-4 py-2 bg-midnight-700 border border-midnight-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-electric"
                  />
                </div>
                <button
                  onClick={searchRepositories}
                  disabled={loading}
                  className="px-4 py-2 bg-electric hover:bg-electric/80 disabled:opacity-50 text-midnight-900 font-medium rounded-lg transition-colors"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      loadRepositories();
                    }}
                    className="px-4 py-2 bg-midnight-600 hover:bg-midnight-500 text-white rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Repository List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-electric mx-auto"></div>
                    <p className="text-gray-400 mt-2">Loading repositories...</p>
                  </div>
                ) : repositories.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No repositories found</p>
                  </div>
                ) : (
                  repositories.map((repo) => (
                    <div
                      key={repo.id}
                      className="p-4 bg-midnight-700 rounded-lg border border-midnight-600 hover:border-electric/50 transition-colors cursor-pointer"
                      onClick={() => handleSelectRepository(repo)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <img
                              src={repo.owner.avatar_url}
                              alt={repo.owner.login}
                              className="w-6 h-6 rounded-full"
                            />
                            <div>
                              <h3 className="font-medium text-white">{repo.full_name}</h3>
                              {repo.description && (
                                <p className="text-sm text-gray-400 mt-1">{repo.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            {repo.language && (
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-electric"></div>
                                {repo.language}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                              {repo.stargazers_count}
                            </span>
                            {repo.private && (
                              <span className="text-yellow-400">Private</span>
                            )}
                            {repo.fork && (
                              <span className="text-blue-400">Fork</span>
                            )}
                            {repo.archived && (
                              <span className="text-red-400">Archived</span>
                            )}
                          </div>
                        </div>
                        <button className="px-3 py-1.5 bg-electric hover:bg-electric/80 text-midnight-900 text-sm font-medium rounded transition-colors">
                          Select
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Confirmation Modal */}
        {confirming && selectedRepo && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-midnight-700 rounded-lg p-6 w-full max-w-md mx-4 border border-midnight-600">
              <h3 className="text-lg font-bold text-white mb-4">Confirm Repository Selection</h3>
              <p className="text-gray-300 mb-2">
                Set <strong>{selectedRepo.full_name}</strong> as your team's repository?
              </p>
              {selectedRepo.description && (
                <p className="text-sm text-gray-400 mb-4">{selectedRepo.description}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmSelection}
                  className="flex-1 px-4 py-2 bg-electric hover:bg-electric/80 text-midnight-900 font-medium rounded-lg transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => {
                    setConfirming(false);
                    setSelectedRepo(null);
                  }}
                  className="flex-1 px-4 py-2 bg-midnight-600 hover:bg-midnight-500 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};