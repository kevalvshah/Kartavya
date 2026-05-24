import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { tokens, Tokens, ColorScheme } from './tokens';
import { storage } from '../lib/storage';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  scheme:     ColorScheme;
  t:          Tokens;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  scheme:     'dark',
  t:          tokens.dark,
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() as ColorScheme ?? 'dark';
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => (storage.getString('theme_pref') as ThemePreference) ?? 'system'
  );

  const scheme: ColorScheme =
    preference === 'system' ? systemScheme :
    preference === 'light'  ? 'light' : 'dark';

  const setPreference = (p: ThemePreference) => {
    storage.set('theme_pref', p);
    setPreferenceState(p);
  };

  return (
    <ThemeContext.Provider value={{ scheme, t: tokens[scheme], preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
