import { defineConfig, Plugin } from 'vite';
import { build as esbuild } from 'esbuild';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';

// Get target browser from environment variable (default: chrome)
const targetBrowser = process.env.BROWSER || 'chrome';

// Output directory based on target browser
const outDir = `dist/${targetBrowser}`;

// Read version from package.json (single source of truth)
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
const extensionVersion = packageJson.version;

// Content scripts that need special bundling (no ES modules, must be self-contained IIFE)
const contentScripts = ['content-script', 'feed-discovery', 'injected-script', 'floating-button'];

/**
 * Plugin to re-bundle content scripts as self-contained IIFEs using esbuild.
 * After Vite writes ES module output, esbuild resolves each content script's
 * imports and produces a single IIFE file - overwriting the original.
 * Shared chunks remain on disk for the service worker (which uses ES modules).
 */
function bundleContentScripts(): Plugin {
  return {
    name: 'bundle-content-scripts',
    async writeBundle() {
      await Promise.all(
        contentScripts.map((name) =>
          esbuild({
            entryPoints: [path.resolve(outDir, `${name}.js`)],
            bundle: true,
            format: 'iife',
            outfile: path.resolve(outDir, `${name}.js`),
            allowOverwrite: true,
          }),
        ),
      );
    },
  };
}

// Localhost patterns to inject in development builds (browser-specific)
const chromeLocalhostPatterns = [
  'http://localhost:3000/*',
  'http://localhost/*',
];

const firefoxLocalhostPatterns = [
  'http://localhost:3000/*',
  'http://localhost:3000/',
  'http://localhost/*',
];

// Get the appropriate patterns for the target browser
const localhostPatterns = targetBrowser === 'firefox'
  ? firefoxLocalhostPatterns
  : chromeLocalhostPatterns;

/**
 * Plugin to copy the correct manifest based on target browser and inject version.
 * In development mode, also injects localhost patterns for local testing.
 */
function copyBrowserManifest(isDev: boolean): Plugin {
  return {
    name: 'copy-browser-manifest',
    writeBundle() {
      const manifestSource = targetBrowser === 'firefox'
        ? path.resolve(__dirname, 'public/manifest.firefox.json')
        : path.resolve(__dirname, 'public/manifest.json');
      const manifestDest = path.resolve(__dirname, outDir, 'manifest.json');

      // Read the manifest, inject version from package.json, and write to output
      const manifest = JSON.parse(fs.readFileSync(manifestSource, 'utf-8'));
      manifest.version = extensionVersion;

      // In development mode, inject localhost patterns for local testing
      if (isDev) {
        // Add to content_scripts matches (first content script is the main one)
        if (manifest.content_scripts?.[0]?.matches) {
          manifest.content_scripts[0].matches.push(...localhostPatterns);
        }
        // Add to web_accessible_resources matches
        if (manifest.web_accessible_resources?.[0]?.matches) {
          manifest.web_accessible_resources[0].matches.push(...localhostPatterns);
        }
        console.log(`[vite] Injected localhost patterns for development`);
      }

      fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2));
      console.log(`[vite] Built ${targetBrowser} manifest with version ${extensionVersion}`);

      // Remove the extra manifest.firefox.json that gets copied from public/
      const extraManifest = path.resolve(__dirname, outDir, 'manifest.firefox.json');
      if (fs.existsSync(extraManifest)) {
        fs.unlinkSync(extraManifest);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    bundleContentScripts(),
    copyBrowserManifest(mode === 'development'),
  ],
  define: {
    // Inject version from package.json at build time
    __EXTENSION_VERSION__: JSON.stringify(extensionVersion),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    copyPublicDir: true,
    outDir,
    sourcemap: process.env.NODE_ENV === 'development',
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'src/popup/popup.html'),
        main: path.resolve(__dirname, 'src/main/main.html'),
        'service-worker': path.resolve(
          __dirname,
          'src/background/service-worker.ts'
        ),
        'content-script': path.resolve(
          __dirname,
          'src/content/content-script.ts'
        ),
        'injected-script': path.resolve(
          __dirname,
          'src/content/injected-script.ts'
        ),
        'feed-discovery': path.resolve(
          __dirname,
          'src/content/feed-discovery.ts'
        ),
        'floating-button': path.resolve(
          __dirname,
          'src/content/floating-button/index.ts'
        ),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep script names for manifest.json references
          if (
            chunkInfo.name === 'service-worker' ||
            chunkInfo.name === 'content-script' ||
            chunkInfo.name === 'injected-script' ||
            chunkInfo.name === 'feed-discovery' ||
            chunkInfo.name === 'floating-button'
          ) {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    emptyOutDir: true, // Clear the output directory on build
  },
}));
