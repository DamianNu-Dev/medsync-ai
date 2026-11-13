import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius } from '@/constants/theme';
import { AppText } from './AppText';

interface ProgressBarProps {
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
  label?: string;
  valueLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  value,
  color = colors.primary,
  trackColor = colors.surfaceSunken,
  height = 9,
  label,
  valueLabel,
  style,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const progress = useRef(new Animated.Value(clamped)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: clamped,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [clamped, progress]);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={style}>
      {label || valueLabel ? (
        <View style={styles.header}>
          {label ? (
            <AppText variant="caption" color={colors.inkMuted} weight="semibold">
              {label}
            </AppText>
          ) : (
            <View />
          )}
          {valueLabel ? (
            <AppText variant="caption" color={colors.inkSoft} weight="bold">
              {valueLabel}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View
        onLayout={onLayout}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
        style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              borderRadius: height / 2,
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, width],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  track: {
    overflow: 'hidden',
    width: '100%',
    borderRadius: radius.pill,
  },
  fill: {
    height: '100%',
  },
});
