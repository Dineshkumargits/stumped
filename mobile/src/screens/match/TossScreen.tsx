import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, borderRadius, spacing, shadows } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Alert } from '../../components/ui/AppAlert';
import { trpc } from '../../trpc';
import { Team, TossDecision } from '@stumped/shared';
import { showLocalNotification } from '../../utils/notification';

export const TossScreen = ({ route, navigation }: any) => {
  const { matchId } = route.params;
  const [tossWinner, setTossWinner] = useState<Team | null>(null);
  const [decision, setDecision] = useState<TossDecision | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [loading, setLoading] = useState(false);

  const flipAnim = React.useRef(new Animated.Value(0)).current;

  const { data: match, isLoading } = trpc.match.getDetails.useQuery({ matchId });
  const recordTossMutation = trpc.match.recordToss.useMutation();
  const startInningsMutation = trpc.match.startInnings.useMutation();

  const handleFlipCoin = () => {
    if (flipping) return;
    setFlipping(true);

    // Animated coin flip using rotateY with perspective for proper 3D effect
    Animated.sequence([
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(flipAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Pick random team
      const winner = Math.random() < 0.5 ? Team.TEAM_A : Team.TEAM_B;
      setTossWinner(winner);
      setFlipping(false);
    });
  };

  const handleStartMatch = async () => {
    if (!tossWinner || !decision) {
      Alert.alert('Selection Required', 'Please flip the coin and select batting/bowling decision.');
      return;
    }

    setLoading(true);
    try {
      // Record toss
      await recordTossMutation.mutateAsync({
        matchId,
        winner: tossWinner,
        decision,
      });

      // Start 1st Innings
      const innings = await startInningsMutation.mutateAsync({ matchId });

      // Send local notification
      await showLocalNotification(
        '🏆 Match Started!',
        `${winnerName} won the toss and elected to ${decision === TossDecision.BAT ? 'bat' : 'bowl'} first.`
      );

      Alert.alert('Toss Recorded', `Match started! Innings 1 is active.`);
      
      // Navigate to Scoring screen
      navigation.navigate('Scoring', { matchId, inningsId: innings.id });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not start match.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </SafeAreaView>
    );
  }

  const winnerName = tossWinner === Team.TEAM_A ? match?.teamAName : match?.teamBName;

  const spin = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const perspective = 1000;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {navigation.canGoBack?.() && (
          <TouchableOpacity
            onPress={navigation.goBack}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Coin Toss</Text>
        <Text style={styles.subtitle}>{match?.teamAName} vs {match?.teamBName}</Text>
      </View>

      <View style={styles.container}>
        {/* Coin flip graphic */}
        <TouchableOpacity
          style={styles.coinArea}
          onPress={handleFlipCoin}
          disabled={flipping || !!tossWinner}
        >
          <Animated.View
            style={[
              styles.coin,
              { transform: [{ perspective }, { rotateY: spin }] },
              tossWinner && styles.coinFlipped,
            ]}
          >
            <Icon
              name={flipping ? 'sync-outline' : tossWinner ? 'checkmark-done-outline' : 'disc-outline'}
              size={52}
              color={tossWinner ? colors.accentSecondary : colors.textPrimary}
            />
            <Text style={styles.coinLabel}>
              {flipping ? 'Flipping...' : tossWinner ? 'TOSS DONE' : 'TAP TO FLIP'}
            </Text>
          </Animated.View>
        </TouchableOpacity>

        {tossWinner && (
          <View style={styles.tossResults}>
            <View style={styles.resultRow}>
              <Icon name="trophy" size={20} color={colors.accentSecondary} />
              <Text style={styles.resultText}>
                <Text style={styles.winnerHighlight}>{winnerName}</Text> won the toss!
              </Text>
            </View>

            <Text style={styles.choiceTitle}>Select Decision</Text>
            <View style={styles.choiceRow}>
              <TouchableOpacity
                style={[
                  styles.choiceCard,
                  decision === TossDecision.BAT && styles.choiceCardActive,
                ]}
                onPress={() => setDecision(TossDecision.BAT)}
              >
                <Icon
                  name="tennisball-outline"
                  size={30}
                  color={decision === TossDecision.BAT ? colors.accentPrimary : colors.textSecondary}
                  style={styles.choiceIcon as any}
                />
                <Text style={styles.choiceText}>Bat First</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.choiceCard,
                  decision === TossDecision.BOWL && styles.choiceCardActive,
                ]}
                onPress={() => setDecision(TossDecision.BOWL)}
              >
                <Icon
                  name="baseball-outline"
                  size={30}
                  color={decision === TossDecision.BOWL ? colors.accentPrimary : colors.textSecondary}
                  style={styles.choiceIcon as any}
                />
                <Text style={styles.choiceText}>Bowl First</Text>
              </TouchableOpacity>
            </View>

            <Button
              title={loading ? 'Starting Match...' : 'Start Match Scoring'}
              icon="play-outline"
              onPress={handleStartMatch}
              variant="primary"
              disabled={loading || !decision}
              style={styles.startBtn}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
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
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinArea: {
    marginBottom: spacing['2xl'],
  },
  coin: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.bgSecondary,
    borderWidth: 3,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.elevated,
  },
  coinFlipped: {
    borderColor: colors.accentSecondary,
    ...shadows.glow(colors.accentSecondary),
  },
  coinLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  tossResults: {
    width: '100%',
    alignItems: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  resultText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  winnerHighlight: {
    color: colors.accentSecondary,
  },
  choiceTitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    marginBottom: spacing['2xl'],
  },
  choiceCard: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
  },
  choiceCardActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: 'rgba(0, 200, 83, 0.05)',
  },
  choiceIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  choiceText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  startBtn: {
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
