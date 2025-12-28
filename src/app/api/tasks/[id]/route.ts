import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const RDS_API_BASE = 'https://api.realdevsquad.com';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Check authentication - only root users can write
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
    const { title, priority, endsOn } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) {
      updateData.title = title;
    }

    if (priority !== undefined) {
      updateData.priority = priority;
    }

    if (endsOn !== undefined) {
      // endsOn can be null (to clear) or a timestamp in seconds
      updateData.endsOn = endsOn;
    }

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
        { error: errorData.message || 'Failed to update task' },
        { status: response.status }
      );
    }

    // Revalidate the tasks page cache
    revalidatePath('/tasks');

    return NextResponse.json({ 
      success: true,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}
