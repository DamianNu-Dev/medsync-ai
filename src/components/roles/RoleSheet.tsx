import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { useApp } from '@/store/AppProvider';
import { useAuth } from '@/store/AuthProvider';
import { useNotifications } from '@/store/NotificationProvider';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';

interface RoleSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function RoleSheet({ visible, onClose }: RoleSheetProps) {
  const { state, actions } = useApp();
  const {
    mode,
    user,
    patient,
    busy,
    error: authError,
    linkPatient,
    unlinkPatient,
    clearError,
  } = useAuth();
  const { permission } = useNotifications();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isAccount = mode === 'account';
  const isCaregiver = isAccount ? user?.role === 'caregiver' : state.role === 'caregiver';
  const patientCode = patient?.code ?? state.profile.caregiverCode;
  const linked = isCaregiver
    ? isAccount
      ? Boolean(patient)
      : state.linkedPatientCode === state.profile.caregiverCode
    : false;

  const goPatient = () => {
    actions.setRole('patient');
    onClose();
    router.replace('/');
  };

  const goCaregiver = () => {
    if (linked) {
      actions.setRole('caregiver');
      onClose();
      router.replace('/caregiver');
      return;
    }
    if (code.trim().length === 0) {
      setError('Escribe el código de vinculación del paciente.');
      return;
    }
    if (!actions.linkCaregiver(code)) {
      setError('El código no coincide. Revísalo con el paciente.');
      return;
    }
    setCode('');
    setError(null);
    onClose();
    router.replace('/caregiver');
  };

  const handleRemoteLink = async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError('Escribe el código de vinculación del paciente.');
      return;
    }
    setError(null);
    clearError();
    try {
      await linkPatient(normalized);
      setCode('');
      onClose();
      router.replace('/caregiver');
    } catch {
      // El mensaje se muestra desde AuthProvider.
    }
  };

  const handleRemoteUnlink = async () => {
    setError(null);
    clearError();
    try {
      await unlinkPatient();
      onClose();
      router.replace('/caregiver');
    } catch {
      // El mensaje se muestra desde AuthProvider.
    }
  };

  const message = error ?? authError;

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setError(null);
        clearError();
        onClose();
      }}
      title="Roles y vinculación"
      description={
        isAccount
          ? 'Esta cuenta define si eres paciente o cuidador.'
          : 'Paciente y cuidador comparten los mismos datos en este dispositivo.'
      }
    >
      <Card tone={isCaregiver ? 'infoSoft' : 'primarySoft'} style={styles.statusCard}>
        <View style={styles.statusIcon}>
          <Ionicons
            name={isCaregiver ? 'people' : 'person'}
            size={22}
            color={isCaregiver ? colors.info : colors.primary}
          />
        </View>
        <View style={styles.statusText}>
          <AppText variant="caption" color={colors.inkMuted}>
            {isAccount ? 'Cuenta' : 'Modo actual'}
          </AppText>
          <AppText variant="bodyStrong">
            {isAccount ? user?.name : isCaregiver ? state.profile.caregiverName : state.profile.name}
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {isAccount ? user?.email : 'Datos guardados solo en este teléfono'}
          </AppText>
        </View>
      </Card>

      {isCaregiver ? (
        <>
          <View style={styles.linkedRow}>
            <Ionicons
              name={linked ? 'shield-checkmark' : 'information-circle-outline'}
              size={18}
              color={linked ? colors.success : colors.inkMuted}
            />
            <AppText variant="caption" color={colors.inkSoft} style={styles.linkedText}>
              {linked
                ? `Puedes ver las tomas y alertas de ${
                    patient?.name ?? state.profile.name
                  } en tiempo real.`
                : 'Todavía no tienes un paciente vinculado. Pídele su código de vinculación.'}
            </AppText>
          </View>

          {linked ? (
            <>
              <View style={styles.codeRow}>
                <View style={styles.codeInfo}>
                  <AppText variant="caption" color={colors.inkMuted}>
                    Paciente vinculado
                  </AppText>
                  <AppText variant="h3" weight="extrabold" color={colors.primaryStrong}>
                    {patient?.name ?? state.profile.name}
                  </AppText>
                  <AppText variant="caption" color={colors.inkMuted}>
                    Código {patientCode}
                  </AppText>
                </View>
                <Ionicons name="people" size={26} color={colors.primary} />
              </View>

              {isAccount ? (
                <Button
                  label="Desvincular paciente"
                  icon="unlink-outline"
                  variant="dangerSoft"
                  size="md"
                  fullWidth
                  loading={busy}
                  onPress={() => void handleRemoteUnlink()}
                />
              ) : (
                <>
                  <Button
                    label="Volver a modo paciente"
                    icon="person-outline"
                    fullWidth
                    onPress={goPatient}
                  />
                  <Button
                    label="Desvincular paciente"
                    icon="unlink-outline"
                    variant="dangerSoft"
                    size="md"
                    fullWidth
                    onPress={() => {
                      actions.unlinkCaregiver();
                      onClose();
                      goPatient();
                    }}
                  />
                </>
              )}
            </>
          ) : isAccount ? (
            <>
              <TextField
                label="Código del paciente"
                value={code}
                onChangeText={(value) => {
                  setCode(value.toUpperCase());
                  setError(null);
                  clearError();
                }}
                placeholder="MED-0000"
                autoCapitalize="characters"
                autoCorrect={false}
                error={message ?? undefined}
                hint="Lo encuentras en el perfil del paciente, en la sección de vinculación."
              />
              <Button
                label="Vincular paciente"
                icon="link"
                fullWidth
                loading={busy}
                onPress={() => void handleRemoteLink()}
              />
            </>
          ) : (
            <>
              <TextField
                label="Vincular este dispositivo como cuidador"
                value={code}
                onChangeText={(value) => {
                  setCode(value.toUpperCase());
                  setError(null);
                }}
                placeholder="MED-0000"
                autoCapitalize="characters"
                autoCorrect={false}
                error={message ?? undefined}
              />
              <Button
                label="Vincular y cambiar a cuidador"
                icon="link"
                fullWidth
                onPress={goCaregiver}
              />
            </>
          )}
        </>
      ) : (
        <>
          <View style={styles.codeRow}>
            <View style={styles.codeInfo}>
              <AppText variant="caption" color={colors.inkMuted}>
                Código para vincular a tu cuidador
              </AppText>
              <AppText variant="h3" weight="extrabold" color={colors.primaryStrong}>
                {patientCode || 'Sin código'}
              </AppText>
            </View>
            <Ionicons name="key-outline" size={26} color={colors.primary} />
          </View>

          <View style={styles.alarmRow}>
            <View style={styles.alarmText}>
              <AppText variant="bodyStrong">Alarma de toma</AppText>
              <AppText variant="caption" color={colors.inkMuted}>
                Se apaga solo con la verificación visual de la pastilla en la boca.
              </AppText>
            </View>
            <Switch
              value={state.alarmEnabled}
              onValueChange={actions.setAlarmEnabled}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={state.alarmEnabled ? colors.primary : colors.surface}
              accessibilityLabel="Activar alarma de toma"
            />
          </View>

          <View style={styles.linkedRow}>
            <Ionicons
              name={permission.status === 'granted' ? 'notifications' : 'notifications-outline'}
              size={18}
              color={permission.status === 'granted' ? colors.success : colors.info}
            />
            <AppText variant="caption" color={colors.inkSoft} style={styles.linkedText}>
              {permission.status === 'granted'
                ? 'Los recordatorios del teléfono están activos. Puedes cambiarlos desde el perfil.'
                : 'Los recordatorios del teléfono aún no están activados. Actívalos desde el inicio o el perfil.'}
            </AppText>
          </View>

          {!isAccount ? (
            linked ? (
              <Button
                label="Cambiar a modo cuidador"
                icon="people-outline"
                fullWidth
                onPress={goCaregiver}
              />
            ) : (
              <>
                <TextField
                  label="Vincular este dispositivo como cuidador"
                  value={code}
                  onChangeText={(value) => {
                    setCode(value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="MED-0000"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  error={message ?? undefined}
                />
                <Button
                  label="Vincular y cambiar a cuidador"
                  icon="link"
                  fullWidth
                  onPress={goCaregiver}
                />
              </>
            )
          ) : (
            <AppText variant="caption" color={colors.inkMuted} style={styles.accountNote}>
              Comparte este código con tu cuidador para que cree su cuenta y se vincule. Tu
              cuenta de paciente no cambia de rol.
            </AppText>
          )}
        </>
      )}

      {message && !(isAccount && isCaregiver && !linked) ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={17} color={colors.danger} />
          <AppText variant="caption" color={colors.danger} style={styles.errorText}>
            {message}
          </AppText>
        </View>
      ) : null}

      <Button label="Cerrar" variant="ghost" size="md" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { flex: 1, gap: 1 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  codeInfo: { flex: 1, gap: 2 },
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  alarmText: { flex: 1, gap: 1 },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  linkedText: { flex: 1, lineHeight: 17 },
  accountNote: { lineHeight: 17 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { flex: 1, lineHeight: 18 },
});
