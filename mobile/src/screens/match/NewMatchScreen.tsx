import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, borderRadius, spacing } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Icon } from '../../components/ui/Icon';
import { Alert } from '../../components/ui/AppAlert';
import { useAuthStore } from '../../stores/auth.store';
import { trpc } from '../../trpc';
import { Team } from '@stumped/shared';

interface BalancedPlayer {
  playerId: string;
  name: string;
  category: string;
  overallRating: number;
}

type TeamKey = 'teamA' | 'teamB';

export const NewMatchScreen = ({ navigation }: any) => {
  const activeClubId = useAuthStore((state) => state.activeClubId);

  const [step, setStep] = useState<1 | 2>(1);
  const [overs, setOvers] = useState('8');
  const [teamA, setTeamA] = useState('Team A');
  const [teamB, setTeamB] = useState('Team B');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [balancedTeams, setBalancedTeams] = useState<{
    teamA: BalancedPlayer[];
    teamB: BalancedPlayer[];
  } | null>(null);
  // Playing for both teams (odd player counts) — at most one player at a time.
  const [doubleSidedPlayerId, setDoubleSidedPlayerId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [reshuffling, setReshuffling] = useState(false);

  const { data: matches } = trpc.match.list.useQuery(
    { clubId: activeClubId || '' },
    { enabled: !!activeClubId } as any
  );

  React.useEffect(() => {
    if (matches) {
      const activeMatch = matches.find((m: any) => m.status !== 'COMPLETED');
      if (activeMatch) {
        Alert.alert(
          'Active Match in Progress',
          'A match is already in progress in this club. You cannot start a new match until the current one is completed.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    }
  }, [matches]);

  // All hooks must be called unconditionally (before any early return)
  const { data: players, isLoading: loadingPlayers } = trpc.player.list.useQuery(
    { clubId: activeClubId || '' },
    { enabled: !!activeClubId } as any
  );

  const playersById = useMemo(() => {
    const map: Record<string, any> = {};
    (players || []).forEach((p: any) => {
      map[p.id] = p;
    });
    return map;
  }, [players]);

  const autoBalanceMutation = trpc.match.autoBalance.useMutation();
  const createMatchMutation = trpc.match.create.useMutation();

  // Block rendering form while we have not yet confirmed there is no active match
  if (!matches) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  const togglePlayerSelect = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const allSelected = !!players && players.length > 0 && selectedPlayerIds.length === players.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedPlayerIds([]);
    } else {
      setSelectedPlayerIds((players || []).map((p: any) => p.id));
    }
  };

  const runAutoBalance = async (reshuffle: boolean) => {
    const balanced = await autoBalanceMutation.mutateAsync({
      clubId: activeClubId || '',
      playerIds: selectedPlayerIds,
      reshuffle,
    });
    setBalancedTeams({ teamA: balanced.teamA, teamB: balanced.teamB });
    setDoubleSidedPlayerId(null);
  };

  const handleNextStep = async () => {
    const o = parseInt(overs);
    if (isNaN(o) || o <= 0 || o > 50) {
      Alert.alert('Validation Error', 'Overs must be a number between 1 and 50.');
      return;
    }

    if (selectedPlayerIds.length < 4) {
      Alert.alert('Validation Error', 'Please select at least 4 players (at least 2 per team).');
      return;
    }

    setLoading(true);
    try {
      await runAutoBalance(false);
      setStep(2);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not balance teams.');
    } finally {
      setLoading(false);
    }
  };

  const handleReshuffle = async () => {
    setReshuffling(true);
    try {
      await runAutoBalance(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not reshuffle teams.');
    } finally {
      setReshuffling(false);
    }
  };

  const movePlayer = (playerId: string, fromTeam: TeamKey) => {
    setBalancedTeams((prev) => {
      if (!prev) return prev;
      const toTeam: TeamKey = fromTeam === 'teamA' ? 'teamB' : 'teamA';
      const player = prev[fromTeam].find((p) => p.playerId === playerId);
      if (!player) return prev;

      const next = {
        ...prev,
        [fromTeam]: prev[fromTeam].filter((p) => p.playerId !== playerId),
        [toTeam]: [...prev[toTeam], player],
      };
      if (next.teamA.length === next.teamB.length) {
        setDoubleSidedPlayerId(null);
      }
      return next;
    });
  };

  const toggleDoubleSided = (playerId: string) => {
    setDoubleSidedPlayerId((prev) => (prev === playerId ? null : playerId));
  };

  const handleCreateMatch = async () => {
    if (!balancedTeams) return;

    if (balancedTeams.teamA.length < 2 || balancedTeams.teamB.length < 2) {
      Alert.alert('Validation Error', 'Both teams must have at least 2 players.');
      return;
    }

    setLoading(true);
    try {
      const matchPlayers = [
        ...balancedTeams.teamA.map((p) => ({
          playerId: p.playerId,
          team: Team.TEAM_A,
          isDoubleSided: p.playerId === doubleSidedPlayerId,
        })),
        ...balancedTeams.teamB.map((p) => ({
          playerId: p.playerId,
          team: Team.TEAM_B,
          isDoubleSided: p.playerId === doubleSidedPlayerId,
        })),
      ];

      const match = await createMatchMutation.mutateAsync({
        clubId: activeClubId || '',
        totalOvers: parseInt(overs),
        teamAName: teamA.trim() || 'Team A',
        teamBName: teamB.trim() || 'Team B',
        players: matchPlayers,
      });

      Alert.alert('Success', 'Match created successfully!');
      // Navigate to Toss Screen
      navigation.navigate('Toss', { matchId: match.id });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not create match.');
    } finally {
      setLoading(false);
    }
  };

  const isUneven = !!balancedTeams && balancedTeams.teamA.length !== balancedTeams.teamB.length;
  const teamATotal = balancedTeams?.teamA.reduce((sum, p) => sum + p.overallRating, 0) ?? 0;
  const teamBTotal = balancedTeams?.teamB.reduce((sum, p) => sum + p.overallRating, 0) ?? 0;

  const renderRoster = (teamKey: TeamKey) => {
    if (!balancedTeams) return null;
    const homePlayers = balancedTeams[teamKey];
    const otherKey: TeamKey = teamKey === 'teamA' ? 'teamB' : 'teamA';
    const guest =
      doubleSidedPlayerId &&
      balancedTeams[otherKey].find((p) => p.playerId === doubleSidedPlayerId);

    return (
      <>
        {homePlayers.map((p) => {
          const isDoubleSided = p.playerId === doubleSidedPlayerId;
          return (
            <View key={p.playerId} style={styles.rosterRow}>
              <Avatar
                name={p.name}
                color={playersById[p.playerId]?.avatarColor || colors.accentPrimary}
                size={30}
              />
              <Text style={styles.rosterName} numberOfLines={1}>
                {p.name}
              </Text>
              {isDoubleSided && (
                <View style={styles.bothTeamsBadge}>
                  <Icon name="people" size={11} color={colors.accentSecondary} />
                  <Text style={styles.bothTeamsBadgeText}>Both</Text>
                </View>
              )}
              <View style={styles.rosterActions}>
                {isUneven && (
                  <TouchableOpacity
                    onPress={() => toggleDoubleSided(p.playerId)}
                    style={[
                      styles.rosterActionBtn,
                      isDoubleSided && styles.rosterActionBtnActive,
                    ]}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Icon
                      name="people-outline"
                      size={14}
                      color={isDoubleSided ? colors.accentSecondary : colors.textTertiary}
                    />
                  </TouchableOpacity>
                )}
                {!isDoubleSided && (
                  <TouchableOpacity
                    onPress={() => movePlayer(p.playerId, teamKey)}
                    style={styles.rosterActionBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Icon name="swap-horizontal" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {guest && (
          <View style={[styles.rosterRow, styles.rosterRowGuest]}>
            <Avatar
              name={guest.name}
              color={playersById[guest.playerId]?.avatarColor || colors.accentSecondary}
              size={30}
            />
            <Text style={styles.rosterName} numberOfLines={1}>
              {guest.name}
            </Text>
            <View style={styles.bothTeamsBadge}>
              <Icon name="people" size={11} color={colors.accentSecondary} />
              <Text style={styles.bothTeamsBadgeText}>Guest</Text>
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {navigation.canGoBack?.() && (
            <TouchableOpacity onPress={navigation.goBack} style={styles.backBtn}>
              <Icon name="chevron-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>New Match Wizard</Text>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Step {step}/2</Text>
          </View>
        </View>
        <View style={styles.stepTrack}>
          <View style={[styles.stepFill, { width: step === 1 ? '50%' : '100%' }]} />
        </View>
      </View>

      {step === 1 ? (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Card style={styles.settingsCard}>
              <Text style={styles.cardTitle}>Match Settings</Text>

              <Input
                label="Overs Per Innings"
                placeholder="e.g. 8"
                keyboardType="numeric"
                value={overs}
                onChangeText={setOvers}
              />

              <Input
                label="Team A Name"
                placeholder="Team A"
                value={teamA}
                onChangeText={setTeamA}
              />

              <Input
                label="Team B Name"
                placeholder="Team B"
                value={teamB}
                onChangeText={setTeamB}
              />
            </Card>

            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>
                Select Players ({selectedPlayerIds.length} selected)
              </Text>
              {!loadingPlayers && !!players && players.length > 0 && (
                <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn}>
                  <Icon
                    name={allSelected ? 'checkbox' : 'square-outline'}
                    size={15}
                    color={colors.accentPrimary}
                  />
                  <Text style={styles.selectAllBtnText}>
                    {allSelected ? 'Clear All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingPlayers ? (
              <ActivityIndicator size="large" color={colors.accentPrimary} style={{ margin: 20 }} />
            ) : players && players.length > 0 ? (
              <View style={styles.playerList}>
                {players.map((p: any) => {
                  const isSelected = selectedPlayerIds.includes(p.id);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.playerSelectItem,
                        isSelected && styles.playerSelectItemActive,
                      ]}
                      onPress={() => togglePlayerSelect(p.id)}
                    >
                      <Avatar name={p.name} color={p.avatarColor} size={36} />
                      <Text style={styles.playerName}>{p.name}</Text>
                      <View style={styles.playerRatingWrap}>
                        <Icon name="star" size={12} color={colors.accentSecondary} />
                        <Text style={styles.playerRating}>{p.overallRating.toFixed(0)}</Text>
                      </View>
                      <Icon
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={isSelected ? colors.accentPrimary : colors.textTertiary}
                        style={{ marginLeft: spacing.md } as any}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.noPlayersText}>No players available. Add players first!</Text>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title={loading ? 'Balancing Teams...' : 'Auto-Balance & Continue'}
              icon="shuffle-outline"
              onPress={handleNextStep}
              variant="primary"
              disabled={loading}
            />
          </View>
        </View>
      ) : (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Serpentine Balanced Teams</Text>
              <TouchableOpacity
                onPress={handleReshuffle}
                disabled={reshuffling}
                style={styles.reshuffleBtn}
              >
                {reshuffling ? (
                  <ActivityIndicator size="small" color={colors.accentPrimary} />
                ) : (
                  <Icon name="shuffle" size={15} color={colors.accentPrimary} />
                )}
                <Text style={styles.reshuffleBtnText}>Reshuffle</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.teamsDesc}>
              Tap the swap icon to move a player between teams.
            </Text>

            {isUneven && (
              <View style={styles.unevenHint}>
                <Icon name="information-circle-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.unevenHintText}>
                  Uneven squad size — move a player across, or tap the people icon on one
                  player to have them play for both teams.
                </Text>
              </View>
            )}

            <View style={styles.teamsSplit}>
              {/* Team A */}
              <Card style={styles.teamCol}>
                <View style={styles.teamColHeader}>
                  <Text style={[styles.teamColTitle, { color: colors.info }]} numberOfLines={1}>
                    {teamA}
                  </Text>
                  <View style={styles.teamColRatingWrap}>
                    <Icon name="star" size={11} color={colors.accentSecondary} />
                    <Text style={styles.teamColRating}>{teamATotal.toFixed(0)}</Text>
                  </View>
                </View>
                <View style={styles.teamRoster}>{renderRoster('teamA')}</View>
              </Card>

              {/* Team B */}
              <Card style={styles.teamCol}>
                <View style={styles.teamColHeader}>
                  <Text style={[styles.teamColTitle, { color: colors.accentDanger }]} numberOfLines={1}>
                    {teamB}
                  </Text>
                  <View style={styles.teamColRatingWrap}>
                    <Icon name="star" size={11} color={colors.accentSecondary} />
                    <Text style={styles.teamColRating}>{teamBTotal.toFixed(0)}</Text>
                  </View>
                </View>
                <View style={styles.teamRoster}>{renderRoster('teamB')}</View>
              </Card>
            </View>

            <Button
              title="Edit Player Selection"
              icon="repeat-outline"
              onPress={() => setStep(1)}
              variant="ghost"
              disabled={loading}
              style={{ marginTop: spacing.md }}
            />
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title={loading ? 'Creating Match...' : 'Confirm & Go to Toss'}
              icon="checkmark-done-outline"
              onPress={handleCreateMatch}
              variant="primary"
              disabled={loading}
            />
          </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary,
    flex: 1,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.round,
    backgroundColor: colors.bgTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  stepBadge: {
    backgroundColor: colors.accentPrimarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  stepBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.accentPrimary,
    letterSpacing: 0.5,
  },
  stepTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgTertiary,
    overflow: 'hidden',
  },
  stepFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.accentPrimary,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 80,
  },
  settingsCard: {
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  cardTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reshuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentPrimarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  reshuffleBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.accentPrimary,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  selectAllBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.accentPrimary,
  },
  playerList: {
    gap: spacing.sm,
  },
  playerSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  playerSelectItemActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: 'rgba(0, 200, 83, 0.05)',
  },
  playerName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginLeft: spacing.md,
    flex: 1,
  },
  playerRatingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSecondarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
  },
  playerRating: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.accentSecondary,
  },
  noPlayersText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.xl,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.base,
  },
  teamsDesc: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.base,
  },
  unevenHint: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.accentSecondarySoft,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  unevenHintText: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  teamsSplit: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  teamCol: {
    flex: 1,
    padding: spacing.md,
  },
  teamColHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 2,
  },
  teamColTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    textAlign: 'center',
  },
  teamColRatingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  teamColRating: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  teamRoster: {
    gap: spacing.sm,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgTertiary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  rosterRowGuest: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accentSecondary,
    backgroundColor: colors.accentSecondarySoft,
  },
  rosterName: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  bothTeamsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.accentSecondarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
  },
  bothTeamsBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 9,
    color: colors.accentSecondary,
    textTransform: 'uppercase',
  },
  rosterActions: {
    flexDirection: 'row',
    gap: 4,
  },
  rosterActionBtn: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.round,
    backgroundColor: colors.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rosterActionBtnActive: {
    backgroundColor: colors.accentSecondarySoft,
  },
});
