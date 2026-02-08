import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ExternalLink, RefreshCw } from 'lucide-react'
import type { CustomBlogUpdatesState } from '@/utils/types'
import { BlogTitleList } from './BlogTitleList'
import { DASHBOARD_BASE_URL } from '@/background/utils/constants'

interface CustomBlogUpdatesSectionProps {
  state: CustomBlogUpdatesState | null
  loading: boolean
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function CustomBlogUpdatesSection({
  state,
  loading,
  onRefresh,
  isRefreshing = false,
}: CustomBlogUpdatesSectionProps) {
  // Format relative time
  const formatRelativeTime = (timestamp: number | null) => {
    if (!timestamp) return null
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return 'just now'
    if (minutes === 1) return '1 minute ago'
    if (minutes < 60) return `${minutes} minutes ago`
    if (hours === 1) return '1 hour ago'
    if (hours < 24) return `${hours} hours ago`
    return 'over a day ago'
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner className="size-4" />
        <span className="text-sm text-muted-foreground">
          Loading custom blogs...
        </span>
      </div>
    )
  }

  // No state at all - never synced
  if (!state) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Custom blogs</span>
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
          to sync your custom blogs.
        </p>
      </div>
    )
  }

  const { status, updatedCount, totalCount, lastCheckedAt, lastSyncAt } = state

  // No custom blogs synced
  if (totalCount === 0) {
    const lastSynced = formatRelativeTime(lastSyncAt)
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Custom blogs</span>
          <Badge variant="secondary">0</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          No custom blogs added.{' '}
          <a
            href={DASHBOARD_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Add some →
          </a>
        </p>
        {lastSynced && (
          <p className="text-xs text-muted-foreground/70">
            Synced {lastSynced}
          </p>
        )}
      </div>
    )
  }

  // Status-based display
  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2">
        <Spinner className="size-4" />
        <span className="text-sm text-muted-foreground">
          Checking custom blogs...
        </span>
      </div>
    )
  }

  if (status === 'error') {
    const lastSynced = formatRelativeTime(lastSyncAt)
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Custom blogs</span>
            <Badge variant="destructive">Error</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {state.error || 'Failed to check custom blogs'}
        </p>
        {lastSynced && (
          <p className="text-xs text-muted-foreground/70">
            {totalCount} blogs synced {lastSynced}
          </p>
        )}
      </div>
    )
  }

  // Success or idle status
  const hasUpdates = updatedCount > 0
  const lastChecked = formatRelativeTime(lastCheckedAt)

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
  ) : null

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Custom blogs</span>
          <Badge variant={hasUpdates ? 'default' : 'secondary'}>
            {updatedCount}
          </Badge>
          {RefreshButton}
        </div>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">
            of {totalCount} total
          </span>
        )}
      </div>
      {lastChecked && (
        <p className="text-xs text-muted-foreground">Checked {lastChecked}</p>
      )}
      {hasUpdates && (
        state.blogs && state.blogs.length > 0 ? (
          <BlogTitleList
            blogs={state.blogs
              .filter(b => b.hasUpdates)
              .map(b => ({ id: b.feedUrl, title: b.title }))}
            maxDisplay={3}
            type="custom"
          />
        ) : (
          <a
            href={DASHBOARD_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            View updates →
          </a>
        )
      )}
    </div>
  )
}
