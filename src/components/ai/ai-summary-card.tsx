'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useAIStream } from '@/hooks/use-ai-stream';
import { useAIAccess } from '@/hooks/use-ai-access';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Task, TodoAPI } from '@/types';

interface AISummaryCardProps {
  /** Task or todo to summarize */
  data: Task | TodoAPI.Todo;
  /** Type of data */
  type: 'task' | 'todo';
  /** Optional assignee name for display */
  assigneeName?: string;
  /** Optional team name for todos */
  teamName?: string;
  /** Whether to auto-generate on mount */
  autoGenerate?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AI-powered summary card for tasks and todos
 *
 * Displays a streaming AI-generated summary with:
 * - Auto-generate on mount (optional)
 * - Manual refresh button
 * - Loading state with animation
 * - Error handling with retry
 * - Collapsible on mobile
 */
export function AISummaryCard({
  data,
  type,
  assigneeName,
  teamName,
  autoGenerate = true,
  className,
}: AISummaryCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Check if user has AI access
  const { hasAccess, isLoading: isCheckingAccess } = useAIAccess();

  const { startStream, content, isLoading, error, reset } = useAIStream({
    endpoint: '/api/ai/task-summary',
    onComplete: () => setHasGenerated(true),
  });

  // Auto-generate on mount if enabled and user has access
  useEffect(() => {
    if (autoGenerate && hasAccess && !hasGenerated && !isLoading && !isCheckingAccess) {
      startStream({
        type,
        data,
        assigneeName,
        teamName,
      });
    }
    // Only run when access is determined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, isCheckingAccess]);

  // Don't render if user doesn't have access (or still checking)
  if (isCheckingAccess || !hasAccess) {
    return null;
  }

  const handleRefresh = () => {
    reset();
    startStream({
      type,
      data,
      assigneeName,
      teamName,
    });
  };

  const handleRetry = () => {
    handleRefresh();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'rounded-lg border bg-gradient-to-br from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20',
        'border-violet-200/50 dark:border-violet-800/30',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer md:cursor-default"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={isLoading ? { rotate: 360 } : {}}
            transition={{ duration: 2, repeat: isLoading ? Infinity : 0, ease: 'linear' }}
          >
            <Sparkles className="h-4 w-4 text-violet-500" />
          </motion.div>
          <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
            AI Summary
          </span>
          {isLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">Generating...</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh button (desktop) */}
          {hasGenerated && !isLoading && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hidden md:flex"
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}

          {/* Collapse toggle (mobile) */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 md:hidden"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
          >
            {isCollapsed ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronUp className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {/* Error state */}
              {error && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/30">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-red-700 dark:text-red-300">
                      {error.message === 'AI service not configured'
                        ? 'AI features are not configured. Please set up OpenRouter API key.'
                        : 'Failed to generate summary.'}
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-red-600 dark:text-red-400"
                      onClick={handleRetry}
                    >
                      Try again
                    </Button>
                  </div>
                </div>
              )}

              {/* Loading skeleton */}
              {isLoading && !content && (
                <div className="space-y-2">
                  <div className="h-3 bg-violet-200/50 dark:bg-violet-800/30 rounded animate-pulse w-full" />
                  <div className="h-3 bg-violet-200/50 dark:bg-violet-800/30 rounded animate-pulse w-4/5" />
                  <div className="h-3 bg-violet-200/50 dark:bg-violet-800/30 rounded animate-pulse w-3/5" />
                </div>
              )}

              {/* Content */}
              {content && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-foreground/80 leading-relaxed"
                >
                  {content}
                  {isLoading && (
                    <span className="inline-block w-1.5 h-4 bg-violet-500 ml-0.5 animate-pulse" />
                  )}
                </motion.p>
              )}

              {/* Generate prompt (if not auto-generated) */}
              {!autoGenerate && !hasGenerated && !isLoading && !error && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleRefresh}
                >
                  <Sparkles className="h-3 w-3 mr-1.5" />
                  Generate AI Summary
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
