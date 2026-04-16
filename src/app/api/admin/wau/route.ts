import { NextResponse } from 'next/server';

/**
 * Admin WAU (Weekly Active Users) endpoint.
 * Phase 7 implementation — Phase 0 stub only.
 */
export async function GET(): Promise<NextResponse> {
  // Phase 7: implement real WAU query + role check
  return NextResponse.json(
    { totalMembers: 0, wauCount: 0, wauWindow: { start: null, end: null } },
    { status: 200 },
  );
}
