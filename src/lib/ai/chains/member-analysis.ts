/**
 * Member Analysis Chain
 *
 * LangChain chain for generating AI-powered member performance reports.
 * Supports streaming responses.
 */

import { StringOutputParser } from '@langchain/core/output_parsers';
import { createOpenRouterClient } from '../openrouter-client';
import { AI_MODELS } from '../config';
import { memberAnalysisPrompt } from '../prompts/member-analysis';
import { formatExtensionPatternsForAI } from '../prompts/extension-enrichment-context';
import type { User, Task } from '@/types';
import type { MemberEnrichmentEvent } from '@/lib/enrichment-types';
import type { ExtensionEnrichmentEvent } from '@/lib/extension-enrichment-types';
import type { MultiPeriodMetrics } from '@/lib/logs-cache';

/**
 * Progress update summary for AI analysis
 */
export interface ProgressSummary {
  recentBlockers: string[];
  updateCount: number;
  daysSinceLastUpdate: number | null;
  averageUpdateLength: number;
}

/**
 * Task enrichment summary (complexity, skills)
 */
export interface TaskEnrichmentSummary {
  weightedProductivity: number;
  tasksByComplexity: Record<string, number>;
  skillsUsed: string[];
  unenrichedTaskCount: number;
}

/**
 * Initiative metrics from task requests
 */
export interface InitiativeMetrics {
  taskRequestsMade: number;
  taskRequestsApproved: number;
  taskRequestsDenied: number;
}

/**
 * Timeline accuracy metrics
 */
export interface TimelineMetrics {
  averageDaysToStart: number | null;
  onTimeCompletionRate: number;
  completedOnTime: number;
  completedLate: number;
}

/**
 * Red and green flags for the member
 */
export interface Flags {
  red: string[];
  green: string[];
}

/**
 * Activity metrics for a member
 */
export interface MemberActivityMetrics {
  tasksAssigned: number;
  tasksStarted: number;
  tasksCompleted: number;
  taskUpdates: number;
  extensionRequests: number;
  /**
   * Extensions requested AFTER the task was already red (past deadline).
   * Indicates lack of proactive communication - user let task go red before asking for help.
   * See: pulse-app/docs/USER_ENRICHMENT_METRICS.md
   */
  lateExtensionRequests: number;

  // Enriched metrics
  progressSummary?: ProgressSummary;
  taskEnrichment?: TaskEnrichmentSummary;
  initiativeMetrics?: InitiativeMetrics;
  timelineMetrics?: TimelineMetrics;
  flags?: Flags;
}

/**
 * Input for member analysis generation
 */
export interface MemberAnalysisInput {
  user: User;
  metrics: MemberActivityMetrics;
  multiPeriodMetrics: MultiPeriodMetrics;
  activeTasks: Task[];
  enrichmentEvents: MemberEnrichmentEvent[];
  /** Extension request enrichments (optional for backwards compatibility) */
  extensionEnrichments?: ExtensionEnrichmentEvent[];
}

/**
 * Format roles for display
 */
function formatRoles(roles: User['roles']): string {
  const roleLabels: string[] = [];

  if (roles?.super_user) roleLabels.push('Super User');
  if (roles?.admin) roleLabels.push('Admin');
  if (roles?.member) roleLabels.push('Member');
  if (roles?.developer) roleLabels.push('Developer');
  if (roles?.designer) roleLabels.push('Designer');

  return roleLabels.length > 0 ? roleLabels.join(', ') : 'Member';
}

/**
 * Format date for display
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Calculate tenure string (e.g., "2 years, 3 months")
 */
function calculateTenure(joinTimestamp: number): string {
  const now = Date.now();
  const diffMs = now - joinTimestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 30) {
    return `${diffDays} days`;
  }

  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);

  if (years === 0) {
    return `${months} month${months !== 1 ? 's' : ''}`;
  }

  if (months === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  }

  return `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
}

/**
 * Format active tasks for the prompt
 */
function formatActiveTasks(tasks: Task[]): string {
  if (tasks.length === 0) {
    return 'No active tasks currently assigned.';
  }

  return tasks
    .slice(0, 10) // Limit to 10 most relevant
    .map((task) => {
      const status = task.status?.replace('_', ' ') || 'Unknown';
      const progress = task.percentCompleted ?? 0;
      return `- ${task.title} (${status}, ${progress}% complete)`;
    })
    .join('\n');
}

/**
 * Format enrichment notes for the prompt
 */
function formatEnrichmentNotes(events: MemberEnrichmentEvent[]): string {
  if (events.length === 0) {
    return 'No enrichment notes have been added for this member yet.';
  }

  return events
    .slice(0, 10) // Limit to 10 most recent
    .map((event) => {
      const date = formatDate(event.timestamp);
      const type = event.enrichmentType.replace('_', ' ');
      const category = event.content.category;
      return `- [${date}] **${type}** (${category}): ${event.content.text}`;
    })
    .join('\n');
}

/**
 * Get user status display
 */
function getUserStatus(status?: string): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/**
 * Format multi-period metrics for the prompt
 */
function formatMultiPeriodMetrics(multiPeriod: MultiPeriodMetrics): string {
  return multiPeriod.periods
    .map((p) => {
      const completionRate =
        p.tasksStarted > 0 ? Math.round((p.tasksCompleted / p.tasksStarted) * 100) : 0;
      return `### ${p.label}
- Tasks Started: ${p.tasksStarted}
- Tasks Completed: ${p.tasksCompleted}
- Completion Rate: ${completionRate}%
- Task Updates: ${p.taskUpdates}
- Extension Requests: ${p.extensionRequests}`;
    })
    .join('\n\n');
}

/**
 * Format recent blockers for the prompt
 */
function formatBlockers(blockers: string[]): string {
  if (blockers.length === 0) return 'No blockers reported recently.';
  return blockers.map((b, i) => `${i + 1}. "${b}"`).join('\n');
}

/**
 * Format task complexity breakdown for the prompt
 */
function formatComplexityBreakdown(tasksByComplexity: Record<string, number>): string {
  const parts: string[] = [];
  if (tasksByComplexity.very_complex > 0) parts.push(`${tasksByComplexity.very_complex} very complex`);
  if (tasksByComplexity.complex > 0) parts.push(`${tasksByComplexity.complex} complex`);
  if (tasksByComplexity.moderate > 0) parts.push(`${tasksByComplexity.moderate} moderate`);
  if (tasksByComplexity.simple > 0) parts.push(`${tasksByComplexity.simple} simple`);
  if (tasksByComplexity.trivial > 0) parts.push(`${tasksByComplexity.trivial} trivial`);
  return parts.length > 0 ? parts.join(', ') : 'No completed tasks';
}

/**
 * Format flags for the prompt
 */
function formatFlags(flags?: Flags): string {
  if (!flags) return 'No flags detected.';

  const parts: string[] = [];

  if (flags.red.length > 0) {
    parts.push('**Red Flags:**');
    flags.red.forEach((f) => parts.push(`- ⚠️ ${f}`));
  }

  if (flags.green.length > 0) {
    if (parts.length > 0) parts.push('');
    parts.push('**Green Flags:**');
    flags.green.forEach((f) => parts.push(`- ✅ ${f}`));
  }

  if (parts.length === 0) {
    return 'No significant flags detected.';
  }

  return parts.join('\n');
}

/**
 * Generate a streaming member performance analysis
 */
export async function generateMemberAnalysis(input: MemberAnalysisInput) {
  const { user, metrics, multiPeriodMetrics, activeTasks, enrichmentEvents, extensionEnrichments } = input;

  // Use BALANCED model for more comprehensive analysis
  const llm = createOpenRouterClient({
    model: AI_MODELS.BALANCED,
    maxTokens: 2048,
  });

  const chain = memberAnalysisPrompt.pipe(llm).pipe(new StringOutputParser());

  const memberName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;

  // Calculate communication proactivity score
  const totalExtensions = metrics.extensionRequests;
  const lateExtensions = metrics.lateExtensionRequests || 0;
  const proactiveExtensions = totalExtensions - lateExtensions;
  const communicationScore = totalExtensions > 0
    ? Math.round((proactiveExtensions / totalExtensions) * 100)
    : 100; // 100% if no extensions needed

  // Extract enriched metrics with defaults
  const progressSummary = metrics.progressSummary;
  const taskEnrichment = metrics.taskEnrichment;
  const initiativeMetrics = metrics.initiativeMetrics;
  const timelineMetrics = metrics.timelineMetrics;

  return chain.stream({
    memberName,
    username: user.username,
    roles: formatRoles(user.roles),
    memberSince: user.created_at ? formatDate(user.created_at) : 'Unknown',
    tenure: user.created_at ? calculateTenure(user.created_at) : 'Unknown',
    currentStatus: getUserStatus(user.status),
    tasksAssigned: metrics.tasksAssigned,
    tasksStarted: metrics.tasksStarted,
    tasksCompleted: metrics.tasksCompleted,
    taskUpdates: metrics.taskUpdates,
    extensionRequests: metrics.extensionRequests,
    lateExtensionRequests: lateExtensions,
    communicationScore,
    multiPeriodBreakdown: formatMultiPeriodMetrics(multiPeriodMetrics),
    activeTasks: formatActiveTasks(activeTasks),
    enrichmentNotes: formatEnrichmentNotes(enrichmentEvents),
    extensionPatterns: formatExtensionPatternsForAI(extensionEnrichments || []),
    // New enriched metrics
    recentBlockers: progressSummary ? formatBlockers(progressSummary.recentBlockers) : 'No data available.',
    progressUpdateCount: progressSummary?.updateCount ?? 0,
    daysSinceLastUpdate: progressSummary?.daysSinceLastUpdate ?? 'Unknown',
    weightedProductivity: taskEnrichment?.weightedProductivity ?? 0,
    complexityBreakdown: taskEnrichment ? formatComplexityBreakdown(taskEnrichment.tasksByComplexity) : 'No data available.',
    skillsUsed: taskEnrichment?.skillsUsed?.join(', ') || 'None tracked',
    taskRequestsMade: initiativeMetrics?.taskRequestsMade ?? 0,
    taskRequestsApproved: initiativeMetrics?.taskRequestsApproved ?? 0,
    taskRequestsDenied: initiativeMetrics?.taskRequestsDenied ?? 0,
    averageDaysToStart: timelineMetrics?.averageDaysToStart ?? 'Unknown',
    onTimeCompletionRate: timelineMetrics?.onTimeCompletionRate ?? 100,
    flags: formatFlags(metrics.flags),
  });
}

/**
 * Generate a non-streaming member analysis
 */
export async function generateMemberAnalysisSync(input: MemberAnalysisInput): Promise<string> {
  const stream = await generateMemberAnalysis(input);
  let result = '';
  for await (const chunk of stream) {
    result += chunk;
  }
  return result;
}
