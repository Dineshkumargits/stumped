import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../backend/src/trpc/trpc.router';
import { useAuthStore } from '../stores/auth.store';
import { useServerStatusStore } from '../stores/serverStatus.store';

export const trpc = createTRPCReact<AppRouter>();

const API_URL = __DEV__
  ? 'http://10.0.2.2:3000/trpc' // Android emulator -> localhost
  : 'https://api-stumped.adkdev.in/trpc'; // Production URL

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: API_URL,
        fetch: async (url, options) => {
          try {
            const res = await globalThis.fetch(url, options);
            // If the fetch resolves, the server responded
            useServerStatusStore.getState().setOnline();
            return res;
          } catch (error) {
            // A network exception (like request timeout or DNS lookup failed) indicates the server is offline
            useServerStatusStore.getState().setOffline();
            throw error;
          }
        },
        headers() {
          const token = useAuthStore.getState().accessToken;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
