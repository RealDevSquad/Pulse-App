'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Usage statistics from the AI model
 */
export interface AIUsageStats {
  /** Model used for generation */
  model: string;
  /** Estimated input tokens */
  inputTokens: number;
  /** Estimated output tokens */
  outputTokens: number;
  /** Total tokens (input + output) */
  totalTokens: number;
  /** Estimated cost in USD */
  cost: number;
}

interface UseAIStreamOptions {
  /** API endpoint to call */
  endpoint: string;
  /** Callback when streaming completes successfully */
  onComplete?: (result: string, usage?: AIUsageStats) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

interface UseAIStreamReturn {
  /** Start streaming with the given payload */
  startStream: (payload: Record<string, unknown>) => Promise<void>;
  /** Current streamed content */
  content: string;
  /** Whether currently streaming */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Usage statistics (available after stream completes) */
  usage: AIUsageStats | null;
  /** Reset the state */
  reset: () => void;
  /** Abort current stream */
  abort: () => void;
}

/**
 * Hook for consuming streaming AI responses (SSE)
 *
 * @example
 * ```tsx
 * const { startStream, content, isLoading, usage } = useAIStream({
 *   endpoint: '/api/ai/task-summary',
 *   onComplete: (result, usage) => console.log('Done:', result, usage),
 * });
 *
 * // Start streaming
 * await startStream({ type: 'task', data: taskData });
 *
 * // Display content as it streams
 * <p>{content}</p>
 * 
 * // Show usage after completion
 * {usage && <span>{usage.totalTokens} tokens (~${usage.cost.toFixed(4)})</span>}
 * ```
 */
export function useAIStream({
  endpoint,
  onComplete,
  onError,
}: UseAIStreamOptions): UseAIStreamReturn {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [usage, setUsage] = useState<AIUsageStats | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setContent('');
    setError(null);
    setIsLoading(false);
    setUsage(null);
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const startStream = useCallback(
    async (payload: Record<string, unknown>) => {
      // Abort any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Reset state
      setContent('');
      setError(null);
      setIsLoading(true);
      setUsage(null);

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let fullContent = '';
        let usageStats: AIUsageStats | null = null;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });

          // Parse SSE events (format: "data: {...}\n\n")
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              // Check for completion signal
              if (data === '[DONE]') {
                continue;
              }

              try {
                const parsed = JSON.parse(data);

                if (parsed.error) {
                  throw new Error(parsed.error);
                }

                // Handle content chunks
                if (parsed.content) {
                  fullContent += parsed.content;
                  setContent(fullContent);
                }

                // Handle usage stats (sent at end of stream)
                if (parsed.usage) {
                  usageStats = parsed.usage;
                  setUsage(usageStats);
                }
              } catch (parseError) {
                // Skip malformed chunks
                if (parseError instanceof SyntaxError) {
                  continue;
                }
                throw parseError;
              }
            }
          }
        }

        setIsLoading(false);
        onComplete?.(fullContent, usageStats || undefined);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        const error = err instanceof Error ? err : new Error('Stream failed');
        setError(error);
        setIsLoading(false);
        onError?.(error);
      }
    },
    [endpoint, onComplete, onError]
  );

  return {
    startStream,
    content,
    isLoading,
    error,
    usage,
    reset,
    abort,
  };
}
