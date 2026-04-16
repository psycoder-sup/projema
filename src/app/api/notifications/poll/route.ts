import { NextResponse } from 'next/server';

/**
 * Notifications poll endpoint.
 * Phase 6 implementation — Phase 0 stub only.
 */
export async function GET(): Promise<NextResponse> {
  // Phase 6: implement real notifications polling
  return NextResponse.json({ items: [], unreadCount: 0 }, { status: 200 });
}
