import React, { useEffect, useState, useContext } from 'react';
import type { ComponentProps } from '@/types';

interface NotificationProps extends ComponentProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | undefined;
  duration?: number | undefined;
  onClose?: () => void;
  show?: boolean;
}

// Sound manager for notifications
class NotificationSounds {
  private static instance: NotificationSounds;
  private context: AudioContext | null = null;
  private soundsEnabled: boolean = true;

  static getInstance(): NotificationSounds {
    if (!NotificationSounds.instance) {
      NotificationSounds.instance = new NotificationSounds();
    }
    return NotificationSounds.instance;
  }

  setSoundsEnabled(enabled: boolean) {
    this.soundsEnabled = enabled;
  }

  private async initContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  private createBeep(frequency: number, duration: number, volume: number = 0.3) {
    if (!this.context) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, this.context.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.context.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
    
    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + duration);
  }

  async playSound(type: 'info' | 'success' | 'warning' | 'error') {
    // Check if sounds are enabled
    if (!this.soundsEnabled) {
      return;
    }

    try {
      await this.initContext();
      
      switch (type) {
        case 'success':
          // Pleasant success sound - rising tones
          this.createBeep(523, 0.15, 0.2); // C5
          setTimeout(() => this.createBeep(659, 0.15, 0.2), 100); // E5
          setTimeout(() => this.createBeep(784, 0.2, 0.25), 200); // G5
          break;
        case 'error':
          // Alert error sound - descending tones
          this.createBeep(800, 0.2, 0.3);
          setTimeout(() => this.createBeep(600, 0.2, 0.3), 150);
          setTimeout(() => this.createBeep(400, 0.3, 0.3), 300);
          break;
        case 'warning':
          // Attention warning sound - two quick beeps
          this.createBeep(700, 0.15, 0.25);
          setTimeout(() => this.createBeep(700, 0.15, 0.25), 200);
          break;
        case 'info':
          // Gentle info sound - single soft tone
          this.createBeep(600, 0.2, 0.2);
          break;
      }
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }
}

export const Notification: React.FC<NotificationProps> = ({
  message,
  type = 'info',
  duration = 5000,
  onClose,
  show = true,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(show);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      // Play sound when notification appears
      NotificationSounds.getInstance().playSound(type);
      
      // Trigger animation
      setIsAnimating(true);
      
      if (duration > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          onClose?.();
        }, duration);

        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [show, duration, onClose, type]);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  if (!isVisible) return null;

  const typeClasses = {
    info: 'bg-gradient-to-r from-blue-600 to-blue-700 border-blue-500 shadow-blue-500/20',
    success: 'bg-gradient-to-r from-green-600 to-emerald-700 border-green-500 shadow-green-500/20',
    warning: 'bg-gradient-to-r from-amber-600 to-orange-700 border-amber-500 shadow-amber-500/20',
    error: 'bg-gradient-to-r from-red-600 to-red-700 border-red-500 shadow-red-500/20',
  };

  const iconMap = {
    info: (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-blue-200" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </div>
    ),
    success: (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-green-200" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      </div>
    ),
    warning: (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-amber-200" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </div>
    ),
    error: (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-red-200" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      </div>
    ),
  };

  return (
    <div className={`
      transform transition-all duration-300 ease-out max-w-sm w-full
      ${isAnimating ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'}
      ${className}
    `}>
      <div className={`
        relative flex items-center w-full p-4 rounded-xl border backdrop-blur-sm
        shadow-2xl ${typeClasses[type]}
        hover:scale-105 transition-transform duration-200
      `}>
        {/* Animated border glow */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
        
        {/* Progress bar */}
        {duration > 0 && (
          <div className="absolute bottom-0 left-0 h-1 bg-white/30 rounded-full overflow-hidden w-full">
            <div 
              className="h-full bg-white/60 rounded-full animate-shrink"
              style={{ 
                animation: `shrink ${duration}ms linear forwards`,
              }}
            />
          </div>
        )}
        
        {iconMap[type]}
        
        <div className="ml-4 text-sm font-medium flex-1 text-white">
          {message}
        </div>
        
        {onClose && (
          <button
            onClick={() => {
              setIsVisible(false);
              onClose();
            }}
            className="ml-3 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors duration-150"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

// Notification system hook for managing multiple notifications
export interface NotificationData {
  id: string;
  message: string;
  type: NotificationProps['type'];
  duration?: number;
}

interface NotificationContextValue {
  notifications: NotificationData[];
  addNotification: (notification: Omit<NotificationData, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = React.createContext<NotificationContextValue | null>(null);

export const useNotification = () => {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// Create a context for sound settings integration
const SoundSettingsIntegrationContext = React.createContext<{ soundsEnabled?: boolean }>({});

export const NotificationProvider: React.FC<{ children: React.ReactNode; soundsEnabled?: boolean }> = ({ children, soundsEnabled = true }) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  // Update the NotificationSounds singleton when soundsEnabled changes
  React.useEffect(() => {
    NotificationSounds.getInstance().setSoundsEnabled(soundsEnabled);
  }, [soundsEnabled]);

  const addNotification = (notification: Omit<NotificationData, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2);
    setNotifications(prev => [...prev, { ...notification, id }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearAll }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className="pointer-events-auto"
            style={{ 
              zIndex: 50 - index,
              transform: `translateY(${index * 4}px)`,
            }}
          >
            <Notification
              message={notification.message}
              type={notification.type}
              duration={notification.duration}
              onClose={() => removeNotification(notification.id)}
              className="notification-enter"
            />
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};