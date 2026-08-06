import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { colors, typography, borderRadius, spacing } from '../../theme';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Icon } from '../../components/ui/Icon';
import { trpc } from '../../trpc';

interface H2HTabProps {
  clubId: string;
}

export const H2HTab: React.FC<H2HTabProps> = ({ clubId }) => {
  const [playerAId, setPlayerAId] = useState<string | null>(null);
  const [playerBId, setPlayerBId] = useState<string | null>(null);
  const [selectingFor, setSelectingFor] = useState<'A' | 'B' | null>(null);

  const { data: players, isLoading: playersLoading } = trpc.player.list.useQuery(
    { clubId },
    { enabled: !!clubId } as any
  );

  const playerA = players?.find((p: any) => p.id === playerAId);
  const playerB = players?.find((p: any) => p.id === playerBId);

  // Query H2H and Comparison
  const { data: h2hData, isLoading: h2hLoading } = trpc.stats.getH2H.useQuery(
    { playerAId: playerAId || '', playerBId: playerBId || '' },
    { enabled: !!playerAId && !!playerBId } as any
  );

  const { data: comparisonData, isLoading: compLoading } = trpc.stats.getComparison.useQuery(
    { playerAId: playerAId || '', playerBId: playerBId || '' },
    { enabled: !!playerAId && !!playerBId } as any
  );

  const renderPlayerSelectItem = ({ item }: { item: any }) => {
    // Cannot select the same player for both slots
    const isDisabled = selectingFor === 'A' ? item.id === playerBId : item.id === playerAId;

    return (
      <TouchableOpacity
        style={[styles.playerItem, isDisabled && styles.playerItemDisabled]}
        disabled={isDisabled}
        onPress={() => {
          if (selectingFor === 'A') {
            setPlayerAId(item.id);
          } else {
            setPlayerBId(item.id);
          }
          setSelectingFor(null);
        }}
      >
        <Avatar name={item.name} color={item.avatarColor} size={36} />
        <View style={styles.playerItemText}>
          <Text style={styles.playerItemName}>{item.name}</Text>
          <Text style={styles.playerItemCategory}>{item.category.replace('_', ' ')}</Text>
        </View>
        <Text style={styles.playerItemRating}>Rating: {item.overallRating.toFixed(0)}</Text>
      </TouchableOpacity>
    );
  };

  const CompareBar = ({
    label,
    valA,
    valB,
    format = (v: number) => v.toFixed(0),
    invertColors = false,
  }: {
    label: string;
    valA: number;
    valB: number;
    format?: (v: number) => string;
    invertColors?: boolean;
  }) => {
    const total = valA + valB;
    const pctA = total > 0 ? (valA / total) * 100 : 50;
    const pctB = total > 0 ? (valB / total) * 100 : 50;

    const colorA = invertColors ? colors.accentSecondary : colors.accentPrimary;
    const colorB = invertColors ? colors.accentPrimary : colors.accentSecondary;

    return (
      <View style={styles.compareBarContainer}>
        <View style={styles.compareBarLabels}>
          <Text style={[styles.compareValText, { color: colorA, textAlign: 'left' }]}>{format(valA)}</Text>
          <Text style={styles.compareLabel}>{label}</Text>
          <Text style={[styles.compareValText, { color: colorB, textAlign: 'right' }]}>{format(valB)}</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${pctA}%`, backgroundColor: colorA }]} />
          <View style={[styles.progressBarFill, { width: `${pctB}%`, backgroundColor: colorB }]} />
        </View>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Player Comparison</Text>
      <Text style={styles.subtitle}>Compare player ratings and head-to-head match stats</Text>

      {/* Selectors */}
      <View style={styles.selectorsRow}>
        {/* Player A Selector */}
        <TouchableOpacity
          style={styles.selectorCard}
          onPress={() => setSelectingFor('A')}
        >
          {playerA ? (
            <View style={styles.selectedPlayerInfo}>
              <Avatar name={playerA.name} color={playerA.avatarColor} size={48} />
              <Text style={styles.selectedPlayerName} numberOfLines={1}>
                {playerA.name}
              </Text>
              <Text style={[styles.ratingPill, { backgroundColor: colors.accentPrimary + '20', color: colors.accentPrimary }]}>
                {playerA.overallRating.toFixed(0)}
              </Text>
            </View>
          ) : (
            <View style={styles.placeholderSelector}>
              <Icon name="person-add-outline" size={26} color={colors.textTertiary} style={styles.placeholderIcon as any} />
              <Text style={styles.placeholderText}>Select Player A</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.vsCircle}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        {/* Player B Selector */}
        <TouchableOpacity
          style={styles.selectorCard}
          onPress={() => setSelectingFor('B')}
        >
          {playerB ? (
            <View style={styles.selectedPlayerInfo}>
              <Avatar name={playerB.name} color={playerB.avatarColor} size={48} />
              <Text style={styles.selectedPlayerName} numberOfLines={1}>
                {playerB.name}
              </Text>
              <Text style={[styles.ratingPill, { backgroundColor: colors.accentSecondary + '20', color: colors.accentSecondary }]}>
                {playerB.overallRating.toFixed(0)}
              </Text>
            </View>
          ) : (
            <View style={styles.placeholderSelector}>
              <Icon name="person-add-outline" size={26} color={colors.textTertiary} style={styles.placeholderIcon as any} />
              <Text style={styles.placeholderText}>Select Player B</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* H2H Results */}
      {playerAId && playerBId ? (
        h2hLoading || compLoading ? (
          <ActivityIndicator size="large" color={colors.accentPrimary} style={{ marginTop: spacing.xl }} />
        ) : h2hData && comparisonData ? (
          <View style={{ gap: spacing.base }}>
            {/* Direct Face-off Card */}
            <Card style={styles.h2hCard}>
              <Text style={styles.cardHeaderTitle}>Direct Face-off</Text>
              <Text style={styles.cardHeaderSubtitle}>Matches played together: {h2hData.commonMatchesCount}</Text>

              <View style={styles.h2hSummaryRow}>
                <View style={styles.relationCol}>
                  <Text style={styles.relationNum}>{h2hData.playedAsTeammates}</Text>
                  <Text style={styles.relationLabel}>As Teammates</Text>
                </View>
                <View style={styles.relationDivider} />
                <View style={styles.relationCol}>
                  <Text style={styles.relationNum}>{h2hData.playedAsOpponents}</Text>
                  <Text style={styles.relationLabel}>As Opponents</Text>
                </View>
              </View>

              {h2hData.playedAsOpponents > 0 && (
                <View style={styles.barsContainer}>
                  <CompareBar label="Opponent Match Wins" valA={h2hData.winsA} valB={h2hData.winsB} />
                </View>
              )}

              <View style={styles.barsContainer}>
                <CompareBar label="Runs in Common Matches" valA={h2hData.runsA} valB={h2hData.runsB} />
                <CompareBar label="Wickets in Common Matches" valA={h2hData.wicketsA} valB={h2hData.wicketsB} />
              </View>
            </Card>

            {/* Career Comparison Card */}
            <Card>
              <Text style={styles.cardHeaderTitle}>Career Stats side-by-side</Text>
              <Text style={styles.cardHeaderSubtitle}>All matches career aggregates</Text>

              <View style={styles.barsContainer}>
                <CompareBar
                  label="Overall Rating"
                  valA={comparisonData.playerA.overallRating}
                  valB={comparisonData.playerB.overallRating}
                />
                <CompareBar
                  label="Batting Rating"
                  valA={comparisonData.playerA.battingRating}
                  valB={comparisonData.playerB.battingRating}
                />
                <CompareBar
                  label="Bowling Rating"
                  valA={comparisonData.playerA.bowlingRating}
                  valB={comparisonData.playerB.bowlingRating}
                />
                <CompareBar
                  label="Matches Played"
                  valA={comparisonData.playerA.career.matchesPlayed}
                  valB={comparisonData.playerB.career.matchesPlayed}
                />
                <CompareBar
                  label="Runs Scored"
                  valA={comparisonData.playerA.career.totalRuns}
                  valB={comparisonData.playerB.career.totalRuns}
                />
                <CompareBar
                  label="Wickets Taken"
                  valA={comparisonData.playerA.career.totalWickets}
                  valB={comparisonData.playerB.career.totalWickets}
                />
                <CompareBar
                  label="Batting Average"
                  valA={comparisonData.playerA.career.battingAverage}
                  valB={comparisonData.playerB.career.battingAverage}
                  format={(v) => v.toFixed(2)}
                />
                <CompareBar
                  label="Bowling Average"
                  valA={comparisonData.playerA.career.bowlingAverage}
                  valB={comparisonData.playerB.career.bowlingAverage}
                  format={(v) => v.toFixed(2)}
                  invertColors
                />
                <CompareBar
                  label="Batting Strike Rate"
                  valA={comparisonData.playerA.career.strikeRate}
                  valB={comparisonData.playerB.career.strikeRate}
                  format={(v) => v.toFixed(1)}
                />
                <CompareBar
                  label="Economy Rate"
                  valA={comparisonData.playerA.career.economy}
                  valB={comparisonData.playerB.career.economy}
                  format={(v) => v.toFixed(2)}
                  invertColors
                />
              </View>
            </Card>
          </View>
        ) : null
      ) : (
        <Card style={styles.guideCard}>
          <Icon name="git-compare-outline" size={34} color={colors.textTertiary} style={styles.guideIcon as any} />
          <Text style={styles.guideText}>Select two players from the selectors above to see a full head-to-head comparison analysis.</Text>
        </Card>
      )}

      {/* Selector Modal */}
      <Modal
        visible={selectingFor !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectingFor(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select Player {selectingFor}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectingFor(null)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>

            {playersLoading ? (
              <ActivityIndicator size="large" color={colors.accentPrimary} style={{ margin: spacing.xl }} />
            ) : (
              <FlatList
                data={players}
                keyExtractor={(item) => item.id}
                renderItem={renderPlayerSelectItem}
                contentContainerStyle={styles.playersList}
                ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
                ListEmptyComponent={
                  <View style={styles.emptyList}>
                    <Text style={styles.emptyListText}>No players found.</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.base,
    paddingBottom: spacing.xl,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.base,
  },
  selectorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  selectorCard: {
    flex: 1,
    height: 120,
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderSelector: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    marginBottom: spacing.xs,
  },
  placeholderText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  selectedPlayerInfo: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
    width: '100%',
  },
  selectedPlayerName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    textAlign: 'center',
    width: '90%',
  },
  ratingPill: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 4,
  },
  vsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  vsText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  guideCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  guideIcon: {
    marginBottom: spacing.sm,
  },
  guideText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    height: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
  },
  closeBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  closeBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.accentPrimary,
  },
  playersList: {
    padding: spacing.base,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  playerItemDisabled: {
    opacity: 0.3,
  },
  playerItemText: {
    marginLeft: spacing.base,
    flex: 1,
  },
  playerItemName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  playerItemCategory: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  playerItemRating: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.accentPrimary,
  },
  itemSeparator: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyList: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyListText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  h2hCard: {
    backgroundColor: colors.bgSecondary,
  },
  cardHeaderTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  cardHeaderSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.base,
  },
  h2hSummaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgTertiary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.base,
    marginBottom: spacing.base,
  },
  relationCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relationNum: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  relationLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  relationDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  compareBarContainer: {
    marginBottom: spacing.base,
  },
  compareBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  compareValText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    width: 60,
  },
  compareLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  progressBarBg: {
    height: 10,
    backgroundColor: colors.bgTertiary,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  barsContainer: {
    marginTop: spacing.sm,
  },
});
