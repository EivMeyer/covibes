import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';

interface ConnectionDiagnosticsProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  socket?: any;
}

export const ConnectionDiagnostics: React.FC<ConnectionDiagnosticsProps> = ({
  isOpen,
  onClose,
  isConnected,
  socket
}) => {
  const [diagnostics, setDiagnostics] = useState<any>({});
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      gatherDiagnostics();
    }
  }, [isOpen]);

  // Re-gather diagnostics when socket changes
  useEffect(() => {
    if (isOpen && socket) {
      console.log('🔄 Socket changed, re-gathering diagnostics');
      gatherDiagnostics();
    }
  }, [socket, isConnected]);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev.slice(-19), `[${timestamp}] ${message}`]); // Keep last 20 logs
  };

  const gatherDiagnostics = () => {
    const debugInfo = `isConnected: ${isConnected}, socket: ${socket ? 'exists' : 'null'}, socketType: ${typeof socket}`;
    addDebugLog(`🔍 Diagnostics gathered - ${debugInfo}`);
    
    // Get debug info from sessionStorage
    const socketDebug = sessionStorage.getItem('socketDebug');
    const socketCreated = sessionStorage.getItem('socketCreated');
    const socketConnected = sessionStorage.getItem('socketConnected');
    const socketError = sessionStorage.getItem('socketError');
    
    if (socketDebug) {
      const debug = JSON.parse(socketDebug);
      addDebugLog(`⚙️ Socket init - Mobile: ${debug.mobile}, URL: ${debug.url}, HasToken: ${debug.hasToken}`);
    }
    
    if (socketCreated) {
      addDebugLog(`🔧 Socket created at: ${new Date(socketCreated).toLocaleTimeString()}`);
    }
    
    if (socketConnected) {
      addDebugLog(`✅ Socket connected at: ${new Date(socketConnected).toLocaleTimeString()}`);
    }
    
    if (socketError) {
      const error = JSON.parse(socketError);
      addDebugLog(`❌ Socket error: ${error.error} at ${new Date(error.timestamp).toLocaleTimeString()}`);
    }
    
    if (socket) {
      addDebugLog(`🔌 Socket details - connected: ${socket.connected}, id: ${socket.id || 'none'}`);
      addDebugLog(`🌐 Socket URL - ${socket.io?.uri || 'unknown'}`);
      addDebugLog(`🚛 Transport - ${socket.io?.engine?.transport?.name || 'unknown'}`);
    } else {
      addDebugLog(`❌ Socket is null/undefined - check socket initialization`);
    }
    
    const diag: any = {
      timestamp: new Date().toISOString(),
      browser: navigator.userAgent,
      connectionStatus: isConnected ? 'Connected' : 'Disconnected',
      currentUrl: window.location.href,
      protocol: window.location.protocol,
      host: window.location.host,
      wsUrl: socket?.io?.uri || 'N/A',
      wsReadyState: socket?.connected !== undefined ? (socket.connected ? 'OPEN' : 'CLOSED') : 'UNKNOWN',
      transportType: socket?.io?.engine?.transport?.name || 'N/A',
      socketId: socket?.id || 'N/A',
      authToken: localStorage.getItem('colabvibe_auth_token') ? 'Present' : 'Missing',
      tokenExpiry: checkTokenExpiry(),
      networkType: getNetworkType(),
      onLine: navigator.onLine,
      lastError: socket?.io?.engine?.transport?.lastError || sessionStorage.getItem('lastSocketError') || 'None',
      reconnectionAttempts: socket?.io?.reconnectionAttempts || 0,
      backoff: socket?.io?.backoff?.ms || 0,
      // Debug info
      socketExists: !!socket,
      socketConnected: socket?.connected,
      ioExists: !!socket?.io,
      engineExists: !!socket?.io?.engine,
    };

    // Get socket events if available
    if (socket) {
      diag.socketEvents = {
        hasConnectListener: socket.hasListeners('connect'),
        hasDisconnectListener: socket.hasListeners('disconnect'),
        hasErrorListener: socket.hasListeners('error'),
        hasConnectErrorListener: socket.hasListeners('connect_error'),
      };
    }

    setDiagnostics(diag);
  };

  const checkTokenExpiry = () => {
    const token = localStorage.getItem('colabvibe_auth_token');
    if (!token) return 'No token';
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = new Date(payload.exp * 1000);
      const now = new Date();
      
      if (expiry < now) {
        return `Expired ${Math.round((now.getTime() - expiry.getTime()) / 1000 / 60)} minutes ago`;
      }
      return `Valid for ${Math.round((expiry.getTime() - now.getTime()) / 1000 / 60)} more minutes`;
    } catch (e) {
      return 'Invalid token format';
    }
  };

  const getNetworkType = () => {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      return `${connection.effectiveType || 'Unknown'} (${connection.downlink || '?'} Mbps)`;
    }
    return 'Unknown';
  };

  const runConnectionTests = async () => {
    setTesting(true);
    const results: any[] = [];

    // Test 1: HTTP API connectivity
    try {
      const apiStart = Date.now();
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('colabvibe_auth_token') || ''}`
        }
      });
      const apiTime = Date.now() - apiStart;
      
      results.push({
        test: 'API Endpoint',
        status: response.ok ? 'PASS' : `FAIL (${response.status})`,
        time: `${apiTime}ms`,
        details: response.ok ? 'API is reachable' : `HTTP ${response.status}: ${response.statusText}`
      });
    } catch (e: any) {
      results.push({
        test: 'API Endpoint',
        status: 'FAIL',
        time: 'N/A',
        details: e.message
      });
    }

    // Test 2: WebSocket endpoint
    try {
      const wsUrl = socket?.io?.uri || `${window.location.protocol.replace('http', 'ws')}//${window.location.host}`;
      const wsStart = Date.now();
      const testWs = new WebSocket(wsUrl.replace('http', 'ws'));
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          testWs.close();
          reject(new Error('WebSocket connection timeout'));
        }, 5000);
        
        testWs.onopen = () => {
          clearTimeout(timeout);
          const wsTime = Date.now() - wsStart;
          results.push({
            test: 'WebSocket Connection',
            status: 'PASS',
            time: `${wsTime}ms`,
            details: 'WebSocket can connect'
          });
          testWs.close();
          resolve(true);
        };
        
        testWs.onerror = (e) => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        };
      });
    } catch (e: any) {
      results.push({
        test: 'WebSocket Connection',
        status: 'FAIL',
        time: 'N/A',
        details: e.message
      });
    }

    // Test 3: DNS resolution
    try {
      const dnsStart = Date.now();
      await fetch(`https://dns.google/resolve?name=${window.location.hostname}&type=A`);
      const dnsTime = Date.now() - dnsStart;
      
      results.push({
        test: 'DNS Resolution',
        status: 'PASS',
        time: `${dnsTime}ms`,
        details: 'External DNS working'
      });
    } catch (e) {
      results.push({
        test: 'DNS Resolution',
        status: 'WARN',
        time: 'N/A',
        details: 'Could not verify external DNS'
      });
    }

    // Test 4: Local Storage
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      results.push({
        test: 'Local Storage',
        status: 'PASS',
        time: 'N/A',
        details: 'Storage is accessible'
      });
    } catch (e) {
      results.push({
        test: 'Local Storage',
        status: 'FAIL',
        time: 'N/A',
        details: 'Storage blocked or full'
      });
    }

    setTestResults(results);
    setTesting(false);
  };

  const copyDiagnostics = () => {
    const text = JSON.stringify({ diagnostics, testResults }, null, 2);
    navigator.clipboard.writeText(text);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 max-w-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">
          🔌 Connection Diagnostics
        </h2>
        
        <div className="mb-4">
          <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full ${
            isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
            <span className="font-medium">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {/* Basic Info */}
          <div className="bg-midnight-700 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">Connection Info</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Server URL:</span>
                <span className="text-white font-mono">{diagnostics.host}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">WebSocket URL:</span>
                <span className="text-white font-mono">{diagnostics.wsUrl}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Socket State:</span>
                <span className={`font-mono ${diagnostics.wsReadyState === 'OPEN' ? 'text-green-400' : 'text-red-400'}`}>
                  {diagnostics.wsReadyState}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Transport:</span>
                <span className="text-white">{diagnostics.transportType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Socket ID:</span>
                <span className="text-white font-mono text-xs">{diagnostics.socketId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Reconnect Attempts:</span>
                <span className="text-white">{diagnostics.reconnectionAttempts}</span>
              </div>
            </div>
          </div>

          {/* Auth Info */}
          <div className="bg-midnight-700 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">Authentication</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Token Status:</span>
                <span className={`${diagnostics.authToken === 'Present' ? 'text-green-400' : 'text-red-400'}`}>
                  {diagnostics.authToken}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Token Validity:</span>
                <span className={`${diagnostics.tokenExpiry?.includes('Valid') ? 'text-green-400' : 'text-orange-400'}`}>
                  {diagnostics.tokenExpiry}
                </span>
              </div>
            </div>
          </div>

          {/* Network Info */}
          <div className="bg-midnight-700 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">Network</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Online Status:</span>
                <span className={`${diagnostics.onLine ? 'text-green-400' : 'text-red-400'}`}>
                  {diagnostics.onLine ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network Type:</span>
                <span className="text-white">{diagnostics.networkType}</span>
              </div>
            </div>
          </div>

          {/* Error Info */}
          {diagnostics.lastError && diagnostics.lastError !== 'None' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <h3 className="text-red-400 font-semibold mb-2">Last Error</h3>
              <p className="text-red-300 text-sm font-mono">{diagnostics.lastError}</p>
            </div>
          )}

          {/* Connection Tests */}
          <div className="bg-midnight-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-semibold">Connection Tests</h3>
              <button
                onClick={runConnectionTests}
                disabled={testing}
                className="px-3 py-1 bg-electric hover:bg-electric-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
              >
                {testing ? 'Testing...' : 'Run Tests'}
              </button>
            </div>
            
            {testResults.length > 0 && (
              <div className="space-y-2 mt-3">
                {testResults.map((result, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">{result.test}:</span>
                    <div className="flex items-center space-x-2">
                      <span className={`font-mono ${
                        result.status === 'PASS' ? 'text-green-400' : 
                        result.status === 'WARN' ? 'text-orange-400' : 'text-red-400'
                      }`}>
                        {result.status}
                      </span>
                      {result.time !== 'N/A' && (
                        <span className="text-gray-500">({result.time})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Browser Info */}
          <div className="bg-midnight-700 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">Environment</h3>
            <p className="text-gray-400 text-xs font-mono break-all">{diagnostics.browser}</p>
          </div>

          {/* Debug Logs */}
          <div className="bg-midnight-800 rounded-lg p-4 border border-red-500/30">
            <h3 className="text-red-400 font-semibold mb-2">🐛 Debug Logs</h3>
            <div className="bg-black/50 rounded p-3 max-h-48 overflow-y-auto">
              {debugLogs.length > 0 ? (
                debugLogs.map((log, i) => (
                  <div key={i} className="text-xs font-mono text-green-400 mb-1">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-xs">No debug logs yet...</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-6">
          <button
            onClick={copyDiagnostics}
            className="px-4 py-2 bg-midnight-600 hover:bg-midnight-500 text-white rounded transition-colors"
          >
            📋 Copy Diagnostics
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-electric hover:bg-electric-600 text-white rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};