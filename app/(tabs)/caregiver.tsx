import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';

import { colors, radius, shadows, spacing } from '@/constants/theme';
import { formatTimeShort, relativeFromNow } from '@/lib/date';
import { useNow } from '@/hooks/useNow';
import { useApp } from '@/store/AppProvider';
import {
  CaregiverData,
  getCaregiverData,
  getSyncLabel,
  getTodayDoses,
} from '@/store/selectors';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeInView } from '@/components/ui/FadeInView';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PulseDot } from '@/components/ui/PulseDot';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { WeekBars } from '@/components/caregiver/WeekBars';
import { RoleSheet } from '@/components/roles/RoleSheet';
import { DoseRow } from '@/components/medication/DoseRow';

const HERO_GRADIENTS: Record<CaregiverData['severity'], [string, string]> = {
  success: ['#0C755F', '#06483B'],
  warning: ['#A15A00', '#6F3D00'],
  danger: ['#B3261E', '#7A1410'],
};

const HERO_ICONS: Record<
  CaregiverData['severity'],
  React.ComponentProps<typeof Ionicons>['name']
> = {
  success: 'shield-checkmark',
  warning: 'alert-circle',
  danger: 'warning',
};

export default function CaregiverScreen() {
  const { state, actions } = useApp();
  const [rolesOpen, setRolesOpen] = useState(false);
  const linked = state.linkedPatientCode === state.profile.caregiverCode;
  const now = useNow(30_000);
  const data = useMemo(() => getCaregiverData(state, now), [state, now]);
  const today = useMemo(() => getTodayDoses(state, now), [state, now]);

  const average = useMemo(() => {
    const withData = data.weekly.filter((day) => day.total > 0);
    if (withData.length === 0) return null;
    return Math.round(
      withData.reduce((sum, day) => sum + day.percent, 0) / withData.length,
    );
  }, [data.weekly]);

  const shareText = async (message: string) => {
    try {
      await Share.share({ message });
    } catch {
      actions.showToast('No se pudo abrir el menú de compartir', 'error');
    }
  };

  const shareCode = () =>
    shareText(
      `Hola, te comparto el código de MedSync AI para acompañar el tratamiento de ${state.profile.firstName}: ${state.profile.caregiverCode}.`,
    );

  const callPatient = async () => {
    try {
      await Linking.openURL(`tel:${state.profile.phone.replace(/\s+/g, '')}`);
    } catch {
      actions.showToast('No se pudo iniciar la llamada', 'error');
    }
  };

  if (state.role === 'caregiver' && !linked) {
    return (
      <Screen tab>
        <EmptyState
          icon="link-outline"
          title="Vincula a tu paciente"
          message="Introduce el código de vinculación para ver sus tomas y alertas."
          actionLabel="Vincular paciente"
          onAction={() => setRolesOpen(true)}
        />
        <RoleSheet visible={rolesOpen} onClose={() => setRolesOpen(false)} />
      </Screen>
    );
  }

  return (
    <Screen tab>
      <FadeInView>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="h1" weight="extrabold">
              Modo cuidador
            </AppText>
            <AppText variant="body" color={colors.inkMuted}>
              Panel de {state.profile.caregiverName}
            </AppText>
            <AppText variant="caption" color={linked ? colors.success : colors.inkMuted}>
              {linked
                ? `Vinculado con ${state.profile.name}`
                : 'Vista previa · sin vínculo'}
            </AppText>
          </View>
          <Pressable
            onPress={() => setRolesOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Roles y vinculación"
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <Avatar name={state.profile.caregiverName} size={50} />
          </Pressable>
        </View>
      </FadeInView>

      <FadeInView delay={60}>
        <LinearGradient
          colors={HERO_GRADIENTS[data.severity]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.livePill}>
              <PulseDot color={colors.white} size={7} />
              <AppText variant="caption" color={colors.white} weight="bold">
                En vivo
              </AppText>
            </View>
            <AppText variant="caption" color="rgba(255,255,255,0.7)">
              {getSyncLabel(state.lastSyncAt, now)}
            </AppText>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusIcon}>
              <Ionicons name={HERO_ICONS[data.severity]} size={30} color={colors.white} />
            </View>
            <View style={styles.statusText}>
              <AppText variant="h1" color={colors.white} weight="extrabold">
                {data.title}
              </AppText>
              <AppText variant="body" color="rgba(255,255,255,0.82)">
                {data.detail}
              </AppText>
            </View>
          </View>

          <View style={styles.patientRow}>
            <Avatar name={state.profile.name} size={40} />
            <View style={styles.patientText}>
              <AppText variant="bodyStrong" color={colors.white}>
                {state.profile.name}
              </AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.7)">
                Paciente vinculada
              </AppText>
              {data.lastTaken ? (
                <AppText variant="caption" color="rgba(255,255,255,0.62)">
                  Última toma{' '}
                  {relativeFromNow(
                    data.lastTaken.dose.takenAt ?? data.lastTaken.dose.scheduledAt,
                    now,
                  )}
                </AppText>
              ) : null}
            </View>
          </View>

          <View style={styles.metrics}>
            <HeroMetric label="Adherencia" value={`${data.adherence}%`} hint="de hoy" />
            <View style={styles.metricDivider} />
            <HeroMetric
              label="Registradas"
              value={`${data.takenToday}/${data.totalToday}`}
              hint="tomas"
            />
            <View style={styles.metricDivider} />
            <HeroMetric
              label="Próxima"
              value={data.nextDose ? formatTimeShort(data.nextDose.dose.scheduledAt) : '—'}
              hint={data.nextDose?.treatment.name ?? 'sin pendientes'}
            />
          </View>
        </LinearGradient>
      </FadeInView>

      <FadeInView delay={120}>
        <Card style={styles.codeCard}>
          <View style={styles.codeRow}>
            <View style={styles.keyIcon}>
              <Ionicons name="key-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.codeText}>
              <AppText variant="caption" color={colors.inkMuted} weight="semibold">
                Código de vinculación
              </AppText>
              <AppText
                variant="h2"
                weight="extrabold"
                color={colors.primaryStrong}
                style={styles.code}
              >
                {state.profile.caregiverCode}
              </AppText>
              <AppText variant="caption" color={colors.inkMuted}>
                Compártelo para que otro cuidador vea este panel.
              </AppText>
            </View>
            <View style={styles.codeActions}>
              <Pressable
                onPress={callPatient}
                accessibilityRole="button"
                accessibilityLabel={`Llamar a ${state.profile.name}`}
                style={({ pressed }) => [styles.circleButton, pressed ? styles.pressed : null]}
              >
                <Ionicons name="call-outline" size={20} color={colors.primaryStrong} />
              </Pressable>
              <Pressable
                onPress={shareCode}
                accessibilityRole="button"
                accessibilityLabel="Compartir código de vinculación"
                style={({ pressed }) => [styles.circleButton, pressed ? styles.pressed : null]}
              >
                <Ionicons name="share-social-outline" size={20} color={colors.primaryStrong} />
              </Pressable>
            </View>
          </View>
        </Card>
      </FadeInView>

      <View style={styles.section}>
        <SectionHeader
          title="Alertas"
          subtitle={
            data.alerts.length === 0
              ? 'Sin novedades por ahora'
              : `${data.alerts.length} ${
                  data.alerts.length === 1 ? 'punto a revisar' : 'puntos a revisar'
                }`
          }
        />
        {data.alerts.length === 0 ? (
          <Card tone="successSoft" style={styles.calmCard}>
            <View style={styles.calmIcon}>
              <Ionicons name="shield-checkmark" size={24} color={colors.white} />
            </View>
            <View style={styles.calmText}>
              <AppText variant="bodyStrong" color={colors.success}>
                Todo bajo control
              </AppText>
              <AppText variant="caption" color={colors.inkSoft}>
                Las tomas de hoy están registradas y el inventario está en orden.
              </AppText>
            </View>
          </Card>
        ) : (
          <View style={styles.alertList}>
            {data.alerts.map((alert) => {
              const danger = alert.severity === 'danger';
              return (
                <Card
                  key={alert.id}
                  tone={danger ? 'dangerSoft' : 'warningSoft'}
                  style={styles.alertCard}
                >
                  <View style={styles.alertRow}>
                    <View
                      style={[
                        styles.alertIcon,
                        { backgroundColor: danger ? colors.danger : colors.warning },
                      ]}
                    >
                      <Ionicons
                        name={danger ? 'alert' : 'cube-outline'}
                        size={20}
                        color={colors.white}
                      />
                    </View>
                    <View style={styles.alertText}>
                      <AppText
                        variant="bodyStrong"
                        color={danger ? colors.danger : colors.warning}
                      >
                        {alert.title}
                      </AppText>
                      <AppText
                        variant="caption"
                        color={colors.inkSoft}
                        style={styles.alertDetail}
                      >
                        {alert.detail}
                      </AppText>
                    </View>
                  </View>
                  <View style={styles.alertActions}>
                    <Button
                      label={danger ? 'Enviar recordatorio' : 'Ver tratamiento'}
                      size="sm"
                      variant={danger ? 'dangerSoft' : 'outline'}
                      icon={danger ? 'notifications-outline' : 'medkit-outline'}
                      onPress={() => {
                        if (danger) {
                          void shareText(
                            `Recordatorio de MedSync AI: ${state.profile.firstName} tiene una toma pendiente de ${alert.title}.`,
                          );
                        } else if (alert.treatmentId) {
                          router.push(`/treatment/${alert.treatmentId}`);
                        }
                      }}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Hoy" subtitle="Progreso del tratamiento" />
        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <AppText variant="bodyStrong">
              {data.takenToday} de {data.totalToday} tomas registradas
            </AppText>
            <Badge
              label={`${data.adherence}%`}
              tone={
                data.adherence >= 80 ? 'success' : data.adherence >= 50 ? 'warning' : 'danger'
              }
            />
          </View>
          <ProgressBar
            value={data.totalToday === 0 ? 0 : data.takenToday / data.totalToday}
            height={10}
            color={data.severity === 'danger' ? colors.danger : colors.primary}
          />
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <AppText variant="caption" color={colors.inkMuted}>
                Tomada
              </AppText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
              <AppText variant="caption" color={colors.inkMuted}>
                Es hora
              </AppText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
              <AppText variant="caption" color={colors.inkMuted}>
                Atrasada u omitida
              </AppText>
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Adherencia"
          subtitle={`Últimos 7 días${average === null ? '' : ` · ${average}% promedio`}`}
        />
        <Card style={styles.weekCard}>
          <WeekBars days={data.weekly} />
          <AppText
            variant="caption"
            color={colors.inkMuted}
            align="center"
            style={styles.weekHint}
          >
            Cada barra representa un día. Verde: 85 % o más · Rojo: menos de 50 %.
          </AppText>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Tomas de hoy" subtitle={`${today.length} programadas`} />
        {today.length === 0 ? (
          <Card tone="alt">
            <AppText variant="body" color={colors.inkMuted} align="center">
              No hay tomas programadas para hoy.
            </AppText>
          </Card>
        ) : (
          <View style={styles.rows}>
            {today.map((item) => (
              <DoseRow
                key={item.dose.id}
                item={item}
                onPress={() => router.push(`/treatment/${item.treatment.id}`)}
              />
            ))}
          </View>
        )}
      </View>

      <Card tone="infoSoft" style={styles.infoCard}>
        <Ionicons name="git-network-outline" size={20} color={colors.info} />
        <AppText variant="caption" color={colors.inkSoft} style={styles.infoText}>
          Esta vista previa sincroniza el panel en este dispositivo. Para monitoreo remoto
          real, conecta el backend de MedSync AI (ver README).
        </AppText>
      </Card>
      <RoleSheet visible={rolesOpen} onClose={() => setRolesOpen(false)} />
    </Screen>
  );
}

function HeroMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.metric}>
      <AppText variant="caption" color="rgba(255,255,255,0.66)">
        {label}
      </AppText>
      <AppText variant="title" color={colors.white} weight="bold" numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" color="rgba(255,255,255,0.6)" numberOfLines={1}>
        {hint}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headerText: { flex: 1, gap: 2 },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.card,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { flex: 1, gap: 2 },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  patientText: { flex: 1, gap: 1 },
  metrics: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 4,
  },
  metricDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  codeCard: { marginTop: spacing.lg, padding: spacing.lg },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  keyIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: { flex: 1, gap: 1 },
  code: { letterSpacing: 1.5 },
  codeActions: { gap: 8 },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  section: { marginTop: spacing['2xl'] },
  calmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  calmIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calmText: { flex: 1, gap: 2 },
  alertList: { gap: spacing.md },
  alertCard: { gap: spacing.md },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertText: { flex: 1, gap: 2 },
  alertDetail: { lineHeight: 18 },
  alertActions: { alignItems: 'flex-start', paddingLeft: 52 },
  progressCard: { gap: spacing.md },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  weekCard: { gap: spacing.md },
  weekHint: { lineHeight: 17 },
  rows: { gap: spacing.sm },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing['2xl'],
  },
  infoText: { flex: 1, lineHeight: 18 },
});
