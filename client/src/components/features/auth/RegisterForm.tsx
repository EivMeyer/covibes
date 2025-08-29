import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GitHubButton } from '@/components/ui/GitHubButton';
import { useNotification } from '@/components/ui/Notification';

interface RegisterFormProps {
  onRegister: (userData: { teamName: string; userName: string; email: string; password: string }) => Promise<void>;
  error?: string;
  clearError: () => void;
  onSwitchToLogin?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onRegister,
  error,
  clearError,
  onSwitchToLogin,
}) => {
  const [formData, setFormData] = useState({
    teamName: '',
    userName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { addNotification } = useNotification();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.teamName.trim()) {
      newErrors.teamName = 'Team name is required';
    } else if (formData.teamName.length < 2) {
      newErrors.teamName = 'Team name must be at least 2 characters';
    }

    if (!formData.userName.trim()) {
      newErrors.userName = 'Your name is required';
    } else if (formData.userName.length < 2) {
      newErrors.userName = 'Name must be at least 2 characters';
    }

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

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const { confirmPassword, ...registerData } = formData;
      await onRegister(registerData);
      addNotification({
        message: `Team "${formData.teamName}" created successfully! Welcome to CoVibe.`,
        type: 'success',
      });
    } catch (error) {
      console.error('Registration failed:', error);
      addNotification({
        message: error instanceof Error ? error.message : 'Registration failed. Please try again.',
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
        <h2 className="text-2xl font-bold text-white mb-2">Create New Team</h2>
        <p className="text-gray-400">Start collaborating with AI agents</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-600 border border-red-500 rounded text-white text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
          placeholder="My Awesome Team"
        />

        <Input
          id="userName"
          name="userName"
          type="text"
          label="Your Name"
          value={formData.userName}
          onChange={handleInputChange('userName')}
          error={errors.userName}
          required
          disabled={isSubmitting}
          placeholder="John Doe"
        />

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
          placeholder="john@example.com"
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
          autoComplete="new-password"
          disabled={isSubmitting}
          placeholder="At least 6 characters"
        />

        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleInputChange('confirmPassword')}
          error={errors.confirmPassword}
          required
          autoComplete="new-password"
          disabled={isSubmitting}
          placeholder="Repeat your password"
        />

        <Button
          type="submit"
          variant="success"
          className="w-full"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Create Team
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
        <span className="text-gray-400">Already have an account? </span>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-blue-400 hover:text-blue-300 hover:underline"
          disabled={isSubmitting}
        >
          Sign In
        </button>
      </div>
    </div>
  );
};