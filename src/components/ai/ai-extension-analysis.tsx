'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { useAIStream } from '@/hooks/use-ai-stream';
import { useAIAccess } from '@/hooks/use-ai-access';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExtensionRequest {
  id: string;
  oldEndsOn: number;
  newEndsOn: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  timestamp?: { _seconds: number };
  createdAt?: number;
}

interface TaskData {
  id: string;
  title: string;
  status: string;
  percentCompleted?: number;
  assignee?: string;
  startedOn?: number;
  endsOn?: number;
  createdAt?: number;
}

interface AIExtensionAnalysisProps {
  task: TaskData;
  extensions: ExtensionRequest[];
  assigneeName?: string;
  className?: string;
}

/**
 * AI-powered analysis of task extension history
 *
 * Shows how the user is progressing in relation to their extension requests.
 * Auto-generates when rendered (typically when extensions section is opened).
 */
export function AIExtensionAnalysis({
  task,
  extensions,
  assigneeName,
  className,
}: AIExtensionAnalysisProps) {
  // Check if user has AI access
  const { hasAccess, isLoading: isCheckingAccess } = useAIAccess();

  const { startStream, content, isLoading, error, reset } = useAIStream({
    endpoint: '/api/ai/extension-analysis',
  });

  // Auto-generate when component mounts and user has access
  useEffect(() => {
    if (hasAccess && !isCheckingAccess) {
      startStream({
        task,
        extensions,
        assigneeName,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, isCheckingAccess]);

  const handleRefresh = () => {
    reset();
    startStream({
      task,
      extensions,
      assigneeName,
    });
  };

  // Don't render if user doesn't have access
  if (isCheckingAccess || !hasAccess) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-lg border bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20',
        'border-amber-200/50 dark:border-amber-800/30',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <motion.div
            animate={isLoading ? { rotate: 360 } : {}}
            transition={{ duration: 2, repeat: isLoading ? Infinity : 0, ease: 'linear' }}
          >
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </motion.div>
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            AI Analysis
          </span>
          {isLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">Analyzing...</span>
          )}
        </div>

        {content && !isLoading && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="px-3 pb-3">
        {/* Error state */}
        {error && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/30">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-red-700 dark:text-red-300">
                Failed to generate analysis.
              </p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-red-600 dark:text-red-400"
                onClick={handleRefresh}
              >
                Try again
              </Button>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !content && (
          <div className="space-y-2">
            <div className="h-3 bg-amber-200/50 dark:bg-amber-800/30 rounded animate-pulse w-full" />
            <div className="h-3 bg-amber-200/50 dark:bg-amber-800/30 rounded animate-pulse w-4/5" />
            <div className="h-3 bg-amber-200/50 dark:bg-amber-800/30 rounded animate-pulse w-3/5" />
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
              <span className="inline-block w-1.5 h-4 bg-amber-500 ml-0.5 animate-pulse" />
            )}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
