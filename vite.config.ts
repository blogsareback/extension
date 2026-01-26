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
const contentScripts = ['content-script', 'feed-discovery', 'injected-script', 'floating-button'];

/**
 * Plugin to transform content scripts from ES modules to self-contained IIFEs
 * Content scripts cannot use import statements, so we need to inline all dependencies
 */
function bundleContentScripts(): Plugin {
  return {
    name: 'bundle-content-scripts',
    generateBundle(_, bundle) {
      // Build a map of all chunks with their code and exports
      const chunkMap = new Map<string, { code: string; exportMap: Record<string, string> }>();

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          const exportMap: Record<string, string> = {};

          // Parse export statement to build export map
          // e.g., "export{I as B,U as a,L as g}" -> { B: 'I', a: 'U', g: 'L' }
          const exportMatch = chunk.code.match(/export\s*\{([^}]+)\};?/);
          if (exportMatch) {
            exportMatch[1].split(',').forEach(part => {
              const [internal, external] = part.trim().split(/\s+as\s+/);
              if (external) {
                exportMap[external.trim()] = internal.trim();
              } else {
                exportMap[internal.trim()] = internal.trim();
              }
            });
          }

          chunkMap.set(fileName, { code: chunk.code, exportMap });
        }
      }

      // Counter for unique namespace names
      let namespaceCounter = 0;

      // Process each content script
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && contentScripts.some(name => fileName === `${name}.js`)) {
          let code = chunk.code;
          let inlinedCode = '';

          // Find and process ALL import statements
          const importRegex = /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g;
          let match;
          const processedImports = new Set<string>();

          // Collect all imports first
          const imports: Array<{ fullMatch: string; bindings: string; importPath: string }> = [];
          while ((match = importRegex.exec(code)) !== null) {
            imports.push({ fullMatch: match[0], bindings: match[1], importPath: match[2] });
          }

          for (const { bindings, importPath } of imports) {
            // Find the chunk that matches this import path
            let matchedChunkName: string | null = null;
            for (const [chunkFileName] of chunkMap) {
              // Match by chunk name in the path
              if (importPath.includes(chunkFileName.replace('.js', '')) ||
                chunkFileName.includes(importPath.split('/').pop()?.replace('.js', '') || '')) {
                matchedChunkName = chunkFileName;
                break;
              }
            }

            if (matchedChunkName && !processedImports.has(matchedChunkName)) {
              const chunkData = chunkMap.get(matchedChunkName)!;
              processedImports.add(matchedChunkName);

              // Create a unique namespace for this chunk to avoid variable collisions
              const namespace = `__chunk${namespaceCounter++}__`;

              // Prepare the chunk code without the export statement
              let chunkCode = chunkData.code.replace(/export\s*\{[^}]+\};?/g, '');

              // Wrap the chunk in an IIFE that returns the exports
              const exportsList = Object.entries(chunkData.exportMap)
                .map(([ext, int]) => `${ext}: ${int}`)
                .join(', ');

              // Parse bindings and create variable assignments from the namespace
              const bindingsList = bindings.split(',').map(b => {
                const parts = b.trim().split(/\s+as\s+/);
                return { imported: parts[0].trim(), local: (parts[1] || parts[0]).trim() };
              });

              const assignments = bindingsList.map(b => {
                return `var ${b.local} = ${namespace}.${b.imported};`;
              }).join('\n');

              // Wrap chunk in IIFE that returns exports object
              inlinedCode += `var ${namespace} = (function() {\n${chunkCode}\nreturn { ${exportsList} };\n})();\n${assignments}\n`;
            }
          }

          // Remove all import statements from the original code
          code = code.replace(/import\s*\{[^}]+\}\s*from\s*["'][^"']+["'];?/g, '');

          // Combine: inlined dependencies + original code, wrapped in IIFE
          chunk.code = `(function(){\n${inlinedCode}${code}\n})();`;
        }
      }

      // NOTE: Don't delete the shared chunks - the service worker still needs them
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
        'floating-button': path.resolve(
          __dirname,
          'src/content/floating-button.ts'
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
        // Prevent shared chunks between entry points
        // Each content script needs to be self-contained to avoid
        // variable collisions when multiple scripts are injected
        manualChunks: () => undefined,
      },
    },
    emptyOutDir: true, // Clear the output directory on build
  },
});
