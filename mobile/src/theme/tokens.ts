export type ColorScheme = 'light' | 'dark';

const brand = {
  gradient: ['#0082c6', '#03a1b6', '#05b7aa'] as string[],
  teal:     '#05b7aa',
  blue:     '#0082c6',
  mid:      '#03a1b6',
};

const light = {
  // Surfaces
  bg:             '#F2F2F7',
  surface:        '#FFFFFF',
  surfaceLow:     '#ECECF1',
  surfaceHigh:    '#FFFFFF',
  // M3 surface levels
  surface1: '#F4F4F9',
  surface2: '#EEEEF3',
  surface3: '#E8E8EE',
  surface4: '#E6E6EC',
  surface5: '#E2E2E8',
  // M3 secondary / tertiary / purple
  secondaryContainer:   '#D4E4FF',
  onSecondaryContainer: '#001D36',
  tertiaryContainer:    '#FFE0B2',
  onTertiaryContainer:  '#2D1600',
  purpleContainer:      '#EDE7F6',
  purple:               '#7C3AED',
  // iOS translucent tab bar background
  tabBg: 'rgba(255,255,255,0.78)',
  // Text
  onSurface:      '#1A1A1F',
  onSurfaceVar:   '#3F4042',
  onSurfaceVar2:  '#73757A',
  onSurfaceFaint: '#A0A2A8',
  // Shorthand aliases
  ink:   '#1A1A1F',
  ink2:  '#3F4042',
  ink3:  '#73757A',
  ink4:  '#A0A2A8',
  // Primary (M3 teal)
  primary:          '#006A60',
  primaryContainer: '#A0F0E4',
  onPrimary:        '#FFFFFF',
  onPrimaryContainer: '#00201C',
  // Accents
  approval:       '#F59E0B',
  approvalBg:     '#FFF8E1',
  error:          '#BA1A1A',
  errorBg:        '#FFDAD6',
  success:        '#16a34a',
  successBg:      '#DCFCE7',
  // Borders
  outline:        '#C6C6CB',
  outlineVar:     '#E0E0E5',
  // Brand (same both themes for CTAs)
  ...brand,
};

const dark = {
  bg:             '#000000',
  surface:        '#1C1C1E',
  surfaceLow:     '#0f1411',
  surfaceHigh:    '#2C2C2E',
  // M3 surface levels
  surface1: '#1E1E20',
  surface2: '#222224',
  surface3: '#262628',
  surface4: '#282829',
  surface5: '#2A2A2C',
  // M3 secondary / tertiary / purple
  secondaryContainer:   '#003258',
  onSecondaryContainer: '#CFE5FF',
  tertiaryContainer:    '#4E2D00',
  onTertiaryContainer:  '#FFDCBf',
  purpleContainer:      '#2D1B52',
  purple:               '#A78BFA',
  // iOS translucent tab bar background
  tabBg: 'rgba(28,28,30,0.78)',
  onSurface:      '#F2F2F7',
  onSurfaceVar:   '#AEAEB2',
  onSurfaceVar2:  '#636366',
  onSurfaceFaint: '#48484A',
  ink:   '#F2F2F7',
  ink2:  '#AEAEB2',
  ink3:  '#636366',
  ink4:  '#48484A',
  primary:          '#83D5C6',
  primaryContainer: '#00504A',
  onPrimary:        '#00201C',
  onPrimaryContainer: '#A0F0E4',
  approval:       '#F59E0B',
  approvalBg:     '#2C1F00',
  error:          '#FF6B6B',
  errorBg:        '#410002',
  success:        '#4ADE80',
  successBg:      '#052e16',
  outline:        '#48484A',
  outlineVar:     '#3A3A3C',
  ...brand,
};

export type Tokens = typeof light;
export const tokens: Record<ColorScheme, Tokens> = { light, dark };

// Priority colours — same both themes
export const PRIORITY_COLOR: Record<string, string> = {
  urgent:  '#dc2626',
  high:    '#ef4444',
  medium:  '#f59e0b',
  low:     '#22c55e',
};

// Approval status colours
export const APPROVAL_COLOR: Record<string, string> = {
  pending:        '#d97706',
  pending_client: '#7c3aed',
  approved:       '#16a34a',
  rejected:       '#dc2626',
};

// Deterministic project colour from team_id
const PROJECT_PALETTE = [
  '#0082c6','#05b7aa','#8b5cf6','#ec4899',
  '#f59e0b','#10b981','#6366f1','#ef4444',
  '#14b8a6','#f97316',
];
export function projectColor(teamId: string, override?: string | null): string {
  if (override) return override;
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) hash = teamId.charCodeAt(i) + ((hash << 5) - hash);
  return PROJECT_PALETTE[Math.abs(hash) % PROJECT_PALETTE.length];
}

// Avatar initials colours
export const AVATAR_COLORS = [
  '#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1',
];
export function userInitials(name: string): string {
  const parts = (name || '').trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}
export function avatarColor(userId: string, index?: number): string {
  if (index !== undefined) return AVATAR_COLORS[index % AVATAR_COLORS.length];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Typography scale
export const type = {
  displaySerif: { fontFamily: 'Newsreader', fontWeight: '400' as const },
  titleSerif:   { fontFamily: 'Newsreader', fontWeight: '400' as const },
  labelHindi:   { fontFamily: 'TiroDevanagariHindi', fontWeight: '400' as const },
  mono:         { fontFamily: 'SpaceMono', fontWeight: '400' as const },
  // UI sizes
  xs:   { fontSize: 11, lineHeight: 15 },
  sm:   { fontSize: 13, lineHeight: 18 },
  base: { fontSize: 15, lineHeight: 22 },
  lg:   { fontSize: 17, lineHeight: 24 },
  xl:   { fontSize: 20, lineHeight: 28 },
  xxl:  { fontSize: 26, lineHeight: 32 },
  hero: { fontSize: 34, lineHeight: 40 },
};

// Spacing
export const space = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40,
};

// Radii
export const radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  22,
  full: 999,
};
