/**
 * Grocery Choice Delivery App - Design Tokens & Theme
 * Optimized for outdoor readability, high contrast, and large touch targets.
 */

export const colors = {
  primary: '#059669', // Emerald 600
  primaryDark: '#047857',
  primaryLight: '#ecfdf5', // Emerald 50
  primaryGlow: 'rgba(5, 150, 105, 0.15)',

  secondary: '#0f172a', // Slate 900
  secondaryLight: '#1e293b',

  background: '#f8fafc', // Slate 50
  surface: '#ffffff',
  surfaceCard: '#ffffff',
  surfaceSecondary: '#f1f5f9',

  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textInverse: '#ffffff',

  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  borderFocus: '#059669',

  success: '#10b981',
  successLight: '#f0fdf4',
  successBorder: '#bbf7d0',
  successText: '#166534',

  danger: '#ef4444',
  dangerLight: '#fef2f2',
  dangerBorder: '#fecaca',
  dangerText: '#991b1b',

  warning: '#f59e0b',
  warningLight: '#fffbeb',
  warningBorder: '#fde68a',
  warningText: '#92400e',

  info: '#0284c7',
  infoLight: '#f0f9ff',
  infoBorder: '#bae6fd',
  infoText: '#0369a1',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const typography = {
  h1: { fontSize: 24, fontWeight: '800' as const, color: colors.textPrimary },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.textPrimary },
  h3: { fontSize: 18, fontWeight: '700' as const, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.textSecondary },
  bodyMedium: { fontSize: 15, fontWeight: '600' as const, color: colors.textPrimary },
  small: { fontSize: 13, fontWeight: '400' as const, color: colors.textMuted },
  caption: { fontSize: 11, fontWeight: '500' as const, color: colors.textMuted },
};
