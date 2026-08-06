import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory fallback storage in case native AsyncStorage is null (requires native rebuild)
const memoryStorage: Record<string, string> = {};
const safeMemoryStorage = {
  getItem: (name: string) => {
    return memoryStorage[name] || null;
  },
  setItem: (name: string, value: string) => {
    memoryStorage[name] = value;
  },
  removeItem: (name: string) => {
    delete memoryStorage[name];
  },
};

// Check if native AsyncStorage is functional
let activeStorage: any = safeMemoryStorage;
try {
  if (AsyncStorage) {
    activeStorage = AsyncStorage;
  }
} catch (e) {
  console.warn('Native AsyncStorage not loaded yet, using memory storage fallback.', e);
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  activeClubId: string | null;

  // Actions
  setAuth: (user: AuthUser, accessToken: string, activeClubId?: string | null) => void;
  setActiveClub: (clubId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      activeClubId: null,

      setAuth: (user, accessToken, activeClubId = null) =>
        set({
          user,
          accessToken,
          isAuthenticated: true,
          activeClubId,
        }),

      setActiveClub: (clubId) =>
        set({ activeClubId: clubId }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          activeClubId: null,
        }),
    }),
    {
      name: 'stumped-auth-storage',
      storage: createJSONStorage(() => activeStorage),
    }
  )
);
