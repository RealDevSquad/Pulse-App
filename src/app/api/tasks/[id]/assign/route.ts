import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const RDS_API_BASE = 'https://api.realdevsquad.com';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Check authentication - only root users can assign tasks
    const session = await getSession();
    if (!session?.userId || !isRootUser(session.userId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the session cookie to forward to RDS API
    const cookieStore = await cookies();
    const cookieName = process.env.JWT_AUTH_COOKIE_NAME || 'rds-session';
    const sessionCookie = cookieStore.get(cookieName)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: 'No session cookie' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { assigneeId } = body;

    if (!assigneeId) {
      return NextResponse.json({ error: 'assigneeId is required' }, { status: 400 });
    }

    // Calculate dates: start now, end in 7 days
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysFromNow = now + 7 * 24 * 60 * 60;

    // Build update data for task assignment
    const updateData = {
      status: 'ASSIGNED',
      assignee: assigneeId,
      startedOn: now,
      endsOn: sevenDaysFromNow,
    };

    // Call RDS API to update task
    const response = await fetch(`${RDS_API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${cookieName}=${sessionCookie}`,
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('RDS API error:', response.status, errorData);

      if (response.status === 401) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (response.status === 404) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: errorData.message || 'Failed to assign task' },
        { status: response.status }
      );
    }

    // Revalidate relevant pages
    revalidatePath('/availability');
    revalidatePath('/tasks');

    return NextResponse.json({
      success: true,
      message: 'Task assigned successfully',
    });
  } catch (error) {
    console.error('Error assigning task:', error);
    return NextResponse.json({ error: 'Failed to assign task' }, { status: 500 });
  }
}
