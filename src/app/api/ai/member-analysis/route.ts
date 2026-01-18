import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAIEnabled } from '@/lib/ai/config';
import { isAdminUser } from '@/lib/users';
import { db } from '@/lib/firebase-admin';
import { getFreshUserTasks } from '@/lib/tasks-cache';
import { getUserActivityFromLogs, getUserMultiPeriodMetrics } from '@/lib/logs-cache';
import { generateMemberAnalysis, type MemberActivityMetrics } from '@/lib/ai/chains/member-analysis';
import type { User } from '@/types';
import type { MemberEnrichmentEvent } from '@/lib/enrichment-types';
import type { ExtensionEnrichmentEvent } from '@/lib/extension-enrichment-types';

/**
 * Normalize timestamps to milliseconds
 * Extension requests may use Firestore timestamps with _seconds or epoch seconds
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

/**
 * Fetch extension requests for a user and calculate late extension count.
 * Late extensions are those requested AFTER the task deadline (oldEndsOn) had passed.
 * See: docs/USER_ENRICHMENT_METRICS.md
 *
 * Also returns extension IDs for follow-up queries (e.g., fetching enrichments).
 */
async function getExtensionMetrics(userId: string): Promise<{
  total: number;
  late: number;
  extensionIds: string[];
}> {
  // Fetch last 90 days of extension requests for this user
  // Using 90 days instead of 30 to capture recent activity for AI analysis
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  // Convert to epoch seconds for Firestore comparison (extension requests use epoch seconds)
  const ninetyDaysAgoSeconds = Math.floor(ninetyDaysAgo.getTime() / 1000);

  const snapshot = await db
    .collection('extensionRequests')
    .where('assignee', '==', userId)
    .where('timestamp', '>=', ninetyDaysAgoSeconds)
    .get();

  let total = 0;
  let late = 0;
  const extensionIds: string[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    total++;
    extensionIds.push(doc.id);

    const requestedAt = normalizeTimestamp(data.timestamp);
    const oldDeadline = normalizeTimestamp(data.oldEndsOn);

    // Late = requested after the task was already past deadline
    if (oldDeadline && requestedAt > oldDeadline) {
      late++;
    }
  }

  return { total, late, extensionIds };
}

/**
 * Progress update summary for AI analysis
 */
interface ProgressSummary {
  recentBlockers: string[];
  updateCount: number;
  daysSinceLastUpdate: number | null;
  averageUpdateLength: number;
}

/**
 * Fetch progress updates for a user and extract meaningful content.
 * Returns recent blockers, update quality metrics, etc.
 */
async function getProgressSummary(userId: string): Promise<ProgressSummary> {
  // Using 90 days to capture recent activity for AI analysis
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const snapshot = await db
    .collection('progresses')
    .where('userId', '==', userId)
    .where('createdAt', '>=', ninetyDaysAgo.getTime())
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const blockerSet = new Set<string>();
  let totalLength = 0;
  let latestUpdate: number | null = null;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Track latest update time
    if (!latestUpdate && data.createdAt) {
      latestUpdate = data.createdAt;
    }

    // Extract non-empty blockers (deduplicate similar ones)
    if (data.blockers && data.blockers.trim() && data.blockers.trim().toLowerCase() !== 'none') {
      // Normalize and add to set (first 100 chars to group similar blockers)
      const normalized = data.blockers.trim().substring(0, 100).toLowerCase();
      blockerSet.add(data.blockers.trim());
    }

    // Calculate average update length
    const updateText = [data.completed, data.planned, data.blockers]
      .filter(Boolean)
      .join(' ');
    totalLength += updateText.length;
  }

  const updateCount = snapshot.docs.length;
  const daysSinceLastUpdate = latestUpdate
    ? Math.floor((Date.now() - latestUpdate) / (1000 * 60 * 60 * 24))
    : null;

  return {
    recentBlockers: Array.from(blockerSet).slice(0, 5), // Top 5 unique blockers
    updateCount,
    daysSinceLastUpdate,
    averageUpdateLength: updateCount > 0 ? Math.round(totalLength / updateCount) : 0,
  };
}

/**
 * Task enrichment summary (complexity, skills)
 */
interface TaskEnrichmentSummary {
  weightedProductivity: number;
  tasksByComplexity: Record<string, number>;
  skillsUsed: string[];
  unenrichedTaskCount: number;
}

/**
 * Fetch task enrichment data for the user's completed tasks.
 * Calculates weighted productivity based on complexity.
 */
async function getTaskEnrichmentSummary(
  taskIds: string[]
): Promise<TaskEnrichmentSummary> {
  const result: TaskEnrichmentSummary = {
    weightedProductivity: 0,
    tasksByComplexity: { trivial: 0, simple: 0, moderate: 0, complex: 0, very_complex: 0 },
    skillsUsed: [],
    unenrichedTaskCount: 0,
  };

  if (taskIds.length === 0) return result;

  // Complexity weights: trivial=1, simple=2, moderate=3, complex=4, very_complex=5
  const complexityWeights: Record<string, number> = {
    trivial: 1,
    simple: 2,
    moderate: 3,
    complex: 4,
    very_complex: 5,
  };

  // Fetch task enrichment events for these tasks
  const batchSize = 30;
  const enrichmentMap = new Map<string, { complexity: string; skills: string[] }>();

  for (let i = 0; i < taskIds.length; i += batchSize) {
    const batch = taskIds.slice(i, i + batchSize);
    const snapshot = await db
      .collection('pulseAppOnly')
      .where('meta.type', '==', 'task_enrichment')
      .where('targetId', 'in', batch)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const existing = enrichmentMap.get(data.targetId);
      // Keep the latest enrichment (by timestamp)
      if (!existing || (data.timestamp && data.timestamp > (existing as any).timestamp)) {
        enrichmentMap.set(data.targetId, {
          complexity: data.complexity || 'moderate',
          skills: data.skills || [],
        });
      }
    }
  }

  const skillSet = new Set<string>();

  for (const taskId of taskIds) {
    const enrichment = enrichmentMap.get(taskId);
    if (enrichment) {
      const weight = complexityWeights[enrichment.complexity] || 3;
      result.weightedProductivity += weight;
      result.tasksByComplexity[enrichment.complexity] =
        (result.tasksByComplexity[enrichment.complexity] || 0) + 1;
      enrichment.skills.forEach((s) => skillSet.add(s));
    } else {
      result.unenrichedTaskCount++;
      // Default to moderate for unenriched tasks
      result.weightedProductivity += 3;
      result.tasksByComplexity.moderate = (result.tasksByComplexity.moderate || 0) + 1;
    }
  }

  result.skillsUsed = Array.from(skillSet).slice(0, 10);
  return result;
}

/**
 * Initiative metrics from task requests
 */
interface InitiativeMetrics {
  taskRequestsMade: number;
  taskRequestsApproved: number;
  taskRequestsDenied: number;
}

/**
 * Fetch task request history to measure initiative.
 */
async function getInitiativeMetrics(userId: string): Promise<InitiativeMetrics> {
  // Using 90 days to capture recent activity for AI analysis
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const snapshot = await db
    .collection('taskRequests')
    .where('requestedBy', '==', userId)
    .where('createdAt', '>=', ninetyDaysAgo.getTime())
    .get();

  let approved = 0;
  let denied = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.status === 'APPROVED') approved++;
    else if (data.status === 'DENIED' || data.status === 'REJECTED') denied++;
  }

  return {
    taskRequestsMade: snapshot.docs.length,
    taskRequestsApproved: approved,
    taskRequestsDenied: denied,
  };
}

/**
 * Timeline accuracy metrics
 */
interface TimelineMetrics {
  averageDaysToStart: number | null;
  onTimeCompletionRate: number;
  completedOnTime: number;
  completedLate: number;
}

/**
 * Calculate timeline accuracy from tasks.
 */
function calculateTimelineMetrics(tasks: any[]): TimelineMetrics {
  const completedStatuses = ['COMPLETED', 'DONE', 'VERIFIED'];
  // Using 90 days to capture recent activity for AI analysis
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

  let totalDaysToStart = 0;
  let startedCount = 0;
  let completedOnTime = 0;
  let completedLate = 0;

  for (const task of tasks) {
    const startedOn = normalizeTimestamp(task.startedOn);
    const endsOn = normalizeTimestamp(task.endsOn);
    const createdAt = normalizeTimestamp(task.createdAt);
    const updatedAt = normalizeTimestamp(task.updatedAt || task.updated_at);

    // Days to start (from creation/assignment to IN_PROGRESS)
    if (startedOn && createdAt && startedOn > createdAt) {
      const daysToStart = (startedOn - createdAt) / (1000 * 60 * 60 * 24);
      if (daysToStart < 365) {
        // Sanity check
        totalDaysToStart += daysToStart;
        startedCount++;
      }
    }

    // On-time completion (only for recently completed tasks)
    if (completedStatuses.includes(task.status?.toUpperCase()) && updatedAt >= ninetyDaysAgo) {
      if (endsOn) {
        if (updatedAt <= endsOn) {
          completedOnTime++;
        } else {
          completedLate++;
        }
      } else {
        // No deadline = on time
        completedOnTime++;
      }
    }
  }

  const totalCompleted = completedOnTime + completedLate;

  return {
    averageDaysToStart: startedCount > 0 ? Math.round(totalDaysToStart / startedCount) : null,
    onTimeCompletionRate: totalCompleted > 0 ? Math.round((completedOnTime / totalCompleted) * 100) : 100,
    completedOnTime,
    completedLate,
  };
}

/**
 * Detect red and green flags for the member
 */
interface Flags {
  red: string[];
  green: string[];
}

function detectFlags(
  metrics: {
    extensionTotal: number;
    extensionLate: number;
    daysSinceLastUpdate: number | null;
    updateCount: number;
    onTimeRate: number;
    taskRequestsMade: number;
    taskRequestsApproved: number;
  }
): Flags {
  const red: string[] = [];
  const green: string[] = [];

  // Red flags
  if (metrics.daysSinceLastUpdate !== null && metrics.daysSinceLastUpdate > 14) {
    red.push(`No progress updates for ${metrics.daysSinceLastUpdate} days`);
  }
  if (metrics.extensionTotal > 0 && metrics.extensionLate / metrics.extensionTotal > 0.5) {
    red.push('More than 50% of extensions requested after deadline');
  }
  if (metrics.onTimeRate < 50 && metrics.updateCount > 0) {
    red.push(`Low on-time completion rate (${metrics.onTimeRate}%)`);
  }

  // Green flags
  if (metrics.extensionTotal > 0 && metrics.extensionLate === 0) {
    green.push('100% of extensions requested proactively (before deadline)');
  }
  if (metrics.daysSinceLastUpdate !== null && metrics.daysSinceLastUpdate <= 3 && metrics.updateCount >= 5) {
    green.push('Consistent progress updates (every 2-3 days)');
  }
  if (metrics.taskRequestsMade > 0 && metrics.taskRequestsApproved === metrics.taskRequestsMade) {
    green.push(`Self-starter: ${metrics.taskRequestsMade} task requests, all approved`);
  }
  if (metrics.onTimeRate >= 90) {
    green.push(`Excellent on-time completion rate (${metrics.onTimeRate}%)`);
  }

  return { red, green };
}

const META_TYPE = 'member_enrichment';

/**
 * Find when a user actually became active (finished onboarding).
 * Uses logs to find their first task activity.
 * Returns timestamp in ms, or null if no activity found.
 */
async function getUserActiveSince(userId: string): Promise<number | null> {
  // Look for user's first task-related activity log
  // This is more accurate than created_at since users may create accounts
  // but not actively participate until later
  const snapshot = await db
    .collection('logs')
    .where('meta.userId', '==', userId)
    .where('type', '==', 'task')
    .orderBy('timestamp', 'asc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const firstLog = snapshot.docs[0].data();
  // Normalize Firestore timestamp
  if (firstLog.timestamp?._seconds) {
    return firstLog.timestamp._seconds * 1000;
  }
  return firstLog.timestamp || null;
}

/**
 * POST /api/ai/member-analysis
 *
 * Generate an AI-powered performance analysis for a member.
 * Returns a streaming SSE response.
 *
 * Request body:
 * - userId: string (required) - The member's user ID
 */
export async function POST(request: NextRequest) {
  // Check if AI is enabled
  if (!isAIEnabled()) {
    return NextResponse.json({ error: 'AI features are disabled' }, { status: 503 });
  }

  // Check authentication
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // AI features require admin (super_user) access
  if (!(await isAdminUser(session.userId))) {
    return NextResponse.json({ error: 'AI features not available for this user' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Fetch user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = { id: userDoc.id, ...userDoc.data() } as User;

    // Fetch data in parallel
    // Enrichment query uses unified field structure: meta.type + targetId + timestamp
    const [activeTasks, logsMetrics, multiPeriodMetrics, enrichmentSnapshot, extensionMetrics, progressSummary, initiativeMetrics, activeSince] = await Promise.all([
      getFreshUserTasks(userId),
      getUserActivityFromLogs(userId),
      getUserMultiPeriodMetrics(userId),
      db
        .collection('pulseAppOnly')
        .where('meta.type', '==', META_TYPE)
        .where('targetId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get(),
      getExtensionMetrics(userId),
      getProgressSummary(userId),
      getInitiativeMetrics(userId),
      getUserActiveSince(userId),
    ]);

    // Fetch extension enrichments using unified index (query by targetId = extensionId)
    // This must come after extensionMetrics since we need the extension IDs
    let extensionEnrichments: ExtensionEnrichmentEvent[] = [];
    if (extensionMetrics.extensionIds.length > 0) {
      const extensionEnrichmentMap: Record<string, ExtensionEnrichmentEvent> = {};

      // Batch query in groups of 30 (Firestore 'in' limit)
      for (let i = 0; i < extensionMetrics.extensionIds.length; i += 30) {
        const batch = extensionMetrics.extensionIds.slice(i, i + 30);
        const snapshot = await db
          .collection('pulseAppOnly')
          .where('meta.type', '==', 'extension_enrichment')
          .where('targetId', 'in', batch)
          .orderBy('timestamp', 'desc')
          .get();

        // Keep only latest per extension
        for (const doc of snapshot.docs) {
          const data = doc.data() as ExtensionEnrichmentEvent;
          if (!extensionEnrichmentMap[data.targetId]) {
            extensionEnrichmentMap[data.targetId] = { id: doc.id, ...data };
          }
        }
      }

      extensionEnrichments = Object.values(extensionEnrichmentMap);
    }

    const enrichmentEvents: MemberEnrichmentEvent[] = enrichmentSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MemberEnrichmentEvent[];

    // Calculate timeline metrics from tasks
    const timelineMetrics = calculateTimelineMetrics(activeTasks);

    // Get task IDs for completed tasks to fetch enrichment data
    const completedStatuses = ['COMPLETED', 'DONE', 'VERIFIED'];
    const completedTaskIds = activeTasks
      .filter((t) => completedStatuses.includes(t.status?.toUpperCase()))
      .map((t) => t.id);
    const taskEnrichment = await getTaskEnrichmentSummary(completedTaskIds);

    // Detect red/green flags
    const flags = detectFlags({
      extensionTotal: extensionMetrics.total,
      extensionLate: extensionMetrics.late,
      daysSinceLastUpdate: progressSummary.daysSinceLastUpdate,
      updateCount: progressSummary.updateCount,
      onTimeRate: timelineMetrics.onTimeCompletionRate,
      taskRequestsMade: initiativeMetrics.taskRequestsMade,
      taskRequestsApproved: initiativeMetrics.taskRequestsApproved,
    });

    // Build MemberActivityMetrics with all enriched data
    const metrics: MemberActivityMetrics = {
      tasksAssigned: logsMetrics.tasksAssigned,
      tasksStarted: logsMetrics.tasksStarted,
      tasksCompleted: logsMetrics.tasksCompleted,
      taskUpdates: logsMetrics.taskUpdates,
      extensionRequests: extensionMetrics.total,
      lateExtensionRequests: extensionMetrics.late,
      // New enriched metrics
      progressSummary,
      taskEnrichment,
      initiativeMetrics,
      timelineMetrics,
      flags,
    };

    // Generate the analysis stream
    // Use activeSince (first task activity) for tenure, fall back to created_at
    const stream = await generateMemberAnalysis({
      user,
      metrics,
      multiPeriodMetrics,
      activeTasks,
      enrichmentEvents,
      extensionEnrichments,
      activeSince: activeSince ?? user.created_at,
    });

    // Calculate communication score
    const totalExtensions = extensionMetrics.total;
    const lateExtensions = extensionMetrics.late;
    const proactiveExtensions = totalExtensions - lateExtensions;
    const communicationScore = totalExtensions > 0
      ? Math.round((proactiveExtensions / totalExtensions) * 100)
      : 100;

    // Prepare metrics for client visualization
    const clientMetrics = {
      tenure: {
        days: activeSince
          ? Math.floor((Date.now() - activeSince) / (1000 * 60 * 60 * 24))
          : user.created_at
            ? Math.floor((Date.now() - user.created_at) / (1000 * 60 * 60 * 24))
            : 0,
        since: activeSince ?? user.created_at,
      },
      tasks: {
        completed: logsMetrics.tasksCompleted,
        started: logsMetrics.tasksStarted,
        active: activeTasks.filter(t => !['COMPLETED', 'DONE', 'VERIFIED'].includes(t.status?.toUpperCase() || '')).length,
      },
      extensions: {
        total: totalExtensions,
        late: lateExtensions,
        proactive: proactiveExtensions,
      },
      communicationScore,
      onTimeRate: timelineMetrics.onTimeCompletionRate,
      progressUpdates: {
        count: progressSummary.updateCount,
        daysSinceLast: progressSummary.daysSinceLastUpdate,
      },
      multiPeriod: multiPeriodMetrics.periods.map(p => ({
        label: p.label,
        days: p.days,
        completed: p.tasksCompleted,
        started: p.tasksStarted,
        extensions: p.extensionRequests,
      })),
    };

    // Create SSE stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Send metrics as first message for client visualizations
          const metricsMessage = `data: ${JSON.stringify({ metrics: clientMetrics })}\n\n`;
          controller.enqueue(encoder.encode(metricsMessage));

          for await (const chunk of stream) {
            const sseMessage = `data: ${JSON.stringify({ content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));
          }

          // Signal completion
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMessage = `data: ${JSON.stringify({ error: 'Stream error' })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI member analysis error:', error);

    if (error instanceof Error) {
      if (error.message.includes('OPENROUTER_API_KEY')) {
        return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
      }
    }

    return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 });
  }
}
