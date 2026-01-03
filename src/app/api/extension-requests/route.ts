import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAdminUser } from '@/lib/users';
import {
  fetchExtensionRequests,
  getExtensionRequestCounts,
  type GetExtensionRequestsOptions,
} from '@/lib/extension-requests-cache';
import type { ExtensionRequestStatus } from '@/types';

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
  const options: GetExtensionRequestsOptions = {
    size: parseInt(searchParams.get('size') || '20', 10),
    cursor: searchParams.get('cursor') || undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  };

  // Status filter
  const status = searchParams.get('status');
  if (status && ['PENDING', 'APPROVED', 'DENIED', 'all'].includes(status)) {
    options.status = status as ExtensionRequestStatus | 'all';
  }

  // Task ID filter
  const taskId = searchParams.get('taskId');
  if (taskId) {
    options.taskId = taskId;
  }

  // Assignee filter
  const assignee = searchParams.get('assignee');
  if (assignee) {
    options.assignee = assignee;
  }

  try {
    // Fetch extension requests and counts in parallel
    const [result, counts] = await Promise.all([
      fetchExtensionRequests(options),
      getExtensionRequestCounts(),
    ]);

    return NextResponse.json({
      extensionRequests: result.extensionRequests,
      next: result.next,
      counts,
    });
  } catch (error) {
    console.error('Error in extension-requests API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch extension requests' },
      { status: 500 }
    );
  }
}
