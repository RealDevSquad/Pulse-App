'use client';

import { useMemo } from 'react';
import { AIAnalysisCard } from './ai-analysis-card';

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
  // Memoize the data object to prevent unnecessary re-renders
  const data = useMemo(() => ({
    task,
    extensions,
    assigneeName,
  }), [task, extensions, assigneeName]);

  return (
    <AIAnalysisCard
      endpoint="/api/ai/extension-analysis"
      data={data}
      theme="amber"
      label="AI Analysis"
      className={className}
    />
  );
}
