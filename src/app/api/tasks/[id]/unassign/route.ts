import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const RDS_API_BASE = 'https://api.realdevsquad.com';

export async function POST(
  _request: Request,
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

    // Call RDS API to unassign task
    // Setting assignee to null and status to BACKLOG
    const response = await fetch(`${RDS_API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${cookieName}=${sessionCookie}`,
      },
      body: JSON.stringify({
        assignee: null,
        status: 'BACKLOG',
      }),
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
        { error: errorData.message || 'Failed to unassign task' },
        { status: response.status }
      );
    }

    // Revalidate the tasks page cache
    revalidatePath('/tasks');

    return NextResponse.json({ 
      success: true,
      message: 'Task unassigned successfully'
    });
  } catch (error) {
    console.error('Error unassigning task:', error);
    return NextResponse.json({ error: 'Failed to unassign task' }, { status: 500 });
  }
}
