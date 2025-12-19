import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Platform } from 'react-native';

const STORAGE_KEY = '@agent/settings';

interface Settings {
  serverUrl: string;
  theme: 'light' | 'dark' | 'system';
}

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: Settings = {
  serverUrl: Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000',
  theme: 'system',
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

let asyncStorageModule: typeof import('@react-native-async-storage/async-storage') | null = null;

async function getAsyncStorage() {
  if (!asyncStorageModule) {
    asyncStorageModule = await import('@react-native-async-storage/async-storage');
  }
  return asyncStorageModule.default;
}

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    const AsyncStorage = await getAsyncStorage();
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    const AsyncStorage = await getAsyncStorage();
    await AsyncStorage.setItem(key, value);
  },
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await storage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Settings>;
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    try {
      await storage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
