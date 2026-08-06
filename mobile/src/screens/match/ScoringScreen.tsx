import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, typography, borderRadius, spacing } from "../../theme";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Alert } from "../../components/ui/AppAlert";
import { Celebration, CelebrationType } from "../../components/ui/Celebration";
import { trpc } from "../../trpc";
import { WicketType, Team } from "@stumped/shared";
import * as Haptics from "expo-haptics";
import { showLocalNotification } from "../../utils/notification";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ScoringScreen = ({ route, navigation }: any) => {
  const { matchId, inningsId: initialInningsId } = route.params;

  const [inningsId, setInningsId] = useState(initialInningsId);
  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [bowlerId, setBowlerId] = useState<string | null>(null);

  // Modals / Bottom Sheets
  const [setupModalVisible, setSetupModalVisible] = useState(true);
  const [wicketModalVisible, setWicketModalVisible] = useState(false);
  const [bowlerModalVisible, setBowlerModalVisible] = useState(false);

  // Wicket Form State
  const [selectedWicketType, setSelectedWicketType] = useState<WicketType>(
    WicketType.BOWLED,
  );
  const [dismissedPlayerId, setDismissedPlayerId] = useState<string | null>(
    null,
  );
  const [newBatsmanId, setNewBatsmanId] = useState<string | null>(null);

  // Wide / No Ball: a short tap submits the extra immediately (0 extra runs).
  // A long-press "arms" it instead, so the next run-digit tap can record
  // runs taken on top of the extra (e.g. wide + 2 byes) before submitting.
  const [isWidePending, setIsWidePending] = useState(false);
  const [isNoBallPending, setIsNoBallPending] = useState(false);

  // Boundary celebration overlay (keyed so each boundary replays fresh)
  const [celebration, setCelebration] = useState<{
    type: CelebrationType;
    key: number;
  } | null>(null);

  // Storage hydration loading state
  const [loadingLineup, setLoadingLineup] = useState(true);

  const {
    data: match,
    isLoading: loadingMatch,
    refetch: refetchMatch,
  } = trpc.match.getDetails.useQuery({ matchId }, {
    enabled: !!matchId,
  } as any);

  // Fetch live state from tRPC
  const {
    data: liveState,
    isLoading: loadingState,
    refetch: refetchState,
  } = trpc.scoring.getLiveState.useQuery(
    { matchId, inningsId },
    { enabled: !!inningsId, refetchInterval: 5000 } as any, // Poll every 5s in case of socket disconnect
  );

  const recordBallMutation = trpc.scoring.recordBall.useMutation();
  const undoLastBallMutation = trpc.scoring.undoLastBall.useMutation();
  const startInningsMutation = trpc.match.startInnings.useMutation();
  const utils = trpc.useUtils();

  // Hydrate local striker/non-striker/bowler state from AsyncStorage on load
  useEffect(() => {
    if (!inningsId) {
      setLoadingLineup(false);
      return;
    }

    AsyncStorage.getItem(`@stumped:lineup:${inningsId}`)
      .then((saved) => {
        if (saved) {
          const {
            strikerId: sId,
            nonStrikerId: nsId,
            bowlerId: bId,
          } = JSON.parse(saved);
          if (sId && nsId && bId) {
            setStrikerId(sId);
            setNonStrikerId(nsId);
            setBowlerId(bId);
            setSetupModalVisible(false);
          }
        }
      })
      .catch((err) =>
        console.warn("Could not read lineup from AsyncStorage:", err),
      )
      .finally(() => {
        setLoadingLineup(false);
      });
  }, [inningsId]);

  // Persist striker/non-striker/bowler state to AsyncStorage whenever they change
  useEffect(() => {
    if (inningsId && strikerId && nonStrikerId && bowlerId) {
      AsyncStorage.setItem(
        `@stumped:lineup:${inningsId}`,
        JSON.stringify({ strikerId, nonStrikerId, bowlerId }),
      ).catch((err) =>
        console.warn("Could not save lineup to AsyncStorage:", err),
      );
    }
  }, [inningsId, strikerId, nonStrikerId, bowlerId]);

  // Synchronize local striker/non-striker/bowler state from backend liveState when loaded (e.g. on first load or after undo)
  useEffect(() => {
    if (liveState) {
      const hasTwoBatsmen =
        liveState.currentBatsman?.playerId && liveState.nonStriker?.playerId;
      const hasBowler = liveState.currentBowler?.playerId;

      if (hasTwoBatsmen && hasBowler) {
        setStrikerId(liveState.currentBatsman.playerId);
        setNonStrikerId(liveState.nonStriker.playerId);
        setBowlerId(liveState.currentBowler.playerId);
        setSetupModalVisible(false);
      }
    }
  }, [liveState]);

  // Active teams list
  const activeInnings =
    liveState?.innings || match?.innings.find((i: any) => i.id === inningsId);
  const battingTeam = activeInnings?.battingTeam;
  const bowlingTeam = activeInnings?.bowlingTeam;

  // Double-sided players (odd player counts) are eligible for either team.
  const battingPlayers =
    match?.matchPlayers
      .filter((mp: any) => mp.team === battingTeam || mp.isDoubleSided)
      .map((mp: any) => ({ ...mp.player, isDoubleSided: mp.isDoubleSided })) || [];
  const bowlingPlayers =
    match?.matchPlayers
      .filter((mp: any) => mp.team === bowlingTeam || mp.isDoubleSided)
      .map((mp: any) => ({ ...mp.player, isDoubleSided: mp.isDoubleSided })) || [];

  const getStrikerDisplay = () => {
    if (!strikerId) return { name: "Select Striker", stats: "0(0)" };
    const player = battingPlayers.find((p: any) => p.id === strikerId);
    if (!player) return { name: "Select Striker", stats: "0(0)" };

    if (liveState?.currentBatsman?.playerId === strikerId) {
      return {
        name: player.name,
        stats: `${liveState.currentBatsman.runs || 0}(${liveState.currentBatsman.balls || 0})`,
      };
    }
    if (liveState?.nonStriker?.playerId === strikerId) {
      return {
        name: player.name,
        stats: `${liveState.nonStriker.runs || 0}(${liveState.nonStriker.balls || 0})`,
      };
    }
    return { name: player.name, stats: "0(0)" };
  };

  const getNonStrikerDisplay = () => {
    if (!nonStrikerId) return { name: "Select Non-Striker", stats: "0(0)" };
    const player = battingPlayers.find((p: any) => p.id === nonStrikerId);
    if (!player) return { name: "Select Non-Striker", stats: "0(0)" };

    if (liveState?.currentBatsman?.playerId === nonStrikerId) {
      return {
        name: player.name,
        stats: `${liveState.currentBatsman.runs || 0}(${liveState.currentBatsman.balls || 0})`,
      };
    }
    if (liveState?.nonStriker?.playerId === nonStrikerId) {
      return {
        name: player.name,
        stats: `${liveState.nonStriker.runs || 0}(${liveState.nonStriker.balls || 0})`,
      };
    }
    return { name: player.name, stats: "0(0)" };
  };

  const getBowlerDisplay = () => {
    if (!bowlerId) return { name: "Select Bowler", stats: "0-0 (0.0)" };
    const player = bowlingPlayers.find((p: any) => p.id === bowlerId);
    if (!player) return { name: "Select Bowler", stats: "0-0 (0.0)" };

    if (liveState?.currentBowler?.playerId === bowlerId) {
      return {
        name: player.name,
        stats: `${liveState.currentBowler.wickets || 0}-${liveState.currentBowler.runs || 0} (${liveState.currentBowler.overs?.toFixed(1) || "0.0"})`,
      };
    }
    return { name: player.name, stats: "0-0 (0.0)" };
  };

  const strikerDisplay = getStrikerDisplay();
  const nonStrikerDisplay = getNonStrikerDisplay();
  const bowlerDisplay = getBowlerDisplay();

  // Strike rotation helper
  const rotateStrike = () => {
    setStrikerId(nonStrikerId);
    setNonStrikerId(strikerId);
  };

  const playHaptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const triggerCelebration = (type: CelebrationType) => {
    setCelebration({ type, key: Date.now() });
    if (Platform.OS !== "web") {
      // Six gets a heavier "success" haptic than a four.
      if (type === "six") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  };

  const handleRecordBall = async (
    runs: number,
    extraOptions: { isWicket?: boolean; isWide?: boolean; isNoBall?: boolean } = {},
  ) => {
    if (!strikerId || !nonStrikerId || !bowlerId) {
      setSetupModalVisible(true);
      return;
    }

    playHaptic();

    try {
      const payload = {
        inningsId,
        batsmanId: strikerId,
        nonStrikerId: nonStrikerId,
        bowlerId,
        runs,
        isWide: !!extraOptions.isWide,
        isNoBall: !!extraOptions.isNoBall,
        isWicket: !!extraOptions.isWicket,
        wicketType: extraOptions.isWicket ? selectedWicketType : undefined,
        dismissedPlayerId: extraOptions.isWicket
          ? dismissedPlayerId || strikerId
          : undefined,
      };

      const nextState = await recordBallMutation.mutateAsync(payload);

      // Cancel any in-flight background poll for this query before writing
      // the fresh result — otherwise a stale poll response (fetched just
      // before this ball) can land afterward and silently overwrite the
      // correct state, making the board look one ball behind.
      await utils.scoring.getLiveState.cancel({ matchId, inningsId });
      utils.scoring.getLiveState.setData({ matchId, inningsId }, nextState);

      // Trigger local notification highlights
      const strikerName = liveState?.currentBatsman?.name || "Batsman";
      if (extraOptions.isWicket) {
        showLocalNotification(
          "🔴 WICKET!",
          `${strikerName} is OUT via ${selectedWicketType.toLowerCase().replace("_", " ")}.`,
        );
      } else if (runs === 4 && !payload.isWide) {
        showLocalNotification(
          "🏏 FOUR!",
          `${strikerName} hits a beautiful boundary!`,
        );
        triggerCelebration("four");
      } else if (runs === 6 && !payload.isWide) {
        showLocalNotification(
          "🚀 SIX!",
          `${strikerName} launches a massive maximum over the turf!`,
        );
        triggerCelebration("six");
      }

      // Auto rotation logic for runs off bat (excluding extras)
      const scoredRuns = runs;

      // Rotate on odd runs
      if (scoredRuns % 2 !== 0 && !extraOptions.isWicket) {
        setStrikerId(payload.nonStrikerId);
        setNonStrikerId(payload.batsmanId);
      }

      // Reset modifiers
      setIsWidePending(false);
      setIsNoBallPending(false);

      // Check if innings completed
      if (nextState.innings.isCompleted) {
        if (nextState.innings.inningsNumber === 1) {
          Alert.alert(
            "1st Innings Completed",
            "The first innings has ended. Would you like to start the second innings now?",
            [
              {
                text: "Go to Home",
                onPress: () => navigation.navigate("HomeTab"),
                style: "cancel",
              },
              {
                text: "Start 2nd Innings",
                onPress: async () => {
                  try {
                    const newInnings = await startInningsMutation.mutateAsync({
                      matchId,
                    });
                    setInningsId(newInnings.id);
                    setStrikerId(null);
                    setNonStrikerId(null);
                    setBowlerId(null);
                    setSetupModalVisible(true);
                    refetchMatch();
                    refetchState();
                  } catch (err: any) {
                    Alert.alert(
                      "Error",
                      err?.message || "Could not start second innings.",
                    );
                    navigation.navigate("HomeTab");
                  }
                },
              },
            ],
          );
        } else {
          // Refresh the club's match list right away so the Home dashboard
          // and Score tab stop treating this match as live, instead of
          // waiting on the next background poll.
          utils.match.list.invalidate();

          Alert.alert(
            "Match Completed",
            "The second innings has ended and the match is complete!",
            [
              {
                text: "Go to Home",
                onPress: () => navigation.navigate("HomeTab"),
                style: "cancel",
              },
              {
                text: "View Scorecard",
                onPress: () => {
                  navigation.navigate("MatchDetail", { matchId });
                },
              },
            ],
          );
        }
        return;
      }

      // Check for end of over: count legal balls (not wide -1, not no-ball -2; dot ball 0 and wicket -3 are legal)
      const currentLegalBalls = nextState.currentOver.filter(
        (b: number) => b !== -1 && b !== -2,
      ).length;
      if (
        nextState.currentOver.length > 0 &&
        currentLegalBalls > 0 &&
        currentLegalBalls % 6 === 0
      ) {
        // Rotate strike at end of over
        setStrikerId(payload.nonStrikerId);
        setNonStrikerId(payload.batsmanId);

        // Open Bowler selection
        setBowlerModalVisible(true);
      }

      // If wicket fell, ask for new batsman
      if (extraOptions.isWicket) {
        if (dismissedPlayerId === strikerId) {
          setStrikerId(null);
        } else {
          setNonStrikerId(null);
        }
        setSetupModalVisible(true);
      }
    } catch (err: any) {
      Alert.alert("Scoring Error", err?.message || "Could not record ball.");
    }
  };

  const handleUndo = async () => {
    playHaptic();
    Alert.alert(
      "Confirm Undo",
      "Are you sure you want to revert the last ball?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Undo",
          style: "destructive",
          onPress: async () => {
            try {
              const nextState = await undoLastBallMutation.mutateAsync({ inningsId });
              await utils.scoring.getLiveState.cancel({ matchId, inningsId });
              utils.scoring.getLiveState.setData({ matchId, inningsId }, nextState);
              setStrikerId(null);
              setNonStrikerId(null);
              setBowlerId(null);
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Could not undo last ball.");
            }
          },
        },
      ],
    );
  };

  const handleSetupConfirm = () => {
    if (!strikerId || !nonStrikerId || !bowlerId) {
      Alert.alert(
        "Required",
        "Please select Striker, Non-Striker, and Bowler.",
      );
      return;
    }
    if (strikerId === nonStrikerId) {
      Alert.alert(
        "Validation",
        "Striker and Non-Striker must be different players.",
      );
      return;
    }
    if (bowlerId === strikerId || bowlerId === nonStrikerId) {
      Alert.alert(
        "Validation",
        "The bowler cannot also be a batsman on strike for this delivery.",
      );
      return;
    }
    setSetupModalVisible(false);
  };

  const triggerWicketInput = () => {
    setDismissedPlayerId(strikerId);
    setWicketModalVisible(true);
  };

  const handleWicketConfirm = () => {
    setWicketModalVisible(false);
    handleRecordBall(0, {
      isWicket: true,
      isWide: isWidePending,
      isNoBall: isNoBallPending,
    });
  };

  if (loadingMatch || loadingState || loadingLineup) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </SafeAreaView>
    );
  }

  // Display over indicators
  const renderOverBall = (ball: number, idx: number) => {
    let display = ball.toString();
    let bg: string = colors.bgTertiary;
    let textCol: string = colors.textPrimary;

    if (ball === -1) {
      display = "Wd";
      bg = colors.extraWide;
      textCol = colors.black;
    } else if (ball === -2) {
      display = "Nb";
      bg = colors.extraNoBall;
      textCol = colors.black;
    } else if (ball === -3) {
      display = "W";
      bg = colors.wicket;
      textCol = colors.white;
    } else if (ball === 4) {
      bg = colors.scoreFour;
    } else if (ball === 6) {
      bg = colors.scoreSix;
    }

    return (
      <View key={idx} style={[styles.overBallCircle, { backgroundColor: bg }]}>
        <Text style={[styles.overBallText, { color: textCol }]}>{display}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.exitBtn}
          onPress={() => navigation.navigate("HomeTab")}
        >
          <Icon name="exit-outline" size={15} color={colors.accentDanger} />
          <Text style={styles.exitBtnText}>Exit</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Scoring</Text>
        <TouchableOpacity
          style={styles.setupBtn}
          onPress={() => setSetupModalVisible(true)}
        >
          <Icon name="settings-outline" size={15} color={colors.textPrimary} />
          <Text style={styles.setupBtnText}>Setup</Text>
        </TouchableOpacity>
      </View>

      {/* Main Scorecard Widget */}
      <View style={styles.scorecardContainer}>
        <Text style={styles.teamNames}>
          {battingTeam === Team.TEAM_A ? match?.teamAName : match?.teamBName}{" "}
          Innings
        </Text>
        <View style={styles.runsRow}>
          <Text style={styles.scoreText}>
            {activeInnings?.totalRuns}/{activeInnings?.totalWickets}
          </Text>
          <Text style={styles.oversText}>
            Overs: {activeInnings?.totalOvers.toFixed(1)}
          </Text>
        </View>
        <View style={styles.runRateRow}>
          <Text style={styles.rrText}>
            CRR: {liveState?.currentRunRate?.toFixed(2) || "0.00"}
          </Text>
          {liveState?.target && (
            <Text style={styles.rrText}>
              Target: {liveState.target} (RRR:{" "}
              {liveState.requiredRunRate?.toFixed(2)})
            </Text>
          )}
        </View>
      </View>

      {/* Active Batsmen and Bowler Row */}
      <View style={styles.activePlayersCard}>
        <View style={styles.playerRow}>
          <View style={styles.playerNameWrap}>
            <Icon name="tennisball" size={14} color={colors.accentSecondary} />
            <Text style={[styles.activePlayerName, styles.strikerHighlight]}>
              {strikerDisplay.name}*
            </Text>
          </View>
          <Text style={styles.activePlayerStats}>{strikerDisplay.stats}</Text>
        </View>
        <View style={styles.playerRow}>
          <View style={styles.playerNameWrap}>
            <Icon name="tennisball-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.activePlayerName}>{nonStrikerDisplay.name}</Text>
          </View>
          <Text style={styles.activePlayerStats}>
            {nonStrikerDisplay.stats}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.playerRow}>
          <View style={styles.playerNameWrap}>
            <Icon name="baseball-outline" size={14} color={colors.info} />
            <Text style={styles.bowlerName}>{bowlerDisplay.name}</Text>
          </View>
          <Text style={styles.activePlayerStats}>{bowlerDisplay.stats}</Text>
        </View>
      </View>

      {/* Over summary */}
      <View style={styles.overSummaryContainer}>
        <Text style={styles.overLabel}>This Over:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.overScroll}
        >
          {liveState?.currentOver && liveState.currentOver.length > 0 ? (
            liveState.currentOver.map((b: number, i: number) =>
              renderOverBall(b, i),
            )
          ) : (
            <Text style={styles.noBallsText}>First ball pending...</Text>
          )}
        </ScrollView>
      </View>

      {/* Keypad Grid (Calculator Style) */}
      <View style={styles.keypadContainer}>
        {(isWidePending || isNoBallPending) && (
          <View style={styles.armedHint}>
            <Icon name="information-circle-outline" size={13} color={colors.accentSecondary} />
            <Text style={styles.armedHintText}>
              {isWidePending ? "Wide" : "No Ball"} armed — tap a run number to add runs taken,
              or tap the button again to cancel.
            </Text>
          </View>
        )}

        {/* Modifier buttons */}
        <View style={styles.modifierRow}>
          <TouchableOpacity
            style={[styles.modButton, isWidePending && styles.modButtonActive]}
            onPress={() => {
              if (isWidePending) {
                playHaptic();
                setIsWidePending(false);
              } else {
                handleRecordBall(0, { isWide: true });
              }
            }}
            onLongPress={() => {
              playHaptic();
              setIsWidePending(true);
              setIsNoBallPending(false);
            }}
            delayLongPress={350}
          >
            <Text style={styles.modButtonText}>Wide</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modButton,
              isNoBallPending && styles.modButtonActive,
            ]}
            onPress={() => {
              if (isNoBallPending) {
                playHaptic();
                setIsNoBallPending(false);
              } else {
                handleRecordBall(0, { isNoBall: true });
              }
            }}
            onLongPress={() => {
              playHaptic();
              setIsNoBallPending(true);
              setIsWidePending(false);
            }}
            delayLongPress={350}
          >
            <Text style={styles.modButtonText}>No Ball</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modButton, styles.wicketBtn]}
            onPress={triggerWicketInput}
          >
            <Text style={styles.wicketBtnText}>Wicket</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modButton, styles.undoBtn]}
            onPress={handleUndo}
          >
            <Text style={styles.undoBtnText}>Undo</Text>
          </TouchableOpacity>
        </View>

        {/* Numeric Run keys */}
        <View style={styles.runsGrid}>
          <View style={styles.gridRow}>
            {[0, 1, 2, 3].map((r) => (
              <TouchableOpacity
                key={r}
                style={styles.runKey}
                onPress={() =>
                  handleRecordBall(r, { isWide: isWidePending, isNoBall: isNoBallPending })
                }
              >
                <Text style={styles.runKeyText}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.gridRow}>
            <TouchableOpacity
              style={styles.runKey}
              onPress={() =>
                handleRecordBall(5, { isWide: isWidePending, isNoBall: isNoBallPending })
              }
            >
              <Text style={styles.runKeyText}>5</Text>
            </TouchableOpacity>
            {[4, 6].map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.runKey,
                  styles.boundaryKey,
                  r === 4 ? styles.fourKey : styles.sixKey,
                ]}
                onPress={() =>
                  handleRecordBall(r, { isWide: isWidePending, isNoBall: isNoBallPending })
                }
              >
                <Text style={styles.boundaryKeyText}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Setup / Batsman selection Modal */}
      <Modal visible={setupModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Innings Lineup Setup</Text>
            <Text style={styles.modalDesc}>
              Configure strikers and bowlers to record deliveries.
            </Text>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Striker */}
              <Text style={styles.modalSelectLabel}>
                Select Striker (Batsman)*
              </Text>
              <View style={styles.selectorGrid}>
                {battingPlayers
                  // A double-sided player already picked as bowler can't also bat this delivery.
                  .filter((p: any) => p.id !== nonStrikerId && p.id !== bowlerId)
                  .map((p: any) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.selectorItem,
                        strikerId === p.id && styles.selectorItemActive,
                      ]}
                      onPress={() => setStrikerId(p.id)}
                    >
                      <Text style={styles.selectorName}>
                        {p.name}
                        {p.isDoubleSided && (
                          <Text style={styles.bothBadgeInline}> · Both Teams</Text>
                        )}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>

              {/* Non-Striker */}
              <Text style={styles.modalSelectLabel}>Select Non-Striker*</Text>
              <View style={styles.selectorGrid}>
                {battingPlayers
                  .filter((p: any) => p.id !== strikerId && p.id !== bowlerId)
                  .map((p: any) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.selectorItem,
                        nonStrikerId === p.id && styles.selectorItemActive,
                      ]}
                      onPress={() => setNonStrikerId(p.id)}
                    >
                      <Text style={styles.selectorName}>
                        {p.name}
                        {p.isDoubleSided && (
                          <Text style={styles.bothBadgeInline}> · Both Teams</Text>
                        )}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>

              {/* Bowler */}
              <Text style={styles.modalSelectLabel}>Select Bowler*</Text>
              <View style={styles.selectorGrid}>
                {bowlingPlayers
                  // A double-sided player already batting can't also bowl this delivery.
                  .filter((p: any) => p.id !== strikerId && p.id !== nonStrikerId)
                  .map((p: any) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.selectorItem,
                        bowlerId === p.id && styles.selectorItemActive,
                      ]}
                      onPress={() => setBowlerId(p.id)}
                    >
                      <Text style={styles.selectorName}>
                        {p.name}
                        {p.isDoubleSided && (
                          <Text style={styles.bothBadgeInline}> · Both Teams</Text>
                        )}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>

            <Button
              title="Confirm lineup"
              onPress={handleSetupConfirm}
              variant="primary"
              style={styles.modalConfirmBtn}
            />
          </View>
        </View>
      </Modal>

      {/* Wicket Input Modal */}
      <Modal visible={wicketModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Record Wicket</Text>

            <Text style={styles.modalSelectLabel}>Wicket Type</Text>
            <View style={styles.selectorGrid}>
              {Object.values(WicketType).map((wt) => (
                <TouchableOpacity
                  key={wt}
                  style={[
                    styles.selectorItem,
                    selectedWicketType === wt && styles.selectorItemActive,
                  ]}
                  onPress={() => setSelectedWicketType(wt)}
                >
                  <Text style={styles.selectorName}>
                    {wt.replace("_", " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalSelectLabel}>Dismissed Batsman</Text>
            <View style={styles.selectorGrid}>
              <TouchableOpacity
                style={[
                  styles.selectorItem,
                  dismissedPlayerId === strikerId && styles.selectorItemActive,
                ]}
                onPress={() => setDismissedPlayerId(strikerId)}
              >
                <Text style={styles.selectorName}>
                  Striker: {liveState?.currentBatsman?.name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.selectorItem,
                  dismissedPlayerId === nonStrikerId &&
                    styles.selectorItemActive,
                ]}
                onPress={() => setDismissedPlayerId(nonStrikerId)}
              >
                <Text style={styles.selectorName}>
                  Non-Striker: {liveState?.nonStriker?.name}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                onPress={() => setWicketModalVisible(false)}
                variant="ghost"
                style={{ flex: 1 }}
              />
              <Button
                title="Record Out"
                onPress={handleWicketConfirm}
                variant="danger"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* End of Over Bowler Selection Modal */}
      <Modal visible={bowlerModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Next Bowler</Text>
            <Text style={styles.modalDesc}>
              The over is complete. Select the next bowler to continue.
            </Text>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.selectorGrid}>
                {bowlingPlayers
                  .filter(
                    (p: any) =>
                      p.id !== bowlerId && // Cannot bowl consecutive overs
                      p.id !== strikerId && // A double-sided player can't bat and bowl at once
                      p.id !== nonStrikerId,
                  )
                  .map((p: any) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.selectorItem,
                        bowlerId === p.id && styles.selectorItemActive,
                      ]}
                      onPress={() => {
                        setBowlerId(p.id);
                        setBowlerModalVisible(false);
                      }}
                    >
                      <Text style={styles.selectorName}>
                        {p.name}
                        {p.isDoubleSided && (
                          <Text style={styles.bothBadgeInline}> · Both Teams</Text>
                        )}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Boundary celebration overlay — keyed so each boundary replays fresh */}
      {celebration && (
        <Celebration
          key={celebration.key}
          type={celebration.type}
          onDone={() => setCelebration(null)}
        />
      )}
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
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  exitBtn: {
    backgroundColor: colors.accentDangerSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  exitBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.accentDanger,
  },
  setupBtn: {
    backgroundColor: colors.bgTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  setupBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  playerNameWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 1,
  },
  scorecardContainer: {
    backgroundColor: colors.bgSecondary,
    margin: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
  },
  teamNames: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  runsRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  scoreText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.score,
    color: colors.accentPrimary,
  },
  oversText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
  },
  runRateRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  rrText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  activePlayersCard: {
    backgroundColor: colors.bgSecondary,
    marginHorizontal: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  playerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  activePlayerName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  strikerHighlight: {
    fontFamily: typography.fontFamily.bold,
    color: colors.accentSecondary,
  },
  activePlayerStats: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  bowlerName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  overSummaryContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.base,
    marginVertical: spacing.md,
  },
  overLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginRight: spacing.md,
  },
  overScroll: {
    alignItems: "center",
    gap: spacing.xs,
  },
  overBallCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  overBallText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
  },
  noBallsText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  keypadContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.lg,
  },
  armedHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    backgroundColor: colors.accentSecondarySoft,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  armedHintText: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  modifierRow: {
    flexDirection: "row",
    marginHorizontal: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modButton: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: "center",
  },
  modButtonActive: {
    borderColor: colors.accentSecondary,
    backgroundColor: colors.accentSecondarySoft,
  },
  modButtonText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  wicketBtn: {
    backgroundColor: colors.wicket,
    borderColor: colors.wicket,
  },
  wicketBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.white,
  },
  undoBtn: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderLight,
  },
  undoBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  runsGrid: {
    marginHorizontal: spacing.base,
    gap: spacing.sm,
  },
  gridRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  runKey: {
    flex: 1,
    height: 60,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  runKeyText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
  },
  boundaryKey: {
    height: 72,
  },
  fourKey: {
    borderColor: colors.scoreFour,
    backgroundColor: colors.scoreFourSoft,
  },
  sixKey: {
    borderColor: colors.scoreSix,
    backgroundColor: colors.scoreSixSoft,
  },
  boundaryKeyText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize["2xl"],
    color: colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.xl,
    maxHeight: "80%",
  },
  modalTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalDesc: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  modalSelectLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  selectorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  selectorItem: {
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  selectorItemActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.accentPrimarySoft,
  },
  selectorName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  bothBadgeInline: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.accentSecondary,
  },
  modalScroll: {
    paddingBottom: spacing.xl,
  },
  modalConfirmBtn: {
    marginTop: spacing.lg,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
