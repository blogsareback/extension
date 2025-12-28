import browser from '@/utils/browser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface QueueSummaryProps {
  queueCount: number;
}

export function QueueSummary({ queueCount }: QueueSummaryProps) {
  const openQueuePage = () => {
    browser.tabs.create({
      url: browser.runtime.getURL('src/main/main.html#/queue'),
    });
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Queued feeds</span>
        <Badge variant={queueCount > 0 ? 'default' : 'secondary'}>
          {queueCount}
        </Badge>
      </div>
      {queueCount > 0 && (
        <Button variant="ghost" size="sm" onClick={openQueuePage}>
          View all
        </Button>
      )}
    </div>
  );
}
