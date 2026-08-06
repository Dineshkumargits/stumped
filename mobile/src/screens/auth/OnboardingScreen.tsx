import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, borderRadius, spacing, shadows } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Icon, IconBadge } from '../../components/ui/Icon';
import { Alert } from '../../components/ui/AppAlert';
import { trpc } from '../../trpc';
import { useAuthStore } from '../../stores/auth.store';

export const OnboardingScreen = () => {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [clubName, setClubName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const activeClubId = useAuthStore((state) => state.activeClubId);
  const setActiveClub = useAuthStore((state) => state.setActiveClub);
  const logout = useAuthStore((state) => state.logout);

  const createClubMutation = trpc.club.create.useMutation();
  const joinClubMutation = trpc.club.join.useMutation();
  const utils = trpc.useUtils();

  const handleCreateClub = async () => {
    if (!clubName.trim()) {
      Alert.alert('Required', 'Please enter a club name.');
      return;
    }
    setLoading(true);
    try {
      const club = await createClubMutation.mutateAsync({ name: clubName.trim() });
      setActiveClub(club.id);
      Alert.alert('Success', `Club "${club.name}" created successfully! Invite code: ${club.inviteCode}`);
      utils.club.getMyClubs.invalidate();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not create club.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClub = async () => {
    if (!inviteCode.trim() || inviteCode.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-character invite code.');
      return;
    }
    setLoading(true);
    try {
      const clubMember = await joinClubMutation.mutateAsync({
        inviteCode: inviteCode.trim().toUpperCase(),
      });
      setActiveClub(clubMember.clubId);
      Alert.alert('Success', 'Joined club successfully!');
      utils.club.getMyClubs.invalidate();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not join club. Verify code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to Stumped</Text>
          <Text style={styles.subtitle}>Let's set up your turf club to get started.</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {mode === 'select' && (
            <View style={styles.selectionContainer}>
              <TouchableOpacity
                style={styles.optionCard}
                activeOpacity={0.8}
                onPress={() => setMode('create')}
              >
                <IconBadge name="add-circle" size={26} style={styles.optionIcon} />
                <Text style={styles.optionTitle}>Create a New Club</Text>
                <Text style={styles.optionDesc}>
                  Start a fresh club, add players, balance matches, and track leaderboard stats.
                </Text>
                <View style={styles.optionArrow}>
                  <Icon name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionCard}
                activeOpacity={0.8}
                onPress={() => setMode('join')}
              >
                <IconBadge
                  name="key"
                  size={26}
                  color={colors.accentSecondary}
                  background={colors.accentSecondarySoft}
                  style={styles.optionIcon}
                />
                <Text style={styles.optionTitle}>Join an Existing Club</Text>
                <Text style={styles.optionDesc}>
                  Enter a 6-digit invite code shared by your club administrator to join in.
                </Text>
                <View style={styles.optionArrow}>
                  <Icon name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'create' && (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Icon name="add-circle-outline" size={20} color={colors.accentPrimary} />
                <Text style={styles.cardTitle}>Create Club</Text>
              </View>
              <Text style={styles.cardDesc}>
                Set up a club for your weekly turf matches. You will be the administrator.
              </Text>

              <Input
                label="Club Name"
                placeholder="e.g. Wednesday Warriors"
                value={clubName}
                onChangeText={setClubName}
                autoFocus
              />

              <Button
                title={loading ? 'Creating...' : 'Create & Proceed'}
                icon="checkmark-circle-outline"
                onPress={handleCreateClub}
                variant="primary"
                disabled={loading}
                style={styles.submitBtn}
              />

              <Button
                title="Back to Options"
                icon="arrow-back-outline"
                onPress={() => setMode('select')}
                variant="ghost"
                disabled={loading}
              />
            </View>
          )}

          {mode === 'join' && (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Icon name="key-outline" size={20} color={colors.accentSecondary} />
                <Text style={styles.cardTitle}>Join Club</Text>
              </View>
              <Text style={styles.cardDesc}>
                Enter the invite code. Invite codes are 6 characters long (e.g. AX93KF).
              </Text>

              <Input
                label="Invite Code"
                placeholder="e.g. AX93KF"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
                maxLength={6}
                autoFocus
              />

              <Button
                title={loading ? 'Joining...' : 'Join & Proceed'}
                icon="enter-outline"
                onPress={handleJoinClub}
                variant="primary"
                disabled={loading}
                style={styles.submitBtn}
              />

              <Button
                title="Back to Options"
                icon="arrow-back-outline"
                onPress={() => setMode('select')}
                variant="ghost"
                disabled={loading}
              />
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Icon name="log-out-outline" size={16} color={colors.accentDanger} />
            <Text style={styles.logoutText}>Sign out of this account</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['3xl'],
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  selectionContainer: {
    gap: spacing.base,
  },
  optionCard: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  optionIcon: {
    marginBottom: spacing.md,
  },
  optionArrow: {
    position: 'absolute',
    right: spacing.base,
    top: '50%',
  },
  optionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  optionDesc: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.card,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
  },
  cardDesc: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: spacing.base,
    marginBottom: spacing.xs,
  },
  footer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  logoutBtn: {
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  logoutText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accentDanger,
  },
});
