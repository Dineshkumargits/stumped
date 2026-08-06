import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors, typography, borderRadius, spacing } from '../../theme';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Icon, IconName } from '../../components/ui/Icon';
import { EmptyState } from '../../components/ui/EmptyState';
import { trpc } from '../../trpc';

interface AwardsTabProps {
  clubId: string;
}

const AWARD_METADATA: Record<string, { title: string; icon: IconName; subtitle: string; tint: string }> = {
  TOP_SCORER: {
    title: 'Top Scorer',
    icon: 'tennisball',
    subtitle: 'Golden Bat',
    tint: colors.accentSecondary,
  },
  TOP_WICKET_TAKER: {
    title: 'Top Wicket Taker',
    icon: 'baseball',
    subtitle: 'Golden Ball',
    tint: colors.accentPrimary,
  },
  BEST_BATTING_AVG: {
    title: 'Best Batting Avg',
    icon: 'shield-checkmark',
    subtitle: 'Golden Helmet (Min 3 Innings)',
    tint: colors.extraNoBall,
  },
  BEST_BOWLING_AVG: {
    title: 'Best Bowling Avg',
    icon: 'hand-left',
    subtitle: 'Golden Glove (Min 5 Overs)',
    tint: colors.info,
  },
};

export const AwardsTab: React.FC<AwardsTabProps> = ({ clubId }) => {
  const { data: awards, isLoading } = trpc.awards.computeSeasonalAwards.useQuery(
    { clubId, period: 'All Time' },
    { enabled: !!clubId } as any
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  if (!awards || awards.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="medal-outline"
          title="No Awards Yet"
          description="No awards computed yet. Complete matches in the club to see awards!"
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Club Achievements</Text>
      <Text style={styles.sectionSubtitle}>Recognizing top performers across all matches</Text>

      <View style={styles.grid}>
        {awards.map((award: any) => {
          const meta = AWARD_METADATA[award.type] || {
            title: award.type,
            icon: 'trophy' as IconName,
            subtitle: 'Club Award',
            tint: colors.accentPrimary,
          };

          return (
            <Card
              key={award.type}
              style={StyleSheet.flatten([styles.awardCard, { borderLeftColor: meta.tint }])}
            >
              <View style={styles.awardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: meta.tint + '15' }]}>
                  <Icon name={meta.icon} size={22} color={meta.tint} />
                </View>
                <View style={styles.awardHeaderText}>
                  <Text style={styles.awardTitle}>{meta.title}</Text>
                  <Text style={styles.awardSubtitle}>{meta.subtitle}</Text>
                </View>
              </View>

              <View style={styles.winnerSection}>
                <Avatar name={award.player.name} color={award.player.avatarColor} size={40} />
                <View style={styles.winnerTextContainer}>
                  <Text style={styles.winnerLabel}>Winner</Text>
                  <Text style={styles.winnerName} numberOfLines={1}>
                    {award.player.name}
                  </Text>
                </View>
                <View style={styles.valueContainer}>
                  <Text style={[styles.valueText, { color: meta.tint }]}>{award.value}</Text>
                </View>
              </View>
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.base,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  sectionSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.base,
  },
  grid: {
    gap: spacing.base,
  },
  awardCard: {
    borderLeftWidth: 4,
    padding: spacing.base,
  },
  awardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  awardIcon: {
    fontSize: 22,
  },
  awardHeaderText: {
    marginLeft: spacing.base,
    flex: 1,
  },
  awardTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  awardSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  winnerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgTertiary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  winnerTextContainer: {
    marginLeft: spacing.base,
    flex: 1,
  },
  winnerLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  winnerName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginTop: 1,
  },
  valueContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
  },
  valueText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
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
    lineHeight: 22,
  },
});
