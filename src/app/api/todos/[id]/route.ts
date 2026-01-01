import { NextRequest, NextResponse } from 'next/server';
import { MOCK_TODOS } from '@/lib/mock/todos';

/**
 * Local API route for updating a todo - mock implementation for development.
 * 
 * In production: Client calls https://services.realdevsquad.com/todo/v1/tasks/{id} directly
 * In development: Client calls /api/todos/{id} which updates mock data
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const todo = MOCK_TODOS.find((t) => t.id === id);
  
  if (!todo) {
    return NextResponse.json(
      { error: 'Todo not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ task: todo });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  // Find the todo in mock data
  const todoIndex = MOCK_TODOS.findIndex((t) => t.id === id);
  
  if (todoIndex === -1) {
    return NextResponse.json(
      { error: 'Todo not found' },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    
    // Add a small delay to simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Handle defer action
    if (action === 'defer') {
      const { deferredTill } = body;
      
      if (!deferredTill) {
        return NextResponse.json(
          { error: 'deferredTill is required for defer action' },
          { status: 400 }
        );
      }

      const updatedTodo = {
        ...MOCK_TODOS[todoIndex],
        deferredDetails: {
          deferredAt: new Date().toISOString(),
          deferredTill,
          deferredBy: {
            id: 'mock-user-id',
            name: 'Mock User',
          },
        },
        updatedAt: new Date().toISOString(),
      };

      // Update mock data in memory
      MOCK_TODOS[todoIndex] = updatedTodo;

      return NextResponse.json({
        message: 'Task deferred successfully',
        task: updatedTodo,
      });
    }

    // Handle regular update (action=update or no action)
    const allowedFields = [
      'title',
      'description', 
      'priority',
      'status',
      'dueAt',
      'labels',
      'isAcknowledged',
    ];
    
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    // Clear deferredDetails when status changes away from DEFERRED
    const currentTodo = MOCK_TODOS[todoIndex];
    const shouldClearDeferred = 
      updates.status && 
      updates.status !== 'DEFERRED' && 
      currentTodo.deferredDetails;

    const updatedTodo = {
      ...currentTodo,
      ...updates,
      ...(shouldClearDeferred ? { deferredDetails: null } : {}),
      updatedAt: new Date().toISOString(),
    };

    // Update mock data in memory
    MOCK_TODOS[todoIndex] = updatedTodo;

    return NextResponse.json({
      message: 'Task updated successfully',
      task: updatedTodo,
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
