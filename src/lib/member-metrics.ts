/**
 * Member Performance Metrics Library
 *
 * Calculates 5 key performance metrics for members:
 * 1. Task Velocity - On-time completion rate
 * 2. Communication Consistency - Days with updates / total active days
 * 3. Work Steadiness - Consistency of activity (inverse of coefficient of variation)
 * 4. Completion Quality - Tasks completed with minimal extensions/blockers
 * 5. Growth Trajectory - Improvement over time
 *
 * All scores are 0-100 for easy Firestore range queries (where score >= 60)
 */

import { db } from './firebase-admin';
import { getUserOOOEntries, type OOOEntry } from './ooo-cache';
import type { Task, Progress } from '@/types';
import type { LogEntry } from './logs-cache';

// Import types for local use
import type { MetricScore, MemberMetrics } from './member-metrics-types';

// Re-export types and utilities from the client-safe types file
export {
  type MetricScore,
  type MemberMetrics,
  type ScoreLevel,
  getScoreLevel,
  getScoreColor,
} from './member-metrics-types';

// ============================================================================
// Timestamp Normalization
// ============================================================================

/**
 * Normalize timestamps to milliseconds
 * Tasks use seconds, logs may use Firestore timestamps with _seconds
 */
function normalizeTimestamp(ts: number | { _seconds: number } | undefined | null): number {
  if (!ts) return 0;

  if (typeof ts === 'object' && '_seconds' in ts) {
    return ts._seconds * 1000;
  }

  // If timestamp is in seconds (< year 2000 in ms), convert to ms
  if (typeof ts === 'number' && ts < 1000000000000) {
    return ts * 1000;
  }

  return ts as number;
}

// ============================================================================
// Data Fetching
// ============================================================================

interface RawData {
  tasks: Task[];
  logs: LogEntry[];
  progresses: Progress[];
  oooEntries: OOOEntry[];
  extensionRequests: Array<{
    id: string;
    taskId: string;
    status: string;
    timestamp: number;
    oldEndsOn?: number; // Original deadline when extension was requested
  }>;
}

async function fetchMemberData(userId: string, daysBack: number = 90): Promise<RawData> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffMs = cutoffDate.getTime();

  // Parallel fetch all data sources
  const [tasksSnapshot, logsSnapshot, progressesSnapshot, oooEntries, extensionsSnapshot] = await Promise.all([
    // Tasks assigned to user (completed in the period)
    db.collection('tasks')
      .where('assignee', '==', userId)
      .get(),

    // Activity logs for user (last N days)
    db.collection('logs')
      .where('meta.userId', '==', userId)
      .where('timestamp', '>=', cutoffDate)
      .orderBy('timestamp', 'desc')
      .limit(5000)
      .get(),

    // Progress updates by user
    db.collection('progresses')
      .where('userId', '==', userId)
      .where('createdAt', '>=', cutoffMs)
      .get(),

    // OOO entries for user
    getUserOOOEntries(userId),

    // Extension requests by user
    db.collection('extensionRequests')
      .where('assignee', '==', userId)
      .get(),
  ]);

  const tasks: Task[] = tasksSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Task));

  const logs: LogEntry[] = logsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      type: data.type || 'unknown',
      timestamp: data.timestamp?._seconds ? data.timestamp._seconds * 1000 : 0,
      body: data.body || {},
      meta: data.meta || {},
    };
  });

  const progresses: Progress[] = progressesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Progress));

  const extensionRequests = extensionsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      taskId: data.taskId,
      status: data.status,
      timestamp: normalizeTimestamp(data.timestamp),
      oldEndsOn: normalizeTimestamp(data.oldEndsOn), // Original deadline when extension was requested
    };
  });

  return { tasks, logs, progresses, oooEntries, extensionRequests };
}

// ============================================================================
// Metric Calculations
// ============================================================================

/**
 * Calculate Task Velocity Score
 * Formula: (onTimeCompletions / totalCompletions) × 100
 * A task is "on-time" if completed before or on the endsOn date
 */
function calculateTaskVelocity(tasks: Task[], periodMs: number): number {
  const now = Date.now();
  const cutoff = now - periodMs;

  // Get tasks completed in the period
  const completedTasks = tasks.filter(t => {
    const completedStatuses = ['COMPLETED', 'DONE', 'VERIFIED'];
    if (!completedStatuses.includes(t.status?.toUpperCase())) return false;

    const updatedAt = normalizeTimestamp(t.updatedAt || t.updated_at);
    return updatedAt >= cutoff;
  });

  if (completedTasks.length === 0) return 50; // Neutral score if no completions

  // Count on-time completions
  const onTimeCount = completedTasks.filter(t => {
    const endsOn = normalizeTimestamp(t.endsOn);
    const completedAt = normalizeTimestamp(t.updatedAt || t.updated_at);

    // If no deadline set, count as on-time
    if (!endsOn) return true;

    return completedAt <= endsOn;
  }).length;

  return Math.round((onTimeCount / completedTasks.length) * 100);
}

/**
 * Calculate Communication Consistency Score
 * Formula: (daysWithUpdates / totalActiveDays) × 100
 * Excludes OOO days from consideration
 */
function calculateCommunicationConsistency(
  logs: LogEntry[],
  progresses: Progress[],
  oooEntries: OOOEntry[],
  periodMs: number
): number {
  const now = Date.now();
  const cutoff = now - periodMs;

  // Get OOO days in period
  const oooDays = new Set<string>();
  for (const entry of oooEntries) {
    if (entry.status !== 'APPROVED' && entry.status !== 'ACTIVE') continue;

    let current = Math.max(entry.from, cutoff);
    const end = Math.min(entry.until, now);

    while (current <= end) {
      oooDays.add(new Date(current).toISOString().split('T')[0]);
      current += 24 * 60 * 60 * 1000;
    }
  }

  // Get days with activity
  const activityDays = new Set<string>();

  for (const log of logs) {
    if (log.timestamp >= cutoff) {
      const dateKey = new Date(log.timestamp).toISOString().split('T')[0];
      if (!oooDays.has(dateKey)) {
        activityDays.add(dateKey);
      }
    }
  }

  for (const progress of progresses) {
    const ts = progress.createdAt || progress.date;
    if (ts >= cutoff) {
      const dateKey = new Date(ts).toISOString().split('T')[0];
      if (!oooDays.has(dateKey)) {
        activityDays.add(dateKey);
      }
    }
  }

  // Calculate total active days (excluding weekends and OOO)
  const totalDays = Math.floor(periodMs / (24 * 60 * 60 * 1000));
  let workDays = 0;

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(now - (i * 24 * 60 * 60 * 1000));
    const dayOfWeek = date.getDay();
    const dateKey = date.toISOString().split('T')[0];

    // Skip weekends and OOO days
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !oooDays.has(dateKey)) {
      workDays++;
    }
  }

  if (workDays === 0) return 50; // Neutral if no work days

  return Math.min(100, Math.round((activityDays.size / workDays) * 100));
}

/**
 * Calculate Work Steadiness Score
 * Formula: 100 - coefficientOfVariation(weeklyActivity) × 100
 * Lower variation = higher score
 */
function calculateWorkSteadiness(
  logs: LogEntry[],
  progresses: Progress[],
  oooEntries: OOOEntry[],
  periodMs: number
): number {
  const now = Date.now();
  const cutoff = now - periodMs;
  const weeksInPeriod = Math.floor(periodMs / (7 * 24 * 60 * 60 * 1000));

  // Get OOO days
  const oooDays = new Set<string>();
  for (const entry of oooEntries) {
    if (entry.status !== 'APPROVED' && entry.status !== 'ACTIVE') continue;

    let current = Math.max(entry.from, cutoff);
    const end = Math.min(entry.until, now);

    while (current <= end) {
      oooDays.add(new Date(current).toISOString().split('T')[0]);
      current += 24 * 60 * 60 * 1000;
    }
  }

  // Count activity per week (excluding OOO days)
  const weeklyActivity: number[] = new Array(weeksInPeriod).fill(0);

  for (const log of logs) {
    if (log.timestamp >= cutoff) {
      const dateKey = new Date(log.timestamp).toISOString().split('T')[0];
      if (oooDays.has(dateKey)) continue;

      const weekIndex = Math.floor((now - log.timestamp) / (7 * 24 * 60 * 60 * 1000));
      if (weekIndex >= 0 && weekIndex < weeksInPeriod) {
        weeklyActivity[weekIndex]++;
      }
    }
  }

  for (const progress of progresses) {
    const ts = progress.createdAt || progress.date;
    if (ts >= cutoff) {
      const dateKey = new Date(ts).toISOString().split('T')[0];
      if (oooDays.has(dateKey)) continue;

      const weekIndex = Math.floor((now - ts) / (7 * 24 * 60 * 60 * 1000));
      if (weekIndex >= 0 && weekIndex < weeksInPeriod) {
        weeklyActivity[weekIndex]++;
      }
    }
  }

  // Calculate coefficient of variation
  const mean = weeklyActivity.reduce((a, b) => a + b, 0) / weeklyActivity.length;
  if (mean === 0) return 50; // Neutral if no activity

  const variance = weeklyActivity.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / weeklyActivity.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  // Convert CV to score: CV of 0 = 100, CV of 1+ = 0
  // Typical CV range is 0-1.5
  return Math.max(0, Math.min(100, Math.round(100 - (cv * 66))));
}

/**
 * Calculate Completion Quality Score
 * Formula: 100 - (extensionPenalty + lateExtensionPenalty + blockerPenalty + bouncePenalty)
 * Penalties:
 * - Extension request (proactive, before deadline): -5 each (max -20)
 * - Extension request (reactive, after deadline): -15 each (max -45) - indicates lack of communication
 * - Blocked status: -5 each (max -20)
 * - Task bounce (reassigned): -15 each (max -30)
 *
 * Late extension detection: If extensionRequest.timestamp > extensionRequest.oldEndsOn,
 * the task was already red (past deadline) when the extension was requested.
 * This indicates poor proactive communication.
 */
function calculateCompletionQuality(
  tasks: Task[],
  logs: LogEntry[],
  extensionRequests: Array<{ id: string; taskId: string; status: string; timestamp: number; oldEndsOn?: number }>,
  periodMs: number
): number {
  const now = Date.now();
  const cutoff = now - periodMs;

  // Separate proactive vs reactive (late) extension requests
  // Late = requested AFTER the task was already red (past deadline)
  const recentExtensions = extensionRequests.filter(ext => ext.timestamp >= cutoff);

  let proactiveCount = 0;
  let lateCount = 0;

  for (const ext of recentExtensions) {
    if (ext.oldEndsOn && ext.timestamp > ext.oldEndsOn) {
      // Extension requested AFTER deadline - task was already red
      lateCount++;
    } else {
      // Extension requested BEFORE deadline - proactive communication
      proactiveCount++;
    }
  }

  // Heavier penalty for late extensions (lack of communication)
  const proactivePenalty = Math.min(20, proactiveCount * 5);
  const lateExtensionPenalty = Math.min(45, lateCount * 15);
  const extensionPenalty = proactivePenalty + lateExtensionPenalty;

  // Count blocked statuses in logs
  const blockedCount = logs.filter(log => {
    if (log.type !== 'task') return false;
    return log.body?.new?.status === 'BLOCKED';
  }).length;
  const blockerPenalty = Math.min(20, blockedCount * 5);

  // Count task bounces (status changes back to ASSIGNED after being IN_PROGRESS)
  // This is harder to detect from logs, so we'll use a simpler heuristic
  let bouncePenalty = 0;
  const taskStatusHistory = new Map<string, string[]>();

  for (const log of logs.reverse()) { // Process oldest first
    if (log.type !== 'task' || !log.meta.taskId) continue;
    const newStatus = log.body?.new?.status;
    if (!newStatus) continue;

    if (!taskStatusHistory.has(log.meta.taskId)) {
      taskStatusHistory.set(log.meta.taskId, []);
    }
    taskStatusHistory.get(log.meta.taskId)!.push(newStatus);
  }

  // Detect bounces: IN_PROGRESS -> ASSIGNED
  for (const history of taskStatusHistory.values()) {
    for (let i = 1; i < history.length; i++) {
      if (history[i - 1] === 'IN_PROGRESS' && history[i] === 'ASSIGNED') {
        bouncePenalty += 15;
      }
    }
  }
  bouncePenalty = Math.min(30, bouncePenalty);

  return Math.max(0, 100 - extensionPenalty - blockerPenalty - bouncePenalty);
}

/**
 * Calculate Growth Trajectory Score
 * Formula: ((recent30Score - baseline90Score) / baseline90Score) × 100 + 50
 * Centered at 50, positive growth moves higher
 */
function calculateGrowthTrajectory(
  period30Score: number,
  period90Score: number
): number {
  if (period90Score === 0) return 50; // Neutral if no baseline

  const growthRate = (period30Score - period90Score) / period90Score;

  // Map growth rate to 0-100 scale
  // -50% growth = 0, 0% growth = 50, +50% growth = 100
  const score = 50 + (growthRate * 100);

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============================================================================
// Main Calculation Function
// ============================================================================

const PERIOD_30_DAYS = 30 * 24 * 60 * 60 * 1000;
const PERIOD_90_DAYS = 90 * 24 * 60 * 60 * 1000;

/**
 * Calculate all performance metrics for a member
 */
export async function calculateMemberMetrics(userId: string): Promise<MemberMetrics> {
  // Fetch all data for 90 days (includes 30-day period)
  const data = await fetchMemberData(userId, 90);

  // Calculate each metric for both periods
  const velocity30 = calculateTaskVelocity(data.tasks, PERIOD_30_DAYS);
  const velocity90 = calculateTaskVelocity(data.tasks, PERIOD_90_DAYS);

  const communication30 = calculateCommunicationConsistency(
    data.logs, data.progresses, data.oooEntries, PERIOD_30_DAYS
  );
  const communication90 = calculateCommunicationConsistency(
    data.logs, data.progresses, data.oooEntries, PERIOD_90_DAYS
  );

  const steadiness30 = calculateWorkSteadiness(
    data.logs, data.progresses, data.oooEntries, PERIOD_30_DAYS
  );
  const steadiness90 = calculateWorkSteadiness(
    data.logs, data.progresses, data.oooEntries, PERIOD_90_DAYS
  );

  const quality30 = calculateCompletionQuality(
    data.tasks, data.logs, data.extensionRequests, PERIOD_30_DAYS
  );
  const quality90 = calculateCompletionQuality(
    data.tasks, data.logs, data.extensionRequests, PERIOD_90_DAYS
  );

  // Calculate average scores for growth trajectory
  const avg30 = (velocity30 + communication30 + steadiness30 + quality30) / 4;
  const avg90 = (velocity90 + communication90 + steadiness90 + quality90) / 4;
  const growth = calculateGrowthTrajectory(avg30, avg90);

  // Helper to calculate trend
  const calcTrend = (p30: number, p90: number): number => {
    if (p90 === 0) return 0;
    return Math.round(((p30 - p90) / p90) * 100);
  };

  // Calculate OOO days for data availability
  const oooDays = new Set<string>();
  for (const entry of data.oooEntries) {
    if (entry.status !== 'APPROVED' && entry.status !== 'ACTIVE') continue;
    let current = entry.from;
    while (current <= entry.until) {
      oooDays.add(new Date(current).toISOString().split('T')[0]);
      current += 24 * 60 * 60 * 1000;
    }
  }

  // Build result
  const taskVelocity: MetricScore = {
    value: velocity30,
    trend: calcTrend(velocity30, velocity90),
    period30: velocity30,
    period90: velocity90,
  };

  const communicationConsistency: MetricScore = {
    value: communication30,
    trend: calcTrend(communication30, communication90),
    period30: communication30,
    period90: communication90,
  };

  const workSteadiness: MetricScore = {
    value: steadiness30,
    trend: calcTrend(steadiness30, steadiness90),
    period30: steadiness30,
    period90: steadiness90,
  };

  const completionQuality: MetricScore = {
    value: quality30,
    trend: calcTrend(quality30, quality90),
    period30: quality30,
    period90: quality90,
  };

  const growthTrajectory: MetricScore = {
    value: growth,
    trend: 0, // Growth is already a trend metric
    period30: growth,
    period90: 50, // Baseline
  };

  // Overall score: weighted average (all equal weight for now)
  const overallScore = Math.round(
    (taskVelocity.value +
     communicationConsistency.value +
     workSteadiness.value +
     completionQuality.value +
     growthTrajectory.value) / 5
  );

  return {
    taskVelocity,
    communicationConsistency,
    workSteadiness,
    completionQuality,
    growthTrajectory,
    overallScore,
    calculatedAt: Date.now(),
    dataAvailability: {
      tasksAnalyzed: data.tasks.length,
      logsAnalyzed: data.logs.length,
      progressesAnalyzed: data.progresses.length,
      oooDaysExcluded: oooDays.size,
    },
  };
}
