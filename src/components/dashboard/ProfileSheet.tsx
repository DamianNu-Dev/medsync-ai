import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { APP_NAME, DISCLAIMER } from '@/constants/config';
import { colors, radius, spacing } from '@/constants/theme';
import { useApp } from '@/store/AppProvider';
import { useAuth } from '@/store/AuthProvider';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { NotificationPermissionCard } from '@/components/notifications/NotificationPermissionCard';
import { RoleSheet } from '@/components/roles/RoleSheet';

interface ProfileSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function ProfileSheet({ visible, onClose }: ProfileSheetProps) {
  const { state, actions } = useApp();
  const {
    mode,
    user,
    patient,
    apiBaseUrl,
    busy,
    syncState,
    lastSyncedAt,
    logout,
  } = useAuth();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);

  const isAccount = mode === 'account';
  const isCaregiver = isAccount ? user?.role === 'caregiver' : state.role === 'caregiver';
  const displayName = isAccount && user ? user.name : state.profile.name;

  const handleReset = () => {
    actions.resetDemo();
    setConfirmReset(false);
    onClose();
    actions.showToast('Datos de demostración restablecidos', 'success');
  };

  const handleLogout = async () => {
    setConfirmLogout(false);
    onClose();
    await logout();
  };

  const syncLabel = !isAccount
    ? 'Sin sincronización · solo este teléfono'
    : syncState === 'saving'
      ? 'Guardando cambios…'
      : syncState === 'error'
        ? 'Sin conexión con el servidor'
        : lastSyncedAt
          ? `Sincronizado a las ${new Date(lastSyncedAt).toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : 'Todo guardado';

  return (
    <>
      <Sheet
        visible={visible}
        onClose={() => {
          setConfirmReset(false);
          setConfirmLogout(false);
          onClose();
        }}
        title="Tu perfil"
        description={isAccount ? 'Tu cuenta y la sincronización del tratamiento.' : 'Datos guardados en este teléfono.'}
      >
        <View style={styles.brandRow}>
          <BrandMark size={46} />
        </View>

        <View style={styles.profileRow}>
          <Avatar name={displayName} size={52} />
          <View style={styles.profileText}>
            <AppText variant="h3" weight="bold">
              {displayName}
            </AppText>
            <AppText variant="caption" color={colors.inkMuted}>
              {isCaregiver ? 'Cuidador' : 'Paciente'}
              {isCaregiver && patient ? ` · acompaña a ${patient.name}` : ''}
            </AppText>
            {isAccount && user ? (
              <AppText variant="caption" color={colors.inkFaint} numberOfLines={1}>
                {user.email}
              </AppText>
            ) : null}
          </View>
        </View>

        {isAccount ? (
          <Card tone={syncState === 'error' ? 'warningSoft' : 'alt'} style={styles.syncCard}>
            <View style={styles.syncRow}>
              <Ionicons
                name={
                  syncState === 'saving'
                    ? 'sync'
                    : syncState === 'error'
                      ? 'cloud-offline-outline'
                      : 'cloud-done-outline'
                }
                size={20}
                color={syncState === 'error' ? colors.warning : colors.primary}
              />
              <View style={styles.syncText}>
                <AppText variant="bodyStrong">{syncLabel}</AppText>
                <AppText variant="caption" color={colors.inkMuted} numberOfLines={1}>
                  Servidor: {apiBaseUrl}
                </AppText>
              </View>
            </View>
          </Card>
        ) : null}

        <View style={styles.infoList}>
          <InfoRow
            icon={isCaregiver ? 'people-outline' : 'key-outline'}
            label={isCaregiver ? 'Paciente vinculado' : 'Código de vinculación'}
            value={
              isCaregiver
                ? patient
                  ? `${patient.name} · ${patient.code}`
                  : 'Sin paciente vinculado'
                : patient?.code ?? state.profile.caregiverCode
            }
          />
          <InfoRow icon="call-outline" label="Teléfono de contacto" value={state.profile.phone} />
          <InfoRow
            icon="text-outline"
            label="Tamaño de letra"
            value="MedSync respeta el tamaño del sistema"
          />
          <InfoRow
            icon="shield-checkmark-outline"
            label="Privacidad"
            value={
              isAccount
                ? 'La cuenta se guarda en tu backend y la sesión en el almacenamiento seguro'
                : 'Los datos se guardan solo en este dispositivo'
            }
          />
        </View>

        <NotificationPermissionCard showWhenGranted />

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={18} color={colors.inkMuted} />
          <AppText variant="caption" color={colors.inkMuted} style={styles.disclaimerText}>
            {DISCLAIMER}
          </AppText>
        </View>

        <Button
          label="Roles y vinculación"
          icon="people-outline"
          variant="secondary"
          size="md"
          fullWidth
          onPress={() => setRolesOpen(true)}
          style={styles.action}
        />
        <Button
          label="Configurar inteligencia artificial"
          icon="sparkles-outline"
          variant="secondary"
          size="md"
          fullWidth
          onPress={() => {
            onClose();
            router.push('/ai-settings');
          }}
          style={styles.action}
        />

        {isAccount ? (
          confirmLogout ? (
            <View style={styles.confirm}>
              <AppText variant="bodyStrong" color={colors.danger}>
                ¿Cerrar sesión?
              </AppText>
              <AppText variant="caption" color={colors.inkSoft}>
                Tus datos siguen guardados en el servidor. Podrás volver a entrar con tu correo.
              </AppText>
              <Button
                label="Sí, cerrar sesión"
                variant="danger"
                size="md"
                loading={busy}
                onPress={() => void handleLogout()}
              />
              <Button
                label="Cancelar"
                variant="ghost"
                size="md"
                onPress={() => setConfirmLogout(false)}
              />
            </View>
          ) : (
            <Button
              label="Cerrar sesión"
              variant="dangerSoft"
              size="md"
              icon="log-out-outline"
              onPress={() => setConfirmLogout(true)}
              style={styles.reset}
            />
          )
        ) : (
          <>
            {confirmReset ? (
              <View style={styles.confirm}>
                <AppText variant="bodyStrong" color={colors.danger}>
                  ¿Restablecer todo?
                </AppText>
                <AppText variant="caption" color={colors.inkSoft}>
                  Se borrarán los tratamientos, tomas y la conversación de este dispositivo.
                </AppText>
                <Button label="Sí, restablecer" variant="danger" size="md" onPress={handleReset} />
                <Button
                  label="Cancelar"
                  variant="ghost"
                  size="md"
                  onPress={() => setConfirmReset(false)}
                />
              </View>
            ) : (
              <Button
                label="Restablecer datos de demostración"
                variant="dangerSoft"
                size="md"
                icon="refresh"
                onPress={() => setConfirmReset(true)}
                style={styles.reset}
              />
            )}
            <Button
              label="Crear cuenta o iniciar sesión"
              variant="outline"
              size="md"
              icon="log-in-outline"
              onPress={() => {
                onClose();
                router.replace('/auth');
              }}
              style={styles.reset}
            />
          </>
        )}

        <Button label="Cerrar" variant="primary" size="md" onPress={onClose} />

        <AppText variant="caption" color={colors.inkFaint} align="center" style={styles.version}>
          {APP_NAME} · versión 1.0.0
        </AppText>
      </Sheet>
      <RoleSheet visible={rolesOpen} onClose={() => setRolesOpen(false)} />
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.infoTexts}>
        <AppText variant="caption" color={colors.inkMuted}>
          {label}
        </AppText>
        <AppText variant="bodyStrong" color={colors.ink} numberOfLines={2}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: { marginBottom: spacing.lg },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  profileText: { flex: 1, gap: 2 },
  syncCard: { marginBottom: spacing.md, padding: spacing.md },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  syncText: { flex: 1, gap: 1 },
  infoList: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTexts: { flex: 1, gap: 1 },
  disclaimer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  disclaimerText: { flex: 1, lineHeight: 18 },
  confirm: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  reset: { marginBottom: spacing.md },
  action: { marginBottom: spacing.sm },
  version: { marginTop: spacing.md },
});
