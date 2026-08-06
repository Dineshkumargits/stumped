import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  colors,
  typography,
  borderRadius,
  spacing,
  shadows,
} from "../../theme";
import { Card } from "../../components/ui/Card";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Icon, IconBadge } from "../../components/ui/Icon";
import { Alert } from "../../components/ui/AppAlert";
import { useAuthStore } from "../../stores/auth.store";
import { trpc } from "../../trpc";
import { requestNotificationPermissions } from "../../utils/notification";
import { MemberRole } from "@stumped/shared";

export const HomeScreen = ({ navigation }: any) => {
  const user = useAuthStore((state) => state.user);
  const activeClubId = useAuthStore((state) => state.activeClubId);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  const { data: clubs, isLoading: loadingClubs } =
    trpc.club.getMyClubs.useQuery(undefined, {
      enabled: !!user,
    } as any);

  const {
    data: clubDetails,
    isLoading: loadingClubDetails,
    refetch: refetchClub,
  } = trpc.club.getDetails.useQuery({ clubId: activeClubId || "" }, {
    enabled: !!activeClubId,
  } as any);

  const activeClub =
    clubs?.find((c: any) => c.id === activeClubId) || clubDetails;

  const myMembership = clubs?.find((c: any) => c.id === activeClubId);
  const isAdmin = myMembership?.role === MemberRole.ADMIN;
  const isScorerOrAdmin =
    myMembership?.role === MemberRole.ADMIN ||
    myMembership?.role === MemberRole.SCORER;

  const {
    data: matches,
    isLoading: loadingMatches,
    refetch: refetchMatches,
  } = trpc.match.list.useQuery({ clubId: activeClubId || "" }, {
    enabled: !!activeClubId,
    // Auto-update the dashboard (e.g. reflect a match completing on another
    // device) without requiring a manual pull-to-refresh.
    refetchInterval: 10000,
  } as any);

  // Refresh immediately whenever the Home tab regains focus, so returning
  // here after finishing a match shows the up-to-date state right away.
  useFocusEffect(
    React.useCallback(() => {
      refetchMatches();
    }, [refetchMatches]),
  );

  const {
    data: players,
    isLoading: loadingPlayers,
    refetch: refetchPlayers,
  } = trpc.player.list.useQuery({ clubId: activeClubId || "" }, {
    enabled: !!activeClubId,
  } as any);

  // Find the first match that is in progress (includes SETUP/TOSS/active innings)
  const liveMatch = matches?.find(
    (m: any) =>
      m.status === "SETUP" ||
      m.status === "TOSS" ||
      m.status === "FIRST_INNINGS" ||
      m.status === "SECOND_INNINGS",
  );

  // Find active innings
  const activeInning =
    liveMatch?.innings?.find((i: any) => !i.isCompleted) ||
    liveMatch?.innings?.[0];

  const isFirstInningsCompleted =
    liveMatch &&
    liveMatch.status === "FIRST_INNINGS" &&
    liveMatch.innings?.length === 1 &&
    liveMatch.innings[0].isCompleted;

  const [startingInnings, setStartingInnings] = React.useState(false);
  const startInningsMutation = trpc.match.startInnings.useMutation();

  const handleStartSecondInnings = async () => {
    if (!liveMatch) return;
    setStartingInnings(true);
    try {
      const newInnings = await startInningsMutation.mutateAsync({
        matchId: liveMatch.id,
      });
      refetchMatches();
      navigation.navigate("MatchTab", {
        screen: "Scoring",
        params: { matchId: liveMatch.id, inningsId: newInnings.id },
      });
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not start second innings.");
    } finally {
      setStartingInnings(false);
    }
  };

  const { data: liveState, refetch: refetchLiveState } =
    trpc.scoring.getLiveState.useQuery(
      { matchId: liveMatch?.id || "", inningsId: activeInning?.id || "" },
      { enabled: !!liveMatch && !!activeInning, refetchInterval: 5000 } as any,
    );

  const leaderboardPlayers = players
    ? [...players].sort((a, b) => b.overallRating - a.overallRating).slice(0, 3)
    : [];

  const onRefresh = () => {
    refetchClub();
    refetchMatches();
    refetchPlayers();
    if (liveMatch && activeInning) {
      refetchLiveState();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={loadingClubDetails}
            onRefresh={onRefresh}
            tintColor={colors.accentPrimary}
          />
        }
      >
        {/* User Header */}
        <View style={styles.header}>
          <View style={styles.userSection}>
            <Avatar
              name={user?.name || "User"}
              color={user?.avatarColor || colors.accentPrimary}
              size={48}
            />
            <View style={styles.userInfo}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.clubSelector}
            onPress={() => navigation.navigate("ProfileTab")}
          >
            <Icon name="shield-half-outline" size={14} color={colors.accentPrimary} />
            <Text style={styles.clubSelectorText} numberOfLines={1}>
              {activeClub?.name || "Select Club"}
            </Text>
            <Icon name="chevron-down" size={13} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Live Match Card Widget */}
        <View style={styles.sectionTitleRow}>
          <View style={styles.liveDot} />
          <Text style={styles.sectionTitleText}>Live Scoreboard</Text>
        </View>
        {liveMatch ? (
          <Card style={styles.liveCard}>
            <View style={styles.liveHeader}>
              <Text style={styles.liveBadge}>
                {liveMatch.status === "TOSS"
                  ? "TOSS SETUP"
                  : isFirstInningsCompleted
                    ? "1ST INNINGS ENDED"
                    : "LIVE MATCH"}
              </Text>
              <Text style={styles.liveStatus}>
                {liveMatch.status === "TOSS"
                  ? "Coin Toss Pending"
                  : isFirstInningsCompleted
                    ? `1st Innings Ended · ${(liveMatch.innings[0].totalOvers || 0).toFixed(1)} ov`
                    : `Innings ${liveState?.innings?.inningsNumber || 1} · Over ${(liveState?.innings?.totalOvers || 0).toFixed(1)}`}
              </Text>
            </View>

            <Text style={styles.liveTeams}>
              {liveMatch.teamAName} vs {liveMatch.teamBName}
            </Text>

            {liveMatch.status === "TOSS" ? (
              <View style={styles.liveScoreRow}>
                <Text
                  style={[
                    styles.liveScore,
                    {
                      fontSize: typography.fontSize.lg,
                      paddingVertical: spacing.sm,
                    },
                  ]}
                >
                  {liveMatch.tossWinner
                    ? `Toss won by ${liveMatch.tossWinner === "TEAM_A" ? liveMatch.teamAName : liveMatch.teamBName}`
                    : "Awaiting Coin Toss Decision"}
                </Text>
                {liveMatch.tossWinner && (
                  <Text style={styles.liveTarget}>
                    Elected to {liveMatch.tossDecision}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.liveScoreRow}>
                <Text style={styles.liveScore}>
                  {isFirstInningsCompleted
                    ? `${liveMatch.innings[0].totalRuns}/${liveMatch.innings[0].totalWickets}`
                    : `${liveState?.innings?.totalRuns || 0}/${liveState?.innings?.totalWickets || 0}`}
                </Text>
                {isFirstInningsCompleted ? (
                  <Text style={styles.liveTarget}>Waiting for 2nd Innings</Text>
                ) : (
                  liveState?.target && (
                    <Text style={styles.liveTarget}>
                      Target: {liveState.target} (RRR:{" "}
                      {liveState.requiredRunRate || 0})
                    </Text>
                  )
                )}
              </View>
            )}

            {liveMatch.status !== "TOSS" && !isFirstInningsCompleted && (
              <View style={styles.liveDetailsRow}>
                <Icon name="tennisball-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.liveDetails} numberOfLines={1}>
                  {liveState?.currentBatsman?.name || "TBD"}:{" "}
                  {liveState?.currentBatsman?.runs || 0}(
                  {liveState?.currentBatsman?.balls || 0}) · bowling:{" "}
                  {liveState?.currentBowler?.name || "TBD"}
                </Text>
              </View>
            )}
            {isFirstInningsCompleted && (
              <Text style={styles.liveDetails} numberOfLines={1}>
                1st Innings completed. Ready to start 2nd Innings.
              </Text>
            )}

            {liveMatch.status === "TOSS" ? (
              isScorerOrAdmin ? (
                <TouchableOpacity
                  style={styles.watchBtn}
                  onPress={() =>
                    navigation.navigate("MatchTab", {
                      screen: "Toss",
                      params: { matchId: liveMatch.id },
                    })
                  }
                >
                  <Text style={styles.watchBtnText}>Enter Coin Toss Setup</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.watchBtn, { opacity: 0.6 }]}>
                  <Text style={styles.watchBtnText}>Waiting for Toss...</Text>
                </View>
              )
            ) : isFirstInningsCompleted ? (
              isScorerOrAdmin ? (
                <TouchableOpacity
                  style={styles.watchBtn}
                  onPress={handleStartSecondInnings}
                  disabled={startingInnings}
                >
                  <Text style={styles.watchBtnText}>
                    {startingInnings ? "Starting..." : "Start 2nd Innings"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.watchBtn, { opacity: 0.6 }]}>
                  <Text style={styles.watchBtnText}>
                    1st Innings Ended (Waiting for 2nd)
                  </Text>
                </View>
              )
            ) : isScorerOrAdmin && activeInning ? (
              <TouchableOpacity
                style={styles.watchBtn}
                onPress={() =>
                  navigation.navigate("MatchTab", {
                    screen: "Scoring",
                    params: {
                      matchId: liveMatch.id,
                      inningsId: activeInning.id,
                    },
                  })
                }
              >
                <Text style={styles.watchBtnText}>Enter Scoring Desk</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.watchBtn}
                onPress={() =>
                  navigation.navigate("MatchTab", {
                    screen: "LiveSpectator",
                    params: { matchId: liveMatch.id },
                  })
                }
              >
                <Text style={styles.watchBtnText}>Enter Spectator Room</Text>
              </TouchableOpacity>
            )}
          </Card>
        ) : (
          <Card
            style={{
              ...styles.liveCard,
              borderLeftColor: colors.border,
              alignItems: "center",
              paddingVertical: spacing.xl,
            }}
          >
            <IconBadge
              name="baseball-outline"
              size={24}
              color={colors.textTertiary}
              background={colors.bgTertiary}
              style={{ marginBottom: spacing.sm }}
            />
            <Text
              style={{
                fontFamily: typography.fontFamily.bold,
                fontSize: typography.fontSize.base,
                color: colors.textPrimary,
                marginBottom: 4,
              }}
            >
              No Active Matches
            </Text>
            <Text
              style={{
                fontFamily: typography.fontFamily.regular,
                fontSize: typography.fontSize.xs,
                color: colors.textSecondary,
                textAlign: "center",
                marginBottom: spacing.md,
              }}
            >
              Start a new turf match to track real-time scores.
            </Text>
            {isScorerOrAdmin && (
              <Button
                title="Start New Match"
                icon="add-outline"
                onPress={() =>
                  navigation.navigate("MatchTab", { screen: "NewMatch" })
                }
                variant="primary"
                size="sm"
              />
            )}
          </Card>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {isScorerOrAdmin && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.navigate("MatchTab", { screen: "NewMatch" })
              }
            >
              <IconBadge name="add-circle-outline" size={17} style={styles.actionIcon} />
              <Text style={styles.actionText}>New Match</Text>
            </TouchableOpacity>
          )}

          {isAdmin && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.navigate("PlayersTab", { screen: "AddPlayer" })
              }
            >
              <IconBadge
                name="person-add-outline"
                size={17}
                color={colors.info}
                background={colors.infoSoft}
                style={styles.actionIcon}
              />
              <Text style={styles.actionText}>Add Player</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("StatsTab")}
          >
            <IconBadge
              name="trending-up-outline"
              size={17}
              color={colors.accentSecondary}
              background={colors.accentSecondarySoft}
              style={styles.actionIcon}
            />
            <Text style={styles.actionText}>Analytics</Text>
          </TouchableOpacity>
        </View>

        {/* Club Info / Standings preview */}
        <View style={styles.sectionTitleRow}>
          <Icon name="trophy" size={16} color={colors.accentSecondary} />
          <Text style={styles.sectionTitleText}>Club Leaderboard</Text>
        </View>
        <Card style={styles.leaderboardCard}>
          {loadingPlayers ? (
            <ActivityIndicator
              size="small"
              color={colors.accentPrimary}
              style={{ margin: spacing.md }}
            />
          ) : leaderboardPlayers.length > 0 ? (
            leaderboardPlayers.map((player: any, idx: number) => (
              <React.Fragment key={player.id}>
                {idx > 0 && <View style={styles.leaderboardDivider} />}
                <View style={styles.leaderboardRow}>
                  <Text style={styles.leaderboardRank}>{idx + 1}</Text>
                  <Text style={styles.leaderboardName}>{player.name}</Text>
                  <Text style={styles.leaderboardValue}>
                    {player.overallRating.toFixed(0)} rating (
                    {player.category.replace("_", " ")})
                  </Text>
                </View>
              </React.Fragment>
            ))
          ) : (
            <Text
              style={{
                fontFamily: typography.fontFamily.regular,
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                textAlign: "center",
                margin: spacing.md,
              }}
            >
              No players in the club yet. Add players to see the leaderboard!
            </Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scrollContainer: {
    padding: spacing.base,
    paddingBottom: spacing["2xl"],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
    marginTop: spacing.xs,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  userInfo: {
    marginLeft: spacing.md,
  },
  welcomeText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  userName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  clubSelector: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    maxWidth: 170,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  clubSelectorText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitleText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accentDanger,
    ...shadows.glow(colors.accentDanger),
  },
  liveCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.accentDanger,
  },
  liveHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  liveBadge: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.accentDanger,
    backgroundColor: "rgba(255, 82, 82, 0.1)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  liveStatus: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  liveTeams: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  liveScoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.md,
  },
  liveScore: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize["4xl"],
    color: colors.accentPrimary,
  },
  liveTarget: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  liveDetails: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  liveDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  watchBtn: {
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: "center",
  },
  watchBtnText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  actionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    marginBottom: spacing.sm,
  },
  actionText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  leaderboardCard: {
    padding: spacing.md,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  leaderboardRank: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.accentSecondary,
    width: 30,
  },
  leaderboardName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    flex: 1,
  },
  leaderboardValue: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  leaderboardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
});
