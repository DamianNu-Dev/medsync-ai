import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { useNow } from '@/hooks/useNow';
import { getStockLevel } from '@/lib/schedule';
import { useApp } from '@/store/AppProvider';
import { getNextDosesByTreatment } from '@/store/selectors';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeInView } from '@/components/ui/FadeInView';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { LowStockBanner } from '@/components/dashboard/LowStockBanner';
import { TreatmentCard } from '@/components/treatments/TreatmentCard';

export default function TreatmentsScreen() {
  const { state } = useApp();
  const now = useNow(60_000);

  const active = state.treatments.filter((treatment) => treatment.active);
  const paused = state.treatments.filter((treatment) => !treatment.active);
  const lowStock = state.treatments.filter(
    (treatment) => treatment.active && getStockLevel(treatment) !== 'ok',
  );
  const nextByTreatment = useMemo(
    () => getNextDosesByTreatment(state, now),
    [state, now],
  );

  const totalPills = active.reduce((sum, treatment) => sum + treatment.pillsRemaining, 0);

  return (
    <Screen tab>
      <FadeInView>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="h1" weight="extrabold">
              Tratamientos
            </AppText>
            <AppText variant="body" color={colors.inkMuted}>
              {active.length} {active.length === 1 ? 'activo' : 'activos'} ·{' '}
              {totalPills} unidades
            </AppText>
          </View>
          <Button
            label="Nuevo"
            icon="add"
            size="md"
            onPress={() => router.push('/treatment/new')}
            accessibilityLabel="Agregar nuevo tratamiento"
          />
        </View>
      </FadeInView>

      {state.treatments.length === 0 ? (
        <Card style={styles.emptyCard}>
          <EmptyState
            icon="medkit-outline"
            title="Aún no hay tratamientos"
            message="Crea uno manualmente o escanea una receta para cargar los datos automáticamente."
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
      ) : (
        <>
          {lowStock.length > 0 ? (
            <FadeInView delay={60} style={styles.block}>
              <LowStockBanner
                treatments={lowStock}
                onPress={() => router.push(`/treatment/${lowStock[0].id}`)}
              />
            </FadeInView>
          ) : null}

          <FadeInView delay={100}>
            <Card
              tone="primarySoft"
              onPress={() => router.push('/scan')}
              style={styles.scanCard}
              accessibilityLabel="Escanear receta médica"
            >
              <View style={styles.scanRow}>
                <View style={styles.scanIcon}>
                  <Ionicons name="scan" size={24} color={colors.white} />
                </View>
                <View style={styles.scanText}>
                  <AppText variant="bodyStrong" color={colors.primaryStrong}>
                    Escanear una receta
                  </AppText>
                  <AppText variant="caption" color={colors.inkSoft}>
                    Completa nombre, dosis y horario automáticamente.
                  </AppText>
                </View>
                <Ionicons name="camera-outline" size={22} color={colors.primaryStrong} />
              </View>
            </Card>
          </FadeInView>

          {active.length > 0 ? (
            <View style={styles.block}>
              <SectionHeader
                title="Activos"
                subtitle={`${active.length} en seguimiento`}
                style={styles.sectionHeader}
              />
              <View style={styles.list}>
                {active.map((treatment) => (
                  <TreatmentCard
                    key={treatment.id}
                    treatment={treatment}
                    nextDose={nextByTreatment.get(treatment.id)}
                    onPress={() => router.push(`/treatment/${treatment.id}`)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {paused.length > 0 ? (
            <View style={styles.block}>
              <SectionHeader title="En pausa" subtitle="Sin recordatorios por ahora" />
              <View style={styles.list}>
                {paused.map((treatment) => (
                  <TreatmentCard
                    key={treatment.id}
                    treatment={treatment}
                    nextDose={nextByTreatment.get(treatment.id)}
                    onPress={() => router.push(`/treatment/${treatment.id}`)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={() => router.push('/treatment/new')}
            accessibilityRole="button"
            accessibilityLabel="Agregar otro tratamiento"
            style={({ pressed }) => [styles.addCard, pressed ? styles.pressed : null]}
          >
            <View style={styles.addIcon}>
              <Ionicons name="add" size={24} color={colors.primary} />
            </View>
            <View style={styles.addText}>
              <AppText variant="bodyStrong" color={colors.primaryStrong}>
                Agregar otro tratamiento
              </AppText>
              <AppText variant="caption" color={colors.inkMuted}>
                Ingreso paso a paso, en menos de un minuto.
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </Pressable>
        </>
      )}

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={16} color={colors.inkFaint} />
        <AppText variant="caption" color={colors.inkFaint} style={styles.footerText}>
          Los horarios son orientativos. Sigue siempre la indicación de tu médico.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headerText: { flex: 1, gap: 2 },
  block: { marginTop: spacing.xl },
  sectionHeader: { marginTop: 0 },
  list: { gap: spacing.md },
  emptyCard: { paddingBottom: spacing.xl },
  emptyActions: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  scanCard: { marginTop: spacing.lg, padding: spacing.lg },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scanIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanText: { flex: 1, gap: 1 },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryMuted,
    backgroundColor: colors.surface,
  },
  addIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { flex: 1, gap: 1 },
  pressed: { opacity: 0.7 },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing['3xl'],
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xl,
  },
  footerText: { flex: 1, lineHeight: 17 },
});
