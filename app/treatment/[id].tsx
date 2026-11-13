import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { doseAmountLabel, formLabel, stockNoun } from '@/constants/medication';
import { colors, radius, spacing } from '@/constants/theme';
import { combineDateTime, formatDateLong, formatDateShort, formatTime } from '@/lib/date';
import {
  formatFrequency,
  getStockLevel,
  getTreatmentTimesPerDay,
} from '@/lib/schedule';
import { useNow } from '@/hooks/useNow';
import { useApp } from '@/store/AppProvider';
import { getTreatmentDetailData } from '@/store/selectors';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Sheet } from '@/components/ui/Sheet';
import { Stepper } from '@/components/ui/Stepper';
import { WeekBars } from '@/components/caregiver/WeekBars';
import { DoseRow } from '@/components/medication/DoseRow';
import { MedicationIcon } from '@/components/medication/MedicationIcon';

export default function TreatmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const treatmentId = Array.isArray(id) ? id[0] : id;
  const { state, actions } = useApp();
  const now = useNow(30_000);

  const [stockOpen, setStockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [stockAmount, setStockAmount] = useState(30);

  const data = useMemo(
    () => getTreatmentDetailData(state, treatmentId ?? '', now),
    [state, treatmentId, now],
  );

  const average = useMemo(() => {
    const withData = data?.adherence7.filter((day) => day.total > 0) ?? [];
    if (withData.length === 0) return null;
    return Math.round(
      withData.reduce((sum, day) => sum + day.percent, 0) / withData.length,
    );
  }, [data]);

  if (!data) {
    return (
      <Screen>
        <EmptyState
          icon="help-circle-outline"
          title="Tratamiento no encontrado"
          message="Puede que se haya eliminado o que el enlace ya no esté disponible."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const { treatment, today, nextDoses, adherence7, stockLevel, stockPercent } = data;
  const timesPerDay = getTreatmentTimesPerDay(treatment.frequencyHours);
  const perDay = Math.max(1, treatment.unitsPerDose * timesPerDay);
  const coverageDays = Math.floor(treatment.pillsRemaining / perDay);
  const unit = stockNoun(treatment.form, stockAmount);

  const pendingAfterToday = nextDoses.filter(
    (item) => !today.some((todayItem) => todayItem.dose.id === item.dose.id),
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.headerText}>
          <AppText variant="caption" color={colors.inkMuted} weight="semibold">
            Tratamiento
          </AppText>
          <AppText variant="h3" weight="bold" numberOfLines={1}>
            {treatment.name}
          </AppText>
        </View>
        <Badge
          label={treatment.active ? 'Activo' : 'En pausa'}
          tone={treatment.active ? 'success' : 'neutral'}
          icon={treatment.active ? 'checkmark-circle' : 'pause-circle'}
        />
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.heroRow}>
          <MedicationIcon
            form={treatment.form}
            color={treatment.color}
            size={62}
          />
          <View style={styles.heroText}>
            <AppText variant="h2" weight="extrabold" numberOfLines={2}>
              {treatment.name}
            </AppText>
            <AppText variant="body" color={colors.inkSoft}>
              {treatment.strength} · {formLabel(treatment.form)}
            </AppText>
            <AppText variant="caption" color={colors.inkMuted}>
              {doseAmountLabel(treatment.form, treatment.unitsPerDose)} por toma ·{' '}
              {formatFrequency(treatment.frequencyHours)}
            </AppText>
          </View>
        </View>

        {treatment.notes ? (
          <View style={styles.notes}>
            <Ionicons
              name="information-circle-outline"
              size={17}
              color={colors.info}
            />
            <AppText variant="caption" color={colors.inkSoft} style={styles.notesText}>
              {treatment.notes}
            </AppText>
          </View>
        ) : null}

        <View style={styles.infoGrid}>
          <InfoItem
            icon="calendar-outline"
            label="Inicio"
            value={formatDateLong(
              combineDateTime(treatment.startDate, treatment.startTime),
            )}
          />
          <InfoItem
            icon="time-outline"
            label="Primera toma"
            value={formatTime(
              combineDateTime(treatment.startDate, treatment.startTime),
            )}
          />
          <InfoItem
            icon="hourglass-outline"
            label="Duración"
            value={`${treatment.durationDays} días`}
          />
          <InfoItem
            icon="repeat"
            label="Tomas al día"
            value={`${timesPerDay} ${timesPerDay === 1 ? 'vez' : 'veces'}`}
          />
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeader
          title="Inventario"
          subtitle={
            stockLevel === 'ok'
              ? `Cobertura aproximada de ${coverageDays} días`
              : stockLevel === 'empty'
                ? 'Sin unidades disponibles'
                : 'Conviene reponer pronto'
          }
        />
        <Card style={styles.stockCard}>
          <View style={styles.stockTop}>
            <View style={styles.stockText}>
              <AppText variant="caption" color={colors.inkMuted} weight="semibold">
                Quedan
              </AppText>
              <View style={styles.stockNumberRow}>
                <AppText variant="display" weight="extrabold">
                  {treatment.pillsRemaining}
                </AppText>
                <AppText
                  variant="body"
                  color={colors.inkMuted}
                  style={styles.stockUnit}
                >
                  {stockNoun(treatment.form, treatment.pillsRemaining)}
                </AppText>
              </View>
              <AppText variant="caption" color={colors.inkMuted}>
                Aviso cuando queden menos de {treatment.lowStockThreshold}{' '}
                {stockNoun(treatment.form, treatment.lowStockThreshold)}.
              </AppText>
            </View>
            <Badge
              label={
                stockLevel === 'ok'
                  ? 'Suficiente'
                  : stockLevel === 'empty'
                    ? 'Sin stock'
                    : 'Stock bajo'
              }
              tone={
                stockLevel === 'ok'
                  ? 'success'
                  : stockLevel === 'empty'
                    ? 'danger'
                    : 'warning'
              }
              icon={
                stockLevel === 'ok'
                  ? 'checkmark-circle'
                  : stockLevel === 'empty'
                    ? 'alert-circle'
                    : 'warning-outline'
              }
            />
          </View>

          <ProgressBar
            value={stockPercent}
            height={9}
            color={stockLevel === 'ok' ? colors.primary : colors.danger}
          />

          <Button
            label="Agregar al inventario"
            icon="add"
            variant="secondary"
            size="md"
            onPress={() => {
              setStockAmount(30);
              setStockOpen(true);
            }}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Hoy"
          subtitle={`${today.length} ${
            today.length === 1 ? 'toma programada' : 'tomas programadas'
          }`}
        />
        {today.length === 0 ? (
          <Card tone="alt">
            <AppText variant="body" color={colors.inkMuted} align="center">
              No hay tomas programadas para hoy.
            </AppText>
          </Card>
        ) : (
          <View style={styles.list}>
            {today.map((item) => (
              <View key={item.dose.id} style={styles.doseBlock}>
                <DoseRow item={item} />
                {item.isActionable ? (
                  <View style={styles.doseActions}>
                    <Button
                      label="Tomar ahora"
                      icon="checkmark"
                      size="sm"
                      onPress={() => actions.takeDose(item.dose.id)}
                      style={styles.flex}
                    />
                    <Button
                      label="Omitir"
                      icon="close"
                      size="sm"
                      variant="dangerSoft"
                      onPress={() =>
                        actions.skipDose(item.dose.id, 'Omitida desde el detalle')
                      }
                      style={styles.flex}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {pendingAfterToday.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Tomas pendientes"
            subtitle={`${pendingAfterToday.length} sin registrar`}
          />
          <View style={styles.list}>
            {pendingAfterToday.map((item) => (
              <DoseRow
                key={item.dose.id}
                item={item}
                dayLabel={formatDateShort(item.dose.scheduledAt)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="Adherencia"
          subtitle={`Últimos 7 días${average === null ? '' : ` · ${average}% promedio`}`}
        />
        <Card style={styles.weekCard}>
          <WeekBars days={adherence7} />
          <AppText
            variant="caption"
            color={colors.inkMuted}
            align="center"
            style={styles.weekHint}
          >
            {data.takenTotal} de {data.totalResolved} tomas registradas desde el inicio.
          </AppText>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Ajustes" subtitle="Controla los recordatorios de este tratamiento" />
        <Card style={styles.settingsCard}>
          <Button
            label={
              treatment.active ? 'Pausar recordatorios' : 'Reanudar recordatorios'
            }
            icon={treatment.active ? 'pause-circle-outline' : 'play-circle-outline'}
            variant="outline"
            size="md"
            fullWidth
            onPress={() => actions.toggleTreatment(treatment.id)}
          />
          <Button
            label="Eliminar tratamiento"
            icon="trash-outline"
            variant="dangerSoft"
            size="md"
            fullWidth
            onPress={() => setDeleteOpen(true)}
          />
        </Card>
      </View>

      <Sheet
        visible={stockOpen}
        onClose={() => setStockOpen(false)}
        title="Agregar al inventario"
        description="Suma las unidades que acabas de comprar o recibir."
      >
        <Stepper
          label="Unidades a agregar"
          value={stockAmount}
          onChange={setStockAmount}
          min={1}
          max={500}
          step={10}
          suffix={unit}
        />
        <View style={styles.stockPreview}>
          <Ionicons name="layers-outline" size={18} color={colors.primary} />
          <AppText variant="caption" color={colors.inkSoft} style={styles.stockPreviewText}>
            Pasarás de {treatment.pillsRemaining} a{' '}
            {treatment.pillsRemaining + stockAmount}{' '}
            {stockNoun(treatment.form, treatment.pillsRemaining + stockAmount)}.
          </AppText>
        </View>
        <Button
          label={`Agregar ${stockAmount} al inventario`}
          icon="add"
          fullWidth
          onPress={() => {
            actions.addStock(treatment.id, stockAmount);
            setStockOpen(false);
          }}
        />
        <Button
          label="Cancelar"
          variant="ghost"
          size="md"
          style={styles.sheetCancel}
          onPress={() => setStockOpen(false)}
        />
      </Sheet>

      <Sheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Eliminar tratamiento"
        description="Esta acción no se puede deshacer."
      >
        <Card tone="dangerSoft" style={styles.deleteNote}>
          <Ionicons name="warning-outline" size={20} color={colors.danger} />
          <AppText variant="caption" color={colors.inkSoft} style={styles.deleteText}>
            Se borrarán {treatment.name} y todas sus tomas programadas, incluido el
            historial de este dispositivo.
          </AppText>
        </Card>
        <Button
          label="Sí, eliminar tratamiento"
          icon="trash-outline"
          variant="danger"
          fullWidth
          onPress={() => {
            actions.deleteTreatment(treatment.id);
            setDeleteOpen(false);
            router.replace('/treatments');
          }}
        />
        <Button
          label="Cancelar"
          variant="ghost"
          size="md"
          style={styles.sheetCancel}
          onPress={() => setDeleteOpen(false)}
        />
      </Sheet>
    </Screen>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoItem}>
      <Ionicons name={icon} size={17} color={colors.primary} />
      <View style={styles.infoText}>
        <AppText variant="caption" color={colors.inkMuted}>
          {label}
        </AppText>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {value}
        </AppText>
      </View>
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  headerText: { flex: 1, gap: 1 },
  heroCard: { gap: spacing.lg },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heroText: { flex: 1, gap: 2 },
  notes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  notesText: { flex: 1, lineHeight: 18 },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexBasis: '46%',
    flexGrow: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  infoText: { flex: 1, gap: 1 },
  section: { marginTop: spacing['2xl'] },
  stockCard: { gap: spacing.md },
  stockTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stockText: { flex: 1, gap: 2 },
  stockNumberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  stockUnit: { marginBottom: 7 },
  list: { gap: spacing.sm },
  doseBlock: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  doseActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: 2,
  },
  flex: { flex: 1 },
  weekCard: { gap: spacing.md },
  weekHint: { lineHeight: 17 },
  settingsCard: { gap: spacing.sm },
  stockPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  stockPreviewText: { flex: 1, lineHeight: 18 },
  sheetCancel: { alignSelf: 'center', marginTop: spacing.sm },
  deleteNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  deleteText: { flex: 1, lineHeight: 18 },
});
