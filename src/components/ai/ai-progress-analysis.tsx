'use client';

import { useMemo } from 'react';
import { AIAnalysisCard } from './ai-analysis-card';

interface ProgressUpdate {
  id: string;
  taskId: string;
  userId: string;
  type: string;
  completed: string;
  planned: string;
  blockers: string;
  createdAt: number;
  date: number;
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

interface AIProgressAnalysisProps {
  task: TaskData;
  progressUpdates: ProgressUpdate[];
  assigneeName?: string;
  className?: string;
}

/**
 * AI-powered analysis of task progress updates
 *
 * Shows patterns in the developer's progress updates, communication quality,
 * and any concerns like persistent blockers or gaps in updates.
 * Auto-generates when rendered (typically when progress section is opened).
 */
export function AIProgressAnalysis({
  task,
  progressUpdates,
  assigneeName,
  className,
}: AIProgressAnalysisProps) {
  // Memoize the data object to prevent unnecessary re-renders
  const data = useMemo(() => ({
    task,
    progressUpdates,
    assigneeName,
  }), [task, progressUpdates, assigneeName]);

  return (
    <AIAnalysisCard
      endpoint="/api/ai/progress-analysis"
      data={data}
      theme="blue"
      label="AI Analysis"
      className={className}
    />
  );
}
