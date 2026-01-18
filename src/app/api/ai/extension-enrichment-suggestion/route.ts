import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAIEnabled } from '@/lib/ai/config';
import { isAdminUser } from '@/lib/users';
import { generateExtensionEnrichmentSuggestion } from '@/lib/ai/chains/extension-enrichment-suggestion';

/**
 * POST /api/ai/extension-enrichment-suggestion
 *
 * Generate AI-powered enrichment suggestions for an extension request.
 * Analyzes the extension reason to suggest avoidability and root cause.
 *
 * AI features are available to admin users (super_users).
 *
 * Request body:
 * - taskTitle: string (required)
 * - reason: string (required)
 * - assigneeName?: string
 * - daysExtended?: number
 *
 * Response:
 * - avoidability: AvoidabilityType
 * - rootCause: RootCauseType
 * - reasoning: string
 */
export async function POST(request: NextRequest) {
  // Check if AI is enabled
  if (!isAIEnabled()) {
    return NextResponse.json({ error: 'AI features are disabled' }, { status: 503 });
  }

  // Check authentication
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // AI features require admin access
  const isAdmin = await isAdminUser(session.userId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'AI features not available for this user' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { taskTitle, reason, assigneeName, daysExtended } = body;

    if (!taskTitle || typeof taskTitle !== 'string') {
      return NextResponse.json({ error: 'Missing required field: taskTitle' }, { status: 400 });
    }

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json({ error: 'Missing required field: reason' }, { status: 400 });
    }

    // Generate suggestions
    const suggestion = await generateExtensionEnrichmentSuggestion({
      taskTitle,
      reason,
      assigneeName,
      daysExtended,
    });

    return NextResponse.json(suggestion);
  } catch (error) {
    console.error('AI extension enrichment suggestion error:', error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('OPENROUTER_API_KEY')) {
        return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
      }
    }

    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}
