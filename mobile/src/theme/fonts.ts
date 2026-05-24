/**
 * fonts.ts — Custom font loading via @expo-google-fonts
 *
 * Call useFonts() once at the root (App.tsx) before rendering children.
 * The returned [loaded] boolean gates rendering to avoid FOUT.
 */

import {
  useFonts as useNewsreader,
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
} from '@expo-google-fonts/newsreader';

import {
  useFonts as useTiro,
  TiroDevanagariHindi_400Regular,
} from '@expo-google-fonts/tiro-devanagari-hindi';

import {
  useFonts as useSpaceMono,
  SpaceMono_400Regular,
} from '@expo-google-fonts/space-mono';

export function useFonts(): [boolean] {
  const [n] = useNewsreader({
    Newsreader:        Newsreader_400Regular,
    'Newsreader-Italic': Newsreader_400Regular_Italic,
  });
  const [t] = useTiro({
    TiroDevanagariHindi: TiroDevanagariHindi_400Regular,
  });
  const [s] = useSpaceMono({
    SpaceMono: SpaceMono_400Regular,
  });
  return [n && t && s];
}

/** Style presets that consume the loaded fonts */
export const F = {
  /** Hero / display: Newsreader italic serif */
  displaySerif: {
    fontFamily: 'Newsreader-Italic' as const,
    fontWeight: '400' as const,
  },
  /** Section titles / task detail heading: Newsreader regular */
  titleSerif: {
    fontFamily: 'Newsreader' as const,
    fontWeight: '400' as const,
  },
  /** Devanagari kicker text */
  hindi: {
    fontFamily: 'TiroDevanagariHindi' as const,
    fontWeight: '400' as const,
  },
  /** Code / mono */
  mono: {
    fontFamily: 'SpaceMono' as const,
    fontWeight: '400' as const,
  },
};
