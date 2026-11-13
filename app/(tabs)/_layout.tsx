import { Tabs } from 'expo-router/js-tabs';
import React from 'react';

import { colors } from '@/constants/theme';
import { useApp } from '@/store/AppProvider';
import { TabBar } from '@/components/navigation/TabBar';
import { RoleOnboarding } from '@/components/onboarding/RoleOnboarding';

export default function TabsLayout() {
  const { state } = useApp();

  if (!state.roleChosen) {
    return <RoleOnboarding />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="treatments" options={{ title: 'Tratamientos' }} />
      <Tabs.Screen name="caregiver" options={{ title: 'Cuidador' }} />
      <Tabs.Screen name="assistant" options={{ title: 'Medi AI' }} />
    </Tabs>
  );
}
