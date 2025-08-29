import { useState, useEffect, useCallback } from 'react';

export interface VMPingStatus {
  isConnected: boolean;
  ping: number | null;
  status: 'checking' | 'online' | 'offline' | 'error';
  lastCheck: Date | null;
}

export const useVMPing = (vmHost?: string, interval = 30000) => {
  const [pingStatus, setPingStatus] = useState<VMPingStatus>({
    isConnected: false,
    ping: null,
    status: 'checking',
    lastCheck: null,
  });

  const checkVMPing = useCallback(async () => {
    if (!vmHost) {
      setPingStatus(prev => ({ 
        ...prev, 
        status: 'offline', 
        isConnected: false,
        lastCheck: new Date() 
      }));
      return;
    }

    try {
      setPingStatus(prev => ({ ...prev, status: 'checking' }));
      
      const startTime = Date.now();
      
      // Try to ping the VM via backend API
      const response = await fetch('/api/vm/ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ host: vmHost }),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const pingTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        setPingStatus({
          isConnected: data.reachable,
          ping: data.reachable ? pingTime : null,
          status: data.reachable ? 'online' : 'offline',
          lastCheck: new Date(),
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn('VM ping failed:', error);
      setPingStatus({
        isConnected: false,
        ping: null,
        status: 'error',
        lastCheck: new Date(),
      });
    }
  }, [vmHost]);

  useEffect(() => {
    if (!vmHost) return;

    // Initial check
    checkVMPing();

    // Set up interval for periodic checks
    const intervalId = setInterval(checkVMPing, interval);

    return () => clearInterval(intervalId);
  }, [checkVMPing, interval, vmHost]);

  return { pingStatus, checkVMPing };
};