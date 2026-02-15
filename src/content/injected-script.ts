// This script runs in the page's context (not the content script's isolated world)
// It sets window variables that the webapp can detect

// Version injected at build time from package.json (see vite.config.ts)
const EXTENSION_VERSION = __EXTENSION_VERSION__;

window.__BLOGS_ARE_BACK_EXTENSION__ = true;
window.__BLOGS_ARE_BACK_EXTENSION_VERSION__ = EXTENSION_VERSION;

// Notify the web app that the extension is available.
// This fires on initial page load AND when the service worker
// re-injects the content script (install, update, re-enable).
document.dispatchEvent(new CustomEvent('bab-extension-available', {
  detail: { version: EXTENSION_VERSION },
}));

console.log(`[Blogs Are Back] Extension v${EXTENSION_VERSION} detected`);
