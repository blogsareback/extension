import browser from '@/utils/browser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SavedPostsSummaryProps {
  count: number;
}

export function SavedPostsSummary({ count }: SavedPostsSummaryProps) {
  const openSavedPostsPage = () => {
    browser.tabs.create({
      url: browser.runtime.getURL('src/main/main.html#/saved'),
    });
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Saved posts</span>
        <Badge variant={count > 0 ? 'default' : 'secondary'}>{count}</Badge>
      </div>
      {count > 0 && (
        <Button variant="ghost" size="sm" onClick={openSavedPostsPage}>
          View all
        </Button>
      )}
    </div>
  );
}
