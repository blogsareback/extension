import type { FeedLink } from '@/utils/types';
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemGroup,
} from '@/components/ui/item';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

interface FeedListProps {
  feeds: FeedLink[];
  onSubscribe: (feed: FeedLink) => Promise<boolean>;
  subscribingFeed: string | null;
}

function getFeedTypeLabel(type?: string): string {
  if (!type) return 'Feed';
  if (type.includes('atom')) return 'Atom';
  if (type.includes('rss')) return 'RSS';
  return 'Feed';
}

export function FeedList({
  feeds,
  onSubscribe,
  subscribingFeed,
}: FeedListProps) {
  return (
    <ItemGroup className="rounded-md border border-border">
      {feeds.map((feed, index) => {
        const isSubscribing = subscribingFeed === feed.href;
        const feedTitle = feed.title || 'Untitled Feed';
        const feedType = getFeedTypeLabel(feed.type);

        return (
          <Item
            key={feed.href}
            size="sm"
            className={index > 0 ? 'border-t border-border' : ''}
          >
            <ItemContent>
              <ItemTitle>
                <span className="truncate max-w-[180px]">{feedTitle}</span>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {feedType}
                </Badge>
              </ItemTitle>
              <ItemDescription className="truncate text-xs">
                {feed.href}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSubscribe(feed)}
                disabled={isSubscribing}
                className="shrink-0"
              >
                {isSubscribing ? (
                  <>
                    <Spinner className="size-3 mr-1" />
                    Adding...
                  </>
                ) : (
                  'Add'
                )}
              </Button>
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
