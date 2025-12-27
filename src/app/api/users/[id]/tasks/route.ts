import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth';
import { isActiveRDSMember } from '@/lib/users';
import { getCachedUserTasks } from '@/lib/tasks-cache';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Must be active RDS member
  const isActiveMember = await isActiveRDSMember(session.userId);
  if (!isActiveMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    // 1. Invalidate the user's task cache (expire immediately so we fetch fresh)
    revalidateTag(`user-tasks-${id}`, { expire: 0 });
    
    // 2. Fetch fresh data (this repopulates the cache)
    const tasks = await getCachedUserTasks(id);
    
    // 3. Return fresh data to client
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
