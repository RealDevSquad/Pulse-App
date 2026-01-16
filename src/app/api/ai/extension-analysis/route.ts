import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAIEnabled, estimateTokens, calculateCost, AI_MODELS } from '@/lib/ai/config';
import { isRootUser } from '@/lib/users';
import { generateExtensionAnalysis } from '@/lib/ai/chains/extension-analysis';

/**
 * POST /api/ai/extension-analysis
 *
 * Generate an AI analysis of a user's task progress based on extension history.
 * Returns a streaming SSE response with usage stats at the end.
 *
 * AI features are only available to root users (superusers).
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

  // AI features require root access
  if (!(await isRootUser(session.userId))) {
    return NextResponse.json({ error: 'AI features not available for this user' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { task, extensions, assigneeName } = body;

    if (!task) {
      return NextResponse.json({ error: 'Missing required field: task' }, { status: 400 });
    }

    // Estimate input tokens from the request data
    const inputText = JSON.stringify({ task, extensions, assigneeName });
    const inputTokens = estimateTokens(inputText);

    // Generate the analysis stream
    const stream = await generateExtensionAnalysis({
      task,
      extensions: extensions || [],
      assigneeName,
    });

    // Model used for this feature
    const model = AI_MODELS.FAST;

    // Create SSE stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let outputText = '';
        
        try {
          for await (const chunk of stream) {
            outputText += chunk;
            const sseMessage = `data: ${JSON.stringify({ content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));
          }

          // Calculate usage stats
          const outputTokens = estimateTokens(outputText);
          const totalTokens = inputTokens + outputTokens;
          const cost = calculateCost(model, inputTokens, outputTokens);

          // Send usage stats before [DONE]
          const usageMessage = `data: ${JSON.stringify({
            usage: {
              model,
              inputTokens,
              outputTokens,
              totalTokens,
              cost,
            },
          })}\n\n`;
          controller.enqueue(encoder.encode(usageMessage));

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
