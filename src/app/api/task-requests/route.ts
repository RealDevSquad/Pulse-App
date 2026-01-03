import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAdminUser } from '@/lib/users';
import {
  fetchTaskRequests,
  getTaskRequestCounts,
  type GetTaskRequestsOptions,
} from '@/lib/task-requests-cache';
import type { TaskRequestStatus, TaskRequestType } from '@/types';

export async function GET(request: Request) {
  // Check authentication
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check admin access
  const isAdmin = await isAdminUser(session.userId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  // Parse query parameters
  // Map frontend sort field names to Firestore field names
  const sortByParam = searchParams.get('sortBy');
  const sortBy = sortByParam === 'requestors' ? 'usersCount' : 'createdAt';
  
  const options: GetTaskRequestsOptions = {
    size: parseInt(searchParams.get('size') || '20', 10),
    cursor: searchParams.get('cursor') || undefined,
    sortBy: sortBy as 'createdAt' | 'usersCount',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  };

  // Status filter
  const status = searchParams.get('status');
  if (status && ['PENDING', 'APPROVED', 'DENIED', 'all'].includes(status)) {
    options.status = status as TaskRequestStatus | 'all';
  }

  // Request type filter
  const requestType = searchParams.get('requestType');
  if (requestType && ['ASSIGNMENT', 'CREATION', 'all'].includes(requestType)) {
    options.requestType = requestType as TaskRequestType | 'all';
  }

  try {
    // Fetch task requests and counts in parallel
    const [result, counts] = await Promise.all([
      fetchTaskRequests(options),
      getTaskRequestCounts(),
    ]);

    return NextResponse.json({
      taskRequests: result.taskRequests,
      next: result.next,
      counts,
    });
  } catch (error) {
    console.error('Error in task-requests API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task requests' },
      { status: 500 }
    );
  }
}
