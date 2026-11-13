import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { formIcon } from '@/constants/medication';
import { radius } from '@/constants/theme';
import { MedicationForm } from '@/types';

interface MedicationIconProps {
  form: MedicationForm;
  color: string;
  size?: number;
}

export function MedicationIcon({ form, color, size = 54 }: MedicationIconProps) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: color,
        },
      ]}
    >
      <Ionicons name={formIcon(form)} size={size * 0.5} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
});
