import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import { isUserAllowed } from '@/lib/users';

export interface UserTaskActivity {
  userId: string;
  lastTaskUpdate: number | null;
  activeTaskCount: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId || !isUserAllowed(session.userId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userIds } = await request.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'userIds array required' }, { status: 400 });
    }

    // Limit batch size
    const limitedIds = userIds.slice(0, 50);

    // Fetch task activity for each user
    const activities: UserTaskActivity[] = await Promise.all(
      limitedIds.map(async (userId: string) => {
        try {
          // Get user's most recent task by updatedAt
          const tasksSnapshot = await db
            .collection('tasks')
            .where('assignee', '==', userId)
            .orderBy('updatedAt', 'desc')
            .limit(1)
            .get();

          // Count active tasks (not completed or backlog)
          const activeTasksSnapshot = await db
            .collection('tasks')
            .where('assignee', '==', userId)
            .where('status', 'in', ['ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'NEEDS_REVIEW'])
            .count()
            .get();

          const lastTask = tasksSnapshot.docs[0];
          const lastTaskData = lastTask?.data();
          // Handle both updatedAt and updated_at fields (some docs have both)
          const lastTaskUpdate = lastTaskData
            ? (lastTaskData.updated_at || lastTaskData.updatedAt * 1000)
            : null;

          return {
            userId,
            lastTaskUpdate,
            activeTaskCount: activeTasksSnapshot.data().count,
          };
        } catch (error) {
          console.error(`Error fetching task activity for ${userId}:`, error);
          return {
            userId,
            lastTaskUpdate: null,
            activeTaskCount: 0,
          };
        }
      })
    );

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching task activities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
