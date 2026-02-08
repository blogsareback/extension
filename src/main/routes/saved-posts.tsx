import { useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemGroup,
} from '@/components/ui/item';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Download, Upload } from 'lucide-react';
import { useSavedPosts } from '@/main/hooks/useSavedPosts';
import { useRef, useState } from 'react';

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SavedPostsRoute() {
  const { posts, loading, deletePost, deleteAll, exportPosts, importPosts } = useSavedPosts();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);

  const totalSize = posts.reduce((sum, p) => sum + p.contentSizeBytes, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-medium">Saved Posts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Posts saved for offline reading
        </p>
      </div>

      {posts.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              {posts.length} post{posts.length !== 1 ? 's' : ''} &middot;{' '}
              {formatSize(totalSize)}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await exportPosts();
                  } catch {
                    window.alert('Export failed. Check the console for details.');
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Upload className="size-4 mr-1" />
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Download className="size-4 mr-1" />
                Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const result = await importPosts(file);
                    window.alert(
                      `Import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`
                    );
                  } catch (err) {
                    window.alert(
                      `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`
                    );
                  }
                  // Reset input so same file can be re-selected
                  e.target.value = '';
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (
                    window.confirm(
                      'Delete all saved posts? This cannot be undone.'
                    )
                  ) {
                    deleteAll();
                  }
                }}
              >
                <Trash2 className="size-4 mr-1" />
                Delete all
              </Button>
            </div>
          </div>
          <ItemGroup className="rounded-lg border border-border">
            {posts.map((post) => (
              <Item
                key={post.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/saved/${post.id}`)}
              >
                <ItemContent>
                  <ItemTitle>
                    <span className="truncate">{post.title}</span>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {formatSize(post.contentSizeBytes)}
                    </Badge>
                  </ItemTitle>
                  <ItemDescription className="space-y-0.5">
                    {post.blogTitle && (
                      <span className="block text-xs">{post.blogTitle}</span>
                    )}
                    <span className="block text-xs text-muted-foreground/60">
                      {post.pubDate
                        ? `Published ${formatDate(post.pubDate)}`
                        : 'No publish date'}{' '}
                      &middot; Saved {formatDate(post.savedAt)}
                      {post.contentSource === 'extracted' && ' · Extracted'}
                    </span>
                  </ItemDescription>
                </ItemContent>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 size-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePost(post.guid);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </Item>
            ))}
          </ItemGroup>
        </>
      ) : (
        <Empty className="py-16 border border-dashed rounded-lg">
          <EmptyHeader>
            <EmptyTitle>No saved posts</EmptyTitle>
            <EmptyDescription>
              Save posts for offline reading from the Blogs Are Back web app.
              Look for the save icon in the post reader header or right-click
              menu.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  );
}
