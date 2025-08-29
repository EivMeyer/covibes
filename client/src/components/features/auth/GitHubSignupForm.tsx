import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useNotification } from '@/components/ui/Notification';
import { apiService } from '@/services/api';

interface GitHubSignupFormProps {
  onSignupComplete: (userData: any) => void;
  error?: string;
  clearError: () => void;
}

export const GitHubSignupForm: React.FC<GitHubSignupFormProps> = ({
  onSignupComplete,
  error,
  clearError,
}) => {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [formData, setFormData] = useState({
    teamName: '',
    inviteCode: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { addNotification } = useNotification();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (mode === 'create') {
      if (!formData.teamName.trim()) {
        newErrors.teamName = 'Team name is required';
      } else if (formData.teamName.length < 2) {
        newErrors.teamName = 'Team name must be at least 2 characters';
      }
    } else {
      if (!formData.inviteCode.trim()) {
        newErrors.inviteCode = 'Team code is required';
      } else if (formData.inviteCode.length < 6) {
        newErrors.inviteCode = 'Team code must be at least 6 characters';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiService.completeGitHubSignup({
        action: mode === 'create' ? 'create_team' : 'join_team',
        teamName: mode === 'create' ? formData.teamName : undefined,
        inviteCode: mode === 'join' ? formData.inviteCode : undefined,
      });

      // Store token
      localStorage.setItem('colabvibe_auth_token', response.token);
      
      addNotification({
        message: `Successfully ${mode === 'create' ? 'created team' : 'joined team'} with GitHub!`,
        type: 'success',
      });

      // Clean URL and complete signup
      window.history.replaceState({}, document.title, window.location.pathname);
      onSignupComplete(response);

    } catch (error: any) {
      console.error('GitHub signup completion failed:', error);
      
      let errorMessage = 'GitHub signup failed. Please try again.';
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      addNotification({
        message: errorMessage,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Complete Setup</h1>
        <p className="text-gray-400">Choose your team option</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-600 border border-red-500 rounded text-white text-sm">
          <div className="font-semibold mb-1">Setup Failed</div>
          <div>{error}</div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex bg-gray-700 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
              mode === 'create'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
            disabled={isSubmitting}
          >
            Create Team
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
              mode === 'join'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
            disabled={isSubmitting}
          >
            Join Team
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'create' ? (
          <Input
            id="teamName"
            name="teamName"
            type="text"
            label="Team Name"
            value={formData.teamName}
            onChange={handleInputChange('teamName')}
            error={errors.teamName}
            required
            disabled={isSubmitting}
            placeholder="Enter your team name"
          />
        ) : (
          <Input
            id="inviteCode"
            name="inviteCode"
            type="text"
            label="Team Code"
            value={formData.inviteCode}
            onChange={handleInputChange('inviteCode')}
            error={errors.inviteCode}
            required
            disabled={isSubmitting}
            placeholder="Enter team invite code"
          />
        )}

        <Button
          type="submit"
          className="w-full"
          loading={isSubmitting}
          disabled={isSubmitting}
          variant={mode === 'create' ? 'success' : 'primary'}
        >
          {mode === 'create' ? 'Create Team' : 'Join Team'}
        </Button>
      </form>
    </div>
  );
};