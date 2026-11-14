import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { formatTime } from '@/lib/date';
import { useNow } from '@/hooks/useNow';
import { useApp } from '@/store/AppProvider';
import { getDashboardData, JoinedDose } from '@/store/selectors';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeInView } from '@/components/ui/FadeInView';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GreetingHeader } from '@/components/dashboard/GreetingHeader';
import { LowStockBanner } from '@/components/dashboard/LowStockBanner';
import { ProfileSheet } from '@/components/dashboard/ProfileSheet';
import { SummaryHero } from '@/components/dashboard/SummaryHero';
import { NotificationPermissionCard } from '@/components/notifications/NotificationPermissionCard';
import { DoseCard } from '@/components/medication/DoseCard';
import { DoseRow } from '@/components/medication/DoseRow';
import { TakeSuccessModal } from '@/components/medication/TakeSuccessModal';

interface Celebration {
  item: JoinedDose;
  remaining: number;
}

export default function HomeScreen() {
  const { state, actions } = useApp();
  const now = useNow(30_000);
  const data = useMemo(() => getDashboardData(state, now), [state, now]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  const isCaregiver = state.role === 'caregiver';
  const linked =
    !isCaregiver || state.linkedPatientCode === state.profile.caregiverCode;

  if (isCaregiver && !linked) {
    return (
      <Screen tab>
        <EmptyState
          icon="link-outline"
          title="Vincula a tu paciente"
          message="Abre el panel de cuidador e introduce el código para ver sus tomas y alertas."
          actionLabel="Ir al panel"
          onAction={() => router.push('/caregiver')}
        />
      </Screen>
    );
  }

  const handleTake = (id: string) => {
    const item = data.actionable.find((dose) => dose.dose.id === id);
    if (!item) return;
    const remaining = Math.max(
      0,
      item.treatment.pillsRemaining - item.treatment.unitsPerDose,
    );
    actions.takeDose(id);
    setCelebration({ item, remaining });
  };

  const handleUndo = () => {
    if (!celebration) return;
    actions.undoTake(celebration.item.dose.id);
    setCelebration(null);
  };

  return (
    <Screen tab>
      <FadeInView>
        <GreetingHeader
          profile={
            isCaregiver
              ? {
                  ...state.profile,
                  name: state.profile.caregiverName || state.profile.name,
                  firstName:
                    (state.profile.caregiverName || '').trim().split(/\s+/)[0] ||
                    'Cuidador',
                }
              : state.profile
          }
          now={now}
          onSettings={() => setSettingsOpen(true)}
          onScan={() => router.push('/scan')}
        />
      </FadeInView>

      {isCaregiver ? (
        <FadeInView delay={30}>
          <Card
            tone="infoSoft"
            onPress={() => router.push('/caregiver')}
            style={styles.caregiverBanner}
            accessibilityLabel={`Ver el panel de ${state.profile.name}`}
          >
            <View style={styles.caregiverBannerRow}>
              <View style={styles.caregiverBannerIcon}>
                <Ionicons name="people" size={20} color={colors.white} />
              </View>
              <View style={styles.caregiverBannerText}>
                <AppText variant="bodyStrong" color={colors.info}>
                  Estás viendo a {state.profile.name}
                </AppText>
                <AppText variant="caption" color={colors.inkSoft}>
                  Abre el panel del cuidador para ver alertas y adherencia.
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.info} />
            </View>
          </Card>
        </FadeInView>
      ) : null}

      {state.role === 'patient' ? (
        <FadeInView delay={40} style={styles.permissionCard}>
          <NotificationPermissionCard compact />
        </FadeInView>
      ) : null}

      {state.treatments.length === 0 ? (
        <FadeInView delay={80}>
          <Card style={styles.emptyCard}>
            <EmptyState
              icon="medkit-outline"
              title="Empecemos con tu tratamiento"
              message="Agrega tu primera medicina o escanea una receta para autocompletar el calendario."
            />
            <View style={styles.emptyActions}>
              <Button
                label="Agregar tratamiento"
                icon="add"
                fullWidth
                onPress={() => router.push('/treatment/new')}
              />
              <Button
                label="Escanear receta"
                icon="scan-outline"
                variant="outline"
                fullWidth
                onPress={() => router.push('/scan')}
              />
            </View>
          </Card>
        </FadeInView>
      ) : (
        <>
          <FadeInView delay={50}>
            <SummaryHero data={data} />
          </FadeInView>

          {data.lowStock.length > 0 ? (
            <FadeInView delay={100}>
              <LowStockBanner
                treatments={data.lowStock}
                onPress={() => router.push(`/treatment/${data.lowStock[0].id}`)}
              />
            </FadeInView>
          ) : null}

          <View style={styles.section}>
            <SectionHeader
              title="Ahora"
              subtitle={
                data.actionable.length > 0
                  ? 'Tomas que necesitan tu atención'
                  : 'No tienes tomas pendientes'
              }
            />
            {data.actionable.length > 0 ? (
              <View style={styles.list}>
                {data.actionable.map((item) => (
                  <DoseCard
                    key={item.dose.id}
                    item={item}
                    onTake={handleTake}
                    onPostpone={actions.postponeDose}
                    onSkip={actions.skipDose}
                  />
                ))}
              </View>
            ) : (
              <Card tone="successSoft" style={styles.doneCard}>
                <View style={styles.doneIcon}>
                  <Ionicons name="checkmark" size={26} color={colors.white} />
                </View>
                <View style={styles.doneText}>
                  <AppText variant="h3" color={colors.success} weight="bold">
                    Estás al día
                  </AppText>
                  <AppText variant="body" color={colors.inkSoft}>
                    {data.nextDose
                      ? `Tu próxima toma es ${
                          data.nextDose.treatment.name
                        } a las ${formatTime(data.nextDose.dose.scheduledAt)}.`
                      : 'No hay más tomas programadas por hoy. Descansa.'}
                  </AppText>
                </View>
              </Card>
            )}
          </View>

          {data.upcoming.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Más tarde hoy"
                subtitle={`${data.upcoming.length} ${
                  data.upcoming.length === 1 ? 'toma programada' : 'tomas programadas'
                }`}
              />
              <View style={styles.rows}>
                {data.upcoming.slice(0, 4).map((item) => (
                  <DoseRow
                    key={item.dose.id}
                    item={item}
                    onPress={() => router.push(`/treatment/${item.treatment.id}`)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {data.completed.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Ya registradas"
                actionLabel="Historial"
                onAction={() => router.push('/caregiver')}
              />
              <View style={styles.rows}>
                {data.completed.slice(-5).map((item) => (
                  <DoseRow
                    key={item.dose.id}
                    item={item}
                    onPress={() => router.push(`/treatment/${item.treatment.id}`)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}

      <View style={styles.section}>
        <Card tone="aiSoft" onPress={() => router.push('/assistant')} style={styles.aiCard}>
          <View style={styles.aiRow}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles" size={24} color={colors.white} />
            </View>
            <View style={styles.aiText}>
              <AppText variant="bodyStrong" color={colors.ai}>
                ¿Tienes una duda sobre tus tomas?
              </AppText>
              <AppText variant="caption" color={colors.inkSoft}>
                Pregúntale a Medi o escanea una receta nueva.
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.ai} />
          </View>
        </Card>
      </View>

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.inkFaint} />
        <AppText variant="caption" color={colors.inkFaint} align="center" style={styles.footerText}>
          MedSync AI no sustituye la atención médica. Ante una urgencia, llama al 911.
        </AppText>
      </View>

      <ProfileSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TakeSuccessModal
        item={celebration?.item ?? null}
        remaining={celebration?.remaining ?? 0}
        onClose={() => setCelebration(null)}
        onUndo={handleUndo}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing['2xl'] },
  permissionCard: { marginBottom: spacing.xl },
  caregiverBanner: { marginBottom: spacing.xl, padding: spacing.md },
  caregiverBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  caregiverBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caregiverBannerText: { flex: 1, gap: 1 },
  list: { gap: spacing.md },
  rows: { gap: spacing.sm },
  emptyCard: { paddingBottom: spacing.xl },
  emptyActions: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  doneIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { flex: 1, gap: 2 },
  aiCard: { padding: spacing.lg },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  aiIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.ai,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiText: { flex: 1, gap: 2 },
  footer: {
    marginTop: spacing['3xl'],
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  footerText: { maxWidth: 340, lineHeight: 17 },
});
