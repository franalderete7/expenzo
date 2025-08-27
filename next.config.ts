import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent chunk loading issues
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Webpack configuration to fix chunk loading
  webpack: (config, { dev }) => {
    // Fix for chunk loading errors in development
    if (dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          cacheGroups: {
            framework: {
              chunks: 'all',
              name: 'framework',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            lib: {
              test: /[\\/]node_modules[\\/]/,
              name: 'lib',
              priority: 30,
              chunks: 'all',
            },
          },
        },
      };
    }

    return config;
  },

  // Headers to prevent caching issues that cause chunk errors
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
