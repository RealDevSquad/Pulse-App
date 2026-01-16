/**
 * Progress Analysis Chain
 *
 * LangChain chain for generating AI analysis of a developer's
 * progress updates on a task.
 */

import { StringOutputParser } from '@langchain/core/output_parsers';
import { getFeatureClient } from '../openrouter-client';
import { progressAnalysisPrompt } from '../prompts/progress-analysis';

/**
 * Progress update data
 */
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

/**
 * Task data for analysis
 */
interface TaskData {
  id: string;
  title: string;
  status: string;
  percentCompleted?: number;
  assignee?: string;
  assigneeName?: string;
  startedOn?: number;
  endsOn?: number;
  createdAt?: number;
}

/**
 * Input for progress analysis
 */
export interface ProgressAnalysisInput {
  task: TaskData;
  progressUpdates: ProgressUpdate[];
  assigneeName?: string;
}

/**
 * Format epoch timestamp to readable date
 */
function formatEpoch(epoch?: number): string {
  if (!epoch) return 'Not set';
  const ms = epoch > 1e12 ? epoch : epoch * 1000;
  const date = new Date(ms);
  if (isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Calculate days between two epochs
 */
function daysBetween(start?: number, end?: number): number {
  if (!start || !end) return 0;
  const startMs = start > 1e12 ? start : start * 1000;
  const endMs = end > 1e12 ? end : end * 1000;
  return Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate update frequency description
 */
function getUpdateFrequency(progressUpdates: ProgressUpdate[]): string {
  if (progressUpdates.length === 0) return 'No updates';
  if (progressUpdates.length === 1) return 'Single update';

  // Look at last 2 weeks
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentUpdates = progressUpdates.filter((p) => p.createdAt > twoWeeksAgo);

  if (recentUpdates.length === 0) return 'No recent updates (last 2 weeks)';
  if (recentUpdates.length >= 10) return 'Very active (10+ updates in 2 weeks)';
  if (recentUpdates.length >= 5) return 'Active (5-9 updates in 2 weeks)';
  if (recentUpdates.length >= 2) return 'Moderate (2-4 updates in 2 weeks)';
  return 'Sparse (1 update in 2 weeks)';
}

/**
 * Format progress details for the prompt
 */
function formatProgressDetails(progressUpdates: ProgressUpdate[]): string {
  if (progressUpdates.length === 0) return 'No progress updates recorded.';

  // Show up to 10 most recent updates
  const recentUpdates = progressUpdates.slice(0, 10);

  return recentUpdates
    .map((p, i) => {
      const date = formatEpoch(p.createdAt);
      const parts = [];

      if (p.completed?.trim()) {
        parts.push(`Completed: "${p.completed.substring(0, 200)}${p.completed.length > 200 ? '...' : ''}"`);
      }
      if (p.planned?.trim()) {
        parts.push(`Planned: "${p.planned.substring(0, 200)}${p.planned.length > 200 ? '...' : ''}"`);
      }
      if (p.blockers?.trim()) {
        parts.push(`Blockers: "${p.blockers.substring(0, 200)}${p.blockers.length > 200 ? '...' : ''}"`);
      }

      if (parts.length === 0) {
        parts.push('(Empty update)');
      }

      return `${i + 1}. [${date}]\n   ${parts.join('\n   ')}`;
    })
    .join('\n\n');
}

/**
 * Generate a streaming analysis of progress updates
 */
export async function generateProgressAnalysis(input: ProgressAnalysisInput) {
  const { task, progressUpdates, assigneeName } = input;

  const llm = getFeatureClient('taskSummary');
  const chain = progressAnalysisPrompt.pipe(llm).pipe(new StringOutputParser());

  // Calculate stats
  const blockerCount = progressUpdates.filter((p) => p.blockers?.trim()).length;

  // Calculate days on task
  const taskStart = task.startedOn || task.createdAt;
  const daysOnTask = taskStart ? daysBetween(taskStart, Date.now()) : 0;

  return chain.stream({
    title: task.title,
    status: task.status,
    percentCompleted: task.percentCompleted ?? 0,
    assignee: assigneeName || task.assignee || 'Unknown',
    startedOn: formatEpoch(task.startedOn || task.createdAt),
    dueDate: formatEpoch(task.endsOn),
    daysOnTask: daysOnTask > 0 ? `${daysOnTask} days` : 'Recently started',
    totalUpdates: progressUpdates.length,
    blockerCount,
    updateFrequency: getUpdateFrequency(progressUpdates),
    progressDetails: formatProgressDetails(progressUpdates),
  });
}

/**
 * Generate a non-streaming analysis
 */
export async function generateProgressAnalysisSync(input: ProgressAnalysisInput): Promise<string> {
  const stream = await generateProgressAnalysis(input);
  let result = '';
  for await (const chunk of stream) {
    result += chunk;
  }
  return result;
}
