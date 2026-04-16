/**
 * Auth.js v5 catch-all route handler.
 * Delegates all /api/auth/* requests to Auth.js.
 */
import NextAuth from 'next-auth';
import { authConfig } from '../../../../server/auth/config';

const { handlers } = NextAuth(authConfig);

export const { GET, POST } = handlers;
