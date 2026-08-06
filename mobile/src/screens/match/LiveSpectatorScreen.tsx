import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, borderRadius, spacing, shadows } from '../../theme';
import { Card } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';
import io from 'socket.io-client';
import { useAuthStore } from '../../stores/auth.store';
import { trpc } from '../../trpc';

const SOCKET_URL = __DEV__
  ? 'http://10.0.2.2:3000'
  : 'https://api-stumped.adkdev.in';

export const LiveSpectatorScreen = ({ route, navigation }: any) => {
  const { matchId } = route.params;
  const [liveState, setLiveState] = useState<any>(null);
  const [ballFeed, setBallFeed] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(true);
  const [disconnected, setDisconnected] = useState(false);

  // Fallback initial fetch of live state
  const { data: initialDetails } = trpc.match.getDetails.useQuery({ matchId });

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/scoring`, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to Stumped websocket.');
      socket.emit('match:join', { matchId });
      setConnecting(false);
      setDisconnected(false);
    });

    socket.on('disconnect', () => {
      console.warn('Stumped websocket disconnected.');
      setDisconnected(true);
    });

    socket.on('connect_error', () => {
      setConnecting(false);
      setDisconnected(true);
    });

    socket.on('match:ballUpdate', (data: any) => {
      setLiveState(data);
      setDisconnected(false);
      
      // Build visual text for ball event
      let ballText = `${data.currentBatsman.name} faced ${data.currentBowler.name}: `;
      const lastBallVal = data.currentOver[data.currentOver.length - 1];
      if (lastBallVal === -1) ballText += 'Wide';
      else if (lastBallVal === -2) ballText += 'No ball';
      else if (lastBallVal === -3) ballText += 'WICKET 🔴';
      else ballText += `${lastBallVal} run(s)`;

      setBallFeed((prev) => [ballText, ...prev.slice(0, 19)]);
    });

    return () => {
      socket.emit('match:leave', { matchId });
      socket.disconnect();
    };
  }, [matchId]);

  if (connecting && !liveState) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
        <Text style={styles.loadingText}>Connecting to Live Turf Room...</Text>
      </SafeAreaView>
    );
  }

  const innings = liveState?.innings || initialDetails?.innings[initialDetails.innings.length - 1];
  const batsman = liveState?.currentBatsman;
  const bowler = liveState?.currentBowler;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {navigation?.canGoBack?.() && (
          <TouchableOpacity
            onPress={navigation.goBack}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={styles.liveTitleRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveTitle}>LIVE SPECTATOR ROOM</Text>
        </View>
        <Text style={styles.subtitle}>Real-time turf commentary feed</Text>
      </View>

      {/* Disconnected banner */}
      {disconnected && (
        <View style={styles.disconnectBanner}>
          <Icon name="warning-outline" size={14} color={colors.warning} />
          <Text style={styles.disconnectText}>Connection lost. Attempting to reconnect...</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Animated Scorecard */}
        <Card style={styles.scoreCard}>
          <Text style={styles.teamNames}>
            {initialDetails?.teamAName} vs {initialDetails?.teamBName}
          </Text>
          <Text style={styles.scoreText}>
            {innings?.totalRuns || 0} / {innings?.totalWickets || 0}
          </Text>
          <Text style={styles.oversText}>Overs: {innings?.totalOvers?.toFixed(1) || '0.0'}</Text>
        </Card>

        {/* Live Batsmen & Bowler stats */}
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <View style={styles.playerNameWrap}>
              <Icon name="tennisball" size={14} color={colors.accentSecondary} />
              <Text style={styles.playerName}>{batsman?.name || 'Striker'}</Text>
            </View>
            <Text style={styles.playerStats}>{batsman?.runs || 0} runs ({batsman?.balls || 0} balls)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <View style={styles.playerNameWrap}>
              <Icon name="baseball-outline" size={14} color={colors.info} />
              <Text style={styles.playerName}>{bowler?.name || 'Bowler'}</Text>
            </View>
            <Text style={styles.playerStats}>
              {bowler?.wickets || 0} wkts for {bowler?.runs || 0} runs
            </Text>
          </View>
        </View>

        {/* Live Ball-by-ball commentary feed */}
        <Text style={styles.sectionTitle}>Commentary Log</Text>
        <View style={styles.commentaryBox}>
          {ballFeed.length > 0 ? (
            ballFeed.map((feed, idx) => (
              <View key={idx} style={styles.commentaryItem}>
                <Text style={styles.commentaryText}>{feed}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyCommentary}>Waiting for next ball delivery...</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  disconnectBanner: {
    backgroundColor: colors.accentSecondarySoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  disconnectText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.warning,
  },
  header: {
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: spacing.base,
    top: spacing.base,
    width: 34,
    height: 34,
    borderRadius: borderRadius.round,
    backgroundColor: colors.bgTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  liveTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accentDanger,
    ...shadows.glow(colors.accentDanger),
  },
  liveTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.accentDanger,
    letterSpacing: 1,
  },
  playerNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollContainer: {
    padding: spacing.base,
  },
  scoreCard: {
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  teamNames: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  scoreText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 48,
    color: colors.accentPrimary,
    marginVertical: spacing.sm,
  },
  oversText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  statsCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  playerName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  playerStats: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  commentaryBox: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 150,
  },
  commentaryItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  commentaryText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  emptyCommentary: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
