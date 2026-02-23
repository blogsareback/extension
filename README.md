# Blogs Are Back - Browser Extension

A privacy-focused browser extension that fetches RSS/Atom feeds directly from your browser for [Blogs Are Back](https://blogsareback.com), bypassing CORS restrictions and eliminating server bandwidth costs.

## Features

- **Direct Feed Fetching**: Fetch RSS/Atom feeds directly from source websites, bypassing CORS
- **Feed Auto-Discovery**: Automatically detects RSS/Atom feeds on any webpage with badge notification
- **Readable Content Extraction**: Extract clean article content using Mozilla's Readability
- **Blog Update Notifications**: Get notified when followed blogs have new posts (Featured mode)
- **Privacy-First**: Feed content never touches our servers
- **SSRF Protection**: Built-in security to prevent abuse
- **Cross-Browser**: Supports Chrome and Firefox
- **Modern Tech Stack**: Built with TypeScript, React, Vite, and Tailwind CSS v4

## Installation

### Development Mode

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Build the Extension**

   ```bash
   npm run build
   ```

   For development with auto-rebuild:

   ```bash
   npm run dev
   ```

3. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist/chrome/` directory

4. **Load in Firefox** (Optional)
   - Build for Firefox: `npm run build:firefox`
   - Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select `dist/firefox/manifest.json`

### Verify Installation

1. Navigate to the Blogs Are Back web app (localhost:3000 or production)
2. Open browser console and check for:
   ```javascript
   window.__BLOGS_ARE_BACK_EXTENSION__; // Should be true
   ```
3. Click the extension icon to view statistics popup

## Development

### Project Structure

```
bab-extension/
├── src/
│   ├── background/              # Service worker (modular)
│   │   ├── service-worker.ts    # Main entry point
│   │   ├── utils/               # Shared utilities
│   │   │   ├── constants.ts     # All constants
│   │   │   ├── fetch.ts         # Fetch with retry
│   │   │   └── notifications.ts # Push notifications
│   │   ├── storage/             # Storage management
│   │   │   ├── settings.ts      # Extension settings
│   │   │   ├── stats.ts         # Fetch statistics
│   │   │   └── state.ts         # Update state
│   │   └── handlers/            # Message handlers
│   │       ├── feed-fetch.ts    # Feed fetching
│   │       ├── page-fetch.ts    # Page fetching
│   │       ├── readable-extract.ts
│   │       ├── feed-discovery.ts
│   │       ├── blog-status.ts
│   │       ├── directory-updates.ts
│   │       ├── custom-blog-updates.ts
│   │       └── feeds-detected.ts
│   ├── content/
│   │   ├── content-script.ts    # Web app bridge
│   │   ├── feed-discovery.ts    # Feed detection
│   │   └── injected-script.ts   # Extension flag
│   ├── popup/
│   │   ├── Popup.tsx            # Main popup
│   │   ├── components/          # UI components
│   │   └── hooks/               # React hooks
│   ├── pages/                   # Full-page UIs
│   │   ├── queue.html           # Subscription queue
│   │   └── settings.html        # Settings page
│   ├── utils/
│   │   ├── security.ts          # SSRF protection
│   │   ├── types.ts             # TypeScript types
│   │   ├── readability.ts       # Content extraction
│   │   └── browser.ts           # Browser polyfill
│   └── styles/
│       └── globals.css          # Tailwind styles
├── public/
│   ├── manifest.json            # Chrome manifest
│   ├── manifest.firefox.json    # Firefox manifest
│   └── icons/                   # Extension icons
└── dist/                        # Build output
    ├── chrome/                  # Chrome build
    └── firefox/                 # Firefox build
```

### Scripts

- `npm run dev` - Chrome build in watch mode
- `npm run dev:firefox` - Firefox build in watch mode
- `npm run build` - Production build for Chrome
- `npm run build:firefox` - Production build for Firefox
- `npm run build:all` - Build for all browsers
- `npm run package:chrome` - Create Chrome zip for distribution
- `npm run package:firefox` - Create Firefox zip for distribution
- `npm run type-check` - TypeScript validation only

### Debugging

**Service Worker Logs:**

- Chrome: `chrome://extensions/` → Click "service worker" link under extension
- Check console for `[Service Worker]` prefixed logs

**Content Script Logs:**

- Open web app page
- Open browser DevTools console
- Check for `[Content Script]` prefixed logs

**Popup Logs:**

- Right-click extension icon → "Inspect popup"
- Check console in popup DevTools

## How It Works

### Message Flow

```
Web App <--> Content Script <--> Service Worker <--> RSS Feed
   |              |                    |
   |         (window msgs)      (chrome.runtime)
   |              |                    |
   +-- Detection  +-- Relay            +-- Fetch + Security
```

1. Content script sets `window.__BLOGS_ARE_BACK_EXTENSION__` flag
2. Web app detects extension and sends fetch request via `window.postMessage`
3. Content script validates origin and forwards to service worker
4. Service worker validates URL (SSRF protection), fetches feed
5. Response flows back through content script to web app

### Security (SSRF Protection)

The extension blocks requests to:

- Private IP ranges (127.0.0.0/8, 10.0.0.0/8, 192.168.0.0/16, etc.)
- IPv6 private addresses (::1, fc00::/7, fe80::/10)
- Cloud metadata endpoints (169.254.169.254, metadata.google.internal)
- Non-HTTP(S) protocols
- Redirects to blocked URLs

## Testing

### Manual Testing

**Basic Functionality:**

1. Load extension in Chrome
2. Navigate to Blogs Are Back web app
3. Follow a blog (e.g., https://overreacted.io/rss.xml)
4. Verify feed loads without using `/api/proxy/feed`
5. Check extension popup for updated statistics

**Security Testing:**
Try these URLs (should all be blocked):

- `http://localhost/feed.xml`
- `http://127.0.0.1/feed.xml`
- `http://192.168.1.1/feed.xml`
- `http://169.254.169.254/latest/meta-data/`

**Error Handling:**

- Test with invalid URLs
- Test with slow endpoints (timeout after 30s)
- Test with 404 responses

### Test Feeds

Valid feeds for testing:

- https://overreacted.io/rss.xml
- https://www.joshwcomeau.com/rss.xml
- https://blog.jim-nielsen.com/feed.xml

### Manual Installation

**Chrome:**

1. Download and extract the Chrome ZIP
2. Go to `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked" and select extracted folder

**Firefox:**

1. Download the Firefox ZIP
2. Go to `about:addons`
3. Click gear icon → "Install Add-on From File"
4. Select the ZIP file

## Troubleshooting

**Extension not loading:**

- Check Chrome DevTools for errors
- Verify `dist/chrome/` directory contains all files
- Try rebuilding: `npm run build`

**Web app not detecting extension:**

- Check console for content script logs
- Verify `window.__BLOGS_ARE_BACK_EXTENSION__` is set
- Ensure URL matches manifest `content_scripts.matches`

**Feeds not fetching:**

- Check service worker console for errors
- Verify URL isn't blocked by SSRF protection
- Check network tab for failed requests
- Ensure extension has `<all_urls>` permission

**Stats not updating:**

- Check `chrome.storage.local` permissions
- Verify service worker isn't crashing
- Try resetting: Right-click extension → Options → Clear stats

## Privacy

- Feed content is fetched directly from source websites and doesn't touch our servers
- No browsing history, page URLs, or personal data is collected
- Usage telemetry (aggregate counts, extension version) can be disabled in Settings
- Open source and auditable
