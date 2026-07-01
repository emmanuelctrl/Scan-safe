// Theme context: light/dark mode. The choice is persisted to localStorage and,
// when changed by the owner, synced to the backend so it follows the store.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { syncTelegramThemeColors } from '../lib/telegram.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('it_theme') || 'light'
  );

  // Apply the theme to the root element so CSS variables switch.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('it_theme', theme);
    syncTelegramThemeColors(theme);
  }, [theme]);

  const setTheme = useCallback((t) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((t) => (t === 'light' ? 'dark' : 'light')),
    []
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
