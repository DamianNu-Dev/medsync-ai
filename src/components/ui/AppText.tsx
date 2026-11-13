import React from 'react';
import { Text, TextProps } from 'react-native';

import { colors, fonts, layout, typography } from '@/constants/theme';

type Variant = keyof typeof typography;
type Weight = keyof typeof fonts;

export interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  weight?: Weight;
}

export function AppText({
  variant = 'body',
  color = colors.ink,
  align,
  weight,
  style,
  children,
  maxFontSizeMultiplier = layout.maxFontScale,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        typography[variant],
        { color },
        align ? { textAlign: align } : null,
        weight ? { fontFamily: fonts[weight] } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
