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
        };
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
  };

export default nextConfig;