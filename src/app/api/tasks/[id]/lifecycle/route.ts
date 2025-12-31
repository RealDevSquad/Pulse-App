import { NextResponse } from 'next/server';
import { getTaskLifecycle } from '@/lib/task-lifecycle';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const lifecycle = await getTaskLifecycle(id);

    if (!lifecycle) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(lifecycle);
  } catch (error) {
    console.error('Error fetching task lifecycle:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task lifecycle' },
      { status: 500 }
    );
  }
}
