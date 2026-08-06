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
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Icon, IconName } from '../../components/ui/Icon';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../stores/auth.store';
import { trpc } from '../../trpc';
import { SeriesTab } from './SeriesTab';
import { H2HTab } from './H2HTab';
import { AwardsTab } from './AwardsTab';

export const StatsScreen = () => {
  const activeClubId = useAuthStore((state) => state.activeClubId);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'series' | 'h2h' | 'awards'>('leaderboard');
  const [leaderboardSubTab, setLeaderboardSubTab] = useState<'overall' | 'batting' | 'bowling'>('overall');

  const { data: players, isLoading: playersLoading } = trpc.player.list.useQuery(
    { clubId: activeClubId || '' },
    { enabled: !!activeClubId } as any
  );

  const getSortedPlayers = () => {
    if (!players) return [];
    const copy = [...players];
    if (leaderboardSubTab === 'overall') {
      return copy.sort((a, b) => b.overallRating - a.overallRating);
    } else if (leaderboardSubTab === 'batting') {
      return copy.sort((a, b) => b.battingRating - a.battingRating);
    } else {
      return copy.sort((a, b) => b.bowlingRating - a.bowlingRating);
    }
  };

  const sortedList = getSortedPlayers();

  if (!activeClubId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Please select or join a club first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Club Analytics</Text>
        <Text style={styles.subtitle}>Stats, Points Tables, H2H & Awards</Text>
      </View>

      {/* Segmented Tab Control */}
      <View style={styles.tabBar}>
        {(
          [
            { id: 'leaderboard', label: 'Ranks', icon: 'stats-chart' },
            { id: 'series', label: 'Series', icon: 'trophy' },
            { id: 'h2h', label: 'H2H', icon: 'git-compare' },
            { id: 'awards', label: 'Awards', icon: 'medal' },
          ] as Array<{ id: string; label: string; icon: IconName }>
        ).map((t) => {
          const isActive = activeTab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(t.id as any)}
            >
              <Icon
                name={t.icon}
                size={16}
                color={isActive ? colors.accentPrimary : colors.textTertiary}
                style={styles.tabIcon as any}
              />
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab Content rendering */}
      {activeTab === 'leaderboard' && (
        <View style={{ flex: 1 }}>
          {/* Sub-tabs for Leaderboard Categories */}
          <View style={styles.subTabBar}>
            {(['overall', 'batting', 'bowling'] as const).map((sub) => (
              <TouchableOpacity
                key={sub}
                style={[styles.subTabButton, leaderboardSubTab === sub && styles.subTabButtonActive]}
                onPress={() => setLeaderboardSubTab(sub)}
              >
                <Text style={[styles.subTabButtonText, leaderboardSubTab === sub && styles.subTabButtonTextActive]}>
                  {sub.charAt(0).toUpperCase() + sub.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {playersLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accentPrimary} />
            </View>
          ) : sortedList.length > 0 ? (
            <ScrollView contentContainerStyle={styles.scrollContainer}>
              <Card style={styles.leaderboardCard}>
                {sortedList.map((player, idx) => {
                  const val =
                    leaderboardSubTab === 'overall'
                      ? player.overallRating
                      : leaderboardSubTab === 'batting'
                      ? player.battingRating
                      : player.bowlingRating;

                  return (
                    <View key={player.id} style={styles.playerRow}>
                      <View style={styles.rankCol}>
                        <Text
                          style={[
                            styles.rankText,
                            idx === 0 && styles.goldRank,
                            idx === 1 && styles.silverRank,
                            idx === 2 && styles.bronzeRank,
                          ]}
                        >
                          {idx + 1}
                        </Text>
                      </View>
                      <Avatar name={player.name} color={player.avatarColor} size={36} />
                      <Text style={styles.playerName} numberOfLines={1}>
                        {player.name}
                      </Text>
                      <Text style={styles.ratingVal}>{val.toFixed(0)}</Text>
                    </View>
                  );
                })}
              </Card>
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <EmptyState
                icon="stats-chart-outline"
                title="No Stats Yet"
                description="No stats available. Add players to view the leaderboard."
              />
            </View>
          )}
        </View>
      )}

      {activeTab === 'series' && <SeriesTab clubId={activeClubId} />}

      {activeTab === 'h2h' && <H2HTab clubId={activeClubId} />}

      {activeTab === 'awards' && <AwardsTab clubId={activeClubId} />}
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
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accentPrimary,
  },
  tabIcon: {
    marginBottom: 2,
  },
  tabButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: colors.accentPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.md,
    padding: 4,
    margin: spacing.base,
  },
  subTabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  subTabButtonActive: {
    backgroundColor: colors.bgTertiary,
  },
  subTabButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  subTabButtonTextActive: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
  },
  leaderboardCard: {
    padding: spacing.md,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rankCol: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  goldRank: {
    color: '#FFD700',
  },
  silverRank: {
    color: '#C0C0C0',
  },
  bronzeRank: {
    color: '#CD7F32',
  },
  playerName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginLeft: spacing.md,
    flex: 1,
  },
  ratingVal: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.accentSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
