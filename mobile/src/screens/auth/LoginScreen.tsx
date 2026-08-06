import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { colors, typography, spacing, borderRadius, shadows } from "../../theme";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Icon } from "../../components/ui/Icon";
import { Alert } from "../../components/ui/AppAlert";
import { trpc } from "../../trpc";
import { useAuthStore } from "../../stores/auth.store";
import { GOOGLE_WEB_CLIENT_ID } from "../../config";

export const LoginScreen = () => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const signInMutation = trpc.auth.googleSignIn.useMutation();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
    });
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();

      // Force account picker to show up by signing out first
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Safe to ignore if not previously signed in
      }

      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken || (response as any).idToken;
      if (!idToken) {
        throw new Error("Google Sign-In did not return an ID token.");
      }

      const res = await signInMutation.mutateAsync({ idToken });

      setAuth(res.user, res.accessToken, (res as any).activeClubId || null);
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the flow
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert("In Progress", "Sign in is already in progress.");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(
          "Play Services Not Available",
          "Google Play Services are not available.",
        );
      } else {
        Alert.alert(
          "Google Sign-In Failed",
          error?.message || "Something went wrong.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter your name for dev login.");
      return;
    }

    setLoading(true);
    try {
      // Create a mock token format: mock-token-first-last
      const formattedToken = `mock-token-${name.trim().toLowerCase().replace(/\s+/g, "-")}`;

      const response = await signInMutation.mutateAsync({
        idToken: formattedToken,
      });

      // Store in auth store
      setAuth(
        response.user,
        response.accessToken,
        (response as any).activeClubId || null,
      );
    } catch (error: any) {
      Alert.alert("Login Failed", error?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🏏</Text>
            </View>
            <Text style={styles.title}>Stumped</Text>
            <Text style={styles.tagline}>
              Professional cricket scoring, balanced teams, and real-time turf
              analytics
            </Text>
          </View>

          <View style={styles.googleContainer}>
            <Button
              title="Continue with Google"
              icon="logo-google"
              onPress={handleGoogleSignIn}
              variant="primary"
              size="lg"
              loading={loading}
              fullWidth
            />
          </View>

          {__DEV__ && (
            <>
              <View style={styles.separatorContainer}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>OR DEVELOPMENT</Text>
                <View style={styles.separatorLine} />
              </View>

              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Icon name="flask-outline" size={18} color={colors.accentSecondary} />
                  <Text style={styles.cardTitle}>Quick Dev Login</Text>
                </View>
                <Text style={styles.cardDesc}>
                  Enter your name to sign in. The app will simulate Google
                  Sign-In and retrieve your stats.
                </Text>

                <Input
                  label="Your Name"
                  placeholder="e.g. Dinesh Kumar"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />

                <Button
                  title={loading ? "Signing in..." : "Sign In"}
                  icon="log-in-outline"
                  onPress={handleDevLogin}
                  variant="secondary"
                  disabled={loading}
                  style={styles.button}
                />
              </View>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By signing in, you agree to our Terms of Service and Privacy
              Policy.
            </Text>
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
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing["2xl"],
  },
  logoContainer: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.bgSecondary,
    borderWidth: 2,
    borderColor: colors.accentPrimary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
    ...shadows.glow(colors.accentPrimary),
  },
  logoEmoji: {
    fontSize: 44,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize["4xl"],
    color: colors.textPrimary,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.base,
  },
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
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
    lineHeight: 20,
  },
  button: {
    marginTop: spacing.sm,
  },
  googleContainer: {
    width: "100%",
  },
  separatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xl,
    width: "100%",
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  separatorText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    paddingHorizontal: spacing.base,
    letterSpacing: 1,
  },
  footer: {
    alignItems: "center",
    marginTop: spacing["2xl"],
  },
  footerText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textAlign: "center",
  },
});
