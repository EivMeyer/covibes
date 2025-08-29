import { useState, useCallback } from 'react';
import { apiService, ApiError, type VMConfigRequest } from '@/services/api';

export interface VMStatus {
  connected: boolean;
  ip?: string;
  message?: string;
  lastChecked?: Date;
}

export interface VMConfigState {
  status: VMStatus | null;
  isLoading: boolean;
  isTesting: boolean;
  error: string | null;
}

export interface VMConfigHook extends VMConfigState {
  configureVM: (vmData: VMConfigRequest) => Promise<void>;
  testConnection: (vmData: VMConfigRequest) => Promise<{ success: boolean; message: string }>;
  getStatus: () => Promise<VMStatus>;
  clearError: () => void;
  refresh: () => Promise<void>;
}

export function useVMConfig(): VMConfigHook {
  const [status, setStatus] = useState<VMStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configureVM = useCallback(async (vmData: VMConfigRequest): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      await apiService.configureVM(vmData);
      
      // Refresh status after configuration
      await getStatus();
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to configure VM';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const testConnection = useCallback(async (vmData: VMConfigRequest): Promise<{ success: boolean; message: string }> => {
    setIsTesting(true);
    setError(null);
    
    try {
      const result = await apiService.testVMConnection(vmData);
      
      // Update status based on test result
      setStatus(prev => ({
        ...prev,
        connected: result.success,
        ip: vmData.ip,
        message: result.message,
        lastChecked: new Date(),
      }));
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Connection test failed';
      setError(errorMessage);
      
      // Update status to indicate failure
      setStatus(prev => ({
        ...prev,
        connected: false,
        ip: vmData.ip,
        message: errorMessage,
        lastChecked: new Date(),
      }));
      
      throw error;
    } finally {
      setIsTesting(false);
    }
  }, []);

  const getStatus = useCallback(async (): Promise<VMStatus> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const statusData = await apiService.getVMStatus();
      
      const vmStatus: VMStatus = {
        connected: statusData.connected,
        ...(statusData.ip && { ip: statusData.ip }),
        ...(statusData.message && { message: statusData.message }),
        lastChecked: new Date(),
      };
      
      setStatus(vmStatus);
      return vmStatus;
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to get VM status';
      setError(errorMessage);
      
      const fallbackStatus: VMStatus = {
        connected: false,
        message: errorMessage,
        lastChecked: new Date(),
      };
      
      setStatus(fallbackStatus);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    await getStatus();
  }, [getStatus]);

  return {
    status,
    isLoading,
    isTesting,
    error,
    configureVM,
    testConnection,
    getStatus,
    clearError,
    refresh,
  };
}