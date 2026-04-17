/**
 * Auth.js v5 catch-all route handler.
 * Delegates all /api/auth/* requests to Auth.js.
 */
import { handlers } from '@/server/auth';

export const { GET, POST } = handlers;
