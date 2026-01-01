import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAIEnabled, hasAIAccess } from '@/lib/ai/config';
import { generateExtensionAnalysis } from '@/lib/ai/chains/extension-analysis';

/**
 * POST /api/ai/extension-analysis
 *
 * Generate an AI analysis of a user's task progress based on extension history.
 * Returns a streaming SSE response.
 *
 * Request body:
 * - task: { id, title, status, percentCompleted, assignee, endsOn, startedOn, createdAt }
 * - extensions: Array of extension requests
 * - assigneeName?: string (optional, for display)
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

  // Check if user has AI access (experimental feature)
  if (!hasAIAccess(session.userId, session.username)) {
    return NextResponse.json({ error: 'AI features not available for this user' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { task, extensions, assigneeName } = body;

    if (!task) {
      return NextResponse.json({ error: 'Missing required field: task' }, { status: 400 });
    }

    // Generate the analysis stream
    const stream = await generateExtensionAnalysis({
      task,
      extensions: extensions || [],
      assigneeName,
    });

    // Create SSE stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const sseMessage = `data: ${JSON.stringify({ content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMessage = `data: ${JSON.stringify({ error: 'Stream error' })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Extension analysis error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API_KEY')) {
        return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
      }
    }

    return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 });
  }
}
