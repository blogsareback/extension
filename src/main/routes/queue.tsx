import { Spinner } from '@/components/ui/spinner'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemGroup,
} from '@/components/ui/item'
import { Badge } from '@/components/ui/badge'
import { useSubscriptionQueue } from '@/popup/hooks/useSubscriptionQueue'
import { DASHBOARD_BASE_URL } from '@/background/utils/constants'

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function QueueRoute() {
  const { queue, loading } = useSubscriptionQueue()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-6" />
      </div>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-medium">Subscription Queue</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Feeds waiting to be added to your Blogs Are Back account
        </p>
      </div>

      {queue.length > 0 ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">
              {queue.length} feed{queue.length !== 1 ? 's' : ''} queued
            </span>
          </div>
          <ItemGroup className="rounded-lg border border-border">
            {queue.map((subscription) => (
              <Item
                key={`${subscription.feedUrl}-${subscription.queuedAt}`}
              >
                <ItemContent>
                  <ItemTitle>
                    <span className="truncate">
                      {subscription.feedTitle || 'Untitled Feed'}
                    </span>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {formatDate(subscription.queuedAt)}
                    </Badge>
                  </ItemTitle>
                  <ItemDescription className="space-y-1">
                    <span className="block truncate text-xs">
                      Feed: {subscription.feedUrl}
                    </span>
                    <span className="block truncate text-xs">
                      From: {subscription.pageUrl}
                    </span>
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
          <p className="mt-6 text-sm text-muted-foreground text-center">
            These feeds will be automatically added when you visit{' '}
            <a
              href={DASHBOARD_BASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              blogsareback.com
            </a>
          </p>
        </>
      ) : (
        <Empty className="py-16 border border-dashed rounded-lg">
          <EmptyHeader>
            <EmptyTitle>No feeds queued</EmptyTitle>
            <EmptyDescription>
              When you subscribe to feeds using the browser extension, they will
              appear here until you visit Blogs Are Back to add them.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  )
}
