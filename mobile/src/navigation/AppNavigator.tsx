import React from "react";
import { Text, View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import {
  NavigationContainer,
  DefaultTheme,
  useFocusEffect,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuthStore } from "../stores/auth.store";
import { colors, typography, spacing } from "../theme";
import { MemberRole } from "@stumped/shared";
import { Button } from "../components/ui/Button";
import { Icon, IconName } from "../components/ui/Icon";
import { EmptyState } from "../components/ui/EmptyState";
import { SafeAreaView } from "react-native-safe-area-context";
import { trpc } from "../trpc";

// Screens
import { LoginScreen } from "../screens/auth/LoginScreen";
import { OnboardingScreen } from "../screens/auth/OnboardingScreen";
import { HomeScreen } from "../screens/home/HomeScreen";
import { PlayersScreen } from "../screens/players/PlayersScreen";
import { PlayerDetailScreen } from "../screens/players/PlayerDetailScreen";
import { AddPlayerScreen } from "../screens/players/AddPlayerScreen";
import { NewMatchScreen } from "../screens/match/NewMatchScreen";
import { TossScreen } from "../screens/match/TossScreen";
import { ScoringScreen } from "../screens/match/ScoringScreen";
import { LiveSpectatorScreen } from "../screens/match/LiveSpectatorScreen";
import { StatsScreen } from "../screens/stats/StatsScreen";
import { HistoryScreen } from "../screens/history/HistoryScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { MatchDetailScreen } from "../screens/match/MatchDetailScreen";

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MatchStack = createNativeStackNavigator();
const PlayersStack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accentPrimary,
    background: colors.bgPrimary,
    card: colors.bgSecondary,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.accentDanger,
  },
};

// All screens render their own in-content header (see ScreenHeader), so the
// native stack/tab chrome stays fully hidden — otherwise both stack and
// leave a large empty gap where the OS header used to be.
const noHeaderOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.bgPrimary },
} as const;

// Routing switcher component for bottom tab "Score"
function ScoreTabSwitchScreen({ navigation }: any) {
  const activeClubId = useAuthStore((state) => state.activeClubId);

  const {
    data: clubs,
    isLoading: loadingClubs,
    refetch: refetchClubs,
  } = trpc.club.getMyClubs.useQuery(undefined, {
    enabled: !!activeClubId,
  } as any);

  const {
    data: matches,
    isLoading: loadingMatches,
    refetch: refetchMatches,
  } = trpc.match.list.useQuery({ clubId: activeClubId || "" }, {
    enabled: !!activeClubId,
    // Keep polling while this tab is open so a match completing (on this
    // device or another scorer's) is picked up without switching tabs.
    refetchInterval: 10000,
  } as any);

  useFocusEffect(
    React.useCallback(() => {
      if (activeClubId) {
        refetchClubs();
        refetchMatches();
      }
    }, [activeClubId, refetchClubs, refetchMatches]),
  );

  const myMembership = clubs?.find((c: any) => c.id === activeClubId);
  const isScorerOrAdmin =
    myMembership?.role === MemberRole.ADMIN ||
    myMembership?.role === MemberRole.SCORER;

  const liveMatch = matches?.find(
    (m: any) =>
      m.status === "SETUP" ||
      m.status === "TOSS" ||
      m.status === "FIRST_INNINGS" ||
      m.status === "SECOND_INNINGS",
  );

  const activeInning =
    liveMatch?.innings?.find((i: any) => !i.isCompleted) ||
    liveMatch?.innings?.[0];

  if (loadingClubs || loadingMatches) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
        <Text style={styles.loadingText}>Checking active match status...</Text>
      </View>
    );
  }

  if (liveMatch) {
    const customRoute = {
      params: {
        matchId: liveMatch.id,
        inningsId: activeInning?.id,
      },
    };

    if (isScorerOrAdmin) {
      if (liveMatch.status === "SETUP" || liveMatch.status === "TOSS") {
        return <TossScreen route={customRoute} navigation={navigation} />;
      }
      return <ScoringScreen route={customRoute} navigation={navigation} />;
    } else {
      return (
        <LiveSpectatorScreen route={customRoute} navigation={navigation} />
      );
    }
  }

  // No active match
  if (isScorerOrAdmin) {
    return <NewMatchScreen navigation={navigation} />;
  }

  return (
    <SafeAreaView style={styles.placeholderContainer}>
      <EmptyState
        icon="baseball-outline"
        title="No Active Matches"
        description="There is no live match currently in progress for this club. Check back later or browse past match results."
        action={
          <Button
            title="Browse Match History"
            icon="time-outline"
            onPress={() => navigation.navigate("HistoryTab")}
            variant="primary"
          />
        }
      />
    </SafeAreaView>
  );
}

// Stack for Match flow
function MatchStackNavigator() {
  return (
    <MatchStack.Navigator screenOptions={noHeaderOptions}>
      <MatchStack.Screen name="ScoreTabSwitch" component={ScoreTabSwitchScreen} />
      <MatchStack.Screen name="NewMatch" component={NewMatchScreen} />
      <MatchStack.Screen name="Toss" component={TossScreen} />
      <MatchStack.Screen name="Scoring" component={ScoringScreen} />
      <MatchStack.Screen name="LiveSpectator" component={LiveSpectatorScreen} />
    </MatchStack.Navigator>
  );
}

// Stack for Player management
function PlayersStackNavigator() {
  return (
    <PlayersStack.Navigator screenOptions={noHeaderOptions}>
      <PlayersStack.Screen name="PlayersList" component={PlayersScreen} />
      <PlayersStack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
      <PlayersStack.Screen name="AddPlayer" component={AddPlayerScreen} />
    </PlayersStack.Navigator>
  );
}

function tabIcon(focusedName: IconName, name: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Icon name={focused ? focusedName : name} size={23} color={color} />
  );
}

// Bottom Tab Navigator
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 66,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
        },
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontFamily: typography.fontFamily.medium,
          fontSize: 11,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: tabIcon("home", "home-outline"),
        }}
      />
      <Tab.Screen
        name="MatchTab"
        component={MatchStackNavigator}
        options={{
          tabBarLabel: "Score",
          tabBarIcon: tabIcon("calculator", "calculator-outline"),
        }}
      />
      <Tab.Screen
        name="PlayersTab"
        component={PlayersStackNavigator}
        options={{
          tabBarLabel: "Players",
          tabBarIcon: tabIcon("people", "people-outline"),
        }}
      />
      <Tab.Screen
        name="StatsTab"
        component={StatsScreen}
        options={{
          tabBarLabel: "Stats",
          tabBarIcon: tabIcon("podium", "podium-outline"),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{
          tabBarLabel: "History",
          tabBarIcon: tabIcon("time", "time-outline"),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: tabIcon("person-circle", "person-circle-outline"),
        }}
      />
    </Tab.Navigator>
  );
}

export const AppNavigator = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const activeClubId = useAuthStore((state) => state.activeClubId);
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    const hasHydrated = useAuthStore.persist.hasHydrated();
    if (hasHydrated) {
      setIsHydrated(true);
    } else {
      const unsub = useAuthStore.persist.onFinishHydration(() => {
        setIsHydrated(true);
      });
      return unsub;
    }
  }, []);

  if (!isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <RootStack.Screen name="Login" component={LoginScreen} />
        ) : !activeClubId ? (
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={TabNavigator} />
            <RootStack.Screen name="MatchDetail" component={MatchDetailScreen} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bgPrimary,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
  },
  placeholderContainer: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    justifyContent: "center",
  },
});
