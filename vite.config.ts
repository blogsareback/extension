import { defineConfig, Plugin } from 'vite';
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
const contentScripts = ['content-script', 'feed-discovery', 'injected-script'];

/**
 * Plugin to transform content scripts from ES modules to self-contained IIFEs
 * Content scripts cannot use import statements, so we need to inline all dependencies
 */
function bundleContentScripts(): Plugin {
  return {
    name: 'bundle-content-scripts',
    generateBundle(_, bundle) {
      // Find the browser polyfill chunk (if any)
      let polyfillCode = '';
      let polyfillChunkName = '';
      let polyfillExportMap: Record<string, string> = {}; // Maps exported name -> internal name

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && fileName.includes('browser-polyfill')) {
          polyfillChunkName = fileName;
          polyfillCode = chunk.code;

          // Parse the export statement to build a map of exported names to internal names
          // e.g., "export{I as B,U as a,L as g}" -> { B: 'I', a: 'U', g: 'L' }
          const exportMatch = polyfillCode.match(/export\s*\{([^}]+)\};?/);
          if (exportMatch) {
            exportMatch[1].split(',').forEach(part => {
              const [internal, external] = part.trim().split(/\s+as\s+/);
              if (external) {
                polyfillExportMap[external.trim()] = internal.trim();
              } else {
                polyfillExportMap[internal.trim()] = internal.trim();
              }
            });
          }
          break;
        }
      }

      // Process each content script
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && contentScripts.some(name => fileName === `${name}.js`)) {
          let code = chunk.code;

          // Check if this chunk imports from the polyfill
          const importMatch = code.match(/import\s*\{([^}]+)\}\s*from\s*["'][^"']*browser-polyfill[^"']*["'];?/);

          if (importMatch && polyfillCode) {
            // Extract the imported bindings (e.g., "B as r" -> imported: 'B', local: 'r')
            const bindings = importMatch[1].split(',').map(b => {
              const parts = b.trim().split(/\s+as\s+/);
              return { imported: parts[0].trim(), local: (parts[1] || parts[0]).trim() };
            });

            // Remove the import statement
            code = code.replace(importMatch[0], '');

            // Prepare the polyfill code without the export statement
            let inlinedPolyfill = polyfillCode.replace(/export\s*\{[^}]+\};?/, '');

            // Create variable assignments for the imported bindings
            // e.g., import { B as r } -> the polyfill exports I as B -> var r = I;
            const assignments = bindings.map(b => {
              const internalName = polyfillExportMap[b.imported] || b.imported;
              return `var ${b.local} = ${internalName};`;
            }).join('\n');
            inlinedPolyfill += '\n' + assignments;

            // Combine: polyfill code + assignments + original code
            code = inlinedPolyfill + '\n' + code;
          }

          // Wrap in IIFE
          chunk.code = `(function(){\n${code}\n})();`;
        }
      }

      // NOTE: Don't delete the polyfill chunk - the service worker still needs it
      // (service workers can use ES modules, unlike content scripts)
    },
  };
}

/**
 * Plugin to copy the correct manifest based on target browser and inject version
 */
function copyBrowserManifest(): Plugin {
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

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    bundleContentScripts(),
    copyBrowserManifest(),
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
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep script names for manifest.json references
          if (
            chunkInfo.name === 'service-worker' ||
            chunkInfo.name === 'content-script' ||
            chunkInfo.name === 'injected-script' ||
            chunkInfo.name === 'feed-discovery'
          ) {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Prevent shared chunks between entry points
        // Each content script needs to be self-contained to avoid
        // variable collisions when multiple scripts are injected
        manualChunks: () => undefined,
      },
    },
    emptyOutDir: true, // Clear the output directory on build
  },
});
