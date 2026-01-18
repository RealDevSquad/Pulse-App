import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { db } from '@/lib/firebase-admin';
import { TARGET_TYPES } from '@/lib/pulse-event-types';

const META_TYPE = 'availability_hidden';

interface HideEventDoc {
  meta: {
    type: 'availability_hidden';
    by: string;
    target: typeof TARGET_TYPES.USER;
  };
  action: 'hide' | 'show';
  targetId: string;
  timestamp: number;
}

/**
 * GET - Check which users are hidden
 * Query param: userIds (comma-separated list of user IDs to check)
 * Returns only the IDs that are currently hidden
 *
 * Uses composite index: meta.type + targetId + timestamp (desc)
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !isRootUser(session.userId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIdsParam = searchParams.get('userIds');

    if (!userIdsParam) {
      return NextResponse.json({ error: 'userIds query param required' }, { status: 400 });
    }

    const userIds = userIdsParam.split(',').filter(Boolean);
    if (userIds.length === 0) {
      return NextResponse.json({ userIds: [] });
    }

    // Query latest event for each user
    const hiddenUserIds: string[] = [];

    await Promise.all(
      userIds.map(async (userId) => {
        const snapshot = await db
          .collection('pulseAppOnly')
          .where('meta.type', '==', META_TYPE)
          .where('targetId', '==', userId)
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const latestEvent = snapshot.docs[0].data() as HideEventDoc;
          if (latestEvent.action === 'hide') {
            hiddenUserIds.push(userId);
          }
        }
      })
    );

    return NextResponse.json({ userIds: hiddenUserIds });
  } catch (error) {
    console.error('[hidden-users] Error fetching:', error);
    return NextResponse.json({ error: 'Failed to fetch hidden users' }, { status: 500 });
  }
}

/**
 * POST - Create a new hide/show event document
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !isRootUser(session.userId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, action } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (action !== 'hide' && action !== 'show') {
      return NextResponse.json({ error: 'action must be "hide" or "show"' }, { status: 400 });
    }

    const timestamp = Date.now();

    // Create a new document for this event
    const docRef = await db.collection('pulseAppOnly').add({
      meta: { type: META_TYPE, by: session.userId, target: TARGET_TYPES.USER },
      action,
      targetId: userId,
      timestamp,
    });

    return NextResponse.json({
      success: true,
      eventId: docRef.id,
      event: { action, targetId: userId, timestamp, meta: { by: session.userId, target: TARGET_TYPES.USER } }
    });
  } catch (error) {
    console.error('[hidden-users] Error adding event:', error);
    return NextResponse.json({ error: 'Failed to update hidden users' }, { status: 500 });
  }
}
