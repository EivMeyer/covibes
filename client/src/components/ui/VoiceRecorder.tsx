import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  persistentMode?: boolean;
  onModeChange?: (enabled: boolean) => void;
}

type RecorderState = 'idle' | 'listening' | 'recording' | 'processing' | 'error';

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscript,
  disabled = false,
  className = '',
  persistentMode = false,
  onModeChange
}) => {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string>('');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for Web Speech API support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  // Auto-start listening when persistent mode is enabled
  useEffect(() => {
    if (persistentMode && !disabled && state === 'idle') {
      startListening();
    } else if (!persistentMode && (state === 'listening' || state === 'recording')) {
      stopRecording();
    }
  }, [persistentMode, disabled]);

  const startListening = useCallback(() => {
    try {
      setError('');

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser');
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = persistentMode;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setState(persistentMode ? 'listening' : 'recording');
      };

      recognition.onspeechstart = () => {
        setState('recording');
        // Clear any existing silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      };

      recognition.onspeechend = () => {
        if (persistentMode) {
          // In persistent mode, go back to listening after a short pause
          setState('processing');
          silenceTimeoutRef.current = setTimeout(() => {
            setState('listening');
          }, 500);
        }
      };

      recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const transcript = lastResult[0].transcript;
          if (transcript) {
            onTranscript(transcript);

            if (persistentMode) {
              // In persistent mode, immediately go back to listening
              setState('listening');
            } else {
              setState('idle');
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);

        // Don't show error for no-speech in persistent mode
        if (persistentMode && event.error === 'no-speech') {
          setState('listening');
          return;
        }

        let errorMessage = 'Speech recognition failed';
        if (event.error === 'not-allowed') {
          errorMessage = 'Microphone permission denied';
          // Disable persistent mode if permission denied
          if (onModeChange) onModeChange(false);
        } else if (event.error === 'network') {
          errorMessage = 'Network error. Check your connection';
        } else if (event.error === 'no-speech' && !persistentMode) {
          errorMessage = 'No speech detected';
        }

        if (!persistentMode || event.error === 'not-allowed') {
          setError(errorMessage);
          setState('error');
          setTimeout(() => setState('idle'), 3000);
        }
      };

      recognition.onend = () => {
        // Restart if in persistent mode and not explicitly stopped
        if (persistentMode && state !== 'idle' && state !== 'error') {
          setTimeout(() => {
            if (persistentMode && recognitionRef.current) {
              try {
                recognition.start();
              } catch (err) {
                console.log('Restarting recognition...');
              }
            }
          }, 100);
        } else {
          setState('idle');
        }

        // Clear timeouts
        if (recordingTimeoutRef.current) {
          clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }
      };

      // Start recognition
      recognition.start();

      // Auto-stop after 30 seconds if not in persistent mode
      if (!persistentMode) {
        recordingTimeoutRef.current = setTimeout(() => {
          stopRecording();
        }, 30000);
      }

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }, [onTranscript, persistentMode, state, onModeChange]);

  const stopRecording = useCallback(() => {
    // Clear timeouts
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    // Stop recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('Error stopping recognition:', err);
      }
      recognitionRef.current = null;
    }

    setState('idle');
  }, []);

  const handleClick = useCallback(() => {
    if (disabled || !isSupported) return;

    if (persistentMode) {
      // Toggle persistent mode off
      if (onModeChange) {
        onModeChange(false);
      }
      stopRecording();
    } else {
      // Toggle persistent mode on or start single recording
      if (state === 'idle') {
        if (onModeChange) {
          onModeChange(true); // Enable persistent mode
        } else {
          startListening(); // Single recording
        }
      } else {
        stopRecording();
      }
    }
  }, [disabled, isSupported, persistentMode, state, onModeChange, startListening, stopRecording]);

  // Button appearance based on state
  const getButtonContent = () => {
    if (persistentMode) {
      if (state === 'recording') {
        return (
          <>
            <Mic className="w-4 h-4 text-red-500 animate-pulse" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </>
        );
      } else if (state === 'listening') {
        return (
          <>
            <Mic className="w-4 h-4 text-green-500" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full" />
          </>
        );
      } else if (state === 'processing') {
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      }
    }

    switch (state) {
      case 'recording':
        return (
          <>
            <Mic className="w-4 h-4 text-red-500 animate-pulse" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </>
        );
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'error':
        return <MicOff className="w-4 h-4 text-red-500" />;
      default:
        return <Mic className="w-4 h-4 text-gray-400 hover:text-gray-200" />;
    }
  };

  const getTooltip = () => {
    if (!isSupported) {
      return 'Voice input not supported in this browser';
    }

    if (persistentMode) {
      if (state === 'listening') {
        return 'Listening... Click to disable voice mode';
      } else if (state === 'recording') {
        return 'Recording... Click to disable voice mode';
      }
      return 'Voice mode active. Click to disable';
    }

    switch (state) {
      case 'recording':
        return 'Recording... Click to stop';
      case 'processing':
        return 'Processing audio...';
      case 'error':
        return error || 'Error occurred';
      default:
        return 'Click to enable voice mode';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={disabled || !isSupported}
        className={`
          relative p-2 rounded transition-all
          ${disabled || !isSupported ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'}
          ${persistentMode ? 'bg-green-900/20 ring-1 ring-green-500/30' : ''}
          ${state === 'recording' ? 'bg-red-900/20' : ''}
          ${className}
        `}
        title={getTooltip()}
        aria-label="Voice input"
      >
        {getButtonContent()}
      </button>

      {/* Mode indicator */}
      {persistentMode && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2
                        px-2 py-1 text-xs text-green-400 bg-gray-900
                        border border-green-800 rounded whitespace-nowrap">
          Voice mode
        </div>
      )}

      {/* Error message */}
      {error && state === 'error' && !persistentMode && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                        px-2 py-1 text-xs text-red-400 bg-gray-900
                        border border-red-800 rounded whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
};