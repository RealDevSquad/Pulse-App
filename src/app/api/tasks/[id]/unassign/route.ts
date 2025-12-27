import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { db } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';

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

    // Get the task to verify it exists
    const taskRef = db.collection('tasks').doc(id);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Update the task: clear assignee and set status to BACKLOG
    await taskRef.update({
      assignee: null,
      status: 'BACKLOG',
      updatedAt: Math.floor(Date.now() / 1000), // seconds since epoch
    });

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
