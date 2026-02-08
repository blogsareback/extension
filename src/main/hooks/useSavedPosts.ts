import { useState, useEffect, useCallback } from 'react';
import browser from '@/utils/browser';
import type { SavedPost } from '@/background/storage/saved-posts-db';
import type {
  AllSavedPostsResponse,
  DeleteSavedPostResponse,
  ExportSavedPostsResponse,
  ImportSavedPostsResponse,
} from '@/utils/types';

export function useSavedPosts() {
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const response = (await browser.runtime.sendMessage({
        type: 'GET_ALL_SAVED_POSTS',
      })) as AllSavedPostsResponse;

      if (response.success) {
        setPosts(response.posts);
      }
    } catch (error) {
      console.error('[useSavedPosts] Failed to fetch saved posts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deletePost = useCallback(
    async (guid: string) => {
      // Generate the same ID hash the handler uses
      let hash = 5381;
      for (let i = 0; i < guid.length; i++) {
        hash = ((hash << 5) + hash + guid.charCodeAt(i)) & 0xffffffff;
      }
      const id = Math.abs(hash).toString(36);

      try {
        const response = (await browser.runtime.sendMessage({
          type: 'DELETE_SAVED_POST',
          requestId: crypto.randomUUID(),
          guid,
        })) as DeleteSavedPostResponse;

        if (response.success) {
          setPosts((prev) => prev.filter((p) => p.id !== id));
        }
        return response.success;
      } catch (error) {
        console.error('[useSavedPosts] Failed to delete post:', error);
        return false;
      }
    },
    []
  );

  const deleteAll = useCallback(async () => {
    // Delete all posts one by one
    for (const post of posts) {
      await deletePost(post.guid);
    }
    setPosts([]);
  }, [posts, deletePost]);

  const exportPosts = useCallback(async () => {
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'EXPORT_SAVED_POSTS',
      })) as ExportSavedPostsResponse;

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Export failed');
      }

      const json = JSON.stringify(response.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bab-saved-posts-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[useSavedPosts] Export failed:', error);
      throw error;
    }
  }, []);

  const importPosts = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.version || !Array.isArray(data.posts)) {
          throw new Error('Invalid export file format');
        }

        const response = (await browser.runtime.sendMessage({
          type: 'IMPORT_SAVED_POSTS',
          posts: data.posts,
        })) as ImportSavedPostsResponse;

        if (!response.success) {
          throw new Error(response.error || 'Import failed');
        }

        await refresh();
        return {
          imported: response.imported ?? 0,
          skipped: response.skipped ?? 0,
          errors: response.errors ?? 0,
        };
      } catch (error) {
        console.error('[useSavedPosts] Import failed:', error);
        throw error;
      }
    },
    [refresh]
  );

  return { posts, loading, deletePost, deleteAll, refresh, exportPosts, importPosts };
}
