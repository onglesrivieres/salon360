import { useRegisterSW } from 'virtual:pwa-register/react';

const SW_CHECK_INTERVAL = 60 * 1000; // Check every 60 seconds

export function useServiceWorkerUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      // When app becomes visible (iOS resume from background), check immediately
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !registration.installing) {
          registration.update();
        }
      });

      // Periodic check for SW updates (critical for iOS standalone mode)
      setInterval(async () => {
        if (registration.installing) return;
        if ('connection' in navigator && !navigator.onLine) return;

        try {
          const resp = await fetch(swUrl, {
            cache: 'no-store',
            headers: {
              'cache': 'no-store',
              'cache-control': 'no-cache',
            },
          });

          if (resp?.status === 200) {
            await registration.update();
          }
        } catch {
          // Silently fail -- will retry next interval
        }
      }, SW_CHECK_INTERVAL);
    },
    onRegisterError(error) {
      console.error('Service Worker registration error:', error);
    },
  });

  const handleRefresh = () => {
    updateServiceWorker(true);
  };

  return {
    hasNewVersion: needRefresh,
    handleRefresh,
  };
}
