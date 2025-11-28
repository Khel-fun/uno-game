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
};

export default nextConfig;
