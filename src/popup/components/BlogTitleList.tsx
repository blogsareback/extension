import { ExternalLink } from 'lucide-react';
import browser from '@/utils/browser';
import { DASHBOARD_BASE_URL } from '@/background/utils/constants';

interface BlogInfo {
  id: string;
  title: string;
}

interface BlogTitleListProps {
  blogs: BlogInfo[];
  maxDisplay?: number;
  type: 'directory' | 'community' | 'catalog' | 'custom';
}

export function BlogTitleList({
  blogs,
  maxDisplay = 3,
  type,
}: BlogTitleListProps) {
  const displayBlogs = blogs.slice(0, maxDisplay);
  const remainingCount = blogs.length - maxDisplay;

  const openBlogInDashboard = (blogId: string) => {
    // Open dashboard with blog parameter in new tab
    const url = `${DASHBOARD_BASE_URL}/all-posts?blog=${encodeURIComponent(blogId)}`;
    browser.tabs.create({ url });
  };

  if (blogs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0.5 mt-1.5">
      {displayBlogs.map((blog) => (
        <button
          key={blog.id}
          onClick={() => openBlogInDashboard(blog.id)}
          className="group flex items-center gap-1 text-xs text-primary hover:underline w-full text-left"
          title={blog.title}
        >
          <span className="truncate max-w-[250px]">{blog.title}</span>
          <ExternalLink className="size-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
      {remainingCount > 0 && (
        <a
          href={`${DASHBOARD_BASE_URL}/all-posts`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary"
        >
          and {remainingCount} more...
        </a>
      )}
    </div>
  );
}
