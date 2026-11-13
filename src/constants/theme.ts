import { Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * MedSync AI · Design tokens
 * Estética HealthTech: superficies limpias, verde profundo, tipografía grande,
 * contraste alto y espacios generosos. Optimizado para lectores de 45 a 80 años.
 */

export const colors = {
  // Marca
  primary: '#0B6B57',
  primaryStrong: '#075243',
  primarySoft: '#E3F3EE',
  primaryMuted: '#B9DED3',

  // Acentos semánticos
  success: '#0E6E4E',
  successSoft: '#E4F4EC',
  warning: '#8A4F00',
  warningSoft: '#FFF2DC',
  danger: '#B3261E',
  dangerSoft: '#FCEAE8',
  info: '#1F5C8B',
  infoSoft: '#E8F1F8',
  ai: '#1D5FA8',
  aiSoft: '#E9F1FB',
  violet: '#6B4AA0',
  violetSoft: '#F0EAF8',

  // Neutros
  bg: '#F3F6F4',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF2EF',
  surfaceSunken: '#E7EEEA',
  ink: '#10221E',
  inkSoft: '#3D514B',
  inkMuted: '#5F716C',
  inkFaint: '#879690',
  border: '#DDE6E1',
  borderStrong: '#C6D4CD',
  white: '#FFFFFF',
  black: '#000000',

  // Efectos
  overlay: 'rgba(8, 26, 22, 0.45)',
  skeleton: '#E4ECE8',
} as const;

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export const typography = {
  display: {
    fontFamily: fonts.extrabold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.2,
  },
  h1: {
    fontFamily: fonts.extrabold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  h2: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  h3: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 19,
    lineHeight: 25,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
  },
  bodyStrong: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 24,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  overline: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  '2xl': 32,
  pill: 999,
} as const;

export const shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0B2B24',
      shadowOpacity: 0.07,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  soft: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0B2B24',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  floating: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#061B16',
      shadowOpacity: 0.18,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 10 },
    default: {},
  }),
} as const;

export const layout = {
  screenPadding: 20,
  tabBarSpace: 124,
  maxContentWidth: 620,
  maxFontScale: 1.5,
} as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;
