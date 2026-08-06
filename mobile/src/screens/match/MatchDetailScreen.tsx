import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, borderRadius, spacing } from '../../theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { IconBadge } from '../../components/ui/Icon';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Alert } from '../../components/ui/AppAlert';
import { trpc } from '../../trpc';
import { Team, MemberRole } from '@stumped/shared';
import { useAuthStore } from '../../stores/auth.store';

export const MatchDetailScreen = ({ route, navigation }: any) => {
  const { matchId } = route.params;

  const activeClubId = useAuthStore((state) => state.activeClubId);

  const { data: matchDetails, isLoading: detailsLoading } = trpc.match.getDetails.useQuery(
    { matchId: matchId || '' },
    { enabled: !!matchId } as any
  );

  const { data: matchAwards } = trpc.awards.getMatchAwards.useQuery(
    { matchId: matchId || '' },
    { enabled: !!matchId } as any
  );

  const { data: clubs } = trpc.club.getMyClubs.useQuery();
  const myMembership = clubs?.find((c: any) => c.id === activeClubId);
  const isScorerOrAdmin = myMembership?.role === MemberRole.ADMIN || myMembership?.role === MemberRole.SCORER;

  const handleShareScorecard = async () => {
    if (!matchDetails) return;

    try {
      let shareText = `🏏 *Stumped Match Scorecard* 🏏\n\n`;
      shareText += `*${matchDetails.teamAName} vs ${matchDetails.teamBName}*\n`;
      
      const winnerName = matchDetails.winnerTeam === 'TEAM_A'
        ? matchDetails.teamAName
        : matchDetails.winnerTeam === 'TEAM_B'
        ? matchDetails.teamBName
        : 'Match Tied';
      shareText += `🏆 *Winner*: ${winnerName}${matchDetails.winMargin ? ` won by ${matchDetails.winMargin}` : ''}\n\n`;

      matchDetails.innings.forEach((inn: any) => {
        const teamName = inn.battingTeam === 'TEAM_A' ? matchDetails.teamAName : matchDetails.teamBName;
        shareText += `*${inn.inningsNumber === 1 ? '1st' : '2nd'} Innings (${teamName})*:\n`;
        shareText += `Score: ${inn.totalRuns}/${inn.totalWickets} (${inn.totalOvers.toFixed(1)} Overs)\n\n`;

        shareText += `*Top Batsmen*:\n`;
        const topBatsmen = [...inn.battingInnings]
          .sort((a, b) => b.runs - a.runs)
          .slice(0, 2);
        topBatsmen.forEach((bat: any) => {
          shareText += `• ${bat.player.name}: ${bat.runs} runs off ${bat.balls} balls\n`;
        });

        shareText += `\n*Top Bowlers*:\n`;
        const topBowlers = [...inn.bowlingInnings]
          .sort((a, b) => b.wickets - a.wickets)
          .slice(0, 2);
        topBowlers.forEach((bowl: any) => {
          shareText += `• ${bowl.player.name}: ${bowl.wickets} wickets for ${bowl.runs} runs\n`;
        });
        shareText += `\n-----------------------\n\n`;
      });

      if (matchAwards?.mom) {
        shareText += `🌟 *Man of the Match*: ${matchAwards.mom.name}\n`;
      }

      await Share.share({
        message: shareText,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to share scorecard.');
    }
  };

  if (detailsLoading || !matchDetails) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Match Details" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Match status / Result banner */}
        {matchDetails.status === 'COMPLETED' ? (
          <Card style={styles.resultBannerCard}>
            <IconBadge
              name="trophy"
              size={16}
              color={colors.accentSecondary}
              background={colors.accentSecondarySoft}
              style={{ marginBottom: spacing.xs }}
            />
            <Text style={styles.resultWinner}>
              Winner: {
                matchDetails.winnerTeam === 'TEAM_A'
                  ? matchDetails.teamAName
                  : matchDetails.winnerTeam === 'TEAM_B'
                  ? matchDetails.teamBName
                  : 'Match Tied'
              }
            </Text>
            <Text style={styles.resultMargin}>
              {matchDetails.winnerTeam ? `won by ${matchDetails.winMargin}` : 'No result'}
            </Text>
          </Card>
        ) : (
          <Card style={{ ...styles.resultBannerCard, borderLeftColor: colors.accentDanger }}>
            <Text style={[styles.resultWinner, { color: colors.accentDanger }]}>
              {matchDetails.status === 'SETUP' || matchDetails.status === 'TOSS'
                ? 'Match Setup Phase'
                : 'Match In Progress (Live)'}
            </Text>
            <Text style={styles.resultMargin}>
              {matchDetails.status === 'TOSS'
                ? 'Coin Toss Pending'
                : matchDetails.status === 'SETUP'
                  ? 'Awaiting Toss Decision'
                  : 'Live scoring is active'}
            </Text>
          </Card>
        )}

        {/* Resume scoring action for scorers/admins */}
        {matchDetails.status !== 'COMPLETED' && isScorerOrAdmin && (
          <Button
            title={
              matchDetails.status === 'SETUP' || matchDetails.status === 'TOSS'
                ? 'Go to Coin Toss / Setup'
                : 'Resume Scoring'
            }
            variant="primary"
            onPress={() => {
              if (matchDetails.status === 'SETUP' || matchDetails.status === 'TOSS') {
                navigation.navigate('MatchTab', {
                  screen: 'Toss',
                  params: { matchId: matchDetails.id },
                });
              } else {
                const activeInning =
                  matchDetails.innings.find((i: any) => !i.isCompleted) ||
                  matchDetails.innings[0];
                navigation.navigate('MatchTab', {
                  screen: 'Scoring',
                  params: { matchId: matchDetails.id, inningsId: activeInning?.id },
                });
              }
            }}
            style={{ marginBottom: spacing.sm }}
          />
        )}

        {/* Scorecard Innings */}
        {matchDetails.innings && matchDetails.innings.length > 0 ? (
          matchDetails.innings.map((inn: any) => (
            <Card key={inn.id} style={styles.inningsDetailsCard}>
              <View style={styles.inningsHeader}>
                <Text style={styles.inningsName}>
                  {inn.inningsNumber === 1 ? '1st Innings' : '2nd Innings'} - {inn.battingTeam === 'TEAM_A' ? matchDetails.teamAName : matchDetails.teamBName}
                </Text>
                <Text style={styles.inningsTotalScore}>
                  {inn.totalRuns}/{inn.totalWickets} ({inn.totalOvers.toFixed(1)} ov)
                </Text>
              </View>

              {/* Batting score list */}
              <Text style={styles.tableSubHeader}>BATTING</Text>
              {inn.battingInnings.map((bat: any) => (
                <View key={bat.id} style={styles.battingRow}>
                  <Text style={styles.playerNameCol} numberOfLines={1}>
                    {bat.player.name} {bat.isOut ? '' : '*'}
                  </Text>
                  <Text style={styles.dismissalCol} numberOfLines={1}>
                    {bat.isOut ? (bat.dismissalType || 'out').replace('_', ' ').toLowerCase() : 'not out'}
                  </Text>
                  <Text style={styles.runsCol}>{bat.runs}</Text>
                  <Text style={styles.ballsCol}>{bat.balls}</Text>
                  <Text style={styles.srCol}>{bat.strikeRate.toFixed(0)} sr</Text>
                </View>
              ))}

              {/* Bowling score list */}
              <Text style={[styles.tableSubHeader, { marginTop: spacing.base }]}>BOWLING</Text>
              {inn.bowlingInnings.map((bowl: any) => (
                <View key={bowl.id} style={styles.bowlingRow}>
                  <Text style={styles.playerNameCol} numberOfLines={1}>
                    {bowl.player.name}
                  </Text>
                  <Text style={styles.oversCol}>{bowl.overs.toFixed(1)} ov</Text>
                  <Text style={styles.runsConcededCol}>{bowl.runs} r</Text>
                  <Text style={styles.wicketsCol}>{bowl.wickets} w</Text>
                  <Text style={styles.econCol}>{bowl.economy.toFixed(1)} econ</Text>
                </View>
              ))}
            </Card>
          ))
        ) : (
          <Card style={{ padding: spacing.xl, alignItems: 'center' }}>
            <IconBadge
              name="hourglass-outline"
              size={22}
              color={colors.textTertiary}
              background={colors.bgTertiary}
              style={{ marginBottom: spacing.sm }}
            />
            <Text style={{ fontFamily: typography.fontFamily.bold, color: colors.textPrimary }}>
              No Innings Scored Yet
            </Text>
            <Text style={{ fontFamily: typography.fontFamily.regular, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
              The match has not started playing yet.
            </Text>
          </Card>
        )}

        {/* Match Awards Section */}
        {matchAwards && (matchAwards.mom || matchAwards.topBatsman || matchAwards.topBowler) && (
          <Card style={styles.awardsCard}>
            <Text style={styles.awardsTitle}>Match Awards</Text>

            {matchAwards.mom && (
              <View style={styles.awardItem}>
                <IconBadge
                  name="medal"
                  size={16}
                  color={colors.accentSecondary}
                  background={colors.accentSecondarySoft}
                  style={styles.awardIcon}
                />
                <View style={styles.awardItemDetails}>
                  <Text style={styles.awardName}>Man of the Match</Text>
                  <Text style={styles.awardPlayerName}>{matchAwards.mom.name}</Text>
                </View>
              </View>
            )}

            {matchAwards.topBatsman && (
              <View style={styles.awardItem}>
                <IconBadge
                  name="tennisball"
                  size={16}
                  color={colors.info}
                  background={colors.infoSoft}
                  style={styles.awardIcon}
                />
                <View style={styles.awardItemDetails}>
                  <Text style={styles.awardName}>Best Batsman</Text>
                  <Text style={styles.awardPlayerName}>
                    {matchAwards.topBatsman.player.name} ({matchAwards.topBatsman.runs} runs off {matchAwards.topBatsman.balls} balls)
                  </Text>
                </View>
              </View>
            )}

            {matchAwards.topBowler && (
              <View style={styles.awardItem}>
                <IconBadge
                  name="baseball"
                  size={16}
                  color={colors.accentDanger}
                  background={colors.accentDangerSoft}
                  style={styles.awardIcon}
                />
                <View style={styles.awardItemDetails}>
                  <Text style={styles.awardName}>Best Bowler</Text>
                  <Text style={styles.awardPlayerName}>
                    {matchAwards.topBowler.player.name} ({matchAwards.topBowler.wickets} wkts, {matchAwards.topBowler.runs} runs)
                  </Text>
                </View>
              </View>
            )}
          </Card>
        )}

        <Button
          title="Share Scorecard"
          icon="share-social-outline"
          variant="primary"
          onPress={handleShareScorecard}
          style={styles.shareBtn}
        />
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
  scrollContainer: {
    padding: spacing.base,
    gap: spacing.base,
  },
  resultBannerCard: {
    backgroundColor: colors.bgSecondary,
    borderLeftWidth: 4,
    borderLeftColor: colors.accentSecondary,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  resultWinner: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  resultMargin: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accentSecondary,
    marginTop: 2,
  },
  inningsDetailsCard: {
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  inningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  inningsName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    flex: 1,
  },
  inningsTotalScore: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.accentPrimary,
  },
  tableSubHeader: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  battingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  playerNameCol: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    flex: 2,
  },
  dismissalCol: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    flex: 2.5,
  },
  runsCol: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    width: 32,
    textAlign: 'right',
  },
  ballsCol: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    width: 32,
    textAlign: 'right',
  },
  srCol: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    width: 48,
    textAlign: 'right',
  },
  bowlingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  oversCol: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    width: 48,
    textAlign: 'right',
  },
  runsConcededCol: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    width: 40,
    textAlign: 'right',
  },
  wicketsCol: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.accentPrimary,
    width: 40,
    textAlign: 'right',
  },
  econCol: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    width: 54,
    textAlign: 'right',
  },
  awardsCard: {
    padding: spacing.base,
  },
  awardsTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    marginBottom: spacing.base,
  },
  awardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  awardIcon: {
    marginRight: spacing.md,
  },
  awardItemDetails: {
    flex: 1,
  },
  awardName: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  awardPlayerName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    marginTop: 1,
  },
  shareBtn: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
});
