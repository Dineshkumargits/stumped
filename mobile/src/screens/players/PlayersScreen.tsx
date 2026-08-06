import React, { useState } from "react";
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
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { EmptyState } from "../../components/ui/EmptyState";
import { useAuthStore } from "../../stores/auth.store";
import { trpc } from "../../trpc";
import { MemberRole } from "@stumped/shared";

export const PlayersScreen = ({ navigation }: any) => {
  const activeClubId = useAuthStore((state) => state.activeClubId);

  const { data: clubs } = trpc.club.getMyClubs.useQuery();
  const myMembership = clubs?.find((c: any) => c.id === activeClubId);
  const isAdmin = myMembership?.role === MemberRole.ADMIN;

  const {
    data: players,
    isLoading,
    refetch,
  } = trpc.player.list.useQuery({ clubId: activeClubId || "" }, {
    enabled: !!activeClubId,
  } as any);

  const user = useAuthStore((state) => state.user);

  const getCategoryBadgeColor = (cat: string) => {
    switch (cat) {
      case "BATSMAN":
        return colors.info;
      case "BOWLER":
        return colors.accentDanger;
      case "ALL_ROUNDER":
        return colors.accentSecondary;
      default:
        return colors.textSecondary;
    }
  };

  const renderPlayerItem = ({ item }: any) => {
    const isMe = item.linkedUserId === user?.id;
    return (
      <TouchableOpacity
        style={styles.playerCard}
        onPress={() =>
          navigation.navigate("PlayerDetail", { playerId: item.id })
        }
      >
        <View style={styles.playerLeft}>
          <Avatar name={item.name} color={item.avatarColor} size={44} />
          <View style={styles.playerInfo}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: spacing.xs,
              }}
            >
              <Text style={styles.playerName}>{item.name}</Text>
              {isMe && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>You</Text>
                </View>
              )}
            </View>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.categoryBadge,
                  {
                    backgroundColor:
                      getCategoryBadgeColor(item.category) + "15",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    { color: getCategoryBadgeColor(item.category) },
                  ]}
                >
                  {item.category.replace("_", " ")}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.playerRight}>
          <Text style={styles.ratingLabel}>Rating</Text>
          <View style={styles.ratingRow}>
            <Icon name="star" size={13} color={colors.accentSecondary} />
            <Text style={styles.ratingValue}>
              {item.overallRating.toFixed(0)}
            </Text>
          </View>
        </View>
        <Icon
          name="chevron-forward"
          size={18}
          color={colors.textTertiary}
          style={{ marginLeft: spacing.sm } as any}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Players</Text>
            {!isLoading && !!players && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{players.length}</Text>
              </View>
            )}
          </View>
          <Text style={styles.subtitle}>Club roster and player skills</Text>
        </View>
        {isAdmin && (
          <Button
            title="Add"
            icon="person-add-outline"
            onPress={() => navigation.navigate("AddPlayer")}
            variant="primary"
            size="sm"
            style={styles.addBtn}
          />
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
        </View>
      ) : players && players.length > 0 ? (
        <FlatList
          data={players}
          keyExtractor={(item) => item.id}
          renderItem={renderPlayerItem}
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
            icon="people-outline"
            title="No Players Yet"
            description={
              isAdmin
                ? "Add players to your club so you can auto-balance teams and score turf matches."
                : "No players have been added to this club yet. Ask the club admin to add players."
            }
            action={
              isAdmin ? (
                <Button
                  title="Add First Player"
                  icon="person-add-outline"
                  onPress={() => navigation.navigate("AddPlayer")}
                  variant="primary"
                />
              ) : undefined
            }
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize["2xl"],
    color: colors.textPrimary,
  },
  countBadge: {
    backgroundColor: colors.accentPrimarySoft,
    borderRadius: borderRadius.round,
    minWidth: 24,
    height: 22,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.accentPrimary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  addBtn: {
    minWidth: 80,
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
  playerCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  playerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  playerInfo: {
    marginLeft: spacing.md,
  },
  playerName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  youBadge: {
    backgroundColor: colors.accentSecondary + "20",
    borderColor: colors.accentSecondary,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: spacing.sm,
  },
  youBadgeText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 10,
    color: colors.accentSecondary,
    textTransform: "uppercase",
  },
  badgeRow: {
    flexDirection: "row",
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
  },
  categoryText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
  },
  playerRight: {
    alignItems: "flex-end",
  },
  ratingLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingValue: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
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
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
});
