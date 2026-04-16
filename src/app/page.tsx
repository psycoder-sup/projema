import { redirect } from 'next/navigation';

/**
 * Root page — redirects to dashboard (authenticated shell).
 * The auth middleware will redirect unauthenticated users to /sign-in.
 */
export default function RootPage() {
  redirect('/dashboard');
}
