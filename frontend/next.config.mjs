import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { realpathSync } from 'fs';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve bb.js v0.87.0 package paths for browser aliasing.
// The "browser" export condition in bb.js points to dest/browser/index.js,
// which is a pre-bundled webpack file. Re-processing it through Next.js's
// webpack causes "Object.defineProperty called on non-object" due to
// conflicting webpack runtimes. We use the ESM node entry instead and alias
// node-specific sub-modules to their browser equivalents.
// Note: pnpm uses symlinks, so we need realpathSync to get the actual .pnpm path.
const bbSymlink = resolve(__dirname, 'node_modules', '@aztec', 'bb.js');
const bbPkgDir = realpathSync(bbSymlink);
const bbNodeDir = resolve(bbPkgDir, 'dest', 'node');

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable server external packages for Noir/BB
    // These packages will be kept external during SSR
    experimental: {
      serverComponentsExternalPackages: [
        '@aztec/bb.js',
        '@noir-lang/noir_js',
        '@noir-lang/acvm_js',
        '@noir-lang/noirc_abi',
        '@noir-lang/types',
      ],
    },
    
    webpack: (config, { isServer }) => {
      // Some third-party bundles (styled-components CJS in deps) reference a global `React`.
      // Provide it explicitly so SSR does not crash with "React is not defined".
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.ProvidePlugin({
          React: 'react',
        })
      );

      // MP3 file handling
      config.module.rules.push({
        test: /\.mp3$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'static/media/',
              publicPath: '/_next/static/media/',
            },
          },
        ],
      });

      // WASM support
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        layers: true,
        topLevelAwait: true,
      };

      // On server, externalize the WASM packages
      if (isServer) {
        config.externals = config.externals || [];
        config.externals.push({
          '@noir-lang/noir_js': 'commonjs @noir-lang/noir_js',
          '@noir-lang/acvm_js': 'commonjs @noir-lang/acvm_js',
          '@noir-lang/noirc_abi': 'commonjs @noir-lang/noirc_abi',
          '@aztec/bb.js': 'commonjs @aztec/bb.js',
        });
      }

      // Fallback for Node.js modules not available in browser
      if (!isServer) {
        config.resolve.fallback = {
          ...config.resolve.fallback,
          fs: false,
          path: false,
          crypto: false,
          os: false,
        };

        // bb.js: Redirect from pre-bundled browser entry to ESM node entry
        // with node-specific sub-modules aliased to browser equivalents.
        config.resolve.alias = {
          ...config.resolve.alias,
          // Main entry: use ESM source instead of pre-bundled webpack browser bundle
          '@aztec/bb.js': resolve(bbNodeDir, 'index.js'),
          // Worker factory: use Web Workers instead of node worker_threads
          [resolve(bbNodeDir, 'barretenberg_wasm', 'barretenberg_wasm_main', 'factory', 'node')]:
            resolve(bbNodeDir, 'barretenberg_wasm', 'barretenberg_wasm_main', 'factory', 'browser'),
          [resolve(bbNodeDir, 'barretenberg_wasm', 'barretenberg_wasm_thread', 'factory', 'node')]:
            resolve(bbNodeDir, 'barretenberg_wasm', 'barretenberg_wasm_thread', 'factory', 'browser'),
          // Helpers: use browser APIs (navigator, SharedArrayBuffer) instead of node os/fs
          [resolve(bbNodeDir, 'barretenberg_wasm', 'helpers', 'node')]:
            resolve(bbNodeDir, 'barretenberg_wasm', 'helpers', 'browser'),
          // WASM fetch: use browser fetch instead of node fs.readFile
          [resolve(bbNodeDir, 'barretenberg_wasm', 'fetch_code', 'node')]:
            resolve(bbNodeDir, 'barretenberg_wasm', 'fetch_code', 'browser'),
          // CRS: use IndexedDB-cached browser CRS instead of node filesystem CRS
          [resolve(bbNodeDir, 'crs', 'node')]:
            resolve(bbNodeDir, 'crs', 'browser'),
          // Backend factory: use browser WASM backend instead of node native/socket backends
          [resolve(bbNodeDir, 'bb_backends', 'node')]:
            resolve(bbNodeDir, 'bb_backends', 'browser'),
          // Only barretenberg-threads.wasm.gz ships in the package.
          // Alias the single-threaded variant to the threaded one.
          [resolve(bbPkgDir, 'dest', 'node', 'barretenberg_wasm', 'barretenberg.wasm.gz')]:
            resolve(bbPkgDir, 'dest', 'node', 'barretenberg_wasm', 'barretenberg-threads.wasm.gz'),
        };

        // Strip `/* webpackIgnore: true */` from bb.js browser factory and fetch_code files.
        // factory/browser: allows webpack to bundle workers with their dependencies (comlink, etc.)
        // fetch_code/browser: allows webpack to resolve barretenberg-threads.js and .wasm.gz assets
        config.module.rules.push({
          test: /(factory|fetch_code)[\\/]browser[\\/]index\.js$/,
          include: /bb\.js/,
          enforce: 'pre',
          use: [{
            loader: resolve(__dirname, 'bb-worker-patch-loader.js'),
          }],
        });

        // Handle .wasm.gz files as static assets (bb.js ships gzipped WASM binaries)
        config.module.rules.push({
          test: /\.wasm\.gz$/,
          type: 'asset/resource',
          generator: {
            filename: 'static/wasm/[name].[hash][ext]',
          },
        });
      }

      // Ignore .node files from bb.js native bindings
      config.module.rules.push({
        test: /\.node$/,
        use: 'ignore-loader',
      });

      return config;
    },

    // Headers for WASM files and SharedArrayBuffer
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Cross-Origin-Embedder-Policy',
              value: 'require-corp',
            },
            {
              key: 'Cross-Origin-Opener-Policy',
              value: 'same-origin',
            },
          ],
        },
      ];
    },

    // Rewrite CRS requests as fallback proxy (primary: fetch interceptor in proofService.ts)
    async rewrites() {
      return [
        {
          source: '/api/crs/:path*',
          destination: '/api/crs/:path*',
        },
      ];
    },
  };

export default nextConfig;
