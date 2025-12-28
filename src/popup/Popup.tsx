import React from 'react';
import browser from '../utils/browser';
import type { FetchStats } from '../utils/types';
import { STORAGE_KEY_STATS } from '../utils/constants';
import { ThemeProvider } from '@/components/theme-provier';
import ThemeToggle from '@/components/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { useDiscoveredFeeds } from './hooks/useDiscoveredFeeds';
import { useSubscriptionQueue } from './hooks/useSubscriptionQueue';
import { useDirectoryUpdates } from './hooks/useDirectoryUpdates';
import { useCustomBlogUpdates } from './hooks/useCustomBlogUpdates';
import { useSettings } from './hooks/useSettings';
import { FeedList } from './components/FeedList';
import { QueueSummary } from './components/QueueSummary';
import { DirectoryUpdatesSection } from './components/DirectoryUpdatesSection';
import { CustomBlogUpdatesSection } from './components/CustomBlogUpdatesSection';
import { ModeSelector } from './components/ModeSelector';
import { StatsSection } from './components/StatsSection';
import { EXTENSION_VERSION } from '@/utils/constants';

export default function Popup() {
  const {
    feeds,
    loading: feedsLoading,
    subscribe,
    subscribingFeed,
  } = useDiscoveredFeeds();
  const { queue, loading: queueLoading } = useSubscriptionQueue();
  const {
    state: directoryState,
    loading: directoryLoading,
    forceCheck: refreshDirectoryUpdates,
    isRefreshing: isDirectoryRefreshing,
  } = useDirectoryUpdates();
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
  const [stats, setStats] = React.useState<FetchStats>({
    totalFetches: 0,
    errors: 0,
  });

  const isFeaturedMode = settings.extensionMode === 'featured';

  React.useEffect(() => {
    // Load stats from browser.storage
    browser.storage.local.get([STORAGE_KEY_STATS]).then((result) => {
      if (result[STORAGE_KEY_STATS]) {
        setStats(result[STORAGE_KEY_STATS] as FetchStats);
      }
    });
  }, []);

  return (
    <ThemeProvider>
      <div className="w-[360px] p-4 bg-background">
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
            {/* Directory Updates Section */}
            <section className="my-4">
              <DirectoryUpdatesSection
                state={directoryState}
                loading={directoryLoading}
                onRefresh={refreshDirectoryUpdates}
                isRefreshing={isDirectoryRefreshing}
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
        <details className="mt-4">
          <summary className="text-sm font-medium cursor-pointer select-none hover:text-muted-foreground transition-colors">
            Statistics
          </summary>
          <StatsSection stats={stats} />
        </details>

        <Separator className="mt-4" />

        {/* Footer */}
        <footer className="mt-4 flex items-center justify-between">
          <a
            href="https://www.blogsareback.com"
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
