import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, shadows, spacing } from '@/constants/theme';
import { useApp } from '@/store/AppProvider';
import { AppRole } from '@/types';
import { AppText } from '@/components/ui/AppText';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';

export function RoleOnboarding() {
  const { state, actions } = useApp();
  const [role, setRole] = useState<AppRole>('patient');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const choosePatient = () => {
    actions.completeOnboarding('patient');
    actions.showToast(`Bienvenida, ${state.profile.firstName}`, 'success');
    router.replace('/');
  };

  const chooseCaregiver = () => {
    if (code.trim().length === 0) {
      setError('Escribe el código que aparece en el perfil del paciente.');
      return;
    }
    const linked = actions.completeOnboarding('caregiver', code);
    if (!linked) {
      setError('Ese código no coincide. Pídele al paciente el código de vinculación.');
      return;
    }
    actions.showToast(`Vinculado con ${state.profile.name}`, 'success');
    router.replace('/caregiver');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <BrandMark size={54} />
          </View>

          <View style={styles.hero}>
            <AppText variant="caption" color={colors.primary} weight="bold">
              MEDSYNC AI
            </AppText>
            <AppText variant="display" weight="extrabold">
              ¿Cómo vas a usar la app?
            </AppText>
            <AppText variant="body" color={colors.inkSoft}>
              Elige tu rol. Paciente y cuidador comparten el mismo tratamiento mediante un
              código de vinculación.
            </AppText>
          </View>

          <View style={styles.roleGrid}>
            <RoleCard
              selected={role === 'patient'}
              icon="person"
              title="Soy paciente"
              detail="Quiero ver mis tomas, activar la alarma y registrar mi medicación."
              onPress={() => {
                setRole('patient');
                setError(null);
              }}
            />
            <RoleCard
              selected={role === 'caregiver'}
              icon="people"
              title="Soy cuidador"
              detail="Quiero acompañar a una persona y recibir alertas de su tratamiento."
              onPress={() => {
                setRole('caregiver');
                setError(null);
              }}
            />
          </View>

          {role === 'patient' ? (
            <Card style={styles.panel}>
              <View style={styles.panelHeader}>
                <View style={styles.iconBadge}>
                  <Ionicons name="key-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.panelText}>
                  <AppText variant="bodyStrong">Tu código de vinculación</AppText>
                  <AppText variant="caption" color={colors.inkMuted}>
                    Compártelo con tu cuidador para que vea tus tomas.
                  </AppText>
                </View>
              </View>
              <View style={styles.codeBox}>
                <AppText variant="h2" weight="extrabold" color={colors.primaryStrong}>
                  {state.profile.caregiverCode}
                </AppText>
              </View>
              <Button
                label={`Entrar como ${state.profile.firstName}`}
                icon="arrow-forward"
                fullWidth
                onPress={choosePatient}
              />
              <AppText variant="caption" color={colors.inkMuted} align="center">
                Paciente de esta demo: {state.profile.name}
              </AppText>
            </Card>
          ) : (
            <Card style={styles.panel}>
              <View style={styles.panelHeader}>
                <View style={styles.iconBadge}>
                  <Ionicons name="link-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.panelText}>
                  <AppText variant="bodyStrong">Vincula a tu paciente</AppText>
                  <AppText variant="caption" color={colors.inkMuted}>
                    Introduce el código que aparece en el perfil del paciente.
                  </AppText>
                </View>
              </View>
              <TextField
                label="Código de vinculación"
                value={code}
                onChangeText={(value) => {
                  setCode(value.toUpperCase());
                  setError(null);
                }}
                placeholder="MED-0000"
                autoCapitalize="characters"
                autoCorrect={false}
                error={error ?? undefined}
              />
              <Button
                label="Vincular y entrar"
                icon="link"
                fullWidth
                onPress={chooseCaregiver}
              />
              <View style={styles.demoHint}>
                <Ionicons name="flask-outline" size={15} color={colors.info} />
                <AppText variant="caption" color={colors.inkSoft} style={styles.demoHintText}>
                  En esta demo puedes usar el código{' '}
                  <AppText variant="caption" weight="bold" color={colors.info}>
                    MED-4821
                  </AppText>
                  .
                </AppText>
              </View>
            </Card>
          )}

          <View style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.inkMuted} />
            <AppText variant="caption" color={colors.inkMuted} style={styles.noteText}>
              La vinculación de esta versión vive en este dispositivo. Para sincronizar entre
              teléfonos hace falta un backend con autenticación.
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RoleCard({
  selected,
  icon,
  title,
  detail,
  onPress,
}: {
  selected: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.roleCard,
        selected ? styles.roleCardSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.roleIcon, selected ? styles.roleIconSelected : null]}>
        <Ionicons
          name={icon}
          size={23}
          color={selected ? colors.white : colors.primary}
        />
      </View>
      <AppText variant="bodyStrong" color={selected ? colors.primaryStrong : colors.ink}>
        {title}
      </AppText>
      <AppText variant="caption" color={colors.inkMuted} style={styles.roleDetail}>
        {detail}
      </AppText>
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
    gap: spacing.xl,
  },
  brand: {},
  hero: { gap: spacing.sm },
  roleGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  roleCard: {
    flex: 1,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: 190,
    ...shadows.card,
  },
  roleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconSelected: { backgroundColor: colors.primary },
  roleDetail: { lineHeight: 17 },
  check: { position: 'absolute', top: spacing.md, right: spacing.md },
  pressed: { opacity: 0.8 },
  panel: { gap: spacing.lg },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelText: { flex: 1, gap: 1 },
  codeBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  demoHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  demoHintText: { flex: 1, lineHeight: 17 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteText: { flex: 1, lineHeight: 17 },
});
