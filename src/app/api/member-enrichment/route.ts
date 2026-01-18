import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAdminUser } from '@/lib/users';
import { db } from '@/lib/firebase-admin';
import { TARGET_TYPES } from '@/lib/pulse-event-types';
import {
  ENRICHMENT_TYPES,
  ENRICHMENT_CATEGORIES,
  type EnrichmentType,
  type EnrichmentCategory,
  type MemberEnrichmentEvent,
} from '@/lib/enrichment-types';

const META_TYPE = 'member_enrichment';

/**
 * GET - Fetch enrichment events for a member
 *
 * Query params:
 * - userId: Target member's userId (required)
 * - limit: Max number of events to return (default: 50)
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
    const userId = searchParams.get('userId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    if (!userId) {
      return NextResponse.json({ error: 'userId query param required' }, { status: 400 });
    }

    // Query uses unified field structure:
    // - meta.type for event type filtering
    // - targetId for the subject of the event
    // - timestamp for ordering
    const snapshot = await db
      .collection('pulseAppOnly')
      .where('meta.type', '==', META_TYPE)
      .where('targetId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const events: MemberEnrichmentEvent[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MemberEnrichmentEvent[];

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[member-enrichment] Error fetching:', error);
    return NextResponse.json({ error: 'Failed to fetch enrichment events' }, { status: 500 });
  }
}

/**
 * POST - Create a new enrichment event
 *
 * Request body:
 * - userId: string (required) - the member being enriched
 * - enrichmentType: EnrichmentType (required)
 * - content: { text: string, category: EnrichmentCategory } (required)
 *
 * Event structure uses unified field naming:
 * - targetId: subject of the event (member being enriched)
 * - meta.by: who performed the action (superuser)
 * - meta.target: entity type ('user')
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !(await isAdminUser(session.userId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, enrichmentType, content } = body;

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!enrichmentType || !(enrichmentType in ENRICHMENT_TYPES)) {
      return NextResponse.json(
        { error: `enrichmentType must be one of: ${Object.keys(ENRICHMENT_TYPES).join(', ')}` },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'object') {
      return NextResponse.json({ error: 'content object is required' }, { status: 400 });
    }

    if (!content.text || typeof content.text !== 'string' || content.text.trim().length < 10) {
      return NextResponse.json(
        { error: 'content.text must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (!content.category || !(content.category in ENRICHMENT_CATEGORIES)) {
      return NextResponse.json(
        { error: `content.category must be one of: ${Object.keys(ENRICHMENT_CATEGORIES).join(', ')}` },
        { status: 400 }
      );
    }

    const timestamp = Date.now();

    // Create the enrichment event document with unified field naming
    const eventData: Omit<MemberEnrichmentEvent, 'id'> = {
      meta: {
        type: META_TYPE,
        by: session.userId,
        target: TARGET_TYPES.USER,
      },
      targetId: userId,
      enrichmentType: enrichmentType as EnrichmentType,
      content: {
        text: content.text.trim(),
        category: content.category as EnrichmentCategory,
      },
      timestamp,
    };

    const docRef = await db.collection('pulseAppOnly').add(eventData);

    return NextResponse.json({
      success: true,
      eventId: docRef.id,
      event: { id: docRef.id, ...eventData },
    });
  } catch (error) {
    console.error('[member-enrichment] Error creating:', error);
    return NextResponse.json({ error: 'Failed to create enrichment event' }, { status: 500 });
  }
}
