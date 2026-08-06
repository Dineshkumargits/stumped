import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

const isAndroidExpoGo = Platform.OS === 'android' && isRunningInExpoGo();

// We conditionally load expo-notifications to prevent it from crashing in Expo Go on Android
let Notifications: typeof import('expo-notifications') | null = null;

if (!isAndroidExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (error) {
    console.error('Failed to load expo-notifications:', error);
  }
}

if (Notifications) {
  // Configure how notifications are handled when the app is in the foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions from the device.
 */
export async function requestNotificationPermissions() {
  if (Platform.OS === 'web') return false;
  if (!Notifications) {
    console.warn('Notifications are disabled or not supported in this environment (e.g. Expo Go on Android)');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // Set up Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('stumped-matches', {
      name: 'Stumped Matches',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00C853', // Stumped Emerald Green
    });
  }

  return finalStatus === 'granted';
}

/**
 * Trigger an instant simulated push notification.
 */
export async function showLocalNotification(title: string, body: string) {
  if (!Notifications) {
    console.warn('Notifications are disabled or not supported in this environment (e.g. Expo Go on Android)');
    return;
  }
  try {
    const trigger: any = Platform.OS === 'android' ? { channelId: 'stumped-matches' } : null;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger,
    });
  } catch (error) {
    console.error('Failed to trigger notification:', error);
  }
}
