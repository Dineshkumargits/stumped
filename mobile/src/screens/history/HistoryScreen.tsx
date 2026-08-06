import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, typography, borderRadius, spacing } from "../../theme";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { useAuthStore } from "../../stores/auth.store";
import { trpc } from "../../trpc";
import { MemberRole } from "@stumped/shared";

export const HistoryScreen = ({ navigation }: any) => {
  const activeClubId = useAuthStore((state) => state.activeClubId);

  const utils = trpc.useUtils();

  const { data: clubs } = trpc.club.getMyClubs.useQuery();
  const myMembership = clubs?.find((c: any) => c.id === activeClubId);
  const isScorerOrAdmin =
    myMembership?.role === MemberRole.ADMIN ||
    myMembership?.role === MemberRole.SCORER;

  const {
    data: matches,
    isLoading,
    refetch,
  } = trpc.match.list.useQuery({ clubId: activeClubId || "" }, {
    enabled: !!activeClubId,
  } as any);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return colors.success;
      case "SETUP":
      case "TOSS":
        return colors.textSecondary;
      default:
        return colors.accentDanger; // Live status
    }
  };

  const renderMatchItem = ({ item }: any) => {
    const innings1 = item.innings.find((i: any) => i.inningsNumber === 1);
    const innings2 = item.innings.find((i: any) => i.inningsNumber === 2);

    return (
      <TouchableOpacity
        onPress={() => {
          navigation.navigate("MatchDetail", { matchId: item.id });
        }}
      >
        <Card style={styles.matchCard}>
          <View style={styles.matchHeader}>
            <View style={styles.matchDateRow}>
              <Icon name="calendar-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.matchDate}>
                {new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusBadgeColor(item.status) + "15" },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusBadgeColor(item.status) },
                ]}
              >
                {item.status.replace("_", " ")}
              </Text>
            </View>
          </View>

          <Text style={styles.teamsText}>
            {item.teamAName} vs {item.teamBName}
          </Text>

          <View style={styles.scoresContainer}>
            {innings1 && (
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>
                  {innings1.battingTeam === "TEAM_A"
                    ? item.teamAName
                    : item.teamBName}
                  :
                </Text>
                <Text style={styles.scoreValue}>
                  {innings1.totalRuns}/{innings1.totalWickets} (
                  {innings1.totalOvers.toFixed(1)} ov)
                </Text>
              </View>
            )}
            {innings2 && (
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>
                  {innings2.battingTeam === "TEAM_A"
                    ? item.teamAName
                    : item.teamBName}
                  :
                </Text>
                <Text style={styles.scoreValue}>
                  {innings2.totalRuns}/{innings2.totalWickets} (
                  {innings2.totalOvers.toFixed(1)} ov)
                </Text>
              </View>
            )}
          </View>

          {item.status === "COMPLETED" && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultText}>
                {item.winnerTeam
                  ? `🏆 Winner: ${item.winnerTeam === "TEAM_A" ? item.teamAName : item.teamBName} (${item.winMargin})`
                  : `🤝 ${item.winMargin || "Match tied"}`}
              </Text>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        icon="time-outline"
        title="Match History"
        subtitle="List of turf matches and scorecards"
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
        </View>
      ) : matches && matches.length > 0 ? (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatchItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.accentPrimary}
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="file-tray-outline"
            title="No Matches Yet"
            description="No matches have been recorded in this club. Go to the Match wizard to start scoring!"
          />
        </View>
      )}
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
    fontSize: typography.fontSize["2xl"],
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: spacing.base,
    paddingBottom: spacing.xl,
  },
  matchCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  matchDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  matchDate: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
  },
  statusText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 10,
    textTransform: "uppercase",
  },
  teamsText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  scoresContainer: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scoreLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  scoreValue: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  resultContainer: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  resultText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.accentSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing["2xl"],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
