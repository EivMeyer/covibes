import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { useNotification } from '@/components/ui/Notification';
import { useSoundSettings } from '@/context/SoundSettingsContext';
import axios from 'axios';

interface SettingsPageProps {
  user?: any;
  team?: any;
  token?: string;
  logout?: () => void;
  onBack?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  team,
  token,
  logout,
  onBack
}) => {
  const { addNotification } = useNotification();
  const { soundsEnabled, setSoundsEnabled } = useSoundSettings();
  const [enableContextSharing, setEnableContextSharing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch current settings when component mounts
  useEffect(() => {
    if (token) {
      fetchSettings();
    }
  }, [token]);

  const fetchSettings = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await axios.get('/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update local state
      if (response.data.user?.soundsEnabled !== undefined) {
        setSoundsEnabled(response.data.user.soundsEnabled);
      }
      if (response.data.team?.enableContextSharing !== undefined) {
        setEnableContextSharing(response.data.team.enableContextSharing);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      addNotification({
        message: 'Failed to load settings',
        type: 'error',
        duration: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSoundToggle = async (enabled: boolean) => {
    if (!token) return;

    setSoundsEnabled(enabled);
    setSaving(true);

    try {
      await axios.put('/api/settings/user',
        { soundsEnabled: enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      addNotification({
        message: `Notification sounds ${enabled ? 'enabled' : 'disabled'}`,
        type: 'success',
        duration: 2000
      });
    } catch (error) {
      console.error('Failed to update sound settings:', error);
      addNotification({
        message: 'Failed to update sound settings',
        type: 'error',
        duration: 3000
      });
      // Revert on error
      setSoundsEnabled(!enabled);
    } finally {
      setSaving(false);
    }
  };

  const handleContextSharingToggle = async (enabled: boolean) => {
    if (!token) return;

    setEnableContextSharing(enabled);
    setSaving(true);

    try {
      await axios.put('/api/settings/team',
        { enableContextSharing: enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      addNotification({
        message: `Context sharing ${enabled ? 'enabled' : 'disabled'}`,
        type: 'success',
        duration: 2000
      });
    } catch (error) {
      console.error('Failed to update context sharing:', error);
      addNotification({
        message: 'Failed to update context sharing settings',
        type: 'error',
        duration: 3000
      });
      // Revert on error
      setEnableContextSharing(!enabled);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-midnight-900">
      {/* Header */}
      <div className="bg-midnight-800 border-b border-midnight-600 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-midnight-700 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-white">Settings</h1>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-400">{user?.email}</span>
            <Button
              size="sm"
              variant="danger"
              onClick={logout}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Personal Preferences Section */}
            <div className="bg-midnight-800 rounded-xl border border-midnight-600 overflow-hidden">
              <div className="px-6 py-4 border-b border-midnight-600">
                <h2 className="text-lg font-medium text-white">Personal Preferences</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Customize your individual experience
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Sound Settings */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-white">
                      Notification Sounds
                    </h3>
                    <p className="mt-1 text-sm text-gray-400">
                      Play sounds when notifications appear
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={soundsEnabled}
                    onClick={() => handleSoundToggle(!soundsEnabled)}
                    disabled={saving}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
                      border-2 border-transparent transition-colors duration-200 ease-in-out
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                      focus:ring-offset-midnight-800
                      ${soundsEnabled ? 'bg-indigo-600' : 'bg-midnight-600'}
                      ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <span className="sr-only">Enable notification sounds</span>
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full
                        bg-white shadow ring-0 transition duration-200 ease-in-out
                        ${soundsEnabled ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>

                {/* Theme Settings (Future) */}
                <div className="flex items-start justify-between opacity-50">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-white">
                      Dark Mode
                    </h3>
                    <p className="mt-1 text-sm text-gray-400">
                      Use dark theme (always on for now)
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={true}
                    disabled
                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full
                      border-2 border-transparent bg-indigo-600"
                  >
                    <span className="sr-only">Dark mode</span>
                    <span className="pointer-events-none inline-block h-5 w-5 transform rounded-full
                      bg-white shadow translate-x-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Team Settings Section */}
            <div className="bg-midnight-800 rounded-xl border border-midnight-600 overflow-hidden">
              <div className="px-6 py-4 border-b border-midnight-600">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-white">Team Settings</h2>
                    <p className="mt-1 text-sm text-gray-400">
                      Configure settings for {team?.name || 'your team'}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-900/50 text-indigo-400 border border-indigo-500/30">
                    {team?.inviteCode}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Context Sharing */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-white">
                      Context Sharing
                    </h3>
                    <p className="mt-1 text-sm text-gray-400">
                      Allow agents to see what other team members are working on via active.json
                    </p>
                    <div className="mt-2 p-3 bg-midnight-700/50 rounded-lg border border-midnight-600">
                      <p className="text-xs text-gray-500">
                        When enabled, agents can read team activity from a shared file.
                        This helps with coordination but can be disabled for privacy.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enableContextSharing}
                    onClick={() => handleContextSharingToggle(!enableContextSharing)}
                    disabled={saving}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
                      border-2 border-transparent transition-colors duration-200 ease-in-out
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                      focus:ring-offset-midnight-800
                      ${enableContextSharing ? 'bg-indigo-600' : 'bg-midnight-600'}
                      ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <span className="sr-only">Enable context sharing</span>
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full
                        bg-white shadow ring-0 transition duration-200 ease-in-out
                        ${enableContextSharing ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>

                {/* Repository Settings (Link to existing) */}
                {team?.repositoryUrl && (
                  <div className="pt-4 border-t border-midnight-600">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-white">Repository</h3>
                        <p className="mt-1 text-xs text-gray-500 font-mono">
                          {team.repositoryUrl}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={onBack}
                      >
                        Configure
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-midnight-800 rounded-xl border border-red-900/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-red-900/30 bg-red-900/10">
                <h2 className="text-lg font-medium text-red-400">Danger Zone</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Irreversible actions
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white">Leave Team</h3>
                    <p className="mt-1 text-sm text-gray-400">
                      Remove yourself from {team?.name}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled
                  >
                    Coming Soon
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};