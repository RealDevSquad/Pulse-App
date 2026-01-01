/**
 * Extension Analysis Chain
 *
 * LangChain chain for generating AI analysis of a user's task progress
 * in relation to their extension request history.
 */

import { StringOutputParser } from '@langchain/core/output_parsers';
import { getFeatureClient } from '../openrouter-client';
import { extensionAnalysisPrompt } from '../prompts/extension-analysis';

/**
 * Extension request data
 */
interface ExtensionRequest {
  id: string;
  oldEndsOn: number;
  newEndsOn: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  timestamp?: { _seconds: number };
  createdAt?: number;
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
 * Input for extension analysis
 */
export interface ExtensionAnalysisInput {
  task: TaskData;
  extensions: ExtensionRequest[];
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
 * Format extension details for the prompt
 */
function formatExtensionDetails(extensions: ExtensionRequest[]): string {
  if (extensions.length === 0) return 'No extension requests.';

  return extensions
    .map((ext, i) => {
      const daysExtended = daysBetween(ext.oldEndsOn, ext.newEndsOn);
      return `${i + 1}. ${ext.status}: Extended by ${daysExtended} days (${formatEpoch(ext.oldEndsOn)} → ${formatEpoch(ext.newEndsOn)})
   Reason: "${ext.reason || 'No reason provided'}"`;
    })
    .join('\n');
}

/**
 * Find the original due date (before any extensions)
 */
function findOriginalDueDate(extensions: ExtensionRequest[]): number | undefined {
  if (extensions.length === 0) return undefined;

  // Sort by oldEndsOn ascending to find the earliest
  const sorted = [...extensions].sort((a, b) => {
    const aTime = a.oldEndsOn > 1e12 ? a.oldEndsOn : a.oldEndsOn * 1000;
    const bTime = b.oldEndsOn > 1e12 ? b.oldEndsOn : b.oldEndsOn * 1000;
    return aTime - bTime;
  });

  return sorted[0]?.oldEndsOn;
}

/**
 * Generate a streaming analysis of task extensions
 */
export async function generateExtensionAnalysis(input: ExtensionAnalysisInput) {
  const { task, extensions, assigneeName } = input;

  const llm = getFeatureClient('taskSummary');
  const chain = extensionAnalysisPrompt.pipe(llm).pipe(new StringOutputParser());

  // Calculate stats
  const approvedCount = extensions.filter((e) => e.status === 'APPROVED').length;
  const deniedCount = extensions.filter((e) => e.status === 'DENIED').length;
  const pendingCount = extensions.filter((e) => e.status === 'PENDING').length;

  // Find original due date
  const originalDueDate = findOriginalDueDate(extensions) || task.endsOn;

  // Calculate days on task
  const taskStart = task.startedOn || task.createdAt;
  const daysOnTask = taskStart ? daysBetween(taskStart, Date.now()) : 0;

  return chain.stream({
    title: task.title,
    status: task.status,
    percentCompleted: task.percentCompleted ?? 0,
    assignee: assigneeName || task.assignee || 'Unknown',
    originalDueDate: formatEpoch(originalDueDate),
    currentDueDate: formatEpoch(task.endsOn),
    daysOnTask: daysOnTask > 0 ? `${daysOnTask} days` : 'Recently started',
    totalExtensions: extensions.length,
    approvedCount,
    deniedCount,
    pendingCount,
    extensionDetails: formatExtensionDetails(extensions),
  });
}

/**
 * Generate a non-streaming analysis
 */
export async function generateExtensionAnalysisSync(input: ExtensionAnalysisInput): Promise<string> {
  const stream = await generateExtensionAnalysis(input);
  let result = '';
  for await (const chunk of stream) {
    result += chunk;
  }
  return result;
}
