import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { useAuth } from '@/store/AuthProvider';
import { AppRole } from '@/types';
import { AppText } from '@/components/ui/AppText';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';

type Tab = 'login' | 'register';
type ServerState = 'idle' | 'testing' | 'ok' | 'error';

export function AuthScreen() {
  const {
    apiBaseUrl,
    busy,
    error,
    login,
    register,
    enterLocalMode,
    testServer,
    updateApiBaseUrl,
    clearError,
  } = useAuth();

  const [tab, setTab] = useState<Tab>('login');
  const [role, setRole] = useState<AppRole>('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState(apiBaseUrl);
  const [serverState, setServerState] = useState<ServerState>('idle');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setServerUrl(apiBaseUrl);
  }, [apiBaseUrl]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setLocalError(null);
    clearError();
  };

  const goAfterAuth = (nextRole: AppRole) => {
    router.replace(nextRole === 'caregiver' ? '/caregiver' : '/');
  };

  const submitLogin = async () => {
    setLocalError(null);
    clearError();
    if (!email.trim() || !password) {
      setLocalError('Escribe tu correo y contraseña.');
      return;
    }
    try {
      const nextRole = await login(email, password);
      goAfterAuth(nextRole);
    } catch {
      // El mensaje se muestra desde AuthProvider.
    }
  };

  const submitRegister = async () => {
    setLocalError(null);
    clearError();
    if (name.trim().length < 2) {
      setLocalError('Escribe tu nombre completo.');
      return;
    }
    if (!email.trim()) {
      setLocalError('Escribe un correo electrónico.');
      return;
    }
    if (password.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    try {
      const nextRole = await register({
        name,
        email,
        password,
        role,
        linkCode: role === 'caregiver' ? linkCode : undefined,
      });
      goAfterAuth(nextRole);
    } catch {
      // El mensaje se muestra desde AuthProvider.
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setLocalError(null);
    clearError();
    setEmail(demoEmail);
    setPassword('demo1234');
    try {
      const nextRole = await login(demoEmail, 'demo1234');
      goAfterAuth(nextRole);
    } catch {
      // El mensaje se muestra desde AuthProvider.
    }
  };

  const runServerTest = async () => {
    setServerState('testing');
    const ok = await testServer(serverUrl);
    setServerState(ok ? 'ok' : 'error');
    if (ok) await updateApiBaseUrl(serverUrl);
  };

  const startLocal = () => {
    enterLocalMode();
    router.replace('/');
  };

  const message = localError ?? error;

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
          <View style={styles.brandRow}>
            <BrandMark size={52} />
          </View>

          <View style={styles.hero}>
            <AppText variant="caption" color={colors.primary} weight="bold">
              MEDSYNC AI
            </AppText>
            <AppText variant="display" weight="extrabold">
              Tu tratamiento,{'\n'}acompañado.
            </AppText>
            <AppText variant="body" color={colors.inkSoft}>
              Crea tu cuenta como paciente o cuidador. Los dos comparten el mismo
              tratamiento mediante un código de vinculación.
            </AppText>
          </View>

          <View style={styles.tabs}>
            <TabButton
              label="Iniciar sesión"
              active={tab === 'login'}
              onPress={() => switchTab('login')}
            />
            <TabButton
              label="Crear cuenta"
              active={tab === 'register'}
              onPress={() => switchTab('register')}
            />
          </View>

          <Card style={styles.form}>
            {tab === 'register' ? (
              <View style={styles.roleSection}>
                <AppText variant="label" color={colors.inkSoft}>
                  ¿Cómo vas a usar MedSync?
                </AppText>
                <View style={styles.roleGrid}>
                  <RoleOption
                    icon="person"
                    title="Paciente"
                    detail="Mis tomas y mi alarma"
                    selected={role === 'patient'}
                    onPress={() => {
                      setRole('patient');
                      setLocalError(null);
                    }}
                  />
                  <RoleOption
                    icon="people"
                    title="Cuidador"
                    detail="Acompaño a un paciente"
                    selected={role === 'caregiver'}
                    onPress={() => {
                      setRole('caregiver');
                      setLocalError(null);
                    }}
                  />
                </View>
              </View>
            ) : null}

            {tab === 'register' ? (
              <TextField
                label="Nombre completo"
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setLocalError(null);
                }}
                placeholder="Rosa Martínez"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
              />
            ) : null}

            <TextField
              label="Correo electrónico"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setLocalError(null);
              }}
              placeholder="tu@correo.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />

            <TextField
              label="Contraseña"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setLocalError(null);
              }}
              placeholder={tab === 'register' ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showPassword}
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
              textContentType={tab === 'register' ? 'newPassword' : 'password'}
              right={
                <Pressable
                  onPress={() => setShowPassword((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  hitSlop={12}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={21}
                    color={colors.inkMuted}
                  />
                </Pressable>
              }
            />

            {tab === 'register' && role === 'caregiver' ? (
              <TextField
                label="Código del paciente (opcional)"
                value={linkCode}
                onChangeText={(value) => {
                  setLinkCode(value.toUpperCase());
                  setLocalError(null);
                }}
                placeholder="MED-0000"
                autoCapitalize="characters"
                autoCorrect={false}
                hint="Puedes vincularlo ahora o hacerlo después desde el panel del cuidador."
              />
            ) : null}

            {message ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={17} color={colors.danger} />
                <AppText variant="caption" color={colors.danger} style={styles.errorText}>
                  {message}
                </AppText>
              </View>
            ) : null}

            <Button
              label={tab === 'login' ? 'Entrar' : 'Crear mi cuenta'}
              icon={tab === 'login' ? 'log-in-outline' : 'person-add-outline'}
              fullWidth
              loading={busy}
              onPress={() => void (tab === 'login' ? submitLogin() : submitRegister())}
            />
          </Card>

          <Card tone="alt" style={styles.demoCard}>
            <View style={styles.demoHeader}>
              <Ionicons name="flask-outline" size={19} color={colors.info} />
              <AppText variant="bodyStrong" color={colors.info}>
                Probar con cuentas demo
              </AppText>
            </View>
            <AppText variant="caption" color={colors.inkSoft}>
              La cuenta de Rosa ya tiene tratamientos y alarmas. Diego es su cuidador y ve
              el mismo panel.
            </AppText>
            <View style={styles.demoButtons}>
              <Button
                label="Entrar como Rosa"
                icon="person-outline"
                variant="outline"
                size="md"
                fullWidth
                onPress={() => void quickLogin('rosa@medsync.app')}
                style={styles.flex}
              />
              <Button
                label="Entrar como Diego"
                icon="people-outline"
                variant="outline"
                size="md"
                fullWidth
                onPress={() => void quickLogin('diego@medsync.app')}
                style={styles.flex}
              />
            </View>
          </Card>

          <Card style={styles.serverCard}>
            <Pressable
              onPress={() => setServerOpen((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel="Configurar servidor"
              style={({ pressed }) => [styles.serverHeader, pressed ? styles.pressed : null]}
            >
              <View style={styles.serverIcon}>
                <Ionicons name="server-outline" size={19} color={colors.inkSoft} />
              </View>
              <View style={styles.serverText}>
                <AppText variant="bodyStrong">Servidor</AppText>
                <AppText variant="caption" color={colors.inkMuted} numberOfLines={1}>
                  {serverUrl}
                </AppText>
              </View>
              <Ionicons
                name={serverOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.inkMuted}
              />
            </Pressable>

            {serverOpen ? (
              <View style={styles.serverBody}>
                <TextField
                  label="Dirección del backend"
                  value={serverUrl}
                  onChangeText={(value) => {
                    setServerUrl(value);
                    setServerState('idle');
                  }}
                  placeholder="http://192.168.1.50:4000"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  hint="En el teléfono usa la IP de tu computadora en la misma red Wi-Fi."
                />
                <Button
                  label="Probar conexión"
                  icon="pulse-outline"
                  variant="outline"
                  size="md"
                  fullWidth
                  loading={serverState === 'testing'}
                  onPress={() => void runServerTest()}
                />
                {serverState === 'ok' ? (
                  <AppText variant="caption" color={colors.success} weight="semibold">
                    Servidor conectado correctamente.
                  </AppText>
                ) : serverState === 'error' ? (
                  <AppText variant="caption" color={colors.danger} weight="semibold">
                    No pudimos conectar. Revisa la IP, el puerto 4000 y que el backend esté
                    encendido.
                  </AppText>
                ) : null}
              </View>
            ) : null}
          </Card>

          <View style={styles.localRow}>
            <Button
              label="Continuar sin cuenta en este teléfono"
              variant="ghost"
              size="md"
              fullWidth
              onPress={startLocal}
            />
            <AppText variant="caption" color={colors.inkMuted} align="center">
              Modo local: sin sincronización con el cuidador. Puedes crear una cuenta más
              adelante.
            </AppText>
          </View>

          <View style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.inkMuted} />
            <AppText variant="caption" color={colors.inkMuted} style={styles.noteText}>
              La contraseña se guarda cifrada en el backend. La sesión queda en el
              almacenamiento seguro del teléfono.
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tab,
        active ? styles.tabActive : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <AppText
        variant="bodyStrong"
        color={active ? colors.primaryStrong : colors.inkMuted}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function RoleOption({
  icon,
  title,
  detail,
  selected,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.roleOption,
        selected ? styles.roleOptionSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.roleIcon, selected ? styles.roleIconSelected : null]}>
        <Ionicons
          name={icon}
          size={20}
          color={selected ? colors.white : colors.primary}
        />
      </View>
      <AppText variant="bodyStrong" color={selected ? colors.primaryStrong : colors.ink}>
        {title}
      </AppText>
      <AppText variant="caption" color={colors.inkMuted} numberOfLines={2}>
        {detail}
      </AppText>
      {selected ? (
        <Ionicons
          name="checkmark-circle"
          size={18}
          color={colors.primary}
          style={styles.roleCheck}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing['3xl'],
    gap: spacing.lg,
  },
  brandRow: { marginBottom: spacing.xs },
  hero: { gap: spacing.sm },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  form: { gap: spacing.md },
  roleSection: { gap: spacing.sm },
  roleGrid: { flexDirection: 'row', gap: spacing.sm },
  roleOption: {
    flex: 1,
    gap: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 132,
    backgroundColor: colors.surface,
  },
  roleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  roleIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  roleIconSelected: { backgroundColor: colors.primary },
  roleCheck: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { flex: 1, lineHeight: 18 },
  demoCard: { gap: spacing.sm },
  demoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demoButtons: { gap: spacing.sm, marginTop: spacing.xs },
  serverCard: { gap: spacing.sm },
  serverHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  serverIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverText: { flex: 1, gap: 1 },
  serverBody: { gap: spacing.sm, marginTop: spacing.xs },
  localRow: { gap: spacing.xs },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteText: { flex: 1, lineHeight: 17 },
  pressed: { opacity: 0.7 },
});
