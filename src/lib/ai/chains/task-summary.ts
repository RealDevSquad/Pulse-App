/**
 * Task Summary Chain
 *
 * LangChain chain for generating AI summaries of tasks and todos.
 * Supports streaming responses.
 */

import { StringOutputParser } from '@langchain/core/output_parsers';
import { getFeatureClient } from '../openrouter-client';
import { taskSummaryPrompt, todoSummaryPrompt } from '../prompts/task-summary';
import type { Task, TodoAPI } from '@/types';

/**
 * Format a timestamp for display
 */
function formatDate(timestamp: number | string | undefined): string {
  if (!timestamp) return 'Not set';

  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);

  if (isNaN(date.getTime())) return 'Invalid date';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Calculate days until due date
 */
function calculateDaysUntilDue(endsOn: number | string | undefined): string {
  if (!endsOn) return 'No due date';

  const dueDate = typeof endsOn === 'string' ? new Date(endsOn) : new Date(endsOn * 1000);

  if (isNaN(dueDate.getTime())) return 'Invalid date';

  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `${diffDays} days remaining`;
}

/**
 * Map priority number to label
 */
function getPriorityLabel(priority: TodoAPI.PriorityNumber | null | undefined): string {
  if (!priority) return 'Not set';
  const map: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };
  return map[priority] || 'Unknown';
}

/**
 * Input for task summary generation
 */
export interface TaskSummaryInput {
  task: Task;
  assigneeName?: string;
  additionalContext?: string;
}

/**
 * Input for todo summary generation
 */
export interface TodoSummaryInput {
  todo: TodoAPI.Todo;
  teamName?: string;
}

/**
 * Generate a streaming summary for a Firestore task
 */
export async function generateTaskSummary(input: TaskSummaryInput) {
  const { task, assigneeName, additionalContext } = input;

  const llm = getFeatureClient('taskSummary');
  const chain = taskSummaryPrompt.pipe(llm).pipe(new StringOutputParser());

  return chain.stream({
    title: task.title,
    status: task.status,
    type: task.type || 'Not specified',
    priority: task.priority || 'Not set',
    percentCompleted: task.percentCompleted ?? 0,
    assignee: assigneeName || task.assignee || 'Unassigned',
    daysUntilDue: calculateDaysUntilDue(task.endsOn),
    lastUpdated: formatDate(task.updatedAt || task.updated_at),
    additionalContext: additionalContext || '',
  });
}

/**
 * Generate a streaming summary for a TODO API todo
 */
export async function generateTodoSummary(input: TodoSummaryInput) {
  const { todo, teamName } = input;

  const llm = getFeatureClient('todoSummary');
  const chain = todoSummaryPrompt.pipe(llm).pipe(new StringOutputParser());

  // Format labels
  const labels =
    todo.labels && todo.labels.length > 0
      ? todo.labels.map((l) => l.name).join(', ')
      : 'None';

  // Format deferred info
  let deferredInfo = 'No';
  if (todo.deferredDetails) {
    const until = new Date(todo.deferredDetails.deferredTill).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    deferredInfo = `Yes, until ${until} by ${todo.deferredDetails.deferredBy?.name || 'Unknown'}`;
  }

  return chain.stream({
    title: todo.title,
    description: todo.description || 'No description',
    status: todo.status || 'Unknown',
    priority: getPriorityLabel(todo.priority),
    assignee: todo.assignee?.assignee_name || todo.assignee?.name || 'Unassigned',
    team: teamName || todo.assignee?.team_id || 'No team',
    labels,
    dueDate: todo.dueAt ? calculateDaysUntilDue(todo.dueAt) : 'No due date',
    deferredInfo,
    inWatchlist: todo.in_watchlist ? 'Yes' : 'No',
    createdBy: todo.createdBy?.name || 'Unknown',
    createdAt: formatDate(todo.createdAt),
  });
}

/**
 * Generate a non-streaming summary (for cases where streaming isn't needed)
 */
export async function generateTaskSummarySync(input: TaskSummaryInput): Promise<string> {
  const stream = await generateTaskSummary(input);
  let result = '';
  for await (const chunk of stream) {
    result += chunk;
  }
  return result;
}

/**
 * Generate a non-streaming todo summary
 */
export async function generateTodoSummarySync(input: TodoSummaryInput): Promise<string> {
  const stream = await generateTodoSummary(input);
  let result = '';
  for await (const chunk of stream) {
    result += chunk;
  }
  return result;
}
