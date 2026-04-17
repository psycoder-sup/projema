// Auth.js v5 config. Phase 1: allowlist enforcement via signIn callback + sessions_log events.
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { NextAuthConfig } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '../db/client';
import { env } from '@/lib/env';
import { handleSignInCallback, recordSignIn } from './allowlist';
import { track } from '@/server/analytics/events';

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Link Google OAuth to an existing user row matched by email.
      // Our signIn callback pre-creates the User (bootstrap-admin / allowlist admit) before
      // the adapter persists the Account, so without this flag the adapter returns
      // OAuthAccountNotLinked. Safe: Google is the only provider and the email is verified.
      allowDangerousEmailAccountLinking: true,
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
    async signIn({ user, account }) {
      // Extract email and profile details from Auth.js user object
      const email = user.email ?? '';
      const displayName = user.name ?? email;
      const avatarUrl = user.image ?? null;
      const provider = (account?.provider ?? 'google') as 'google';

      if (!email) return '/sign-in?error=no_email';

      const result = await handleSignInCallback({
        email,
        displayName,
        avatarUrl,
        provider,
      });

      if (!result.ok) {
        if (result.error.code === 'not_allowlisted') {
          return '/sign-in?error=not_allowlisted';
        }
        return '/sign-in?error=unknown';
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        // Attach role and isActive from DB user
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (dbUser) {
          (session.user as typeof session.user & { role: string; isActive: boolean }).role = dbUser.role;
          (session.user as typeof session.user & { role: string; isActive: boolean }).isActive = dbUser.isActive;
        }
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (!user.id) return;
      const provider = (account?.provider ?? 'google') as 'google';
      await recordSignIn({ userId: user.id, provider });
      // Emit post-signIn (after sessions_log write, non-fatal)
      void track({
        name: 'session_started',
        props: { userId: user.id, provider },
      });
    },
  },
};
