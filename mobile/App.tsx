import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, Text, StyleSheet } from 'react-native';
import { trpc, getTrpcClient } from './src/trpc';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useServerStatusStore } from './src/stores/serverStatus.store';
import { AlertHost } from './src/components/ui/AppAlert';
import { Icon } from './src/components/ui/Icon';
import { colors, typography, spacing, borderRadius, shadows } from './src/theme';

function AppContent() {
  const isOffline = useServerStatusStore((state) => state.isOffline);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <AppNavigator />

      {isOffline && (
        <View
          style={[
            styles.offlineBanner,
            { bottom: insets.bottom > 0 ? insets.bottom + spacing.xs : spacing.base }
          ]}
        >
          <Icon name="cloud-offline" size={18} color={colors.white} />
          <Text style={styles.offlineText}>
            Server offline — the scoring server is unreachable.
          </Text>
        </View>
      )}

      <AlertHost />
    </View>
  );
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  }));

  const [trpcClient] = useState(() => getTrpcClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AppContent />
          <StatusBar style="light" />
        </SafeAreaProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  offlineBanner: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    backgroundColor: colors.accentDangerDark,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.elevated,
  },
  offlineText: {
    color: colors.white,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
});
