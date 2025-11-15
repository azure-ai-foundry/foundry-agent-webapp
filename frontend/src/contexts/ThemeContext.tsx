import { createContext, useContext } from 'react';
import type { Theme as FluentTheme } from '@fluentui/react-components';
import { lightTheme } from '../config/themes';

export type ThemeType = 'Light' | 'Dark' | 'System';

export interface ThemeContextValue {
  savedTheme: ThemeType;
  currentTheme: 'Light' | 'Dark';
  themeStyles: FluentTheme;
  setTheme: (theme: ThemeType) => void;
  isDarkMode: boolean;
}

const defaultContext: ThemeContextValue = {
  savedTheme: 'System',
  currentTheme: 'Light',
  themeStyles: lightTheme,
  setTheme: () => {},
  isDarkMode: false,
};

export const ThemeContext = createContext<ThemeContextValue>(defaultContext);

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};
