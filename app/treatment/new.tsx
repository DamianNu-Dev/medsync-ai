import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DURATION_PRESETS,
  formLabel,
  FORM_OPTIONS,
  FREQUENCY_OPTIONS,
  stockNoun,
  unitNoun,
} from '@/constants/medication';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import {
  addMinutes,
  formatDayLabel,
  formatTime,
  HOUR_MS,
  isSameDay,
  minutesOfDay,
  minutesToHHMM,
  nextDateForTime,
  roundToMinutes,
} from '@/lib/date';
import { warningFeedback } from '@/lib/haptics';
import { getTreatmentTimesPerDay } from '@/lib/schedule';
import { useApp } from '@/store/AppProvider';
import { useNow } from '@/hooks/useNow';
import {
  ExtractedMedication,
  MedicationForm,
  NewTreatmentInput,
} from '@/types';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Stepper } from '@/components/ui/Stepper';
import { TextField } from '@/components/ui/TextField';
import { TimeField } from '@/components/ui/TimeField';

interface FormState {
  name: string;
  strength: string;
  form: MedicationForm;
  unitsPerDose: number;
  frequencyHours: number;
  startTime: string;
  durationDays: number;
  totalPills: string;
  lowStockThreshold: number;
  notes: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

function defaultStartTime(): string {
  const next = addMinutes(roundToMinutes(new Date(), 5), 30);
  return minutesToHHMM(minutesOfDay(next));
}

function formFromMedication(medication?: ExtractedMedication): FormState {
  return {
    name: medication?.medicationName ?? '',
    strength: medication?.strength ?? '',
    form: medication?.form ?? 'tablet',
    unitsPerDose: medication?.unitsPerDose ?? 1,
    frequencyHours: medication?.frequencyHours ?? 12,
    startTime: medication?.startTime ?? defaultStartTime(),
    durationDays: medication?.durationDays ?? 30,
    totalPills: medication?.totalPills ? String(medication.totalPills) : '',
    lowStockThreshold: 5,
    notes: medication?.notes ?? '',
  };
}

export default function NewTreatmentScreen() {
  const { state, actions } = useApp();
  const now = useNow(60_000);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const draft = state.scanDraft;
  const draftMedications = draft?.medications ?? [];
  const isMultiMedication = draftMedications.length > 1;

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState<FormState>(() =>
    formFromMedication(draftMedications[0]),
  );
  const [medications, setMedications] = useState<ExtractedMedication[]>(
    () => draftMedications,
  );
  const [editing, setEditing] = useState<{
    index: number;
    value: ExtractedMedication;
  } | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);

  const timesPerDay = getTreatmentTimesPerDay(form.frequencyHours);
  const neededPills = useMemo(
    () =>
      form.unitsPerDose *
      Math.max(1, Math.ceil((form.durationDays * 24) / form.frequencyHours)),
    [form.durationDays, form.frequencyHours, form.unitsPerDose],
  );
  const totalPillsNumber = Number.parseInt(form.totalPills, 10) || 0;
  const coverageDays = useMemo(() => {
    const perDay = form.unitsPerDose * timesPerDay;
    if (perDay <= 0 || totalPillsNumber <= 0) return 0;
    return Math.floor(totalPillsNumber / perDay);
  }, [form.unitsPerDose, timesPerDay, totalPillsNumber]);

  const firstDose = useMemo(
    () => nextDateForTime(form.startTime, now),
    [form.startTime, now],
  );
  const firstDoseIsToday = isSameDay(firstDose, now);

  const upcoming = useMemo(
    () =>
      [0, 1, 2].map(
        (index) =>
          new Date(firstDose.getTime() + index * form.frequencyHours * HOUR_MS),
      ),
    [firstDose, form.frequencyHours],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
  };

  const validate = (): boolean => {
    const next: Errors = {};

    if (step === 0) {
      if (form.name.trim().length < 2) {
        next.name = 'Escribe el nombre del medicamento.';
      }
      if (form.unitsPerDose < 1) {
        next.unitsPerDose = 'Indica al menos una unidad por toma.';
      }
    }

    if (step === 1) {
      if (form.durationDays < 1) {
        next.durationDays = 'La duración debe ser de al menos 1 día.';
      }
      if (form.frequencyHours < 1) {
        next.frequencyHours = 'Elige una frecuencia válida.';
      }
    }

    if (step === 2) {
      if (totalPillsNumber < form.unitsPerDose) {
        next.totalPills = `Ingresa al menos ${form.unitsPerDose} ${unitNoun(
          form.form,
          form.unitsPerDose,
        )}.`;
      }
      if (form.lowStockThreshold < 1) {
        next.lowStockThreshold = 'La alerta debe ser de al menos 1 dosis.';
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) {
      warningFeedback();
      return false;
    }
    return true;
  };

  const scrollTop = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
  };

  const goNext = () => {
    if (!validate()) return;

    if (step < 2) {
      if (step === 1 && !form.totalPills) {
        setForm((current) => ({ ...current, totalPills: String(neededPills) }));
      }
      setStep((current) => current + 1);
      scrollTop();
      return;
    }

    const input: NewTreatmentInput = {
      name: form.name.trim(),
      strength: form.strength.trim() || 'Concentración no indicada',
      form: form.form,
      unitsPerDose: form.unitsPerDose,
      frequencyHours: form.frequencyHours,
      startTime: form.startTime,
      durationDays: form.durationDays,
      totalPills: totalPillsNumber,
      lowStockThreshold: form.lowStockThreshold,
      notes: form.notes.trim() || undefined,
    };

    actions.addTreatment(input);
    router.replace('/treatments');
  };

  const goBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    setStep((current) => current - 1);
    scrollTop();
  };

  const saveAllMedications = () => {
    if (medications.length === 0) return;
    for (const medication of medications) {
      const input: NewTreatmentInput = {
        name: medication.medicationName,
        strength: medication.strength.trim() || 'Concentración no indicada',
        form: medication.form,
        unitsPerDose: medication.unitsPerDose,
        frequencyHours: medication.frequencyHours,
        startTime: medication.startTime,
        durationDays: medication.durationDays,
        totalPills: medication.totalPills,
        lowStockThreshold: 5,
        notes: medication.notes,
      };
      actions.addTreatment(input);
    }
    actions.showToast(
      `${medications.length} ${
        medications.length === 1 ? 'tratamiento agregado' : 'tratamientos agregados'
      } a tu calendario`,
      'success',
    );
    router.replace('/treatments');
  };

  const openEditor = (index: number) => {
    setEditorError(null);
    setEditing({ index, value: { ...medications[index] } });
  };

  const applyEditor = () => {
    if (!editing) return;
    const value = editing.value;
    if (value.medicationName.trim().length < 2) {
      setEditorError('Escribe el nombre del medicamento.');
      return;
    }
    if (value.unitsPerDose < 1) {
      setEditorError('Indica al menos una unidad por toma.');
      return;
    }
    if (value.totalPills < value.unitsPerDose) {
      setEditorError('La cantidad total debe alcanzar para al menos una toma.');
      return;
    }
    setMedications((current) =>
      current.map((medication, index) =>
        index === editing.index
          ? {
              ...value,
              medicationName: value.medicationName.trim(),
              strength: value.strength.trim(),
              notes: value.notes?.trim() || undefined,
            }
          : medication,
      ),
    );
    setEditing(null);
    setEditorError(null);
  };

  const updateEditing = (patch: Partial<ExtractedMedication>) => {
    setEditing((current) =>
      current ? { ...current, value: { ...current.value, ...patch } } : current,
    );
  };

  const removeMedication = (index: number) => {
    const medication = medications[index];
    if (!medication) return;
    Alert.alert(
      'Quitar medicamento',
      `¿Quitar ${medication.medicationName} de esta receta? No se guardará.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: () =>
            setMedications((current) =>
              current.filter((_, position) => position !== index),
            ),
        },
      ],
    );
  };

  if (isMultiMedication) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver al escáner"
            style={({ pressed }) => [styles.headerButton, pressed ? styles.pressed : null]}
          >
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.headerText}>
            <AppText variant="caption" color={colors.inkMuted} weight="semibold">
              Receta escaneada
            </AppText>
            <AppText variant="h3" weight="bold">
              Revisar {medications.length}{' '}
              {medications.length === 1 ? 'medicamento' : 'medicamentos'}
            </AppText>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepContent}>
            <StepHeading
              title="Encontramos estos medicamentos"
              subtitle="Compara cada uno con tu receta. Al confirmar se agregan todos a tu calendario."
            />

            {medications.length === 0 ? (
              <Card tone="warningSoft" style={styles.multiWarnings}>
                <AppText variant="bodyStrong" color={colors.warning}>
                  No quedan medicamentos por agregar
                </AppText>
                <AppText variant="caption" color={colors.inkSoft}>
                  Vuelve al escáner para tomar otra foto de la receta.
                </AppText>
              </Card>
            ) : null}

            {medications.map((medication, index) => (
              <Card
                key={`${medication.medicationName}-${index}`}
                style={styles.multiCard}
              >
                <View style={styles.multiHeader}>
                  <View style={styles.multiIndex}>
                    <AppText variant="caption" weight="bold" color={colors.white}>
                      {index + 1}
                    </AppText>
                  </View>
                  <View style={styles.multiTitle}>
                    <AppText variant="h3" weight="bold">
                      {medication.medicationName}
                    </AppText>
                    <AppText variant="body" color={colors.inkSoft}>
                      {medication.strength} · {formLabel(medication.form)} ·{' '}
                      {medication.unitsPerDose}{' '}
                      {unitNoun(medication.form, medication.unitsPerDose)}
                    </AppText>
                  </View>
                </View>

                <View style={styles.summaryGrid}>
                  <SummaryItem
                    icon="repeat"
                    label="Frecuencia"
                    value={`Cada ${medication.frequencyHours} h`}
                  />
                  <SummaryItem
                    icon="time-outline"
                    label="Primera toma"
                    value={formatTime(nextDateForTime(medication.startTime, now))}
                  />
                  <SummaryItem
                    icon="calendar-outline"
                    label="Duración"
                    value={`${medication.durationDays} días`}
                  />
                  <SummaryItem
                    icon="layers-outline"
                    label="Inventario"
                    value={`${medication.totalPills} ${stockNoun(
                      medication.form,
                      medication.totalPills,
                    )}`}
                  />
                </View>

                {medication.notes ? (
                  <View style={styles.multiNote}>
                    <Ionicons
                      name="information-circle-outline"
                      size={15}
                      color={colors.inkMuted}
                    />
                    <AppText variant="caption" color={colors.inkSoft} style={styles.tipText}>
                      {medication.notes}
                    </AppText>
                  </View>
                ) : null}

                <View style={styles.multiActions}>
                  <Pressable
                    onPress={() => openEditor(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ${medication.medicationName}`}
                    style={({ pressed }) => [
                      styles.multiAction,
                      styles.multiActionEdit,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.primaryStrong} />
                    <AppText variant="caption" weight="bold" color={colors.primaryStrong}>
                      Revisar y editar
                    </AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => removeMedication(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${medication.medicationName}`}
                    style={({ pressed }) => [
                      styles.multiAction,
                      styles.multiActionRemove,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    <AppText variant="caption" weight="bold" color={colors.danger}>
                      Quitar
                    </AppText>
                  </Pressable>
                </View>
              </Card>
            ))}

            {draft && Array.isArray(draft.warnings) && draft.warnings.length > 0 ? (
              <Card tone="warningSoft" style={styles.multiWarnings}>
                <View style={styles.multiWarningsTitle}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                  <AppText variant="bodyStrong" color={colors.warning}>
                    Revisa antes de guardar
                  </AppText>
                </View>
                {draft.warnings.map((warning) => (
                  <AppText
                    key={warning}
                    variant="caption"
                    color={colors.inkSoft}
                    style={styles.multiWarningText}
                  >
                    • {warning}
                  </AppText>
                ))}
              </Card>
            ) : null}

            <Card tone="successSoft" style={styles.privacy}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
              <AppText variant="caption" color={colors.inkSoft} style={styles.tipText}>
                Después puedes ajustar inventario, horarios o notas de cada tratamiento en
                la pestaña Tratamientos.
              </AppText>
            </Card>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button
            label={
              medications.length === 1
                ? 'Agregar 1 tratamiento'
                : `Agregar ${medications.length} tratamientos`
            }
            icon="checkmark"
            iconPosition="left"
            size="md"
            disabled={medications.length === 0}
            onPress={saveAllMedications}
            style={styles.footerButtonPrimary}
          />
        </View>

        <MedicationEditor
          value={editing?.value ?? null}
          error={editorError}
          onChange={updateEditing}
          onClose={() => {
            setEditing(null);
            setEditorError(null);
          }}
          onSave={applyEditor}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={step === 0 ? 'Cerrar' : 'Volver al paso anterior'}
            style={({ pressed }) => [styles.headerButton, pressed ? styles.pressed : null]}
          >
            <Ionicons name={step === 0 ? 'close' : 'chevron-back'} size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.headerText}>
            <AppText variant="caption" color={colors.inkMuted} weight="semibold">
              Paso {step + 1} de 3
            </AppText>
            <AppText variant="h3" weight="bold">
              Nuevo tratamiento
            </AppText>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.progress}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={[styles.segment, index <= step ? styles.segmentActive : null]}
            />
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {draft ? (
            <Card tone="aiSoft" style={styles.draftNote}>
              <Ionicons name="sparkles" size={18} color={colors.ai} />
              <AppText variant="caption" color={colors.inkSoft} style={styles.draftText}>
                Datos extraídos de la receta. Revisa cada campo antes de guardar.
              </AppText>
            </Card>
          ) : null}

          {step === 0 ? (
            <View style={styles.stepContent}>
              <StepHeading
                title="¿Qué medicamento vas a tomar?"
                subtitle="Así lo verás en tu tarjeta del día. Usa el nombre tal como aparece en la receta."
              />

              <TextField
                label="Medicamento"
                value={form.name}
                onChangeText={(value) => update('name', value)}
                placeholder="Ej. Metformina"
                autoCapitalize="words"
                autoCorrect={false}
                error={errors.name}
                returnKeyType="next"
              />

              <TextField
                label="Concentración"
                value={form.strength}
                onChangeText={(value) => update('strength', value)}
                placeholder="Ej. 850 mg"
                error={errors.strength}
                hint="Opcional, pero ayuda a identificar la caja correcta."
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color={colors.inkSoft}>
                  Forma del medicamento
                </AppText>
                <ChoiceChips
                  options={FORM_OPTIONS}
                  value={form.form}
                  onChange={(value) => update('form', value)}
                />
              </View>

              <Stepper
                label="Unidades por toma"
                value={form.unitsPerDose}
                onChange={(value) => update('unitsPerDose', value)}
                min={1}
                max={10}
                suffix={unitNoun(form.form, form.unitsPerDose)}
              />
              {errors.unitsPerDose ? (
                <AppText variant="caption" color={colors.danger}>
                  {errors.unitsPerDose}
                </AppText>
              ) : null}

              <Card tone="alt" style={styles.tip}>
                <Ionicons name="bulb-outline" size={19} color={colors.primary} />
                <AppText variant="caption" color={colors.inkSoft} style={styles.tipText}>
                  Ejemplo: si tu receta dice “1 tableta cada 12 horas”, elige tableta y
                  1 unidad.
                </AppText>
              </Card>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.stepContent}>
              <StepHeading
                title="¿Cada cuánto y por cuánto tiempo?"
                subtitle="Define el horario de la primera toma y la duración del tratamiento."
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color={colors.inkSoft}>
                  Frecuencia
                </AppText>
                <ChoiceChips
                  options={FREQUENCY_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                    hint: option.hint,
                  }))}
                  value={form.frequencyHours}
                  onChange={(value) => update('frequencyHours', value)}
                />
              </View>

              <TimeField
                value={form.startTime}
                onChange={(value) => update('startTime', value)}
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color={colors.inkSoft}>
                  Duración del tratamiento
                </AppText>
                <ChoiceChips
                  options={DURATION_PRESETS.map((days) => ({
                    value: days,
                    label: `${days} días`,
                  }))}
                  value={form.durationDays}
                  onChange={(value) => update('durationDays', value)}
                  columns={2}
                />
                <Stepper
                  label="Días indicados en la receta"
                  value={form.durationDays}
                  onChange={(value) => update('durationDays', value)}
                  min={1}
                  max={365}
                  suffix={form.durationDays === 1 ? 'día' : 'días'}
                />
                {errors.durationDays ? (
                  <AppText variant="caption" color={colors.danger}>
                    {errors.durationDays}
                  </AppText>
                ) : null}
              </View>

              <Card style={styles.scheduleCard}>
                <View style={styles.scheduleHeader}>
                  <Ionicons name="calendar-outline" size={19} color={colors.primary} />
                  <AppText variant="bodyStrong">Así quedará tu calendario</AppText>
                </View>
                <View style={styles.scheduleRow}>
                  <AppText variant="caption" color={colors.inkMuted}>
                    Primera toma
                  </AppText>
                  <AppText variant="bodyStrong" color={colors.primaryStrong}>
                    {formatDayLabel(firstDose, now)} · {formatTime(firstDose)}
                  </AppText>
                </View>
                <View style={styles.scheduleRow}>
                  <AppText variant="caption" color={colors.inkMuted}>
                    Frecuencia
                  </AppText>
                  <AppText variant="bodyStrong">
                    Cada {form.frequencyHours} h · {timesPerDay}{' '}
                    {timesPerDay === 1 ? 'vez' : 'veces'} al día
                  </AppText>
                </View>
                <View style={styles.nextDoses}>
                  {upcoming.map((date, index) => (
                    <View key={date.toISOString()} style={styles.nextDoseChip}>
                      <AppText variant="caption" weight="bold" color={colors.inkSoft}>
                        {index === 0 ? '1.ª' : `${index + 1}.ª`} {formatTime(date)}
                      </AppText>
                    </View>
                  ))}
                </View>
                {!firstDoseIsToday ? (
                  <View style={styles.noticeRow}>
                    <Ionicons name="information-circle-outline" size={15} color={colors.info} />
                    <AppText variant="caption" color={colors.info} style={styles.noticeText}>
                      La hora ya pasó hoy, así que el tratamiento inicia mañana.
                    </AppText>
                  </View>
                ) : null}
              </Card>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.stepContent}>
              <StepHeading
                title="Últimos detalles"
                subtitle="Revisa el resumen, confirma tu inventario y guarda el tratamiento."
              />

              <Card style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                  <View style={styles.summaryIcon}>
                    <Ionicons name="medkit" size={24} color={colors.white} />
                  </View>
                  <View style={styles.summaryText}>
                    <AppText variant="h3" weight="bold">
                      {form.name || 'Medicamento'}
                    </AppText>
                    <AppText variant="body" color={colors.inkSoft}>
                      {form.strength || 'Sin concentración'} · {formLabel(form.form)} ·{' '}
                      {form.unitsPerDose} {unitNoun(form.form, form.unitsPerDose)}
                    </AppText>
                  </View>
                </View>
                <View style={styles.summaryGrid}>
                  <SummaryItem
                    icon="repeat"
                    label="Frecuencia"
                    value={`Cada ${form.frequencyHours} h`}
                  />
                  <SummaryItem
                    icon="calendar-outline"
                    label="Duración"
                    value={`${form.durationDays} días`}
                  />
                  <SummaryItem
                    icon="time-outline"
                    label="Primera toma"
                    value={`${formatDayLabel(firstDose, now)}\n${formatTime(firstDose)}`}
                  />
                  <SummaryItem icon="layers-outline" label="Tomas totales" value={`${neededPills}`} />
                </View>
              </Card>

              <TextField
                label="Cantidad total de unidades"
                value={form.totalPills}
                onChangeText={(value) =>
                  update('totalPills', value.replace(/[^0-9]/g, '').slice(0, 5))
                }
                placeholder="Ej. 60"
                keyboardType="number-pad"
                error={errors.totalPills}
                hint={`Sugerido para ${form.durationDays} días: ${neededPills}.`}
                right={
                  form.totalPills !== String(neededPills) ? (
                    <Pressable
                      onPress={() => update('totalPills', String(neededPills))}
                      accessibilityRole="button"
                      accessibilityLabel={`Usar ${neededPills} unidades sugeridas`}
                      style={styles.useSuggested}
                    >
                      <AppText variant="caption" color={colors.primary} weight="bold">
                        Usar {neededPills}
                      </AppText>
                    </Pressable>
                  ) : (
                    <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                  )
                }
              />

              {totalPillsNumber > 0 ? (
                <View
                  style={[
                    styles.coverage,
                    totalPillsNumber < neededPills ? styles.coverageWarning : null,
                  ]}
                >
                  <Ionicons
                    name={
                      totalPillsNumber < neededPills ? 'alert-circle' : 'checkmark-circle'
                    }
                    size={18}
                    color={totalPillsNumber < neededPills ? colors.warning : colors.success}
                  />
                  <AppText
                    variant="caption"
                    color={totalPillsNumber < neededPills ? colors.warning : colors.success}
                    style={styles.coverageText}
                  >
                    {totalPillsNumber < neededPills
                      ? `Alcanza para ${coverageDays} de ${form.durationDays} días. Repón antes de quedarte sin dosis.`
                      : `Inventario suficiente para los ${form.durationDays} días del tratamiento.`}
                  </AppText>
                </View>
              ) : null}

              <Stepper
                label="Avisarme cuando queden menos de"
                value={form.lowStockThreshold}
                onChange={(value) => update('lowStockThreshold', value)}
                min={1}
                max={30}
                suffix={stockNoun(form.form, form.lowStockThreshold)}
              />
              {errors.lowStockThreshold ? (
                <AppText variant="caption" color={colors.danger}>
                  {errors.lowStockThreshold}
                </AppText>
              ) : null}

              <TextField
                label="Notas para tu cuidador (opcional)"
                value={form.notes}
                onChangeText={(value) => update('notes', value)}
                placeholder="Ej. Tomar con alimentos. No suspender sin indicación."
                multiline
                maxLength={180}
              />

              <Card tone="successSoft" style={styles.privacy}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
                <AppText variant="caption" color={colors.inkSoft} style={styles.tipText}>
                  Podrás pausar, editar el inventario o eliminar este tratamiento cuando
                  quieras.
                </AppText>
              </Card>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step > 0 ? (
            <Button
              label="Atrás"
              variant="outline"
              size="md"
              icon="chevron-back"
              onPress={goBack}
              style={styles.footerButton}
            />
          ) : null}
          <Button
            label={step === 2 ? 'Guardar tratamiento' : 'Continuar'}
            icon={step === 2 ? 'checkmark' : 'arrow-forward'}
            iconPosition={step === 2 ? 'left' : 'right'}
            size="md"
            onPress={goNext}
            style={styles.footerButtonPrimary}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.heading}>
      <AppText variant="h2" weight="extrabold">
        {title}
      </AppText>
      <AppText variant="body" color={colors.inkMuted}>
        {subtitle}
      </AppText>
    </View>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <View style={styles.summaryItemText}>
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

interface MedicationEditorProps {
  value: ExtractedMedication | null;
  error: string | null;
  onChange: (patch: Partial<ExtractedMedication>) => void;
  onClose: () => void;
  onSave: () => void;
}

function MedicationEditor({
  value,
  error,
  onChange,
  onClose,
  onSave,
}: MedicationEditorProps) {
  return (
    <Modal
      visible={value !== null}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar edición"
            style={({ pressed }) => [styles.headerButton, pressed ? styles.pressed : null]}
          >
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.headerText}>
            <AppText variant="caption" color={colors.inkMuted} weight="semibold">
              Receta escaneada
            </AppText>
            <AppText variant="h3" weight="bold">
              Revisar medicamento
            </AppText>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {value ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.editorContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <StepHeading
                title="Ajusta los datos"
                subtitle="Corrige lo que la receta diga distinto. La hora corresponde a la primera toma."
              />

              <TextField
                label="Medicamento"
                value={value.medicationName}
                onChangeText={(text) => onChange({ medicationName: text })}
                placeholder="Ej. Metformina"
                autoCapitalize="words"
                autoCorrect={false}
              />

              <TextField
                label="Concentración"
                value={value.strength}
                onChangeText={(text) => onChange({ strength: text })}
                placeholder="Ej. 850 mg"
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color={colors.inkSoft}>
                  Forma del medicamento
                </AppText>
                <ChoiceChips
                  options={FORM_OPTIONS}
                  value={value.form}
                  onChange={(form) => onChange({ form })}
                />
              </View>

              <Stepper
                label="Unidades por toma"
                value={value.unitsPerDose}
                onChange={(unitsPerDose) => onChange({ unitsPerDose })}
                min={1}
                max={10}
                suffix={unitNoun(value.form, value.unitsPerDose)}
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color={colors.inkSoft}>
                  Frecuencia
                </AppText>
                <ChoiceChips
                  options={FREQUENCY_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                    hint: option.hint,
                  }))}
                  value={value.frequencyHours}
                  onChange={(frequencyHours) => onChange({ frequencyHours })}
                />
              </View>

              <TimeField
                value={value.startTime}
                onChange={(startTime) => onChange({ startTime })}
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color={colors.inkSoft}>
                  Duración del tratamiento
                </AppText>
                <ChoiceChips
                  options={DURATION_PRESETS.map((days) => ({
                    value: days,
                    label: `${days} días`,
                  }))}
                  value={value.durationDays}
                  onChange={(durationDays) => onChange({ durationDays })}
                  columns={2}
                />
                <Stepper
                  label="Días indicados en la receta"
                  value={value.durationDays}
                  onChange={(durationDays) => onChange({ durationDays })}
                  min={1}
                  max={365}
                  suffix={value.durationDays === 1 ? 'día' : 'días'}
                />
              </View>

              <TextField
                label="Cantidad total de unidades"
                value={String(value.totalPills)}
                onChangeText={(text) => {
                  const next = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
                  onChange({ totalPills: Number.isNaN(next) ? 0 : Math.min(next, 99999) });
                }}
                placeholder="Ej. 60"
                keyboardType="number-pad"
              />

              <TextField
                label="Notas (opcional)"
                value={value.notes ?? ''}
                onChangeText={(text) => onChange({ notes: text })}
                placeholder="Ej. Tomar con alimentos."
                multiline
                maxLength={180}
              />

              {error ? (
                <AppText variant="caption" color={colors.danger}>
                  {error}
                </AppText>
              ) : null}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(insetsSafeBottom(), 12) }]}>
              <Button
                label="Guardar cambios"
                icon="checkmark"
                iconPosition="left"
                size="md"
                onPress={onSave}
                style={styles.footerButtonPrimary}
              />
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

/** Espacio inferior seguro dentro de un modal a pantalla completa. */
function insetsSafeBottom(): number {
  return Platform.OS === 'ios' ? 20 : 12;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 1 },
  headerSpacer: { width: 44 },
  pressed: { opacity: 0.6 },
  progress: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSunken,
  },
  segmentActive: { backgroundColor: colors.primary },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  draftNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  draftText: { flex: 1, lineHeight: 18 },
  stepContent: { gap: spacing.xl },
  heading: { gap: spacing.xs },
  fieldGroup: { gap: spacing.sm },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
  },
  tipText: { flex: 1, lineHeight: 18 },
  scheduleCard: { gap: spacing.md },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  nextDoses: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  nextDoseChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  noticeText: { flex: 1, lineHeight: 17 },
  summaryCard: { gap: spacing.lg },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: { flex: 1, gap: 2 },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexBasis: '46%',
    flexGrow: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  summaryItemText: { flex: 1, minWidth: 0, gap: 0 },
  multiCard: { gap: spacing.lg },
  multiActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  multiAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  multiActionEdit: { backgroundColor: colors.primarySoft },
  multiActionRemove: { backgroundColor: colors.dangerSoft },
  editorContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
    gap: spacing.xl,
  },
  multiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  multiIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiTitle: { flex: 1, gap: 2 },
  multiNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  multiWarnings: { gap: 4 },
  multiWarningsTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  multiWarningText: { lineHeight: 18, paddingLeft: 2 },
  useSuggested: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  coverage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  coverageWarning: { backgroundColor: colors.warningSoft },
  coverageText: { flex: 1, lineHeight: 18 },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  footerButton: { flex: 1 },
  footerButtonPrimary: { flex: 1.6 },
});
