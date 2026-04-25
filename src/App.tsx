import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { Layout } from './components/Layout';
import { PageSkeleton } from './components/Skeleton';
import { loadSettings } from './store/settings';
import { initClient } from './api/gitea';
import { pruneOldSnapshots } from './store/db';
import { pruneOldHistory } from './store/history';

// ── Lazy-load all pages — each becomes its own JS chunk ──────────────────────
const Dashboard     = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Engineers     = lazy(() => import('./pages/Engineers').then(m => ({ default: m.Engineers })));
const EngineerDetail = lazy(() => import('./pages/EngineerDetail').then(m => ({ default: m.EngineerDetail })));
const Activity      = lazy(() => import('./pages/Activity').then(m => ({ default: m.Activity })));
const Settings      = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));

// ── Persistent cache — survives page refresh, serves 1000 users stale-fast ──
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,       // 5 min — serve cached data instantly
      gcTime: 60 * 60 * 1000,          // 1 hour — keep in memory
    },
  },
});

// Persist to localStorage — data survives refresh, no reload spinner
// Key bumped to v4: TeamStats now includes `availableRepos`; AppSettings adds `teamMembers`.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'gitea-metrics-cache-v4',
  throttleTime: 3000,  // write at most once every 3s
});

// Auto-init Gitea client + proxy registration on startup (fire-and-forget)
const saved = loadSettings();
if (saved.giteaUrl && saved.token) {
  void initClient(saved.giteaUrl, saved.token);
  // Prune stale IndexedDB data in the background (non-blocking)
  void pruneOldSnapshots(90);
  void pruneOldHistory(saved.giteaUrl, 12);
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 60 * 60 * 1000 }}
    >
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            {/* Each page loads only when navigated to */}
            <Route index element={<Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>} />
            <Route path="engineers" element={<Suspense fallback={<PageSkeleton />}><Engineers /></Suspense>} />
            <Route path="engineers/:username" element={<Suspense fallback={<PageSkeleton />}><EngineerDetail /></Suspense>} />
            <Route path="activity" element={<Suspense fallback={<PageSkeleton />}><Activity /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<PageSkeleton />}><Settings /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </PersistQueryClientProvider>
  );
}

export default App;
