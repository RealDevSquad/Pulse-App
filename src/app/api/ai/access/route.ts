import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { isAIEnabled } from '@/lib/ai/config';

/**
 * GET /api/ai/access
 *
 * Check if the current user has access to AI features.
 * Returns { hasAccess: boolean }
 *
 * AI features are only available to root users (superusers).
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ hasAccess: false });
  }

  // AI features require: AI enabled globally + user is root
  const hasAccess = isAIEnabled() && isRootUser(session.userId);

  return NextResponse.json({ hasAccess });
}
