import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useNotification } from '@/components/ui/Notification';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  language: string | null;
  updated_at: string;
  stargazers_count: number;
  owner: {
    login: string;
    avatar_url: string;
  };
}

interface RepositorySelectorProps {
  onSelectRepository: (repoUrl: string) => void;
  currentRepositoryUrl?: string;
  className?: string;
}

export const RepositorySelector: React.FC<RepositorySelectorProps> = ({
  onSelectRepository,
  currentRepositoryUrl,
  className = ''
}) => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<string | null>(currentRepositoryUrl || null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [page, setPage] = useState(1);
  
  const { addNotification } = useNotification();

  // Check GitHub connection status
  useEffect(() => {
    checkGitHubStatus();
  }, []);

  // Load repositories when component mounts or page changes
  useEffect(() => {
    if (githubConnected) {
      if (searchQuery) {
        searchRepositories();
      } else {
        loadRepositories();
      }
    }
  }, [githubConnected, page]);

  const checkGitHubStatus = async () => {
    try {
      const response = await apiService.checkGitHubStatus();
      setGithubConnected(response.connected);
      if (!response.connected) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to check GitHub status:', error);
      setGithubConnected(false);
      setLoading(false);
    }
  };

  const loadRepositories = async () => {
    setLoading(true);
    try {
      const response = await apiService.getGitHubRepositories({ 
        page,
        per_page: 12 
      });
      setRepositories(response.repositories);
    } catch (error: any) {
      console.error('Failed to load repositories:', error);
      addNotification({
        message: error.message || 'Failed to load repositories',
        type: 'error'
      });
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
        page: 1,
        per_page: 12 
      });
      setRepositories(response.repositories);
      setPage(1);
    } catch (error: any) {
      console.error('Failed to search repositories:', error);
      addNotification({
        message: error.message || 'Failed to search repositories',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRepository = async (repo: Repository) => {
    setSelectedRepo(repo.html_url);
    try {
      await apiService.setTeamRepository(repo.html_url);
      onSelectRepository(repo.html_url);
      addNotification({
        message: `Repository set to ${repo.full_name}`,
        type: 'success'
      });
    } catch (error: any) {
      console.error('Failed to set repository:', error);
      addNotification({
        message: error.message || 'Failed to set repository',
        type: 'error'
      });
      setSelectedRepo(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchRepositories();
  };

  const connectGitHub = () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';
    window.location.href = `${backendUrl}/api/auth/github`;
  };

  // Show GitHub connection prompt if not connected
  if (!githubConnected && !loading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 text-center ${className}`}>
        <div className="mb-4">
          <svg
            className="w-16 h-16 mx-auto text-gray-600 mb-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="text-xl font-semibold text-white mb-2">Connect GitHub</h3>
          <p className="text-gray-400 mb-4">
            Connect your GitHub account to select repositories for your team
          </p>
        </div>
        <Button onClick={connectGitHub} className="bg-gray-700 hover:bg-gray-600">
          Connect GitHub Account
        </Button>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-white mb-2">Select Repository</h3>
        <p className="text-gray-400 text-sm">
          Choose a GitHub repository for your team's collaboration
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            Search
          </Button>
        </div>
      </form>

      {/* Repository List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : repositories.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>No repositories found</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {repositories.map((repo) => (
            <div
              key={repo.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedRepo === repo.html_url
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-gray-700 hover:border-gray-600 hover:bg-gray-700/50'
              }`}
              onClick={() => handleSelectRepository(repo)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-white">
                      {repo.name}
                    </h4>
                    {repo.private && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-600/20 text-yellow-400 rounded">
                        Private
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-1">
                    {repo.owner.login}/{repo.name}
                  </p>
                  {repo.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {repo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {repo.language && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        {repo.language}
                      </span>
                    )}
                    <span>⭐ {repo.stargazers_count}</span>
                    <span>
                      Updated {new Date(repo.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {selectedRepo === repo.html_url && (
                  <div className="ml-2">
                    <svg
                      className="w-5 h-5 text-blue-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && repositories.length > 0 && (
        <div className="flex justify-between items-center mt-4">
          <Button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            variant="ghost"
          >
            Previous
          </Button>
          <span className="text-gray-400 text-sm">Page {page}</span>
          <Button
            onClick={() => setPage(p => p + 1)}
            disabled={repositories.length < 12}
            variant="ghost"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};