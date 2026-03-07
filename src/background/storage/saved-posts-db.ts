/**
 * IndexedDB Storage Module for Saved Posts
 *
 * Provides offline reading by storing full post content in the extension's IndexedDB.
 * Uses IndexedDB (not chrome.storage) for essentially unlimited storage.
 */

import {
  SAVED_POSTS_DB_NAME,
  SAVED_POSTS_DB_VERSION,
  SAVED_POSTS_STORE_NAME,
  SAVED_POSTS_MAX_COUNT,
  SAVED_POSTS_MAX_SIZE_BYTES,
} from '../utils/constants';

export interface SavedPost {
  id: string; // guidHash (keyPath)
  guid: string; // original post GUID
  link: string; // original post URL
  title: string;
  author?: string;
  pubDate: number | null; // ms timestamp
  description?: string;
  image?: string;
  blogId?: string;
  blogTitle?: string;
  blogIcon?: string;
  blogFeedUrl?: string;
  htmlContent: string; // cleaned HTML (RSS or Readability)
  contentSource: 'rss' | 'extracted';
  savedAt: number; // ms timestamp
  contentSizeBytes: number;
  domain?: string; // hostname from URL (e.g. 'nytimes.com')
  saveSource?: 'blog-post' | 'url'; // distinguish blog saves from URL saves
}

/**
 * Open (or create) the saved posts database
 */
export function openSavedPostsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SAVED_POSTS_DB_NAME, SAVED_POSTS_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(SAVED_POSTS_STORE_NAME)) {
        const store = db.createObjectStore(SAVED_POSTS_STORE_NAME, {
          keyPath: 'id',
        });
        store.createIndex('guid', 'guid', { unique: true });
        store.createIndex('blogId', 'blogId', { unique: false });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a post to IndexedDB
 * Enforces count and size limits with oldest-first eviction
 */
export async function savePost(post: SavedPost): Promise<void> {
  const db = await openSavedPostsDB();

  try {
    // Check limits and evict if needed
    await evictIfNeeded(db, post.contentSizeBytes);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVED_POSTS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SAVED_POSTS_STORE_NAME);
      store.put(post);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Get a single saved post by ID (guidHash)
 */
export async function getPost(id: string): Promise<SavedPost | undefined> {
  const db = await openSavedPostsDB();

  try {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVED_POSTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SAVED_POSTS_STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result as SavedPost | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Get all saved posts, sorted by savedAt (newest first)
 */
export async function getAllPosts(): Promise<SavedPost[]> {
  const db = await openSavedPostsDB();

  try {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVED_POSTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SAVED_POSTS_STORE_NAME);
      const index = store.index('savedAt');
      const request = index.openCursor(null, 'prev'); // newest first
      const results: SavedPost[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          results.push(cursor.value as SavedPost);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Delete a saved post by ID (guidHash)
 */
export async function deletePost(id: string): Promise<void> {
  const db = await openSavedPostsDB();

  try {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVED_POSTS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SAVED_POSTS_STORE_NAME);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Check if a post is already saved (by GUID)
 */
export async function isPostSaved(guid: string): Promise<boolean> {
  const db = await openSavedPostsDB();

  try {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVED_POSTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SAVED_POSTS_STORE_NAME);
      const index = store.index('guid');
      const request = index.count(guid);

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Get all saved post GUIDs (lightweight - no content fetched)
 */
export async function getAllSavedPostGuids(): Promise<string[]> {
  const db = await openSavedPostsDB();

  try {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVED_POSTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SAVED_POSTS_STORE_NAME);
      const index = store.index('guid');
      const request = index.openKeyCursor();
      const guids: string[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          guids.push(cursor.key as string);
          cursor.continue();
        } else {
          resolve(guids);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Get count of saved posts
 */
export async function getSavedPostCount(): Promise<number> {
  const db = await openSavedPostsDB();

  try {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVED_POSTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SAVED_POSTS_STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Get storage statistics (count + total size)
 */
export async function getStorageStats(): Promise<{
  count: number;
  totalSizeBytes: number;
}> {
  const db = await openSavedPostsDB();

  try {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVED_POSTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SAVED_POSTS_STORE_NAME);
      const request = store.openCursor();
      let count = 0;
      let totalSizeBytes = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const post = cursor.value as SavedPost;
          count++;
          totalSizeBytes += post.contentSizeBytes;
          cursor.continue();
        } else {
          resolve({ count, totalSizeBytes });
        }
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Evict oldest posts if count or size limits would be exceeded
 */
async function evictIfNeeded(
  db: IDBDatabase,
  incomingSizeBytes: number
): Promise<void> {
  const stats = await new Promise<{ count: number; totalSizeBytes: number }>(
    (resolve, reject) => {
      const tx = db.transaction(SAVED_POSTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SAVED_POSTS_STORE_NAME);
      const request = store.openCursor();
      let count = 0;
      let totalSizeBytes = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const post = cursor.value as SavedPost;
          count++;
          totalSizeBytes += post.contentSizeBytes;
          cursor.continue();
        } else {
          resolve({ count, totalSizeBytes });
        }
      };
      request.onerror = () => reject(request.error);
    }
  );

  const needEvictCount = stats.count >= SAVED_POSTS_MAX_COUNT;
  const needEvictSize =
    stats.totalSizeBytes + incomingSizeBytes > SAVED_POSTS_MAX_SIZE_BYTES;

  if (!needEvictCount && !needEvictSize) return;

  // Get posts sorted by savedAt (oldest first) for eviction
  const oldestPosts = await new Promise<SavedPost[]>((resolve, reject) => {
    const tx = db.transaction(SAVED_POSTS_STORE_NAME, 'readonly');
    const store = tx.objectStore(SAVED_POSTS_STORE_NAME);
    const index = store.index('savedAt');
    const request = index.openCursor(null, 'next'); // oldest first
    const results: SavedPost[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        results.push(cursor.value as SavedPost);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });

  // Determine how many to evict
  let currentCount = stats.count;
  let currentSize = stats.totalSizeBytes;
  const idsToDelete: string[] = [];

  for (const post of oldestPosts) {
    const overCount = currentCount >= SAVED_POSTS_MAX_COUNT;
    const overSize =
      currentSize + incomingSizeBytes > SAVED_POSTS_MAX_SIZE_BYTES;

    if (!overCount && !overSize) break;

    idsToDelete.push(post.id);
    currentCount--;
    currentSize -= post.contentSizeBytes;
  }

  if (idsToDelete.length === 0) return;

  // Delete evicted posts
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAVED_POSTS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SAVED_POSTS_STORE_NAME);

    for (const id of idsToDelete) {
      store.delete(id);
    }

    tx.oncomplete = () => {
      console.log(
        `[Saved Posts DB] Evicted ${idsToDelete.length} oldest posts`
      );
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
