import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAdminUser } from '@/lib/users';
import { db } from '@/lib/firebase-admin';
import { TARGET_TYPES } from '@/lib/pulse-event-types';
import {
  validateExtensionEnrichmentInput,
  calculateMaxAvoidabilityWeight,
  type ExtensionEnrichmentEvent,
  type AutoComputedFlags,
} from '@/lib/extension-enrichment-types';

const META_TYPE = 'extension_enrichment';

/** Days threshold for repeat offender check */
const REPEAT_OFFENDER_DAYS = 30;
const REPEAT_OFFENDER_COUNT = 3;

/** Days threshold for short interval check */
const SHORT_INTERVAL_DAYS = 3;

/** Days threshold for significant delay check */
const SIGNIFICANT_DELAY_DAYS = 7;

/**
 * Compute auto flags based on extension request data and history
 */
async function computeAutoFlags(
  extensionId: string,
  taskId: string,
  userId: string
): Promise<AutoComputedFlags> {
  const flags: AutoComputedFlags = {
    repeatOffender: false,
    sameTaskRepeat: false,
    shortInterval: false,
    significantDelay: false,
  };

  try {
    // Fetch the current extension request
    const extensionDoc = await db.collection('extensionRequests').doc(extensionId).get();
    if (!extensionDoc.exists) {
      return flags;
    }

    const extensionData = extensionDoc.data()!;
    const oldEndsOn = extensionData.oldEndsOn;
    const newEndsOn = extensionData.newEndsOn;
    const requestTimestamp = extensionData.timestamp?._seconds || extensionData.timestamp;

    // Check sameTaskRepeat: requestNumber > 1 means multiple extensions on same task
    if (extensionData.requestNumber && extensionData.requestNumber > 1) {
      flags.sameTaskRepeat = true;
    }

    // Check shortInterval: extension requested < 3 days after previous deadline
    if (requestTimestamp && oldEndsOn) {
      const daysSinceDeadline = (requestTimestamp - oldEndsOn) / (24 * 60 * 60);
      if (daysSinceDeadline < SHORT_INTERVAL_DAYS && daysSinceDeadline >= 0) {
        flags.shortInterval = true;
      }
    }

    // Check significantDelay: extension > 7 days from original deadline
    if (oldEndsOn && newEndsOn) {
      const daysExtended = (newEndsOn - oldEndsOn) / (24 * 60 * 60);
      if (daysExtended > SIGNIFICANT_DELAY_DAYS) {
        flags.significantDelay = true;
      }
    }

    // Check repeatOffender: 3+ extensions from same user in 30 days
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - REPEAT_OFFENDER_DAYS * 24 * 60 * 60;
    const recentExtensions = await db
      .collection('extensionRequests')
      .where('assignee', '==', userId)
      .where('timestamp', '>=', thirtyDaysAgo)
      .get();

    if (recentExtensions.size >= REPEAT_OFFENDER_COUNT) {
      flags.repeatOffender = true;
    }
  } catch (error) {
    console.error('[extension-enrichment] Error computing flags:', error);
  }

  return flags;
}

/**
 * GET - Fetch enrichment for an extension request (latest event) or multiple requests
 *
 * Query params:
 * - extensionId: Single extension request ID (returns latest enrichment)
 * - extensionIds: Comma-separated extension request IDs (returns latest enrichment for each)
 * - userId: Fetch all enrichments for a user's extension requests
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
    const extensionId = searchParams.get('extensionId');
    const extensionIds = searchParams.get('extensionIds');
    const userId = searchParams.get('userId');

    // Single extension query
    if (extensionId) {
      const snapshot = await db
        .collection('pulseAppOnly')
        .where('meta.type', '==', META_TYPE)
        .where('targetId', '==', extensionId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return NextResponse.json({ enrichment: null });
      }

      const doc = snapshot.docs[0];
      const enrichment: ExtensionEnrichmentEvent = {
        id: doc.id,
        ...doc.data(),
      } as ExtensionEnrichmentEvent;

      return NextResponse.json({ enrichment });
    }

    // Multiple extensions query
    if (extensionIds) {
      const ids = extensionIds.split(',').filter(Boolean).slice(0, 50); // Max 50

      if (ids.length === 0) {
        return NextResponse.json({ enrichments: {} });
      }

      const enrichmentMap: Record<string, ExtensionEnrichmentEvent> = {};

      // Firestore 'in' query limited to 30 items, so batch if needed
      for (let i = 0; i < ids.length; i += 30) {
        const batch = ids.slice(i, i + 30);
        const snapshot = await db
          .collection('pulseAppOnly')
          .where('meta.type', '==', META_TYPE)
          .where('targetId', 'in', batch)
          .orderBy('timestamp', 'desc')
          .get();

        // Keep only latest per extension
        for (const doc of snapshot.docs) {
          const data = doc.data() as ExtensionEnrichmentEvent;
          if (!enrichmentMap[data.targetId]) {
            enrichmentMap[data.targetId] = { id: doc.id, ...data };
          }
        }
      }

      return NextResponse.json({ enrichments: enrichmentMap });
    }

    // User-level query - fetch all enrichments for a user's extensions
    // Uses unified index pattern: first get user's extension IDs, then query by targetId
    if (userId) {
      // Step 1: Get user's extension request IDs
      const extensionsSnapshot = await db
        .collection('extensionRequests')
        .where('assignee', '==', userId)
        .select() // Only need doc IDs
        .limit(200)
        .get();

      if (extensionsSnapshot.empty) {
        return NextResponse.json({ enrichments: [], count: 0 });
      }

      const extensionIds = extensionsSnapshot.docs.map((doc) => doc.id);

      // Step 2: Query pulseAppOnly by targetId (uses unified index)
      const enrichmentMap: Record<string, ExtensionEnrichmentEvent> = {};

      for (let i = 0; i < extensionIds.length; i += 30) {
        const batch = extensionIds.slice(i, i + 30);
        const snapshot = await db
          .collection('pulseAppOnly')
          .where('meta.type', '==', META_TYPE)
          .where('targetId', 'in', batch)
          .orderBy('timestamp', 'desc')
          .get();

        // Keep only latest per extension
        for (const doc of snapshot.docs) {
          const data = doc.data() as ExtensionEnrichmentEvent;
          if (!enrichmentMap[data.targetId]) {
            enrichmentMap[data.targetId] = { id: doc.id, ...data };
          }
        }
      }

      return NextResponse.json({
        enrichments: Object.values(enrichmentMap),
        count: Object.keys(enrichmentMap).length,
      });
    }

    return NextResponse.json(
      { error: 'Either extensionId, extensionIds, or userId query param required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[extension-enrichment] Error fetching:', error);
    return NextResponse.json(
      { error: 'Failed to fetch extension enrichment' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new extension enrichment event
 *
 * Request body:
 * - extensionId: string (required) - the extension request being enriched
 * - taskId: string (required) - the associated task ID
 * - userId: string (required) - the assignee user ID
 * - avoidabilities: AvoidabilityType[] (required) - one or more avoidability factors
 * - rootCauses: RootCauseType[] (required) - one or more root cause classifications
 * - notes?: string (optional)
 *
 * Auto-computed flags will be calculated based on extension request history.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !(await isAdminUser(session.userId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input with strict type checking
    const validation = validateExtensionEnrichmentInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { extensionId, taskId, userId, avoidabilities, rootCauses, notes } = validation.data;
    const timestamp = Date.now();

    // Calculate numeric fields for querying
    const avoidabilityCount = avoidabilities.length;
    const maxAvoidabilityWeight = calculateMaxAvoidabilityWeight(avoidabilities);
    const rootCauseCount = rootCauses.length;

    // Compute auto flags
    const flags = await computeAutoFlags(extensionId, taskId, userId);

    // Create the enrichment event document
    const eventData: Omit<ExtensionEnrichmentEvent, 'id'> = {
      meta: {
        type: META_TYPE,
        by: session.userId,
        target: TARGET_TYPES.EXTENSION,
      },
      targetId: extensionId,
      taskId,
      userId,
      avoidabilities,
      avoidabilityCount,
      maxAvoidabilityWeight,
      rootCauses,
      rootCauseCount,
      flags,
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
    console.error('[extension-enrichment] Error creating:', error);
    return NextResponse.json(
      { error: 'Failed to create extension enrichment' },
      { status: 500 }
    );
  }
}
