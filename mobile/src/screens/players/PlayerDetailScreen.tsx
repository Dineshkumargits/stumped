import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, borderRadius, spacing } from '../../theme';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Icon } from '../../components/ui/Icon';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Alert } from '../../components/ui/AppAlert';
import { trpc } from '../../trpc';

export const PlayerDetailScreen = ({ route, navigation }: any) => {
  const { playerId } = route.params;
  const [tab, setTab] = useState<'stats' | 'ratings'>('stats');
  const [battingInput, setBattingInput] = useState('');
  const [bowlingInput, setBowlingInput] = useState('');
  const [updating, setUpdating] = useState(false);

  const { data: player, isLoading, refetch } = trpc.player.getDetail.useQuery({ playerId });
  const overrideRatingMutation = trpc.player.overrideRating.useMutation();
  const utils = trpc.useUtils();

  const { data: clubs } = trpc.club.getMyClubs.useQuery();
  const myMembership = clubs?.find((c: any) => c.id === player?.clubId);
  const isAdmin = myMembership?.role === 'ADMIN';

  const handleOverride = async () => {
    const bat = parseFloat(battingInput);
    const bowl = parseFloat(bowlingInput);

    if (isNaN(bat) || bat < 0 || bat > 100 || isNaN(bowl) || bowl < 0 || bowl > 100) {
      Alert.alert('Invalid Input', 'Please enter ratings between 0 and 100.');
      return;
    }

    setUpdating(true);
    try {
      await overrideRatingMutation.mutateAsync({
        playerId,
        battingRating: bat,
        bowlingRating: bowl,
      });
      Alert.alert('Success', 'Player ratings overridden successfully.');
      utils.player.getDetail.invalidate({ playerId });
      utils.player.list.invalidate();
      refetch();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not override ratings. Admin privilege required.');
    } finally {
      setUpdating(false);
    }
  };

  const initRatingsForm = () => {
    if (player) {
      setBattingInput(player.battingRating.toString());
      setBowlingInput(player.bowlingRating.toString());
    }
    setTab('ratings');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </SafeAreaView>
    );
  }

  if (!player) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>Player not found</Text>
      </SafeAreaView>
    );
  }

  const { career } = player;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Player Profile" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Avatar name={player.name} color={player.avatarColor} size={72} />
          <Text style={styles.profileName}>{player.name}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{player.category.replace('_', ' ')}</Text>
            </View>
            {player.isRatingManual && (
              <View style={[styles.badge, styles.manualBadge]}>
                <Icon name="create-outline" size={11} color={colors.accentSecondary} />
                <Text style={styles.manualBadgeText}>Manual Rating</Text>
              </View>
            )}
          </View>

          <View style={styles.ratingsOverview}>
            <View style={styles.ratingBox}>
              <Text style={styles.ratingBoxVal}>{player.overallRating.toFixed(0)}</Text>
              <Text style={styles.ratingBoxLabel}>Overall</Text>
            </View>
            <View style={styles.ratingDivider} />
            <View style={styles.ratingBox}>
              <Text style={styles.ratingBoxVal}>{player.battingRating.toFixed(0)}</Text>
              <Text style={styles.ratingBoxLabel}>Batting</Text>
            </View>
            <View style={styles.ratingDivider} />
            <View style={styles.ratingBox}>
              <Text style={styles.ratingBoxVal}>{player.bowlingRating.toFixed(0)}</Text>
              <Text style={styles.ratingBoxLabel}>Bowling</Text>
            </View>
          </View>
        </View>

        {/* Tab Selector */}
        {isAdmin && (
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, tab === 'stats' && styles.tabButtonActive]}
              onPress={() => setTab('stats')}
            >
              <Text style={[styles.tabButtonText, tab === 'stats' && styles.tabButtonTextActive]}>
                Career Stats
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, tab === 'ratings' && styles.tabButtonActive]}
              onPress={initRatingsForm}
            >
              <Text style={[styles.tabButtonText, tab === 'ratings' && styles.tabButtonTextActive]}>
                Override Ratings
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab Content */}
        {tab === 'stats' || !isAdmin ? (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Batting Performance</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCol}>
                <Text style={styles.statVal}>{career.matchesPlayed}</Text>
                <Text style={styles.statLabel}>Matches</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statVal}>{career.totalRuns}</Text>
                <Text style={styles.statLabel}>Runs</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statVal}>{career.battingAverage}</Text>
                <Text style={styles.statLabel}>Average</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statVal}>{career.strikeRate}</Text>
                <Text style={styles.statLabel}>Strike Rate</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statVal}>{career.highestScore}</Text>
                <Text style={styles.statLabel}>Highest Score</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statVal}>{career.notOuts}</Text>
                <Text style={styles.statLabel}>Not Outs</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Bowling Performance</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCol}>
                <Text style={styles.statVal}>{career.totalWickets}</Text>
                <Text style={styles.statLabel}>Wickets</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statVal}>{career.totalOversBowled.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Overs</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statVal}>{career.economy}</Text>
                <Text style={styles.statLabel}>Economy</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statVal}>{career.bowlingAverage}</Text>
                <Text style={styles.statLabel}>Average</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statVal}>{career.totalMaidens}</Text>
                <Text style={styles.statLabel}>Maidens</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.tabContent}>
            <View style={styles.overrideCard}>
              <Text style={styles.overrideTitle}>Admin Controls</Text>
              <Text style={styles.overrideDesc}>
                Directly adjust player ratings. Rating scale is from 0 to 100.
              </Text>

              <Input
                label="Batting Rating"
                placeholder="e.g. 75"
                keyboardType="numeric"
                value={battingInput}
                onChangeText={setBattingInput}
              />

              <Input
                label="Bowling Rating"
                placeholder="e.g. 60"
                keyboardType="numeric"
                value={bowlingInput}
                onChangeText={setBowlingInput}
              />

              <Button
                title={updating ? 'Updating...' : 'Save Ratings'}
                icon="save-outline"
                onPress={handleOverride}
                variant="gold"
                disabled={updating}
                style={styles.overrideBtn}
              />
            </View>
          </View>
        )}
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
  errorText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.error,
  },
  scrollContainer: {
    padding: spacing.base,
    paddingBottom: spacing.xl,
  },
  profileCard: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  profileName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  badge: {
    backgroundColor: colors.bgTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  badgeText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  manualBadge: {
    backgroundColor: colors.accentSecondarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manualBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.accentSecondary,
  },
  ratingsOverview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.base,
  },
  ratingBox: {
    alignItems: 'center',
    flex: 1,
  },
  ratingBoxVal: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary,
  },
  ratingBoxLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.base,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.bgTertiary,
  },
  tabButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  tabContent: {
    gap: spacing.base,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  statCol: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statVal: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  overrideCard: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
  },
  overrideTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  overrideDesc: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  overrideBtn: {
    marginTop: spacing.md,
  },
});
