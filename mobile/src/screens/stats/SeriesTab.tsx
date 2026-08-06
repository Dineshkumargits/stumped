import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { colors, typography, borderRadius, spacing } from '../../theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Icon } from '../../components/ui/Icon';
import { EmptyState } from '../../components/ui/EmptyState';
import { trpc } from '../../trpc';
import { MemberRole } from '@stumped/shared';

interface SeriesTabProps {
  clubId: string;
}

export const SeriesTab: React.FC<SeriesTabProps> = ({ clubId }) => {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { data: clubs } = trpc.club.getMyClubs.useQuery();
  const myMembership = clubs?.find((c: any) => c.id === clubId);
  const isScorerOrAdmin = myMembership?.role === MemberRole.ADMIN || myMembership?.role === MemberRole.SCORER;

  const utils = trpc.useUtils();

  const { data: seriesList, isLoading: listLoading } = trpc.series.list.useQuery(
    { clubId },
    { enabled: !!clubId } as any
  );

  // Automatically select the first series if none selected
  React.useEffect(() => {
    if (seriesList && seriesList.length > 0 && !selectedSeriesId) {
      setSelectedSeriesId(seriesList[0].id);
    }
  }, [seriesList]);

  const { data: pointsTable, isLoading: tableLoading } = trpc.series.getPointsTable.useQuery(
    { seriesId: selectedSeriesId || '' },
    { enabled: !!selectedSeriesId } as any
  );

  const createSeriesMutation = trpc.series.create.useMutation();

  const handleCreateSeries = () => {
    if (!newSeriesName.trim()) {
      setErrorMsg('Series name is required.');
      return;
    }
    setIsCreating(true);
    setErrorMsg('');
    createSeriesMutation.mutate({
      clubId,
      name: newSeriesName.trim(),
      date: new Date().toISOString(),
    }, {
      onSuccess: (newSeries: any) => {
        utils.series.list.invalidate({ clubId });
        setSelectedSeriesId(newSeries.id);
        setIsModalVisible(false);
        setNewSeriesName('');
        setIsCreating(false);
      },
      onError: (err: any) => {
        setErrorMsg(err.message || 'Failed to create series.');
        setIsCreating(false);
      },
    });
  };

  if (listLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Tournaments & Series</Text>
          <Text style={styles.sectionSubtitle}>Track tournament points tables and NRR</Text>
        </View>
        {isScorerOrAdmin && (
          <Button
            title="Create"
            icon="add-outline"
            size="sm"
            onPress={() => {
              setErrorMsg('');
              setIsModalVisible(true);
            }}
            style={styles.createBtn}
          />
        )}
      </View>

      {seriesList && seriesList.length > 0 ? (
        <>
          {/* Series Horizontal Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectorContainer}
          >
            {seriesList.map((series: any) => {
              const isSelected = selectedSeriesId === series.id;
              return (
                <TouchableOpacity
                  key={series.id}
                  style={[styles.seriesChip, isSelected && styles.seriesChipActive]}
                  onPress={() => setSelectedSeriesId(series.id)}
                >
                  <Icon
                    name="trophy-outline"
                    size={13}
                    color={isSelected ? colors.accentPrimary : colors.textTertiary}
                  />
                  <Text style={[styles.seriesChipText, isSelected && styles.seriesChipTextActive]}>
                    {series.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Points Table */}
          {tableLoading ? (
            <ActivityIndicator size="small" color={colors.accentPrimary} style={{ marginTop: spacing.xl }} />
          ) : pointsTable && pointsTable.length > 0 ? (
            <Card style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.posCol]}>#</Text>
                <Text style={[styles.headerCell, styles.teamCol]}>Team</Text>
                <Text style={[styles.headerCell, styles.numCol]}>P</Text>
                <Text style={[styles.headerCell, styles.numCol]}>W</Text>
                <Text style={[styles.headerCell, styles.numCol]}>L</Text>
                <Text style={[styles.headerCell, styles.numCol]}>T</Text>
                <Text style={[styles.headerCell, styles.numCol]}>PTS</Text>
                <Text style={[styles.headerCell, styles.nrrCol]}>NRR</Text>
              </View>

              {pointsTable.map((row: any, idx: number) => {
                const isTopTwo = idx < 2;
                return (
                  <View key={row.name} style={[styles.tableRow, idx === pointsTable.length - 1 && styles.lastRow]}>
                    <Text style={[styles.cellText, styles.posCol, isTopTwo && styles.topTeamText]}>
                      {idx + 1}
                    </Text>
                    <Text style={[styles.cellText, styles.teamCol, styles.teamNameText, isTopTwo && styles.topTeamText]} numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text style={[styles.cellText, styles.numCol]}>{row.played}</Text>
                    <Text style={[styles.cellText, styles.numCol]}>{row.won}</Text>
                    <Text style={[styles.cellText, styles.numCol]}>{row.lost}</Text>
                    <Text style={[styles.cellText, styles.numCol]}>{row.tied}</Text>
                    <Text style={[styles.cellText, styles.numCol, styles.pointsText, isTopTwo && styles.topTeamPoints]}>
                      {row.points}
                    </Text>
                    <Text style={[styles.cellText, styles.nrrCol, row.nrr >= 0 ? styles.positiveNrr : styles.negativeNrr]}>
                      {row.nrr > 0 ? `+${row.nrr.toFixed(3)}` : row.nrr.toFixed(3)}
                    </Text>
                  </View>
                );
              })}
            </Card>
          ) : (
            <View style={styles.emptyTableContainer}>
              <EmptyState
                icon="baseball-outline"
                title="Nothing to Rank Yet"
                description="No matches completed in this series yet."
                style={{ padding: spacing.sm }}
              />
            </View>
          )}
        </>
      ) : (
        <Card style={styles.emptyCard}>
          <EmptyState
            icon="trophy-outline"
            title="No Series Yet"
            description="No series created yet in this club."
            style={{ padding: spacing.sm }}
          />
          {isScorerOrAdmin ? (
            <Button
              title="Create Your First Series"
              icon="add-circle-outline"
              onPress={() => setIsModalVisible(true)}
              style={{ marginTop: spacing.base }}
            />
          ) : (
            <Text style={[styles.emptyCardText, { fontSize: typography.fontSize.sm, marginTop: spacing.sm }]}>
              Ask an administrator or scorer to create a tournament series.
            </Text>
          )}
        </Card>
      )}

      {/* Modal for creating a new Series */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Series</Text>
            <Text style={styles.modalSubtitle}>Create a series to group and rank your turf matches</Text>

            <Input
              label="Series Name"
              placeholder="e.g. Weekend Cup 2026"
              value={newSeriesName}
              onChangeText={setNewSeriesName}
            />

            {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setIsModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Create"
                onPress={handleCreateSeries}
                loading={isCreating}
                style={styles.modalBtn}
              />
            </View>
          </Card>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  createBtn: {
    paddingHorizontal: spacing.md,
  },
  selectorContainer: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    marginBottom: spacing.base,
  },
  seriesChip: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  seriesChipActive: {
    backgroundColor: colors.accentPrimarySoft,
    borderColor: colors.accentPrimary,
  },
  seriesChipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  seriesChipTextActive: {
    fontFamily: typography.fontFamily.bold,
    color: colors.accentPrimary,
  },
  tableCard: {
    padding: 0,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.bgTertiary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  headerCell: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  cellText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  posCol: {
    width: 28,
    textAlign: 'center',
  },
  teamCol: {
    flex: 1,
    paddingLeft: spacing.sm,
  },
  teamNameText: {
    fontFamily: typography.fontFamily.semiBold,
  },
  numCol: {
    width: 32,
    textAlign: 'center',
  },
  pointsText: {
    fontFamily: typography.fontFamily.bold,
  },
  nrrCol: {
    width: 68,
    textAlign: 'right',
    fontFamily: typography.fontFamily.bold,
  },
  topTeamText: {
    color: colors.accentPrimary,
  },
  topTeamPoints: {
    color: colors.accentPrimary,
  },
  positiveNrr: {
    color: '#00E676',
  },
  negativeNrr: {
    color: '#FF1744',
  },
  emptyTableContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTableIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  emptyTableText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyCardIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyCardText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  modalCard: {
    width: '100%',
    padding: spacing.lg,
  },
  modalTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.error,
    marginBottom: spacing.base,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.base,
  },
  modalBtn: {
    flex: 1,
  },
});
