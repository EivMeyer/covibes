import React, { createContext, useContext, useState, useEffect } from 'react';

interface SoundSettingsContextValue {
  soundsEnabled: boolean;
  setSoundsEnabled: (enabled: boolean) => void;
}

const SoundSettingsContext = createContext<SoundSettingsContextValue | null>(null);

export const useSoundSettings = () => {
  const context = useContext(SoundSettingsContext);
  if (!context) {
    throw new Error('useSoundSettings must be used within SoundSettingsProvider');
  }
  return context;
};

interface SoundSettingsProviderProps {
  children: React.ReactNode;
  initialSoundsEnabled?: boolean;
}

export const SoundSettingsProvider: React.FC<SoundSettingsProviderProps> = ({
  children,
  initialSoundsEnabled = true
}) => {
  // Initialize from localStorage if available, otherwise use prop
  const [soundsEnabled, setSoundsEnabledState] = useState(() => {
    const stored = localStorage.getItem('soundsEnabled');
    if (stored !== null) {
      return stored === 'true';
    }
    return initialSoundsEnabled;
  });

  // Wrapper to update both state and localStorage
  const setSoundsEnabled = (enabled: boolean) => {
    setSoundsEnabledState(enabled);
    localStorage.setItem('soundsEnabled', enabled.toString());
  };

  // Update localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('soundsEnabled', soundsEnabled.toString());
  }, [soundsEnabled]);

  return (
    <SoundSettingsContext.Provider value={{ soundsEnabled, setSoundsEnabled }}>
      {children}
    </SoundSettingsContext.Provider>
  );
};