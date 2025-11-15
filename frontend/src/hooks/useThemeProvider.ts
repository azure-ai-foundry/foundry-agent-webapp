import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ThemeContextValue, ThemeType } from '../contexts/ThemeContext';
import { darkTheme, lightTheme } from '../config/themes';

const THEME_STORAGE_KEY = 'ai-foundry-theme';

/**
 * Hook for detecting media query matches.
 * Commonly used for responsive design and user preferences like dark mode.
 * 
 * @param query - Media query string to match
 * @returns Boolean indicating if the query matches
 * 
 * @example
 * ```tsx
 * const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia(query);
      const updateMatches = () => {
        setMatches(mediaQuery.matches);
      };

      mediaQuery.addEventListener('change', updateMatches);

      updateMatches();
      return () => {
        mediaQuery.removeEventListener('change', updateMatches);
      };
    }
    return () => {
      // Cleanup if needed
    };
  }, [query]);

  return matches;
}

/**
 * Theme provider hook that manages theme state and persistence.
 * Supports Light, Dark, and System (auto) modes with localStorage persistence.
 * 
 * @returns Theme context value with current theme, styles, and setter
 * 
 * @example
 * ```tsx
 * function ThemeProvider({ children }) {
 *   const themeContext = useThemeProvider();
 *   
 *   return (
 *     <ThemeContext.Provider value={themeContext}>
 *       <FluentProvider theme={themeContext.themeStyles}>
 *         {children}
 *       </FluentProvider>
 *     </ThemeContext.Provider>
 *   );
 * }
 * ```
 */
export const useThemeProvider = (): ThemeContextValue => {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const [savedTheme, setSavedTheme] = useState<ThemeType>(() => {
    if (typeof localStorage !== 'undefined') {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType;
      if (storedTheme && ['Light', 'Dark', 'System'].includes(storedTheme)) {
        return storedTheme;
      }
    }
    return 'System';
  });

  // Memoize computed values
  const isDarkMode = useMemo(
    () => savedTheme === 'System' ? prefersDark : savedTheme === 'Dark',
    [savedTheme, prefersDark]
  );

  const currentTheme = useMemo(
    () => isDarkMode ? 'Dark' as const : 'Light' as const,
    [isDarkMode]
  );

  const themeStyles = useMemo(
    () => isDarkMode ? darkTheme : lightTheme,
    [isDarkMode]
  );

  const setTheme = useCallback((newTheme: ThemeType) => {
    setSavedTheme(newTheme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    }
  }, []);

  useEffect(() => {
    // Update document color scheme for browser UI
    if (typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
    }
  }, [isDarkMode]);

  return useMemo(
    () => ({
      savedTheme,
      currentTheme,
      themeStyles,
      setTheme,
      isDarkMode,
    }),
    [savedTheme, currentTheme, themeStyles, setTheme, isDarkMode]
  );
};
