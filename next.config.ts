import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow HMR from network IP in development
  allowedDevOrigins: ['10.155.120.120'],

  // TYPE CHECKING IS OWNED BY CI, NOT BY THE DEPLOY BUILD.
  //
  // Do not "restore" this to false without reading this first — it has been flipped twice.
  //
  // History: 8c400833 set this to true specifically to get Cloud Build passing. Audit
  // Phase 1 (F10) then removed it as a regression guard, which silently added a full
  // TypeScript pass to every App Hosting build. That pass takes ~37 minutes on this
  // codebase, on a builder that has repeatedly hit OOM and timeouts (533c8149, add8789d,
  // 31332c64, cb4928fc). It broke the deploy.
  //
  // The safety F10 wanted is fully preserved, just in the right place: the
  // `typecheck-and-lint` CI job runs `tsc --noEmit` with an 8GB heap on every push and
  // fails on any type error, so a type error still cannot reach main. Repeating that work
  // inside the deploy build buys nothing and costs the deploy.
  //
  // To make the deploy build type check again, first make it small enough: split the
  // backoffice out of the client build — docs/architecture/backoffice-isolation-plan.md,
  // Stage D.
  typescript: {
    ignoreBuildErrors: true,
  },

  staticPageGenerationTimeout: 60,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  serverExternalPackages: [
    '@google-cloud/tasks',
    '@google-cloud/storage',
    'canvas',
    'jsdom',
    'firebase-admin',
    'google-auth-library',
    'https-proxy-agent',
    'gaxios',
    '@genkit-ai/google-genai',
    '@genkit-ai/core',
    '@genkit-ai/ai',
    'genkit',
  ],
  experimental: {
    cpus: process.env.BUILD_CPUS
      ? parseInt(process.env.BUILD_CPUS, 10)
      : 2,
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'framer-motion',
      'recharts',
    ],
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  turbopack: {
    resolveAlias: {
      canvas: {
        browser: './src/lib/empty-module.ts',
      },
      jsdom: {
        browser: './src/lib/empty-module.ts',
      },
    },
  },
  webpack: (config, { isServer }) => {
    // Optimize memory usage
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
    };
    
    // Ignore server dependencies and native canvas binaries in client bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
        canvas: false,
        jsdom: false,
        child_process: false,
      };
      
      // Ignore express, canvas, and other server-only/native modules
      config.externals = config.externals || [];
      config.externals.push({
        express: 'commonjs express',
        'express/lib/view': 'commonjs express/lib/view',
        canvas: 'commonjs canvas',
        jsdom: 'commonjs jsdom',
      });
    }
    
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'smartsapp.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.smartsapp.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'onboarding.smartsapp.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'play.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.dribbble.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default (process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_UPLOAD_SOURCEMAPS === 'true')
  ? withSentryConfig(nextConfig, {
      org: 'smartsapp',
      project: 'javascript-nextjs',
      silent: true,
      widenClientFileUpload: true,
      sourcemaps: {
        disable: false,
      },
      webpack: {
        automaticVercelMonitors: true,
        treeshake: {
          removeDebugLogging: true,
        },
      },
    })
  : nextConfig;