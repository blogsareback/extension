import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { DirectoryUpdatesState } from '@/utils/types';
import { BlogTitleList } from './BlogTitleList';

interface DirectoryUpdatesSectionProps {
  state: DirectoryUpdatesState | null;
  loading: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function DirectoryUpdatesSection({
  state,
  loading,
  onRefresh,
  isRefreshing = false,
}: DirectoryUpdatesSectionProps) {
  // Format relative time
  const formatRelativeTime = (timestamp: number | null) => {
    if (!timestamp) return null;
    const now = Date.now();
    const diff = now - timestamp;
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
        <span className="text-sm text-muted-foreground">
          Loading updates...
        </span>
      </div>
    );
  }

  // No state at all - never synced
  if (!state) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Blog updates</span>
          <Badge variant="outline">Not synced</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Open{' '}
          <a
            href="https://www.blogsareback.com"
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

  const { status, updatedCount, followedDirectoryCount, syncStatus, lastSyncAt } = state;

  // Not synced yet (state exists but no sync has happened)
  if (syncStatus === 'not_synced' || (!syncStatus && followedDirectoryCount === 0 && !lastSyncAt)) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Blog updates</span>
          <Badge variant="outline">Not synced</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Open{' '}
          <a
            href="https://www.blogsareback.com"
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

  // Synced but user has no directory blogs
  if (syncStatus === 'synced_empty') {
    const lastSynced = formatRelativeTime(lastSyncAt ?? null);
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Blog updates</span>
          <Badge variant="secondary">0</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          No directory blogs followed.{' '}
          <a
            href="https://blogsareback.com/explore"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Explore blogs →
          </a>
        </p>
        {lastSynced && (
          <p className="text-xs text-muted-foreground/70">
            Synced {lastSynced}
          </p>
        )}
      </div>
    );
  }

  // Status-based display
  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2">
        <Spinner className="size-4" />
        <span className="text-sm text-muted-foreground">
          Checking for updates...
        </span>
      </div>
    );
  }

  if (status === 'error') {
    const lastSynced = formatRelativeTime(lastSyncAt ?? null);
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Blog updates</span>
            <Badge variant="destructive">Error</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {state.error || 'Failed to check for updates'}
        </p>
        {lastSynced && (
          <p className="text-xs text-muted-foreground/70">
            {followedDirectoryCount} blogs synced {lastSynced}
          </p>
        )}
      </div>
    );
  }

  if (status === 'disabled') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Blog updates</span>
        <Badge variant="secondary">Disabled</Badge>
      </div>
    );
  }

  // Success status
  const hasUpdates = updatedCount > 0;
  const lastChecked = formatRelativeTime(state.lastCheckedAt);

  // Refresh button component
  const RefreshButton = onRefresh ? (
    <Button
      variant="ghost"
      size="icon"
      className="size-6"
      onClick={onRefresh}
      disabled={isRefreshing}
      title="Check for updates"
    >
      {isRefreshing ? (
        <Spinner className="size-3" />
      ) : (
        <RefreshCw className="size-3" />
      )}
    </Button>
  ) : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Blog updates</span>
          <Badge variant={hasUpdates ? 'default' : 'secondary'}>
            {updatedCount}
          </Badge>
          {RefreshButton}
        </div>
        {followedDirectoryCount > 0 && (
          <span className="text-xs text-muted-foreground">
            of {followedDirectoryCount} followed
          </span>
        )}
      </div>
      {lastChecked && (
        <p className="text-xs text-muted-foreground">
          Checked {lastChecked}
        </p>
      )}
      {hasUpdates && (
        state.updatedBlogs && state.updatedBlogs.length > 0 ? (
          <BlogTitleList
            blogs={state.updatedBlogs}
            maxDisplay={3}
            type="directory"
          />
        ) : (
          <a
            href="https://www.blogsareback.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            View updates →
          </a>
        )
      )}
    </div>
  );
}
