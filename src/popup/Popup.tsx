import React from 'react';
import browser from '../utils/browser';
import type { FetchStats, LegacyFetchStats } from '../utils/types';
import { STORAGE_KEY_STATS } from '../utils/constants';
import { createEmptyStats } from '@/background/storage/stats';
import { ThemeProvider } from '@/components/theme-provier';
import ThemeToggle from '@/components/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings } from 'lucide-react';
import { useDiscoveredFeeds } from './hooks/useDiscoveredFeeds';
import { useSubscriptionQueue } from './hooks/useSubscriptionQueue';
import { useCatalogUpdates } from './hooks/useCatalogUpdates';
import { useCustomBlogUpdates } from './hooks/useCustomBlogUpdates';
import { useSettings } from './hooks/useSettings';
import { FeedList } from './components/FeedList';
import { QueueSummary } from './components/QueueSummary';
import { CatalogUpdatesSection } from './components/CatalogUpdatesSection';
import { CustomBlogUpdatesSection } from './components/CustomBlogUpdatesSection';
import { ModeSelector } from './components/ModeSelector';
import { StatsSection } from './components/StatsSection';
import { EXTENSION_VERSION } from '@/utils/constants';

/** Check if stats object is legacy format */
function isLegacyStats(stats: unknown): stats is LegacyFetchStats {
  if (!stats || typeof stats !== 'object') return false;
  const obj = stats as Record<string, unknown>;
  return 'totalFetches' in obj && !('version' in obj);
}

/** Migrate legacy stats to new format in popup context */
function migrateLegacyStatsInPopup(legacy: LegacyFetchStats): FetchStats {
  const stats = createEmptyStats();
  stats.operations.feedFetch.total = legacy.totalFetches;
  stats.operations.feedFetch.success = legacy.totalFetches - legacy.errors;
  stats.operations.feedFetch.errors = legacy.errors;
  stats.operations.feedFetch.errorsByCategory.network = legacy.errors;
  if (legacy.lastFetch) {
    stats.operations.feedFetch.lastOperation = {
      url: legacy.lastFetch.url,
      timestamp: legacy.lastFetch.timestamp,
      success: legacy.lastFetch.success,
    };
  }
  return stats;
}

export default function Popup() {
  const {
    feeds,
    loading: feedsLoading,
    subscribe,
    subscribingFeed,
  } = useDiscoveredFeeds();
  const { queue, loading: queueLoading } = useSubscriptionQueue();
  const {
    directoryState,
    communityState,
    totalUpdatedCount,
    totalFollowedCount,
    loading: catalogLoading,
    forceCheck: refreshCatalogUpdates,
    isRefreshing: isCatalogRefreshing,
  } = useCatalogUpdates();
  const {
    state: customBlogState,
    loading: customBlogLoading,
    forceCheck: refreshCustomBlogUpdates,
    isRefreshing: isCustomBlogRefreshing,
  } = useCustomBlogUpdates();
  const {
    settings,
    loading: settingsLoading,
    updateSettings,
  } = useSettings();
  const [stats, setStats] = React.useState<FetchStats>(createEmptyStats);

  const isFeaturedMode = settings.extensionMode === 'featured';

  React.useEffect(() => {
    // Load stats from browser.storage with migration support
    browser.storage.local.get([STORAGE_KEY_STATS]).then((result) => {
      const stored = result[STORAGE_KEY_STATS];
      if (!stored) {
        setStats(createEmptyStats());
        return;
      }

      // Handle legacy format migration
      if (isLegacyStats(stored)) {
        const migrated = migrateLegacyStatsInPopup(stored);
        setStats(migrated);
        // Also save migrated version back to storage
        browser.storage.local.set({ [STORAGE_KEY_STATS]: migrated });
      } else {
        setStats(stored as FetchStats);
      }
    });
  }, []);

  return (
    <ThemeProvider>
      <div className="w-[360px] py-4 px-6 flex flex-col">
        {/* Header */}
        <header className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold">Blogs Are Back</h1>
            <p className="text-sm text-muted-foreground">Feed Discovery</p>
          </div>
          <ThemeToggle />
        </header>

        {/* Mode Selector */}
        <ModeSelector
          mode={settings.extensionMode}
          loading={settingsLoading}
          onChange={(mode) => updateSettings({ extensionMode: mode })}
        />

        {/* Floating Button Toggle - only show in featured mode with feed discovery enabled */}
        {isFeaturedMode && settings.feedDiscoveryEnabled && (
          <div className="flex items-center justify-between py-2 mb-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Floating follow button</span>
              <span className="text-xs text-muted-foreground">
                Show on pages with feeds
              </span>
            </div>
            <Switch
              checked={settings.floatingButtonEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ floatingButtonEnabled: checked })
              }
              disabled={settingsLoading}
            />
          </div>
        )}

        <Separator className="mb-4" />

        {/* Detected Feeds Section - only show when feeds exist or loading */}
        {(feedsLoading || feeds.length > 0) && (
          <>
            <section className="mb-4">
              <h2 className="text-sm font-medium mb-2">Feeds on this page</h2>
              {feedsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="size-5" />
                </div>
              ) : (
                <FeedList
                  feeds={feeds}
                  onSubscribe={subscribe}
                  subscribingFeed={subscribingFeed}
                />
              )}
            </section>

            <Separator />
          </>
        )}

        {/* Queue Summary */}
        <section className="my-4">
          {queueLoading ? (
            <div className="flex items-center gap-2">
              <Spinner className="size-4" />
              <span className="text-sm text-muted-foreground">
                Loading queue...
              </span>
            </div>
          ) : (
            <QueueSummary queueCount={queue.length} />
          )}
        </section>

        <Separator />

        {/* Blog Updates Sections (Featured Mode Only) */}
        {isFeaturedMode && (
          <>
            {/* Catalog Updates Section (Directory + Community) */}
            <section className="my-4">
              <CatalogUpdatesSection
                directoryState={directoryState}
                communityState={communityState}
                totalUpdatedCount={totalUpdatedCount}
                totalFollowedCount={totalFollowedCount}
                loading={catalogLoading}
                onRefresh={refreshCatalogUpdates}
                isRefreshing={isCatalogRefreshing}
              />
            </section>

            <Separator />

            {/* Custom Blog Updates Section */}
            <section className="my-4">
              <CustomBlogUpdatesSection
                state={customBlogState}
                loading={customBlogLoading}
                onRefresh={refreshCustomBlogUpdates}
                isRefreshing={isCustomBlogRefreshing}
              />
            </section>

            <Separator />
          </>
        )}

        {/* Stats Section (Collapsible) */}
        <details className="mt-4 overflow-hidden">
          <summary className="text-sm font-medium cursor-pointer select-none hover:text-muted-foreground transition-colors">
            Statistics
          </summary>
          <StatsSection stats={stats} />
        </details>

        <Separator className="mt-4" />

        {/* Footer */}
        <footer className="mt-4 flex items-center justify-between">
          <a
            href="https://www.blogsareback.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Open Blogs Are Back
          </a>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">v{EXTENSION_VERSION}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => {
                browser.tabs.create({
                  url: browser.runtime.getURL('src/main/main.html#/settings'),
                });
              }}
            >
              <Settings className="size-4" />
              <span className="sr-only">Settings</span>
            </Button>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
