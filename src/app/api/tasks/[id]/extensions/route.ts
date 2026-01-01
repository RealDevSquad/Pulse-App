import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

interface UserInfo {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  picture?: { url: string };
}

interface ExtensionRequest {
  id: string;
  taskId: string;
  title?: string;
  assignee: string;
  assigneeUser?: UserInfo;
  oldEndsOn: number;
  newEndsOn: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  timestamp?: { _seconds: number };
  createdAt?: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const { searchParams } = new URL(request.url);
  const currentAssignee = searchParams.get('assignee');

  try {
    // Query Firestore extensionRequests collection where taskId matches
    const snapshot = await db
      .collection('extensionRequests')
      .where('taskId', '==', taskId)
      .get();

    const extensions: ExtensionRequest[] = [];
    const userIds = new Set<string>();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const assigneeId = data.assignee || data.assigneeId;
      if (assigneeId) {
        userIds.add(assigneeId);
      }
      extensions.push({
        id: doc.id,
        taskId: data.taskId,
        title: data.title,
        assignee: assigneeId,
        oldEndsOn: data.oldEndsOn,
        newEndsOn: data.newEndsOn,
        reason: data.reason,
        status: data.status || 'PENDING',
        timestamp: data.timestamp,
        createdAt: data.createdAt,
      });
    });

    // Fetch user details for all assignees
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

    // Attach user info to extensions
    const extensionsWithUsers = extensions.map((ext) => ({
      ...ext,
      assigneeUser: usersMap.get(ext.assignee),
    }));

    // Sort by timestamp/createdAt descending (newest first)
    extensionsWithUsers.sort((a, b) => {
      const aTime = a.timestamp?._seconds || a.createdAt || 0;
      const bTime = b.timestamp?._seconds || b.createdAt || 0;
      return bTime - aTime;
    });

    // Separate current assignee extensions from past assignee extensions
    const currentAssigneeExtensions = currentAssignee
      ? extensionsWithUsers.filter((ext) => ext.assignee === currentAssignee)
      : [];
    const pastAssigneeExtensions = currentAssignee
      ? extensionsWithUsers.filter((ext) => ext.assignee !== currentAssignee)
      : extensionsWithUsers;

    return NextResponse.json({
      currentAssigneeExtensions,
      pastAssigneeExtensions,
      totalCount: extensionsWithUsers.length,
    });
  } catch (error) {
    console.error('Error fetching extension requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch extension requests' },
      { status: 500 }
    );
  }
}
