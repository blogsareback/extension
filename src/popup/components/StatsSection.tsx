import React from 'react';
import type {
  FetchStats,
  OperationType,
  OperationStats,
  ErrorCategory,
} from '@/utils/types';
import {
  getAggregateStats,
  getOperationLabel,
  getErrorCategoryLabel,
} from '@/background/storage/stats';
import { ChevronDown, ChevronRight, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface StatsSectionProps {
  stats: FetchStats;
}

/** Format milliseconds to human-readable */
function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Format timestamp to relative time */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

/** Single operation type stats row */
function OperationRow({
  type,
  stats,
  isExpanded,
  onToggle,
}: {
  type: OperationType;
  stats: OperationStats;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasData = stats.total > 0;
  const successRate = hasData
    ? ((stats.success / stats.total) * 100).toFixed(0)
    : '0';
  const hasErrors = stats.errors > 0;

  // Get non-zero error categories
  const errorCategories = hasErrors
    ? (Object.entries(stats.errorsByCategory) as [ErrorCategory, number][])
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 px-1 hover:bg-muted/50 transition-colors text-left"
        disabled={!hasData}
      >
        <div className="flex items-center gap-2">
          {hasData ? (
            isExpanded ? (
              <ChevronDown className="size-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3 text-muted-foreground" />
            )
          ) : (
            <span className="size-3" />
          )}
          <span className="text-sm font-medium">{getOperationLabel(type)}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {hasData && (
            <>
              <span className="text-muted-foreground">{stats.total}</span>
              <span
                className={
                  hasErrors
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-green-600 dark:text-green-400'
                }
              >
                {successRate}%
              </span>
            </>
          )}
          {!hasData && <span className="text-muted-foreground">—</span>}
        </div>
      </button>

      {isExpanded && hasData && (
        <div className="pb-2 px-6 space-y-2">
          {/* Counts row */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              <CheckCircle2 className="size-3 inline mr-1 text-green-600 dark:text-green-400" />
              {stats.success} success
            </span>
            <span>
              <AlertCircle className="size-3 inline mr-1 text-red-600 dark:text-red-400" />
              {stats.errors} failed
            </span>
          </div>

          {/* Response time */}
          {stats.avgResponseTimeMs !== undefined && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <span>Avg: {formatMs(stats.avgResponseTimeMs)}</span>
            </div>
          )}

          {/* Error breakdown */}
          {errorCategories.length > 0 && (
            <div className="pt-1">
              <div className="text-xs text-muted-foreground mb-1">
                Error breakdown:
              </div>
              <div className="flex flex-wrap gap-1">
                {errorCategories.map(([category, count]) => (
                  <span
                    key={category}
                    className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded"
                  >
                    {getErrorCategoryLabel(category)}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last operation */}
          {stats.lastOperation && (
            <div className="pt-1 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Last: {formatRelativeTime(stats.lastOperation.timestamp)}</span>
                <span
                  className={
                    stats.lastOperation.success
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }
                >
                  {stats.lastOperation.success ? 'OK' : 'Failed'}
                </span>
              </div>
              <div className="truncate mt-0.5 opacity-70">
                {stats.lastOperation.url}
              </div>
              {stats.lastOperation.responseTimeMs !== undefined && (
                <span className="opacity-70">
                  {formatMs(stats.lastOperation.responseTimeMs)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StatsSection({ stats }: StatsSectionProps) {
  const [expandedOps, setExpandedOps] = React.useState<Set<OperationType>>(
    new Set()
  );

  const aggregate = getAggregateStats(stats);
  const hasAnyData = aggregate.total > 0;

  const toggleOp = (type: OperationType) => {
    setExpandedOps((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Order operations by total count (most used first)
  const operationTypes: OperationType[] = [
    'feedFetch',
    'pageFetch',
    'readableText',
    'readableHtml',
  ];
  const sortedOps = [...operationTypes].sort(
    (a, b) => stats.operations[b].total - stats.operations[a].total
  );

  return (
    <div className="mt-2 space-y-3 min-w-0 overflow-hidden">
      {/* Aggregate summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted/50 rounded p-2">
          <div className="text-lg font-semibold">{aggregate.total}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <div
            className={`text-lg font-semibold ${aggregate.errors > 0
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-green-600 dark:text-green-400'
              }`}
          >
            {aggregate.successRate.toFixed(0)}%
          </div>
          <div className="text-xs text-muted-foreground">Success</div>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <div
            className={`text-lg font-semibold ${aggregate.errors > 0
                ? 'text-red-600 dark:text-red-400'
                : ''
              }`}
          >
            {aggregate.errors}
          </div>
          <div className="text-xs text-muted-foreground">Errors</div>
        </div>
      </div>

      {/* Per-operation breakdown */}
      {hasAnyData && (
        <div className="border border-border rounded">
          {sortedOps.map((type) => (
            <OperationRow
              key={type}
              type={type}
              stats={stats.operations[type]}
              isExpanded={expandedOps.has(type)}
              onToggle={() => toggleOp(type)}
            />
          ))}
        </div>
      )}

      {/* No data message */}
      {!hasAnyData && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No operations tracked yet. Statistics will appear here when the web
          app makes requests through the extension.
        </p>
      )}

      {/* Tracking period */}
      {hasAnyData && (
        <p className="text-xs text-muted-foreground text-center">
          Tracking since {new Date(stats.startedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
