import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GitHubButton } from '@/components/ui/GitHubButton';
import { useNotification } from '@/components/ui/Notification';

interface LoginFormProps {
  onLogin: (credentials: { email: string; password: string }) => Promise<void>;
  error?: string;
  clearError: () => void;
  onSwitchToRegister?: () => void;
  onSwitchToJoinTeam?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onLogin,
  error,
  clearError,
  onSwitchToRegister,
  onSwitchToJoinTeam,
}) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { addNotification } = useNotification();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
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
      await onLogin(formData);
      addNotification({
        message: 'Login successful! Welcome back.',
        type: 'success',
      });
    } catch (error: any) {
      console.error('Login failed:', error);
      
      // Enhanced error message for dev mode
      let errorMessage = 'Login failed. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      // In dev mode, show full error details (logging removed)
      
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
        <h1 className="text-3xl font-bold text-white mb-2">CoVibe</h1>
        <p className="text-gray-400">Welcome back</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-600 border border-red-500 rounded text-white text-sm">
          <div className="font-semibold mb-1">Login Failed</div>
          <div>{error}</div>
          {import.meta.env.DEV && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs opacity-80 hover:opacity-100">
                View Technical Details
              </summary>
              <pre className="mt-2 p-2 bg-black/30 rounded text-xs overflow-auto whitespace-pre-wrap">
                {JSON.stringify({ error, timestamp: new Date().toISOString() }, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="email"
          name="email"
          type="email"
          label="Email Address"
          value={formData.email}
          onChange={handleInputChange('email')}
          error={errors.email}
          required
          autoComplete="email"
          disabled={isSubmitting}
          data-testid="login-email"
        />

        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          value={formData.password}
          onChange={handleInputChange('password')}
          error={errors.password}
          required
          autoComplete="current-password"
          disabled={isSubmitting}
          data-testid="login-password"
        />

        <Button
          type="submit"
          className="w-full"
          loading={isSubmitting}
          disabled={isSubmitting}
          data-testid="login-button"
        >
          Sign In
        </Button>
      </form>

      <div className="mt-4 text-center">
        <div className="text-gray-500 text-sm mb-3">or</div>
        <GitHubButton 
          className="w-full"
          disabled={isSubmitting}
        />
      </div>

      <div className="mt-6 text-center text-sm">
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-blue-400 hover:text-blue-300 hover:underline mr-2"
          disabled={isSubmitting}
        >
          Create Team
        </button>
        <span className="text-gray-500 mx-2">|</span>
        <button
          type="button"
          onClick={onSwitchToJoinTeam}
          className="text-blue-400 hover:text-blue-300 hover:underline ml-2"
          disabled={isSubmitting}
        >
          Join Team
        </button>
      </div>
    </div>
  );
};