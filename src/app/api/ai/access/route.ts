import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasAIAccess, getExperimentalAIUsers } from '@/lib/ai/config';

/**
 * GET /api/ai/access
 *
 * Check if the current user has access to AI features.
 * Returns { hasAccess: boolean }
 *
 * This is used by the client to conditionally show AI UI components.
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    console.log('[AI Access] No session found');
    return NextResponse.json({ hasAccess: false });
  }

  const experimentalUsers = getExperimentalAIUsers();
  const hasAccess = hasAIAccess(session.userId, session.username);

  console.log('[AI Access] Check:', {
    userId: session.userId,
    username: session.username,
    experimentalUsers,
    hasAccess,
  });

  return NextResponse.json({ hasAccess });
}
