/**
 * Auth.js v5 configuration.
 * Phase 0 stub — allowlist logic, sessions_log writes, and PostHog events land in Phase 1.
 */
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { NextAuthConfig } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { prisma } from '../db/client';

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
    }),
    GitHubProvider({
      clientId: process.env['GITHUB_CLIENT_ID'] ?? '',
      clientSecret: process.env['GITHUB_CLIENT_SECRET'] ?? '',
    }),
  ],
  session: {
    strategy: 'database',
    // 24h session maxAge as interim mitigation for deferred session revocation (SPEC §9)
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: '/sign-in',
    error: '/sign-in',
  },
  callbacks: {
    // Phase 1: add allowlist check here
    async signIn() {
      return true;
    },
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    // Phase 1: write sessions_log + update last_seen_at + emit PostHog session_started
    async signIn() {
      // no-op in Phase 0
    },
  },
};
