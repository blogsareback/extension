/**
 * Save Post Handler
 *
 * Handles saving, checking, deleting, and re-extracting offline posts.
 * Content strategy: use RSS content if provided and long enough, otherwise
 * fetch + extract via Readability.
 */

import {
  savePost,
  getPost,
  getAllPosts,
  getAllSavedPostGuids,
  deletePost as deletePostFromDB,
  isPostSaved,
  getSavedPostCount,
  getStorageStats,
  type SavedPost,
} from '../storage/saved-posts-db';
import { SAVED_POST_MIN_FULL_CONTENT_LENGTH } from '../utils/constants';
import { fetchWithRetry } from '../utils/fetch';
import { FETCH_TIMEOUT, USER_AGENT, MAX_CONTENT_SIZE } from '../utils/constants';
import { parseReadableHtml } from '../../utils/readability';
import { isValidFeedUrl } from '../../utils/security';
import type {
  SavePostData,
  SavePostOfflineResponse,
  IsPostSavedResponse,
  DeleteSavedPostResponse,
  SavedPostsCountResponse,
  ReextractSavedPostResponse,
  AllSavedPostsResponse,
  AllSavedPostGuidsResponse,
  SavedPostResponse,
  ExportSavedPostsResponse,
  ImportSavedPostsResponse,
} from '../../utils/types';

/**
 * Generate a simple hash for a GUID to use as the IndexedDB key
 */
function guidToId(guid: string): string {
  // Simple DJB2 hash converted to base36 string
  let hash = 5381;
  for (let i = 0; i < guid.length; i++) {
    hash = ((hash << 5) + hash + guid.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Fetch page and extract content via Readability
 */
async function extractContent(
  url: string
): Promise<{ htmlContent: string; contentSource: 'extracted' } | null> {
  if (!isValidFeedUrl(url)) {
    console.warn('[Save Post] URL blocked by SSRF protection:', url);
    return null;
  }

  try {
    const response = await fetchWithRetry(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      FETCH_TIMEOUT
    );

    if (!response.ok) {
      console.warn(
        `[Save Post] Failed to fetch page: ${response.status} ${response.statusText}`
      );
      return null;
    }

    // Check content size
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_CONTENT_SIZE) {
      console.warn('[Save Post] Page too large:', contentLength);
      return null;
    }

    const html = await response.text();

    if (html.length > MAX_CONTENT_SIZE) {
      console.warn('[Save Post] Page content too large:', html.length);
      return null;
    }

    const result = parseReadableHtml(html, url);
    if (!result || !result.htmlContent) {
      console.warn('[Save Post] Readability extraction failed for:', url);
      return null;
    }

    return {
      htmlContent: result.htmlContent,
      contentSource: 'extracted' as const,
    };
  } catch (error) {
    console.error('[Save Post] Error extracting content:', error);
    return null;
  }
}

/**
 * Handle SAVE_POST_OFFLINE request
 */
export async function handleSavePostOffline(
  post: SavePostData,
  requestId: string
): Promise<SavePostOfflineResponse> {
  try {
    // Check if already saved
    const alreadySaved = await isPostSaved(post.guid);
    if (alreadySaved) {
      return {
        type: 'SAVE_POST_OFFLINE_RESPONSE',
        requestId,
        success: true,
        alreadySaved: true,
      };
    }

    // Determine content
    let htmlContent: string;
    let contentSource: 'rss' | 'extracted';

    if (
      post.rssContent &&
      post.rssContent.length >= SAVED_POST_MIN_FULL_CONTENT_LENGTH
    ) {
      // RSS content is long enough, use it directly
      htmlContent = post.rssContent;
      contentSource = 'rss';
    } else {
      // Fetch and extract via Readability
      const extracted = await extractContent(post.link);
      if (!extracted) {
        // If extraction fails and we have some RSS content, use it as fallback
        if (post.rssContent && post.rssContent.length > 0) {
          htmlContent = post.rssContent;
          contentSource = 'rss';
        } else {
          return {
            type: 'SAVE_POST_OFFLINE_RESPONSE',
            requestId,
            success: false,
            error: 'Could not extract content from this page',
          };
        }
      } else {
        htmlContent = extracted.htmlContent;
        contentSource = extracted.contentSource;
      }
    }

    const contentSizeBytes = new Blob([htmlContent]).size;
    const id = guidToId(post.guid);

    const savedPost: SavedPost = {
      id,
      guid: post.guid,
      link: post.link,
      title: post.title,
      author: post.author,
      pubDate: post.pubDate,
      description: post.description,
      image: post.image,
      blogId: post.blogId,
      blogTitle: post.blogTitle,
      blogIcon: post.blogIcon,
      blogFeedUrl: post.blogFeedUrl,
      htmlContent,
      contentSource,
      savedAt: Date.now(),
      contentSizeBytes,
    };

    await savePost(savedPost);

    console.log(
      `[Save Post] Saved "${post.title}" (${contentSource}, ${Math.round(contentSizeBytes / 1024)}KB)`
    );

    return {
      type: 'SAVE_POST_OFFLINE_RESPONSE',
      requestId,
      success: true,
    };
  } catch (error) {
    console.error('[Save Post] Error saving post:', error);
    return {
      type: 'SAVE_POST_OFFLINE_RESPONSE',
      requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle IS_POST_SAVED request
 */
export async function handleIsPostSaved(
  guid: string,
  requestId: string
): Promise<IsPostSavedResponse> {
  try {
    const isSaved = await isPostSaved(guid);
    return {
      type: 'IS_POST_SAVED_RESPONSE',
      requestId,
      success: true,
      isSaved,
    };
  } catch (error) {
    return {
      type: 'IS_POST_SAVED_RESPONSE',
      requestId,
      success: false,
      isSaved: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle DELETE_SAVED_POST request
 */
export async function handleDeleteSavedPost(
  guid: string,
  requestId: string
): Promise<DeleteSavedPostResponse> {
  try {
    // Find the post by GUID to get the ID
    const id = guidToId(guid);
    await deletePostFromDB(id);
    return {
      type: 'DELETE_SAVED_POST_RESPONSE',
      requestId,
      success: true,
    };
  } catch (error) {
    return {
      type: 'DELETE_SAVED_POST_RESPONSE',
      requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle GET_SAVED_POSTS_COUNT request
 */
export async function handleGetSavedPostsCount(
  requestId: string
): Promise<SavedPostsCountResponse> {
  try {
    const stats = await getStorageStats();
    return {
      type: 'SAVED_POSTS_COUNT_RESPONSE',
      requestId,
      success: true,
      count: stats.count,
      totalSizeBytes: stats.totalSizeBytes,
    };
  } catch (error) {
    return {
      type: 'SAVED_POSTS_COUNT_RESPONSE',
      requestId,
      success: false,
      count: 0,
      totalSizeBytes: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle REEXTRACT_SAVED_POST request
 * Re-fetches the page and updates the stored content via Readability
 */
export async function handleReextractSavedPost(
  guid: string,
  requestId: string
): Promise<ReextractSavedPostResponse> {
  try {
    const id = guidToId(guid);
    const existingPost = await getPost(id);

    if (!existingPost) {
      return {
        type: 'REEXTRACT_SAVED_POST_RESPONSE',
        requestId,
        success: false,
        error: 'Post not found',
      };
    }

    const extracted = await extractContent(existingPost.link);
    if (!extracted) {
      return {
        type: 'REEXTRACT_SAVED_POST_RESPONSE',
        requestId,
        success: false,
        error: 'Could not re-extract content from this page',
      };
    }

    const contentSizeBytes = new Blob([extracted.htmlContent]).size;

    const updatedPost: SavedPost = {
      ...existingPost,
      htmlContent: extracted.htmlContent,
      contentSource: 'extracted',
      contentSizeBytes,
    };

    await savePost(updatedPost);

    console.log(
      `[Save Post] Re-extracted "${existingPost.title}" (${Math.round(contentSizeBytes / 1024)}KB)`
    );

    return {
      type: 'REEXTRACT_SAVED_POST_RESPONSE',
      requestId,
      success: true,
    };
  } catch (error) {
    return {
      type: 'REEXTRACT_SAVED_POST_RESPONSE',
      requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle GET_ALL_SAVED_POSTS request (internal - popup/page to SW)
 */
export async function handleGetAllSavedPosts(): Promise<AllSavedPostsResponse> {
  try {
    const posts = await getAllPosts();
    return {
      type: 'ALL_SAVED_POSTS_RESPONSE',
      success: true,
      posts,
    };
  } catch (error) {
    return {
      type: 'ALL_SAVED_POSTS_RESPONSE',
      success: false,
      posts: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle GET_ALL_SAVED_POST_GUIDS request (from web app via content script)
 * Returns just the GUIDs of all saved posts - lightweight for state sync
 */
export async function handleGetAllSavedPostGuids(
  requestId: string
): Promise<AllSavedPostGuidsResponse> {
  try {
    const guids = await getAllSavedPostGuids();
    return {
      type: 'ALL_SAVED_POST_GUIDS_RESPONSE',
      requestId,
      success: true,
      guids,
    };
  } catch (error) {
    return {
      type: 'ALL_SAVED_POST_GUIDS_RESPONSE',
      requestId,
      success: false,
      guids: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle GET_SAVED_POST request (internal - page to SW)
 */
export async function handleGetSavedPost(
  postId: string
): Promise<SavedPostResponse> {
  try {
    const post = await getPost(postId);
    return {
      type: 'SAVED_POST_RESPONSE',
      success: true,
      post,
    };
  } catch (error) {
    return {
      type: 'SAVED_POST_RESPONSE',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle EXPORT_SAVED_POSTS request (internal - page to SW)
 * Returns all saved posts wrapped in a versioned envelope for JSON export
 */
export async function handleExportSavedPosts(): Promise<ExportSavedPostsResponse> {
  try {
    const posts = await getAllPosts();
    return {
      type: 'EXPORT_SAVED_POSTS_RESPONSE',
      success: true,
      data: {
        version: 1,
        exportedAt: Date.now(),
        posts,
      },
    };
  } catch (error) {
    return {
      type: 'EXPORT_SAVED_POSTS_RESPONSE',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle IMPORT_SAVED_POSTS request (internal - page to SW)
 * Imports posts, skipping duplicates (by GUID)
 */
export async function handleImportSavedPosts(
  posts: SavedPost[]
): Promise<ImportSavedPostsResponse> {
  try {
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const post of posts) {
      try {
        const alreadySaved = await isPostSaved(post.guid);
        if (alreadySaved) {
          skipped++;
          continue;
        }
        await savePost(post);
        imported++;
      } catch {
        errors++;
      }
    }

    console.log(
      `[Save Post] Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`
    );

    return {
      type: 'IMPORT_SAVED_POSTS_RESPONSE',
      success: true,
      imported,
      skipped,
      errors,
    };
  } catch (error) {
    return {
      type: 'IMPORT_SAVED_POSTS_RESPONSE',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
