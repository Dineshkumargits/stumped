import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, typography, borderRadius, spacing } from "../../theme";
import { Card } from "../../components/ui/Card";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Icon } from "../../components/ui/Icon";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Alert } from "../../components/ui/AppAlert";
import { useAuthStore } from "../../stores/auth.store";
import { trpc } from "../../trpc";
import { MemberRole } from "@stumped/shared";

export const ProfileScreen = () => {
  const user = useAuthStore((state) => state.user);
  const activeClubId = useAuthStore((state) => state.activeClubId);
  const setActiveClub = useAuthStore((state) => state.setActiveClub);
  const logout = useAuthStore((state) => state.logout);

  const [regenerating, setRegenerating] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [submittingClub, setSubmittingClub] = useState(false);

  const createClubMutation = trpc.club.create.useMutation();
  const joinClubMutation = trpc.club.join.useMutation();

  const { data: clubs, isLoading: loadingClubs } =
    trpc.club.getMyClubs.useQuery();
  const {
    data: clubDetails,
    isLoading: loadingDetails,
    refetch: refetchClub,
  } = trpc.club.getDetails.useQuery({ clubId: activeClubId || "" }, {
    enabled: !!activeClubId,
  } as any);

  const {
    data: linkedPlayer,
    isLoading: loadingLinkedPlayer,
    refetch: refetchLinkedPlayer,
  } = trpc.player.getLinkedPlayer.useQuery({ clubId: activeClubId || "" }, {
    enabled: !!activeClubId,
  } as any);

  const { data: players } = trpc.player.list.useQuery(
    { clubId: activeClubId || "" },
    { enabled: !!activeClubId } as any,
  );

  const linkToUserMutation = trpc.player.linkToUser.useMutation();

  const unlinkedPlayers = players?.filter((p: any) => !p.linkedUserId);

  const myMembership = clubs?.find((c: any) => c.id === activeClubId);
  const isAdmin = myMembership?.role === MemberRole.ADMIN;

  const regenerateInviteMutation = trpc.club.regenerateInviteCode.useMutation();
  const updateRoleMutation = trpc.club.updateMemberRole.useMutation();
  const utils = trpc.useUtils();

  const handleCreateClub = async () => {
    if (!newClubName.trim()) {
      Alert.alert("Required", "Please enter a club name.");
      return;
    }
    setSubmittingClub(true);
    try {
      const club = await createClubMutation.mutateAsync({
        name: newClubName.trim(),
      });
      setActiveClub(club.id);
      Alert.alert(
        "Success",
        `Club "${club.name}" created successfully! Invite code: ${club.inviteCode}`,
      );
      setNewClubName("");
      setCreateModalVisible(false);
      utils.club.getMyClubs.invalidate();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Could not create club.");
    } finally {
      setSubmittingClub(false);
    }
  };

  const handleJoinClub = async () => {
    if (!joinInviteCode.trim() || joinInviteCode.trim().length !== 6) {
      Alert.alert(
        "Invalid Code",
        "Please enter a valid 6-character invite code.",
      );
      return;
    }
    setSubmittingClub(true);
    try {
      const clubMember = await joinClubMutation.mutateAsync({
        inviteCode: joinInviteCode.trim().toUpperCase(),
      });
      setActiveClub(clubMember.clubId);
      Alert.alert("Success", "Joined club successfully!");
      setJoinInviteCode("");
      setJoinModalVisible(false);
      utils.club.getMyClubs.invalidate();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.message || "Could not join club. Verify code.",
      );
    } finally {
      setSubmittingClub(false);
    }
  };

  const handleLinkPlayer = async (playerId: string) => {
    try {
      await linkToUserMutation.mutateAsync({
        clubId: activeClubId || "",
        playerId,
      });
      Alert.alert("Success", "Profile linked successfully!");
      refetchLinkedPlayer();
      refetchClub();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not link profile.");
    }
  };

  const handleUnlinkPlayer = () => {
    Alert.alert(
      "Unlink Profile",
      "Are you sure you want to unlink your user account from this player profile? Your statistics will no longer show on this page.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            try {
              await linkToUserMutation.mutateAsync({
                clubId: activeClubId || "",
                playerId: null,
              });
              Alert.alert("Success", "Profile unlinked successfully!");
              refetchLinkedPlayer();
              refetchClub();
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Could not unlink profile.");
            }
          },
        },
      ],
    );
  };

  const handleShareInviteCode = async () => {
    if (!clubDetails?.inviteCode) return;
    try {
      await Share.share({
        message: `Join my Cricket Club "${clubDetails.name}" on Stumped!\nUse Invite Code: ${clubDetails.inviteCode}`,
      });
    } catch (err: any) {
      Alert.alert("Share Failed", err.message);
    }
  };

  const handleRegenerateInvite = () => {
    Alert.alert(
      "Regenerate Invite Code",
      "Are you sure you want to regenerate the invite code? The old code will stop working immediately.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: async () => {
            setRegenerating(true);
            try {
              const code = await regenerateInviteMutation.mutateAsync({
                clubId: activeClubId || "",
              });
              Alert.alert("Success", `New invite code generated: ${code}`);
              refetchClub();
            } catch (error: any) {
              Alert.alert(
                "Failed",
                error?.message || "Could not regenerate invite code.",
              );
            } finally {
              setRegenerating(false);
            }
          },
        },
      ],
    );
  };

  const [selectedMember, setSelectedMember] = useState<any>(null);
  const removeMemberMutation = trpc.club.removeMember.useMutation();

  const handleManageMember = (member: any) => {
    setSelectedMember(member);
  };

  const handleUpdateRole = async (member: any, nextRole: MemberRole) => {
    try {
      await updateRoleMutation.mutateAsync({
        clubId: activeClubId || "",
        userId: member.userId,
        role: nextRole,
      });
      Alert.alert("Success", `Role updated to ${nextRole}.`);
      refetchClub();
      setSelectedMember((prev: any) =>
        prev ? { ...prev, role: nextRole } : null,
      );
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not update role.");
    }
  };

  const handleRemoveMember = (member: any) => {
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${member.name} from the club? This will unlink their user profile, but their match history will be preserved.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeMemberMutation.mutateAsync({
                clubId: activeClubId || "",
                userId: member.userId,
              });
              Alert.alert("Success", `${member.name} removed from club.`);
              setSelectedMember(null);
              refetchClub();
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Could not remove member.");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        icon="person-circle-outline"
        title="Profile"
        subtitle="Account, clubs, and player linking"
      />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* User Card */}
        <Card style={styles.userCard}>
          <Avatar
            name={user?.name || "User"}
            color={user?.avatarColor || colors.accentPrimary}
            size={64}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </Card>

        {/* Linked Player / Stats Section */}
        {activeClubId && (
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Player Profile & Statistics</Text>
            {loadingLinkedPlayer ? (
              <ActivityIndicator
                size="small"
                color={colors.accentPrimary}
                style={{ marginVertical: spacing.md }}
              />
            ) : linkedPlayer ? (
              <Card style={styles.playerStatsCard}>
                <View style={styles.statsHeader}>
                  <Avatar
                    name={linkedPlayer.name}
                    color={linkedPlayer.avatarColor}
                    size={48}
                  />
                  <View style={styles.statsHeaderInfo}>
                    <Text style={styles.statsPlayerName}>
                      {linkedPlayer.name}
                    </Text>
                    <Text style={styles.statsPlayerCat}>
                      {linkedPlayer.category.replace("_", " ")}
                    </Text>
                  </View>
                  <View style={styles.statsRatingCol}>
                    <Text style={styles.statsRatingLabel}>Rating</Text>
                    <Text style={styles.statsRatingVal}>
                      {linkedPlayer.overallRating.toFixed(0)}
                    </Text>
                  </View>
                </View>

                {/* Rating bars */}
                <View style={styles.ratingBarContainer}>
                  <View style={styles.ratingRow}>
                    <Text style={styles.barLabel}>Batting</Text>
                    <View style={styles.barBg}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${linkedPlayer.battingRating}%`,
                            backgroundColor: colors.info,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barVal}>
                      {linkedPlayer.battingRating.toFixed(0)}
                    </Text>
                  </View>
                  <View style={styles.ratingRow}>
                    <Text style={styles.barLabel}>Bowling</Text>
                    <View style={styles.barBg}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${linkedPlayer.bowlingRating}%`,
                            backgroundColor: colors.accentDanger,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barVal}>
                      {linkedPlayer.bowlingRating.toFixed(0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsDivider} />

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.gridCell}>
                    <Text style={styles.cellLabel}>Matches</Text>
                    <Text style={styles.cellValue}>
                      {linkedPlayer.career.matchesPlayed}
                    </Text>
                  </View>
                  <View style={styles.gridCell}>
                    <Text style={styles.cellLabel}>Runs</Text>
                    <Text style={styles.cellValue}>
                      {linkedPlayer.career.totalRuns}
                    </Text>
                  </View>
                  <View style={styles.gridCell}>
                    <Text style={styles.cellLabel}>Batting Avg</Text>
                    <Text style={styles.cellValue}>
                      {linkedPlayer.career.battingAverage || "-"}
                    </Text>
                  </View>
                  <View style={styles.gridCell}>
                    <Text style={styles.cellLabel}>Strike Rate</Text>
                    <Text style={styles.cellValue}>
                      {linkedPlayer.career.strikeRate || "-"}
                    </Text>
                  </View>
                  <View style={styles.gridCell}>
                    <Text style={styles.cellLabel}>Highest Score</Text>
                    <Text style={styles.cellValue}>
                      {linkedPlayer.career.highestScore}
                    </Text>
                  </View>
                  <View style={styles.gridCell}>
                    <Text style={styles.cellLabel}>Wickets</Text>
                    <Text style={styles.cellValue}>
                      {linkedPlayer.career.totalWickets}
                    </Text>
                  </View>
                  <View style={styles.gridCell}>
                    <Text style={styles.cellLabel}>Economy</Text>
                    <Text style={styles.cellValue}>
                      {linkedPlayer.career.economy || "-"}
                    </Text>
                  </View>
                  <View style={styles.gridCell}>
                    <Text style={styles.cellLabel}>Bowling Avg</Text>
                    <Text style={styles.cellValue}>
                      {linkedPlayer.career.bowlingAverage || "-"}
                    </Text>
                  </View>
                </View>

                <Button
                  title="Unlink Player Profile"
                  onPress={handleUnlinkPlayer}
                  variant="ghost"
                  style={styles.unlinkBtn}
                  textStyle={{ color: colors.accentDanger }}
                />
              </Card>
            ) : (
              <Card style={styles.linkPromptCard}>
                <Text style={styles.linkPromptText}>
                  Your user profile is not linked to any player record in this
                  club. Link your profile to view your stats here and show as
                  "(You)" in the roster.
                </Text>
                <Button
                  title="Link Player Profile"
                  onPress={() => setLinkModalVisible(true)}
                  variant="primary"
                  fullWidth
                />
              </Card>
            )}
          </View>
        )}

        {/* My Clubs Swapper */}
        <Text style={styles.sectionTitle}>My Clubs</Text>
        {loadingClubs ? (
          <ActivityIndicator size="small" color={colors.accentPrimary} />
        ) : (
          <View style={styles.clubsList}>
            {clubs?.map((c: any) => {
              const isActive = c.id === activeClubId;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.clubTab, isActive && styles.clubTabActive]}
                  onPress={() => setActiveClub(c.id)}
                >
                  <View style={styles.clubTabTitleRow}>
                    <Text
                      style={[
                        styles.clubTabText,
                        isActive && styles.clubTabTextActive,
                      ]}
                    >
                      {c.name}
                    </Text>
                    {isActive && (
                      <Icon name="checkmark-circle" size={14} color={colors.accentPrimary} />
                    )}
                  </View>
                  <Text style={styles.clubTabSub}>{c.role}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.clubActionTab}
              onPress={() => setJoinModalVisible(true)}
            >
              <Icon name="enter-outline" size={15} color={colors.accentPrimary} />
              <Text style={styles.clubActionTabText}>Join Club</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.clubActionTab}
              onPress={() => setCreateModalVisible(true)}
            >
              <Icon name="add-outline" size={15} color={colors.accentPrimary} />
              <Text style={styles.clubActionTabText}>Create Club</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Selected Club details */}
        {activeClubId && clubDetails && (
          <View style={styles.clubDetailsSection}>
            <Text style={styles.sectionTitle}>
              Club Settings: {clubDetails.name}
            </Text>

            <Card style={styles.inviteCard}>
              <Text style={styles.inviteLabel}>Invite Members Code</Text>
              <Text style={styles.inviteCode}>{clubDetails.inviteCode}</Text>
              <View style={styles.inviteBtnRow}>
                <Button
                  title="Share Code"
                  icon="share-social-outline"
                  onPress={handleShareInviteCode}
                  variant="primary"
                  style={{ flex: 1 }}
                />
                {isAdmin && (
                  <Button
                    title={regenerating ? "Wait..." : "Regenerate"}
                    onPress={handleRegenerateInvite}
                    variant="ghost"
                    disabled={regenerating}
                  />
                )}
              </View>
            </Card>

            {/* Members List */}
            <Text style={styles.sectionTitle}>
              Club Members ({clubDetails.memberCount})
            </Text>
            <Card style={styles.membersCard}>
              {clubDetails.members.map((member: any, idx: number) => (
                <View key={member.id}>
                  <View style={styles.memberRow}>
                    <Avatar
                      name={member.name}
                      color={member.avatarColor}
                      size={32}
                    />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberRole}>{member.role}</Text>
                    </View>
                    {isAdmin && member.userId !== user?.id && (
                      <TouchableOpacity
                        style={styles.promoteBtn}
                        onPress={() => handleManageMember(member)}
                      >
                        <Text style={styles.promoteBtnText}>Manage</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {idx < clubDetails.members.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </View>
              ))}
            </Card>
          </View>
        )}

        <Button
          title="Logout"
          icon="log-out-outline"
          onPress={logout}
          variant="danger"
          style={styles.logoutBtn}
        />
      </ScrollView>

      {/* Member Management Modal */}
      <Modal
        visible={!!selectedMember}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedMember(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedMember(null)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Member</Text>
              <TouchableOpacity onPress={() => setSelectedMember(null)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <View style={{ flexShrink: 1 }}>
                {/* Member detail card */}
                <View style={styles.memberDetailCard}>
                  <Avatar
                    name={selectedMember.name}
                    color={selectedMember.avatarColor}
                    size={48}
                  />
                  <View style={styles.memberDetailText}>
                    <Text style={styles.memberDetailName}>
                      {selectedMember.name}
                    </Text>
                    <Text style={styles.memberDetailRole}>
                      Current Role: {selectedMember.role}
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Assign Role</Text>

                <View style={styles.roleOptionList}>
                  {/* ADMIN */}
                  <TouchableOpacity
                    style={[
                      styles.roleOptionCard,
                      selectedMember.role === MemberRole.ADMIN &&
                        styles.roleOptionCardActive,
                    ]}
                    onPress={() =>
                      handleUpdateRole(selectedMember, MemberRole.ADMIN)
                    }
                  >
                    <View style={styles.roleOptionInfo}>
                      <Text style={styles.roleOptionTitle}>Admin</Text>
                      <Text style={styles.roleOptionDesc}>
                        Full access to settings, invite codes, and roster
                        management.
                      </Text>
                    </View>
                    {selectedMember.role === MemberRole.ADMIN && (
                      <Text style={styles.roleActiveCheck}>✓</Text>
                    )}
                  </TouchableOpacity>

                  {/* SCORER */}
                  <TouchableOpacity
                    style={[
                      styles.roleOptionCard,
                      selectedMember.role === MemberRole.SCORER &&
                        styles.roleOptionCardActive,
                    ]}
                    onPress={() =>
                      handleUpdateRole(selectedMember, MemberRole.SCORER)
                    }
                  >
                    <View style={styles.roleOptionInfo}>
                      <Text style={styles.roleOptionTitle}>
                        Scorer / Umpire
                      </Text>
                      <Text style={styles.roleOptionDesc}>
                        Authorized to start matches, select players, and record
                        live ball events.
                      </Text>
                    </View>
                    {selectedMember.role === MemberRole.SCORER && (
                      <Text style={styles.roleActiveCheck}>✓</Text>
                    )}
                  </TouchableOpacity>

                  {/* PLAYER */}
                  <TouchableOpacity
                    style={[
                      styles.roleOptionCard,
                      selectedMember.role === MemberRole.PLAYER &&
                        styles.roleOptionCardActive,
                    ]}
                    onPress={() =>
                      handleUpdateRole(selectedMember, MemberRole.PLAYER)
                    }
                  >
                    <View style={styles.roleOptionInfo}>
                      <Text style={styles.roleOptionTitle}>Player</Text>
                      <Text style={styles.roleOptionDesc}>
                        Spectator access to live scores, career stats, and match
                        summaries.
                      </Text>
                    </View>
                    {selectedMember.role === MemberRole.PLAYER && (
                      <Text style={styles.roleActiveCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Remove member button */}
                <Button
                  title="Remove from Club"
                  onPress={() => handleRemoveMember(selectedMember)}
                  variant="danger"
                  style={styles.kickBtn}
                />
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Link Profile Modal */}
      <Modal
        visible={linkModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLinkModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setLinkModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Link Player Profile</Text>
              <TouchableOpacity onPress={() => setLinkModalVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select your player name from the list below to link your user
              account:
            </Text>

            <ScrollView
              contentContainerStyle={{ paddingBottom: spacing.lg }}
              style={{ maxHeight: 300 }}
            >
              {unlinkedPlayers && unlinkedPlayers.length > 0 ? (
                unlinkedPlayers.map((player: any) => (
                  <TouchableOpacity
                    key={player.id}
                    style={styles.linkPlayerRow}
                    onPress={() => {
                      setLinkModalVisible(false);
                      handleLinkPlayer(player.id);
                    }}
                  >
                    <Avatar
                      name={player.name}
                      color={player.avatarColor}
                      size={36}
                    />
                    <View style={styles.linkPlayerInfo}>
                      <Text style={styles.linkPlayerName}>{player.name}</Text>
                      <Text style={styles.linkPlayerCat}>
                        {player.category.replace("_", " ")}
                      </Text>
                    </View>
                    <Text style={styles.linkPlayerRating}>
                      ★ {player.overallRating.toFixed(0)}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyLinkContainer}>
                  <Text style={styles.emptyLinkText}>
                    No unlinked player profiles found in this club.
                  </Text>
                  <Text style={styles.emptyLinkSubtext}>
                    Ask the club admin to create a player profile for you in the
                    "Players" tab first.
                  </Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Join Club Modal */}
      <Modal
        visible={joinModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setJoinModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join a Club</Text>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter a 6-character invite code shared by the club admin:
            </Text>

            <Input
              placeholder="E.g. AB12CD"
              value={joinInviteCode}
              onChangeText={setJoinInviteCode}
              autoCapitalize="characters"
              maxLength={6}
              editable={!submittingClub}
            />

            <Button
              title={submittingClub ? "Joining..." : "Join Club"}
              onPress={handleJoinClub}
              variant="primary"
              disabled={submittingClub}
              style={{ marginTop: spacing.md }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Create Club Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCreateModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create a New Club</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter the name of your new cricket club:
            </Text>

            <Input
              placeholder="E.g. Sunday Warriors"
              value={newClubName}
              onChangeText={setNewClubName}
              editable={!submittingClub}
            />

            <Button
              title={submittingClub ? "Creating..." : "Create Club"}
              onPress={handleCreateClub}
              variant="primary"
              disabled={submittingClub}
              style={{ marginTop: spacing.md }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    marginBottom: spacing.base,
  },
  userInfo: {
    marginLeft: spacing.lg,
  },
  userName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  userEmail: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  clubsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  clubTab: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minWidth: 120,
  },
  clubTabActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: "rgba(0, 200, 83, 0.05)",
  },
  clubTabTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  clubTabText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  clubTabTextActive: {
    color: colors.accentPrimary,
  },
  clubTabSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: "uppercase",
  },
  clubDetailsSection: {
    gap: spacing.xs,
  },
  inviteCard: {
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  inviteLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  inviteCode: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 32,
    color: colors.accentSecondary,
    marginVertical: spacing.sm,
    letterSpacing: 2,
  },
  inviteBtnRow: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  membersCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  memberInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  memberName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  memberRole: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  promoteBtn: {
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  promoteBtnText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  logoutBtn: {
    marginTop: spacing.xl,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.xl,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  closeBtnText: {
    fontSize: 24,
    color: colors.textSecondary,
    padding: spacing.xs,
  },
  memberDetailCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgPrimary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberDetailText: {
    marginLeft: spacing.base,
    flex: 1,
  },
  memberDetailName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  memberDetailRole: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginTop: 2,
  },
  roleOptionList: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  roleOptionCard: {
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roleOptionCardActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: "rgba(0, 200, 83, 0.03)",
  },
  roleOptionInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  roleOptionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  roleOptionDesc: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 14,
  },
  roleActiveCheck: {
    fontSize: 18,
    color: colors.accentPrimary,
  },
  kickBtn: {
    marginBottom: spacing.sm,
  },
  statsSection: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  playerStatsCard: {
    padding: spacing.lg,
    backgroundColor: colors.bgSecondary,
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  statsHeaderInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  statsPlayerName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  statsPlayerCat: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsRatingCol: {
    alignItems: "center",
  },
  statsRatingLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 9,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  statsRatingVal: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.accentSecondary,
  },
  ratingBarContainer: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  barLabel: {
    width: 60,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  barBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bgTertiary,
    borderRadius: borderRadius.round,
    marginHorizontal: spacing.sm,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: borderRadius.round,
  },
  barVal: {
    width: 24,
    textAlign: "right",
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
  },
  statsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  gridCell: {
    width: "45%",
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  cellLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  cellValue: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  unlinkBtn: {
    marginTop: spacing.sm,
  },
  linkPromptCard: {
    padding: spacing.lg,
    alignItems: "center",
    backgroundColor: colors.bgSecondary,
  },
  linkPromptText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  modalSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  linkPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkPlayerInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  linkPlayerName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  linkPlayerCat: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  linkPlayerRating: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.accentSecondary,
  },
  emptyLinkContainer: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyLinkText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyLinkSubtext: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 16,
  },
  clubActionTab: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minWidth: 120,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  clubActionTabText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.accentPrimary,
  },
});
