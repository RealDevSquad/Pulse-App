import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

interface UserInfo {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  picture?: { url: string };
}

interface ProgressUpdate {
  id: string;
  taskId: string;
  userId: string;
  user?: UserInfo;
  type: string;
  completed: string;
  planned: string;
  blockers: string;
  createdAt: number;
  date: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    // Query Firestore progresses collection where taskId matches
    const snapshot = await db
      .collection('progresses')
      .where('taskId', '==', taskId)
      .orderBy('createdAt', 'desc')
      .get();

    const progressUpdates: ProgressUpdate[] = [];
    const userIds = new Set<string>();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userId) {
        userIds.add(data.userId);
      }
      progressUpdates.push({
        id: doc.id,
        taskId: data.taskId,
        userId: data.userId,
        type: data.type || 'task',
        completed: data.completed || '',
        planned: data.planned || '',
        blockers: data.blockers || '',
        createdAt: data.createdAt,
        date: data.date || data.createdAt,
      });
    });

    // Fetch user details for all users
    const usersMap = new Map<string, UserInfo>();
    if (userIds.size > 0) {
      const userIdsArray = Array.from(userIds);
      // Firestore 'in' query supports up to 30 items
      const batchSize = 30;
      for (let i = 0; i < userIdsArray.length; i += batchSize) {
        const batch = userIdsArray.slice(i, i + batchSize);
        const usersSnapshot = await db
          .collection('users')
          .where('__name__', 'in', batch)
          .get();
        
        usersSnapshot.forEach((doc) => {
          const data = doc.data();
          usersMap.set(doc.id, {
            id: doc.id,
            username: data.username,
            first_name: data.first_name,
            last_name: data.last_name,
            picture: data.picture,
          });
        });
      }
    }

    // Attach user info to progress updates
    const progressWithUsers = progressUpdates.map((progress) => ({
      ...progress,
      user: usersMap.get(progress.userId),
    }));

    return NextResponse.json({
      progressUpdates: progressWithUsers,
      totalCount: progressWithUsers.length,
    });
  } catch (error) {
    console.error('Error fetching progress updates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress updates' },
      { status: 500 }
    );
  }
}
