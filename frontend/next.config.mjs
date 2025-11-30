/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.mp3$/, // For MP3 files
      use: [
        {
          loader: "file-loader",
          options: {
            name: "[name].[ext]",
            outputPath: "static/media/", // Customize the output path if needed
            publicPath: "/_next/static/media/", // Required for serving files correctly in Next.js
          },
        },
      ],
    });

    return config;
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // If you are using SWC (default), this helps minify faster
  swcMinify: true,
};

export default nextConfig;
