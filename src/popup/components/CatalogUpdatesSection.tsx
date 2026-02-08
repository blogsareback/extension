import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ExternalLink, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { CatalogSourceUpdatesState } from '@/utils/types';
import { BlogTitleList } from './BlogTitleList';
import { DASHBOARD_BASE_URL } from '@/background/utils/constants'

interface CatalogUpdatesSectionProps {
  directoryState: CatalogSourceUpdatesState | null;
  communityState: CatalogSourceUpdatesState | null;
  totalUpdatedCount: number;
  totalFollowedCount: number;
  loading: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function CatalogUpdatesSection({
  directoryState,
  communityState,
  totalUpdatedCount,
  totalFollowedCount,
  loading,
  onRefresh,
  isRefreshing = false,
}: CatalogUpdatesSectionProps) {
  const [showDetails, setShowDetails] = useState(false);

  const formatRelativeTime = (timestamp: number | null) => {
    if (!timestamp) return null;
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    return 'over a day ago';
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner className="size-4" />
        <span className="text-sm text-muted-foreground">Loading updates...</span>
      </div>
    );
  }

  // Determine sync status
  const directorySynced = directoryState?.syncStatus === 'synced' || directoryState?.syncStatus === 'synced_empty';
  const communitySynced = communityState?.syncStatus === 'synced' || communityState?.syncStatus === 'synced_empty';
  const anySynced = directorySynced || communitySynced;
  const lastSyncAt = Math.max(directoryState?.lastSyncAt ?? 0, communityState?.lastSyncAt ?? 0) || null;

  // No state at all - never synced
  if (!directoryState && !communityState) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Catalog updates</span>
          <Badge variant="outline">Not synced</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Open{' '}
          <a
            href={DASHBOARD_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-0.5"
          >
            Blogs Are Back
            <ExternalLink className="size-3" />
          </a>{' '}
          to sync your followed blogs.
        </p>
      </div>
    );
  }

  // Not synced yet
  if (!anySynced) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Catalog updates</span>
          <Badge variant="outline">Not synced</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Open{' '}
          <a
            href={DASHBOARD_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-0.5"
          >
            Blogs Are Back
            <ExternalLink className="size-3" />
          </a>{' '}
          to sync your followed blogs.
        </p>
      </div>
    );
  }

  // Synced but user has no catalog blogs
  if (totalFollowedCount === 0) {
    const lastSynced = formatRelativeTime(lastSyncAt);
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Catalog updates</span>
          <Badge variant="secondary">0</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          No catalog blogs followed.{' '}
          <a
            href={`${DASHBOARD_BASE_URL}/explore`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Explore blogs
          </a>
        </p>
        {lastSynced && (
          <p className="text-xs text-muted-foreground/70">Synced {lastSynced}</p>
        )}
      </div>
    );
  }

  // Determine status
  const isChecking = directoryState?.status === 'checking' || communityState?.status === 'checking';
  const hasError = directoryState?.status === 'error' || communityState?.status === 'error';
  const isDisabled = directoryState?.status === 'disabled' && communityState?.status === 'disabled';

  if (isChecking) {
    return (
      <div className="flex items-center gap-2">
        <Spinner className="size-4" />
        <span className="text-sm text-muted-foreground">Checking for updates...</span>
      </div>
    );
  }

  if (isDisabled) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Catalog updates</span>
        <Badge variant="secondary">Disabled</Badge>
      </div>
    );
  }

  const lastCheckedAt = Math.max(directoryState?.lastCheckedAt ?? 0, communityState?.lastCheckedAt ?? 0) || null;
  const lastChecked = formatRelativeTime(lastCheckedAt);

  const RefreshButton = onRefresh ? (
    <Button
      variant="ghost"
      size="icon"
      className="size-6"
      onClick={onRefresh}
      disabled={isRefreshing}
      title="Check for updates"
    >
      {isRefreshing ? <Spinner className="size-3" /> : <RefreshCw className="size-3" />}
    </Button>
  ) : null;

  const hasUpdates = totalUpdatedCount > 0;

  // Combine updated blogs from both sources
  const allUpdatedBlogs: Array<{ id: string; title: string; source: 'directory' | 'community' }> = [
    ...(directoryState?.updatedBlogs?.map(b => ({ ...b, source: 'directory' as const })) ?? []),
    ...(communityState?.updatedBlogs?.map(b => ({ ...b, source: 'community' as const })) ?? []),
  ];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Catalog updates</span>
          <Badge variant={hasUpdates ? 'default' : 'secondary'}>{totalUpdatedCount}</Badge>
          {RefreshButton}
        </div>
        {totalFollowedCount > 0 && (
          <span className="text-xs text-muted-foreground">of {totalFollowedCount} followed</span>
        )}
      </div>

      {hasError && (
        <p className="text-xs text-destructive">
          {directoryState?.error || communityState?.error || 'Error checking updates'}
        </p>
      )}

      {lastChecked && <p className="text-xs text-muted-foreground">Checked {lastChecked}</p>}

      {hasUpdates && allUpdatedBlogs.length > 0 && (
        <BlogTitleList blogs={allUpdatedBlogs} maxDisplay={3} type="catalog" />
      )}

      {hasUpdates && allUpdatedBlogs.length === 0 && (
        <a
          href={DASHBOARD_BASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          View updates
        </a>
      )}

      {/* Details toggle for breakdown */}
      {(directoryState || communityState) && totalFollowedCount > 0 && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showDetails ? (
            <>
              <ChevronUp className="size-3" />
              Hide breakdown
            </>
          ) : (
            <>
              <ChevronDown className="size-3" />
              Show breakdown
            </>
          )}
        </button>
      )}

      {showDetails && (
        <div className="pl-2 space-y-1 border-l-2 border-muted">
          {directoryState && (directoryState.followedCount ?? 0) > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Directory blogs</span>
              <span>{directoryState.updatedCount ?? 0} / {directoryState.followedCount ?? 0}</span>
            </div>
          )}
          {communityState && (communityState.followedCount ?? 0) > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Community blogs</span>
              <span>{communityState.updatedCount ?? 0} / {communityState.followedCount ?? 0}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
