import type { FetchStats } from '@/utils/types';

interface StatsSectionProps {
  stats: FetchStats;
}

export function StatsSection({ stats }: StatsSectionProps) {
  const successRate =
    stats.totalFetches > 0
      ? (
          ((stats.totalFetches - stats.errors) / stats.totalFetches) *
          100
        ).toFixed(1)
      : '0';

  return (
    <div className="mt-2 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Status:</span>
        <span className="font-medium text-green-600 dark:text-green-400">
          Active
        </span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Total Fetches:</span>
        <span className="font-medium">{stats.totalFetches}</span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Errors:</span>
        <span className="font-medium text-red-600 dark:text-red-400">
          {stats.errors}
        </span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Success Rate:</span>
        <span className="font-medium">{successRate}%</span>
      </div>

      {stats.lastFetch && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Last fetch:{' '}
            {new Date(stats.lastFetch.timestamp).toLocaleTimeString()}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-1">
            {stats.lastFetch.url}
          </p>
          <p className="text-xs mt-1">
            <span
              className={
                stats.lastFetch.success
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              {stats.lastFetch.success ? 'Success' : 'Failed'}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
