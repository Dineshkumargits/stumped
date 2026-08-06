import { create } from 'zustand';

interface ServerStatusState {
  isOffline: boolean;
  setOffline: () => void;
  setOnline: () => void;
}

export const useServerStatusStore = create<ServerStatusState>((set) => ({
  isOffline: false,
  setOffline: () => set({ isOffline: true }),
  setOnline: () => set({ isOffline: false }),
}));
