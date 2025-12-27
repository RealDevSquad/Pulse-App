import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { db } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';

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

    // Get the task to verify it exists
    const taskRef = db.collection('tasks').doc(id);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { title, priority, endsOn } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: Math.floor(Date.now() / 1000), // seconds since epoch
    };

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

    // Update the task
    await taskRef.update(updateData);

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
