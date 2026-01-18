import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAIEnabled } from '@/lib/ai/config';
import { isAdminUser } from '@/lib/users';
import { generateEnrichmentSuggestion } from '@/lib/ai/chains/task-enrichment-suggestion';

/**
 * POST /api/ai/task-enrichment-suggestion
 *
 * Generate AI-powered enrichment suggestions for a task.
 * Analyzes the task title to suggest skills, complexity, and unknown factors.
 *
 * AI features are available to admin users (super_users).
 *
 * Request body:
 * - title: string (required)
 * - type?: string
 * - status?: string
 * - priority?: string
 *
 * Response:
 * - skills: string[]
 * - complexity: ComplexityLevel
 * - unknownFactors: string[]
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
    const { title, type, status, priority } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Missing required field: title' }, { status: 400 });
    }

    // Generate suggestions
    const suggestion = await generateEnrichmentSuggestion({
      title,
      type,
      status,
      priority,
    });

    return NextResponse.json(suggestion);
  } catch (error) {
    console.error('AI enrichment suggestion error:', error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('OPENROUTER_API_KEY')) {
        return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
      }
    }

    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}
