import React, { useState, useEffect } from 'react';
import { LoginForm } from '@/components/features/auth/LoginForm';
import { RegisterForm } from '@/components/features/auth/RegisterForm';
import { JoinTeamForm } from '@/components/features/auth/JoinTeamForm';
import { GitHubSignupForm } from '@/components/features/auth/GitHubSignupForm';

type AuthMode = 'login' | 'register' | 'join' | 'github-signup';

interface AuthPageProps {
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (userData: { teamName: string; userName: string; email: string; password: string }) => Promise<void>;
  onGitHubSignupComplete: (userData: any) => void;
  error?: string;
  clearAuthError: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = (props) => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const { login, register, onGitHubSignupComplete, error, clearAuthError } = props;

  // Check for GitHub signup parameter on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const githubSignup = urlParams.get('github_signup');
    
    if (githubSignup === 'true') {
      setAuthMode('github-signup');
    }
  }, []);

  const renderAuthForm = () => {
    switch (authMode) {
      case 'login':
        return (
          <LoginForm
            onLogin={login}
            error={error}
            clearError={clearAuthError}
            onSwitchToRegister={() => setAuthMode('register')}
            onSwitchToJoinTeam={() => setAuthMode('join')}
          />
        );
      case 'register':
        return (
          <RegisterForm
            onRegister={register}
            error={error}
            clearError={clearAuthError}
            onSwitchToLogin={() => setAuthMode('login')}
          />
        );
      case 'join':
        return (
          <JoinTeamForm
            onSwitchToLogin={() => setAuthMode('login')}
          />
        );
      case 'github-signup':
        return (
          <GitHubSignupForm
            onSignupComplete={onGitHubSignupComplete}
            error={error}
            clearError={clearAuthError}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-midnight-900 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-electric/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute top-3/4 right-1/4 w-48 h-48 bg-team-purple/10 rounded-full blur-xl float" />
        <div className="absolute bottom-1/4 left-1/3 w-24 h-24 bg-success/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-br from-electric/5 to-team-purple/5" />
      </div>
      
      <div className="max-w-md w-full relative z-10">
        {/* CoVibe Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-wide">
            Co<span className="text-electric">Vibe</span>
          </h1>
          <p className="text-electric font-medium text-lg">
            Build together
          </p>
        </div>
        
        {/* Auth form container */}
        <div className="glass rounded-xl shadow-card-hover p-8">
          {renderAuthForm()}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400 font-medium">
            Collaborative intelligence
          </p>
        </div>
      </div>
    </div>
  );
};