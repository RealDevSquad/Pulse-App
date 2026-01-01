import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAIEnabled, hasAIAccess } from '@/lib/ai/config';
import { generateTaskSummary, generateTodoSummary } from '@/lib/ai/chains/task-summary';
import type { Task, TodoAPI } from '@/types';

/**
 * POST /api/ai/task-summary
 *
 * Generate an AI summary for a task or todo.
 * Returns a streaming SSE response.
 *
 * Request body:
 * - type: 'task' | 'todo'
 * - data: Task | TodoAPI.Todo
 * - assigneeName?: string (optional, for display)
 * - teamName?: string (optional, for todos)
 *
 * Access restricted to experimental users configured via EXPERIMENTAL_AI_USERS env var.
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
    const { type, data, assigneeName, teamName } = body;

    if (!type || !data) {
      return NextResponse.json({ error: 'Missing required fields: type, data' }, { status: 400 });
    }

    // Generate the appropriate summary stream
    let stream: AsyncGenerator<string>;

    if (type === 'task') {
      stream = await generateTaskSummary({
        task: data as Task,
        assigneeName,
      });
    } else if (type === 'todo') {
      stream = await generateTodoSummary({
        todo: data as TodoAPI.Todo,
        teamName,
      });
    } else {
      return NextResponse.json({ error: 'Invalid type. Must be "task" or "todo"' }, { status: 400 });
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Send each chunk as an SSE event
            const sseMessage = `data: ${JSON.stringify({ content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));
          }

          // Signal completion
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
    console.error('AI summary error:', error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('OPENROUTER_API_KEY')) {
        return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
      }
    }

    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
