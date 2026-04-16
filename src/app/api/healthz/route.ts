import { NextResponse } from 'next/server';

/**
 * Health check endpoint.
 * Returns 200 with { ok: true, ts: <iso> } for uptime monitoring.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() }, { status: 200 });
}
