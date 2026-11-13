import { useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';

import { AuthScreen } from '@/components/auth/AuthScreen';
import { useAuth } from '@/store/AuthProvider';

export default function AuthRoute() {
  const { local } = useLocalSearchParams();
  const { enterLocalMode } = useAuth();

  useEffect(() => {
    if (local === 'true') {
      enterLocalMode();
    }
  }, [local, enterLocalMode]);

  return <AuthScreen />;
}
