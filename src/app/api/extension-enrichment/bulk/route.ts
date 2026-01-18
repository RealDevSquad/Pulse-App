import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAdminUser } from '@/lib/users';
import { db } from '@/lib/firebase-admin';
import { TARGET_TYPES } from '@/lib/pulse-event-types';
import {
  validateExtensionEnrichmentInput,
  calculateMaxAvoidabilityWeight,
  type ExtensionEnrichmentEvent,
  type ExtensionEnrichmentInput,
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

interface BulkEnrichmentResult {
  extensionId: string;
  success: boolean;
  eventId?: string;
  error?: string;
}

/**
 * Compute auto flags for a single extension request
 */
async function computeAutoFlagsForExtension(
  extensionId: string,
  userId: string,
  extensionDataCache: Map<string, FirebaseFirestore.DocumentData>
): Promise<AutoComputedFlags> {
  const flags: AutoComputedFlags = {
    repeatOffender: false,
    sameTaskRepeat: false,
    shortInterval: false,
    significantDelay: false,
  };

  try {
    const extensionData = extensionDataCache.get(extensionId);
    if (!extensionData) {
      return flags;
    }

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

    // Note: repeatOffender is computed per-user, will be done in batch
  } catch (error) {
    console.error('[extension-enrichment-bulk] Error computing flags:', error);
  }

  return flags;
}

/**
 * POST - Create multiple extension enrichment events in batch
 *
 * Request body:
 * - items: Array of { extensionId, taskId, userId, avoidabilities, rootCauses, notes? }
 *
 * Returns:
 * - results: Array of { extensionId, success, eventId?, error? }
 * - summary: { total, succeeded, failed }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !(await isAdminUser(session.userId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { items } = body as { items: ExtensionEnrichmentInput[] };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'items array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (items.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 items per batch' },
        { status: 400 }
      );
    }

    // Validate all items first
    const validatedItems: ExtensionEnrichmentInput[] = [];
    const validationErrors: BulkEnrichmentResult[] = [];

    for (const item of items) {
      const validation = validateExtensionEnrichmentInput(item);
      if (!validation.valid) {
        validationErrors.push({
          extensionId: item.extensionId || 'unknown',
          success: false,
          error: validation.error,
        });
      } else {
        validatedItems.push(validation.data as ExtensionEnrichmentInput);
      }
    }

    if (validatedItems.length === 0) {
      return NextResponse.json({
        results: validationErrors,
        summary: {
          total: items.length,
          succeeded: 0,
          failed: validationErrors.length,
        },
      });
    }

    // Fetch all extension requests in batch for flag computation
    const extensionIds = validatedItems.map((item) => item.extensionId);
    const extensionDataCache = new Map<string, FirebaseFirestore.DocumentData>();

    // Batch fetch extension requests (30 at a time due to Firestore limit)
    for (let i = 0; i < extensionIds.length; i += 30) {
      const batch = extensionIds.slice(i, i + 30);
      const snapshot = await db
        .collection('extensionRequests')
        .where('__name__', 'in', batch)
        .get();

      for (const doc of snapshot.docs) {
        extensionDataCache.set(doc.id, doc.data());
      }
    }

    // Compute repeat offender status per user
    const userIds = [...new Set(validatedItems.map((item) => item.userId))];
    const repeatOffenderStatus = new Map<string, boolean>();

    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - REPEAT_OFFENDER_DAYS * 24 * 60 * 60;

    for (const userId of userIds) {
      try {
        const recentExtensions = await db
          .collection('extensionRequests')
          .where('assignee', '==', userId)
          .where('timestamp', '>=', thirtyDaysAgo)
          .get();

        repeatOffenderStatus.set(userId, recentExtensions.size >= REPEAT_OFFENDER_COUNT);
      } catch {
        repeatOffenderStatus.set(userId, false);
      }
    }

    // Create enrichment events
    const timestamp = Date.now();
    const results: BulkEnrichmentResult[] = [...validationErrors];
    const batch = db.batch();
    const pendingWrites: { ref: FirebaseFirestore.DocumentReference; item: ExtensionEnrichmentInput }[] = [];

    for (const item of validatedItems) {
      try {
        // Compute flags
        const flags = await computeAutoFlagsForExtension(
          item.extensionId,
          item.userId,
          extensionDataCache
        );

        // Set repeat offender from batch computation
        flags.repeatOffender = repeatOffenderStatus.get(item.userId) || false;

        const maxAvoidabilityWeight = calculateMaxAvoidabilityWeight(item.avoidabilities);

        const eventData: Omit<ExtensionEnrichmentEvent, 'id'> = {
          meta: {
            type: META_TYPE,
            by: session.userId,
            target: TARGET_TYPES.EXTENSION,
          },
          targetId: item.extensionId,
          taskId: item.taskId,
          userId: item.userId,
          avoidabilities: item.avoidabilities,
          avoidabilityCount: item.avoidabilities.length,
          maxAvoidabilityWeight,
          rootCauses: item.rootCauses,
          rootCauseCount: item.rootCauses.length,
          flags,
          timestamp,
        };

        if (item.notes?.trim()) {
          eventData.notes = item.notes.trim();
        }

        const docRef = db.collection('pulseAppOnly').doc();
        batch.set(docRef, eventData);
        pendingWrites.push({ ref: docRef, item });
      } catch (err) {
        results.push({
          extensionId: item.extensionId,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Commit batch
    if (pendingWrites.length > 0) {
      await batch.commit();

      for (const { ref, item } of pendingWrites) {
        results.push({
          extensionId: item.extensionId,
          success: true,
          eventId: ref.id,
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      results,
      summary: {
        total: items.length,
        succeeded,
        failed,
      },
    });
  } catch (error) {
    console.error('[extension-enrichment-bulk] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create bulk extension enrichments' },
      { status: 500 }
    );
  }
}
