import React, { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useNotification } from '../../ui/Notification';
import { useSoundSettings } from '../../../context/SoundSettingsContext';
import { apiService } from '../../../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  token
}) => {
  const { addNotification } = useNotification();
  const { soundsEnabled, setSoundsEnabled } = useSoundSettings();
  const [enableContextSharing, setEnableContextSharing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch current settings when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/settings', {
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
    setSoundsEnabled(enabled);
    setSaving(true);

    try {
      await apiService.put('/settings/user',
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
    setEnableContextSharing(enabled);
    setSaving(true);

    try {
      await apiService.put('/settings/team',
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      size="md"
    >
      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <>
            {/* User Settings Section */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Personal Preferences
              </h3>

              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable notification sounds
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                      transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                      ${soundsEnabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}
                      ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                        transition duration-200 ease-in-out
                        ${soundsEnabled ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </label>
              </div>
            </div>

            {/* Team Settings Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Team Settings
              </h3>

              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable context sharing (active.json)
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Allows agents to see what other team members are working on
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enableContextSharing}
                    onClick={() => handleContextSharingToggle(!enableContextSharing)}
                    disabled={saving}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                      transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                      ${enableContextSharing ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}
                      ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                        transition duration-200 ease-in-out
                        ${enableContextSharing ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </label>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Footer */}
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};