export interface ThemeColors {
  text: string;
  textSecondary: string;
  textMuted: string;
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryHover: string;
  error: string;
  errorBackground: string;
  success: string;
  successBackground: string;
  userBubble: string;
  userBubbleText: string;
  assistantBubble: string;
  assistantBubbleText: string;
  icon: string;
  iconActive: string;
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
}

export type ColorScheme = 'light' | 'dark';

export const colors: Record<ColorScheme, ThemeColors> = {
  light: {
    text: '#11181C',
    textSecondary: '#687076',
    textMuted: '#9BA1A6',
    background: '#FFFFFF',
    backgroundSecondary: '#F5F5F5',
    surface: '#FFFFFF',
    surfaceElevated: '#FAFAFA',
    border: '#E5E7EB',
    borderLight: '#F0F0F0',
    primary: '#0a7ea4',
    primaryHover: '#0969A4',
    error: '#DC2626',
    errorBackground: '#FEF2F2',
    success: '#16A34A',
    successBackground: '#F0FDF4',
    userBubble: '#0a7ea4',
    userBubbleText: '#FFFFFF',
    assistantBubble: '#F5F5F5',
    assistantBubbleText: '#11181C',
    icon: '#687076',
    iconActive: '#0a7ea4',
    inputBackground: '#F5F5F5',
    inputBorder: '#E5E7EB',
    inputText: '#11181C',
    inputPlaceholder: '#9BA1A6',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    textMuted: '#687076',
    background: '#151718',
    backgroundSecondary: '#1E2022',
    surface: '#1E2022',
    surfaceElevated: '#262A2C',
    border: '#2E3336',
    borderLight: '#232729',
    primary: '#38BDF8',
    primaryHover: '#7DD3FC',
    error: '#F87171',
    errorBackground: '#450A0A',
    success: '#4ADE80',
    successBackground: '#052E16',
    userBubble: '#0a7ea4',
    userBubbleText: '#FFFFFF',
    assistantBubble: '#262A2C',
    assistantBubbleText: '#ECEDEE',
    icon: '#9BA1A6',
    iconActive: '#38BDF8',
    inputBackground: '#1E2022',
    inputBorder: '#2E3336',
    inputText: '#ECEDEE',
    inputPlaceholder: '#687076',
  },
};

export type ColorKey = keyof ThemeColors;

export function getColors(scheme: ColorScheme): ThemeColors {
  return colors[scheme];
}
