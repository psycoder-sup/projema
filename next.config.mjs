// @ts-check
import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enable for performance (reuse function instances across concurrent requests)
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // Upload source maps only in CI
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  // Disable Sentry in development unless explicitly enabled
  ...(process.env.SENTRY_ENABLED !== 'true' && process.env.NODE_ENV === 'development'
    ? { silent: true }
    : {}),
});
