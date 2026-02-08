import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import browser from '@/utils/browser';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import type { SavedPost } from '@/background/storage/saved-posts-db';
import type { SavedPostResponse, ReextractSavedPostResponse } from '@/utils/types';

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function SavedPostReaderRoute() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<SavedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [reextracting, setReextracting] = useState(false);

  useEffect(() => {
    if (!postId) return;

    browser.runtime
      .sendMessage({ type: 'GET_SAVED_POST', postId })
      .then((response) => {
        const r = response as SavedPostResponse;
        if (r.success && r.post) {
          setPost(r.post);
        }
      })
      .catch((error) => {
        console.error('[SavedPostReader] Failed to load post:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [postId]);

  const handleReextract = async () => {
    if (!post) return;
    setReextracting(true);

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'REEXTRACT_SAVED_POST',
        requestId: crypto.randomUUID(),
        guid: post.guid,
      })) as ReextractSavedPostResponse;

      if (response.success) {
        // Reload the post to get updated content
        const reloadResponse = (await browser.runtime.sendMessage({
          type: 'GET_SAVED_POST',
          postId: post.id,
        })) as SavedPostResponse;

        if (reloadResponse.success && reloadResponse.post) {
          setPost(reloadResponse.post);
        }
      }
    } catch (error) {
      console.error('[SavedPostReader] Re-extract failed:', error);
    } finally {
      setReextracting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!post) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyTitle>Post not found</EmptyTitle>
          <EmptyDescription>
            This saved post may have been deleted.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="ghost" size="sm" onClick={() => navigate('/saved')}>
          <ArrowLeft className="size-4 mr-1" />
          Back to saved posts
        </Button>
      </Empty>
    );
  }

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/saved')}
          className="text-muted-foreground"
        >
          <ArrowLeft className="size-4 mr-1" />
          Saved Posts
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReextract}
            disabled={reextracting}
            className="text-muted-foreground"
          >
            <RefreshCw
              className={`size-4 mr-1 ${reextracting ? 'animate-spin' : ''}`}
            />
            Re-extract
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground"
            >
              <ExternalLink className="size-4 mr-1" />
              Original
            </a>
          </Button>
        </div>
      </div>

      {/* Article header */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold leading-tight">{post.title}</h1>
        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
          {post.author && <span>{post.author}</span>}
          {post.author && post.blogTitle && (
            <span className="text-muted-foreground/40">&middot;</span>
          )}
          {post.blogTitle && <span>{post.blogTitle}</span>}
          {(post.author || post.blogTitle) && post.pubDate && (
            <span className="text-muted-foreground/40">&middot;</span>
          )}
          {post.pubDate && <span>{formatDate(post.pubDate)}</span>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs">
            {post.contentSource === 'rss' ? 'RSS content' : 'Extracted'}
          </Badge>
        </div>
      </header>

      {/* Article content */}
      <article
        className="prose"
        dangerouslySetInnerHTML={{ __html: post.htmlContent }}
      />
    </div>
  );
}
