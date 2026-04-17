/**
 * Central Auth.js v5 exports.
 * Import `auth`, `signIn`, `signOut` from here in server components and actions.
 */
import NextAuth from 'next-auth';
import { authConfig } from './config';

const { auth, signIn, signOut, handlers } = NextAuth(authConfig);

export { auth, signIn, signOut, handlers };
