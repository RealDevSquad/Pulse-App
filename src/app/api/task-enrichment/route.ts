import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAdminUser } from '@/lib/users';
import { db } from '@/lib/firebase-admin';
import { TARGET_TYPES } from '@/lib/pulse-event-types';
import {
  validateTaskEnrichmentInput,
  COMPLEXITY_LEVELS,
  type TaskEnrichmentEvent,
} from '@/lib/task-enrichment-types';

const META_TYPE = 'task_enrichment';

/**
 * GET - Fetch enrichment for a task (latest event) or multiple tasks
 *
 * Query params:
 * - taskId: Single task ID (returns latest enrichment)
 * - taskIds: Comma-separated task IDs (returns latest enrichment for each)
 *
 * Uses composite index: meta.type + targetId + timestamp (desc)
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !(await isAdminUser(session.userId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const taskIds = searchParams.get('taskIds');

    // Single task query
    if (taskId) {
      const snapshot = await db
        .collection('pulseAppOnly')
        .where('meta.type', '==', META_TYPE)
        .where('targetId', '==', taskId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return NextResponse.json({ enrichment: null });
      }

      const doc = snapshot.docs[0];
      const enrichment: TaskEnrichmentEvent = {
        id: doc.id,
        ...doc.data(),
      } as TaskEnrichmentEvent;

      return NextResponse.json({ enrichment });
    }

    // Multiple tasks query
    if (taskIds) {
      const ids = taskIds.split(',').filter(Boolean).slice(0, 50); // Max 50 tasks

      if (ids.length === 0) {
        return NextResponse.json({ enrichments: {} });
      }

      // Firestore 'in' query limited to 30 items, so batch if needed
      const enrichmentMap: Record<string, TaskEnrichmentEvent> = {};

      for (let i = 0; i < ids.length; i += 30) {
        const batch = ids.slice(i, i + 30);
        const snapshot = await db
          .collection('pulseAppOnly')
          .where('meta.type', '==', META_TYPE)
          .where('targetId', 'in', batch)
          .orderBy('timestamp', 'desc')
          .get();

        // Keep only latest per task
        for (const doc of snapshot.docs) {
          const data = doc.data() as TaskEnrichmentEvent;
          if (!enrichmentMap[data.targetId]) {
            enrichmentMap[data.targetId] = { id: doc.id, ...data };
          }
        }
      }

      return NextResponse.json({ enrichments: enrichmentMap });
    }

    return NextResponse.json(
      { error: 'Either taskId or taskIds query param required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[task-enrichment] Error fetching:', error);
    return NextResponse.json({ error: 'Failed to fetch task enrichment' }, { status: 500 });
  }
}

/**
 * POST - Create a new task enrichment event
 *
 * Request body:
 * - taskId: string (required) - the task being enriched
 * - skills: string[] (required) - at least one skill
 * - complexity: ComplexityLevel (required)
 * - unknownFactors?: string[] (optional)
 * - notes?: string (optional)
 *
 * Event structure uses unified field naming:
 * - targetId: subject of the event (task being enriched)
 * - meta.by: who performed the action (superuser)
 * - meta.target: entity type ('task')
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !(await isAdminUser(session.userId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const validation = validateTaskEnrichmentInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { taskId, skills, complexity, unknownFactors, notes } = validation.data;
    const timestamp = Date.now();

    // Get numeric weight for the complexity level
    const complexityWeight = COMPLEXITY_LEVELS[complexity].weight;

    // Create the enrichment event document with unified field naming
    const eventData: Omit<TaskEnrichmentEvent, 'id'> = {
      meta: {
        type: META_TYPE,
        by: session.userId,
        target: TARGET_TYPES.TASK,
      },
      targetId: taskId,
      skills,
      skillCount: skills.length,
      complexity,
      complexityWeight,
      unknownFactors: unknownFactors || [],
      unknownCount: unknownFactors?.length || 0,
      timestamp,
    };

    // Add optional notes if provided
    if (notes && notes.trim()) {
      eventData.notes = notes.trim();
    }

    const docRef = await db.collection('pulseAppOnly').add(eventData);

    return NextResponse.json({
      success: true,
      eventId: docRef.id,
      enrichment: { id: docRef.id, ...eventData },
    });
  } catch (error) {
    console.error('[task-enrichment] Error creating:', error);
    return NextResponse.json({ error: 'Failed to create task enrichment' }, { status: 500 });
  }
}
