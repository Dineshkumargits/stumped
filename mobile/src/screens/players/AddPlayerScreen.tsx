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
import { colors, typography, borderRadius, spacing } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Icon } from '../../components/ui/Icon';
import { Alert } from '../../components/ui/AppAlert';
import { useAuthStore } from '../../stores/auth.store';
import { trpc } from '../../trpc';

export const AddPlayerScreen = ({ navigation }: any) => {
  const activeClubId = useAuthStore((state) => state.activeClubId);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER'>('ALL_ROUNDER');
  const [loading, setLoading] = useState(false);

  const createPlayerMutation = trpc.player.create.useMutation();
  const utils = trpc.useUtils();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('HomeTab');
    }
  };

  const handleAddPlayer = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter player name.');
      return;
    }

    setLoading(true);
    try {
      await createPlayerMutation.mutateAsync({
        clubId: activeClubId || '',
        name: name.trim(),
        category,
      });

      Alert.alert('Success', 'Player added successfully!');
      utils.player.list.invalidate({ clubId: activeClubId || '' });
      handleBack();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not add player.');
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
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Icon name="arrow-back" size={15} color={colors.textPrimary} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Add Player</Text>
            <Text style={styles.subtitle}>Introduce a new player to this club</Text>
          </View>

          <View style={styles.card}>
            <Input
              label="Player Name"
              placeholder="e.g. MS Dhoni"
              value={name}
              onChangeText={setName}
              autoFocus
            />

            <Text style={styles.pickerLabel}>Player Specialty</Text>
            <View style={styles.pickerRow}>
              <TouchableOpacity
                style={[
                  styles.pickerCard,
                  category === 'BATSMAN' && styles.pickerCardActive,
                ]}
                onPress={() => setCategory('BATSMAN')}
              >
                <Icon
                  name="tennisball-outline"
                  size={24}
                  color={category === 'BATSMAN' ? colors.accentPrimary : colors.textSecondary}
                  style={styles.pickerIcon as any}
                />
                <Text style={styles.pickerTitle}>Batsman</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.pickerCard,
                  category === 'BOWLER' && styles.pickerCardActive,
                ]}
                onPress={() => setCategory('BOWLER')}
              >
                <Icon
                  name="baseball-outline"
                  size={24}
                  color={category === 'BOWLER' ? colors.accentPrimary : colors.textSecondary}
                  style={styles.pickerIcon as any}
                />
                <Text style={styles.pickerTitle}>Bowler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.pickerCard,
                  category === 'ALL_ROUNDER' && styles.pickerCardActive,
                ]}
                onPress={() => setCategory('ALL_ROUNDER')}
              >
                <Icon
                  name="star-outline"
                  size={24}
                  color={category === 'ALL_ROUNDER' ? colors.accentPrimary : colors.textSecondary}
                  style={styles.pickerIcon as any}
                />
                <Text style={styles.pickerTitle}>All Rounder</Text>
              </TouchableOpacity>
            </View>

            <Button
              title={loading ? 'Adding...' : 'Add Player'}
              icon="person-add-outline"
              onPress={handleAddPlayer}
              variant="primary"
              disabled={loading}
              style={styles.submitBtn}
            />

            <Button
              title="Cancel"
              onPress={handleBack}
              variant="ghost"
              disabled={loading}
            />
          </View>
        </ScrollView>
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
  scrollContainer: {
    padding: spacing.base,
    flexGrow: 1,
  },
  header: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs,
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
  card: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
  },
  pickerLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  pickerCard: {
    flex: 1,
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  pickerCardActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.accentPrimarySoft,
  },
  pickerIcon: {
    marginBottom: spacing.xs,
  },
  pickerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
  },
  submitBtn: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.round,
  },
  backBtnText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
});
