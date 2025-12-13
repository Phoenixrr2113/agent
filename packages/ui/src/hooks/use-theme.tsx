import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import { colors, type ColorScheme, type ThemeColors, type ColorKey } from '../themes/colors';

interface ThemeContextValue {
  scheme: ColorScheme;
  colors: ThemeColors;
  setScheme: (scheme: ColorScheme | 'system') => void;
  toggleScheme: () => void;
  isSystem: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultScheme?: ColorScheme | 'system';
}

export function ThemeProvider({ children, defaultScheme = 'system' }: ThemeProviderProps) {
  const deviceScheme = useDeviceColorScheme();
  const [userScheme, setUserScheme] = useState<ColorScheme | 'system'>(defaultScheme);

  const scheme: ColorScheme = useMemo(() => {
    if (userScheme === 'system') {
      return deviceScheme === 'dark' ? 'dark' : 'light';
    }
    return userScheme;
  }, [userScheme, deviceScheme]);

  const setScheme = useCallback((newScheme: ColorScheme | 'system') => {
    setUserScheme(newScheme);
  }, []);

  const toggleScheme = useCallback(() => {
    setUserScheme((current) => {
      if (current === 'system') {
        return deviceScheme === 'dark' ? 'light' : 'dark';
      }
      return current === 'dark' ? 'light' : 'dark';
    });
  }, [deviceScheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    scheme,
    colors: colors[scheme],
    setScheme,
    toggleScheme,
    isSystem: userScheme === 'system',
  }), [scheme, setScheme, toggleScheme, userScheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorKey: ColorKey
): string {
  const { scheme, colors: themeColors } = useTheme();
  const colorFromProps = props[scheme];

  if (colorFromProps) {
    return colorFromProps;
  }
  return themeColors[colorKey];
}
