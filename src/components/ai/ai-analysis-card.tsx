'use client';

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, AlertCircle, Coins } from 'lucide-react';
import { useAIStream } from '@/hooks/use-ai-stream';
import { useAIAccess } from '@/hooks/use-ai-access';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Color theme options for the AI analysis card
 */
export type AIAnalysisTheme = 'amber' | 'blue' | 'green' | 'purple';

const themeStyles: Record<AIAnalysisTheme, {
  container: string;
  icon: string;
  label: string;
  skeleton: string;
  cursor: string;
}> = {
  amber: {
    container: 'bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/50 dark:border-amber-800/30',
    icon: 'text-amber-600 dark:text-amber-400',
    label: 'text-amber-700 dark:text-amber-300',
    skeleton: 'bg-amber-200/50 dark:bg-amber-800/30',
    cursor: 'bg-amber-500',
  },
  blue: {
    container: 'bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/50 dark:border-blue-800/30',
    icon: 'text-blue-600 dark:text-blue-400',
    label: 'text-blue-700 dark:text-blue-300',
    skeleton: 'bg-blue-200/50 dark:bg-blue-800/30',
    cursor: 'bg-blue-500',
  },
  green: {
    container: 'bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200/50 dark:border-green-800/30',
    icon: 'text-green-600 dark:text-green-400',
    label: 'text-green-700 dark:text-green-300',
    skeleton: 'bg-green-200/50 dark:bg-green-800/30',
    cursor: 'bg-green-500',
  },
  purple: {
    container: 'bg-gradient-to-br from-purple-50/50 to-violet-50/50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200/50 dark:border-purple-800/30',
    icon: 'text-purple-600 dark:text-purple-400',
    label: 'text-purple-700 dark:text-purple-300',
    skeleton: 'bg-purple-200/50 dark:bg-purple-800/30',
    cursor: 'bg-purple-500',
  },
};

/**
 * Format model name for display
 */
function formatModelName(model: string): string {
  // Extract just the model name without provider prefix
  const parts = model.split('/');
  return parts[parts.length - 1];
}

/**
 * Format cost for display
 */
function formatCost(cost: number): string {
  if (cost < 0.0001) {
    return '<$0.0001';
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(3)}`;
}

interface AIAnalysisCardProps {
  /** API endpoint for the AI analysis */
  endpoint: string;
  /** Data to send to the API */
  data: Record<string, unknown>;
  /** Color theme */
  theme?: AIAnalysisTheme;
  /** Optional label (defaults to "AI Analysis") */
  label?: string;
  /** Whether to show usage stats (defaults to true) */
  showUsage?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Reusable AI analysis card component
 * 
 * Displays a streaming AI analysis with loading states, error handling,
 * refresh capability, and usage stats. Auto-generates when rendered.
 * 
 * Used by AIExtensionAnalysis and AIProgressAnalysis components.
 */
export function AIAnalysisCard({
  endpoint,
  data,
  theme = 'amber',
  label = 'AI Analysis',
  showUsage = true,
  className,
}: AIAnalysisCardProps) {
  // Check if user has AI access
  const { hasAccess, isLoading: isCheckingAccess } = useAIAccess();

  const { startStream, content, isLoading, error, usage, reset } = useAIStream({
    endpoint,
  });

  const styles = themeStyles[theme];

  // Memoize the data to avoid unnecessary re-renders
  // Using JSON.stringify for stable comparison
  const stableData = useMemo(() => data, [JSON.stringify(data)]);

  // Auto-generate when component mounts and user has access
  useEffect(() => {
    if (hasAccess && !isCheckingAccess) {
      startStream(stableData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, isCheckingAccess]);

  const handleRefresh = () => {
    reset();
    startStream(stableData);
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
        'rounded-lg border',
        styles.container,
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
            <Sparkles className={cn('h-4 w-4', styles.icon)} />
          </motion.div>
          <span className={cn('text-xs font-medium', styles.label)}>
            {label}
          </span>
          {isLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">Analyzing...</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Usage stats */}
          {showUsage && usage && !isLoading && (
            <div 
              className="flex items-center gap-1 text-[10px] text-muted-foreground mr-1"
              title={`${usage.inputTokens} in + ${usage.outputTokens} out tokens | ${formatModelName(usage.model)}`}
            >
              <Coins className="h-3 w-3" />
              <span>{usage.totalTokens} tokens</span>
              <span className="opacity-60">({formatCost(usage.cost)})</span>
            </div>
          )}

          {/* Refresh button */}
          {content && !isLoading && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleRefresh}
              title="Regenerate analysis"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
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
            <div className={cn('h-3 rounded animate-pulse w-full', styles.skeleton)} />
            <div className={cn('h-3 rounded animate-pulse w-4/5', styles.skeleton)} />
            <div className={cn('h-3 rounded animate-pulse w-3/5', styles.skeleton)} />
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
              <span className={cn('inline-block w-1.5 h-4 ml-0.5 animate-pulse', styles.cursor)} />
            )}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
