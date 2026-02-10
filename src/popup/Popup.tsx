import React from 'react';
import browser from '../utils/browser';
import type { FetchStats, LegacyFetchStats } from '../utils/types';
import { STORAGE_KEY_STATS } from '../utils/constants';
import { createEmptyStats } from '@/background/storage/stats';
import { ThemeProvider } from '@/components/theme-provier';
import ThemeToggle from '@/components/theme-toggle';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings, BookOpen, ArrowUpRight } from 'lucide-react';
import { useDiscoveredFeeds } from './hooks/useDiscoveredFeeds';
import { useSubscriptionQueue } from './hooks/useSubscriptionQueue';
import { useCatalogUpdates } from './hooks/useCatalogUpdates';
import { useCustomBlogUpdates } from './hooks/useCustomBlogUpdates';
import { useSettings } from './hooks/useSettings';
import { FeedList } from './components/FeedList';
import { QueueSummary } from './components/QueueSummary';
import { SavedPostsSummary } from './components/SavedPostsSummary';
import { useSavedPostsCount } from './hooks/useSavedPostsCount';
import { CatalogUpdatesSection } from './components/CatalogUpdatesSection';
import { CustomBlogUpdatesSection } from './components/CustomBlogUpdatesSection';
import { ModeSelector } from './components/ModeSelector';
import { StatsSection } from './components/StatsSection';
import { TabBar } from './components/TabBar';
import { EXTENSION_VERSION } from '@/utils/constants';
import { DASHBOARD_BASE_URL } from '@/background/utils/constants';

type TabId = 'feeds' | 'updates' | 'stats';

const TAB_STORAGE_KEY = 'popup_active_tab';
const VALID_TABS: TabId[] = ['feeds', 'updates', 'stats'];

function getSavedTab(): TabId {
  const saved = localStorage.getItem(TAB_STORAGE_KEY);
  if (saved && VALID_TABS.includes(saved as TabId)) return saved as TabId;
  return 'feeds';
}

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
  const { count: savedPostsCount, loading: savedPostsLoading } =
    useSavedPostsCount();
  const [stats, setStats] = React.useState<FetchStats>(createEmptyStats);
  const [activeTab, setActiveTab] = React.useState<TabId>(getSavedTab);

  const changeTab = (tab: TabId) => {
    setActiveTab(tab);
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  };

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

  // If user switches to basic mode while on updates tab, go back to feeds
  React.useEffect(() => {
    if (!settingsLoading && !isFeaturedMode && activeTab === 'updates') {
      changeTab('feeds');
    }
  }, [settingsLoading, isFeaturedMode, activeTab]);

  // Determine notification dots
  const feedsDot = feeds.length > 0;
  const customBlogUpdatedCount = customBlogState?.updatedCount ?? 0;
  const updatesDot = totalUpdatedCount > 0 || customBlogUpdatedCount > 0;

  // Build tabs array
  const tabs = [
    { id: 'feeds', label: 'Feeds', dot: feedsDot },
    ...(isFeaturedMode
      ? [{ id: 'updates', label: 'Updates', dot: updatesDot }]
      : []),
    { id: 'stats', label: 'Stats' },
  ];

  return (
    <ThemeProvider>
      <div className="w-[360px] flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-4 pb-2">
          <h1 className="text-lg font-semibold">Blogs Are Back</h1>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
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
        </header>

        {/* Mode Selector + Floating Button */}
        <div className="px-6">
          <ModeSelector
            mode={settings.extensionMode}
            loading={settingsLoading}
            onChange={(mode) => updateSettings({ extensionMode: mode })}
          />

          {isFeaturedMode && settings.feedDiscoveryEnabled && (
            <div className="flex items-center justify-between py-2">
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
        </div>

        {/* Tab Bar */}
        <div className="px-6 py-2">
          <TabBar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(id) => changeTab(id as TabId)}
          />
        </div>

        {/* Tab Content */}
        <div className="px-6 pb-2 min-h-[120px]">
          {/* Feeds Tab */}
          {activeTab === 'feeds' && (
            <div className="tab-panel space-y-4 py-2">
              {/* Detected Feeds */}
              {(feedsLoading || feeds.length > 0) && (
                <section>
                  <h2 className="text-sm font-medium mb-2">Feeds on this page</h2>
                  {feedsLoading ? (
                    <div className="flex items-center justify-center py-6">
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
              )}

              {!feedsLoading && feeds.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  No feeds detected on this page.
                </p>
              )}

              {/* Queue Summary */}
              <section>
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

              {/* Saved Posts Summary */}
              <section>
                {savedPostsLoading ? (
                  <div className="flex items-center gap-2">
                    <Spinner className="size-4" />
                    <span className="text-sm text-muted-foreground">
                      Loading saved posts...
                    </span>
                  </div>
                ) : (
                  <SavedPostsSummary count={savedPostsCount} />
                )}
              </section>
            </div>
          )}

          {/* Updates Tab (Featured Mode Only) */}
          {activeTab === 'updates' && isFeaturedMode && (
            <div className="tab-panel space-y-4 py-2">
              <section>
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

              <section>
                <CustomBlogUpdatesSection
                  state={customBlogState}
                  loading={customBlogLoading}
                  onRefresh={refreshCustomBlogUpdates}
                  isRefreshing={isCustomBlogRefreshing}
                />
              </section>
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && (
            <div className="tab-panel py-2">
              <StatsSection stats={stats} />
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 pt-3 pb-4 border-t border-border">
          <a
            href={DASHBOARD_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="open-reader-btn group flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BookOpen className="size-4" />
            <span>Open Reader</span>
            <ArrowUpRight className="size-3.5 opacity-50" />
          </a>
          <p className="text-center text-[10px] text-muted-foreground/50 mt-2">v{EXTENSION_VERSION}</p>
        </footer>
      </div>
    </ThemeProvider>
  );
}
