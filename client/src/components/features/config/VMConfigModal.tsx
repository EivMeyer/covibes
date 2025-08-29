import React, { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useVMConfig } from '@/hooks/useVMConfig';
import { useNotification } from '@/components/ui/Notification';

interface VMConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface VMFormData {
  host: string;
  port: string;
  username: string;
  privateKey: string;
}

export const VMConfigModal: React.FC<VMConfigModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<VMFormData>({
    host: '',
    port: '22',
    username: '',
    privateKey: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [currentVMStatus, setCurrentVMStatus] = useState<{connected: boolean; ip?: string; message?: string} | null>(null);

  const { configureVM, testConnection, getStatus } = useVMConfig();
  const { addNotification } = useNotification();

  // Fetch current VM status when modal opens
  useEffect(() => {
    if (isOpen) {
      getStatus()
        .then(status => {
          setCurrentVMStatus(status);
          // Pre-populate IP if available
          if (status.ip) {
            setFormData(prev => ({
              ...prev,
              host: status.ip || ''
            }));
          }
        })
        .catch(err => {
          console.error('Failed to fetch VM status:', err);
        });
    }
  }, [isOpen, getStatus]);

  const resetForm = () => {
    setFormData({
      host: '',
      port: '22',
      username: '',
      privateKey: '',
    });
    setErrors({});
    setIsSubmitting(false);
    setIsTesting(false);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Host validation - just check it's not empty
    if (!formData.host.trim()) {
      newErrors.host = 'Host/IP address is required';
    }

    // Port validation
    if (!formData.port.trim()) {
      newErrors.port = 'Port is required';
    } else {
      const port = parseInt(formData.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        newErrors.port = 'Port must be between 1 and 65535';
      }
    }

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, hyphens, and underscores';
    }

    // Private key validation
    if (!formData.privateKey.trim()) {
      newErrors.privateKey = 'SSH private key is required';
    } else if (!formData.privateKey.includes('-----BEGIN') || !formData.privateKey.includes('-----END')) {
      newErrors.privateKey = 'Invalid private key format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await configureVM({
        ip: formData.host.trim(),
        sshKeyPath: formData.privateKey.trim(),
      });

      addNotification({
        message: 'VM configuration saved successfully!',
        type: 'success',
      });

      resetForm();
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to configure VM:', error);
      addNotification({
        message: error instanceof Error ? error.message : 'Failed to save VM configuration',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!validateForm()) {
      return;
    }

    setIsTesting(true);
    try {
      await testConnection({
        ip: formData.host.trim(),
        sshKeyPath: formData.privateKey.trim(),
      });

      addNotification({
        message: 'VM connection test successful! ✅',
        type: 'success',
      });
    } catch (error) {
      console.error('VM connection test failed:', error);
      addNotification({
        message: error instanceof Error ? error.message : 'VM connection test failed',
        type: 'error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleInputChange = (field: keyof VMFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    let value = e.target.value;
    
    // Special handling for port field
    if (field === 'port') {
      value = value.replace(/[^0-9]/g, '');
    }
    
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isTesting) {
      resetForm();
      onClose();
    }
  };

  const fillExampleData = () => {
    setFormData({
      host: 'your-server.example.com',
      port: '22',
      username: 'ubuntu',
      privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\n[Your private key here]\n-----END OPENSSH PRIVATE KEY-----',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="VM Configuration"
      size="md"
      closeOnBackdropClick={!isSubmitting && !isTesting}
      closeOnEscape={!isSubmitting && !isTesting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Status banner - compact */}
        {currentVMStatus && (
          <div className={`px-3 py-2 rounded-lg text-xs ${
            currentVMStatus.connected 
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
          }`}>
            {currentVMStatus.connected ? '✓ VM Connected' : '⚠ No VM configured'}
            {currentVMStatus.ip && ` - ${currentVMStatus.ip}`}
          </div>
        )}


        {/* Connection details - compact grid */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="host"
            name="host"
            type="text"
            label="Host/IP"
            value={formData.host}
            onChange={handleInputChange('host')}
            error={errors.host}
            required
            disabled={isSubmitting || isTesting}
            placeholder="server.example.com"
            className="text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              id="port"
              name="port"
              type="text"
              label="Port"
              value={formData.port}
              onChange={handleInputChange('port')}
              error={errors.port}
              required
              disabled={isSubmitting || isTesting}
              placeholder="22"
              className="text-sm"
            />
            <Input
              id="username"
              name="username"
              type="text"
              label="Username"
              value={formData.username}
              onChange={handleInputChange('username')}
              error={errors.username}
              required
              disabled={isSubmitting || isTesting}
              placeholder="ubuntu"
              className="text-sm"
            />
          </div>
        </div>

        {/* Private Key - compact */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-300">SSH Private Key</label>
            <button
              type="button"
              onClick={fillExampleData}
              disabled={isSubmitting || isTesting}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Example
            </button>
          </div>
          <Textarea
            id="privateKey"
            name="privateKey"
            value={formData.privateKey}
            onChange={handleInputChange('privateKey') as any}
            error={errors.privateKey}
            required
            disabled={isSubmitting || isTesting}
            rows={6}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----\n..."
            className="font-mono text-xs"
          />
          <p className="text-xs text-gray-500 mt-1">
            🔒 Encrypted before storage
          </p>
        </div>

        {/* Test button - compact */}
        <div className="flex justify-center">
          <Button
            type="button"
            variant="secondary"
            onClick={handleTestConnection}
            loading={isTesting}
            disabled={isSubmitting || isTesting}
            className="text-sm"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>

        <ModalFooter
          onCancel={handleClose}
          onConfirm={handleSubmit}
          cancelText="Cancel"
          confirmText="Save Configuration"
          confirmVariant="success"
          isLoading={isSubmitting}
        />
      </form>
    </Modal>
  );
};