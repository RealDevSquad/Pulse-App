import { NextRequest, NextResponse } from 'next/server';
import { MOCK_TODOS } from '@/lib/mock/todos';
import type { TodoAPI } from '@/types';

/**
 * Local API route for todos - returns mock data in development.
 * 
 * Why this exists:
 * The todo API (https://services.realdevsquad.com/todo) requires authentication
 * via cookies. In production, the browser sends cookies directly to the API.
 * However, in local development (localhost), browsers block cross-origin cookies
 * due to SameSite cookie policies - localhost cannot send cookies to a different
 * domain. This local API route serves mock data so developers can work on the
 * Todos feature without needing production authentication.
 * 
 * In production: Client calls https://services.realdevsquad.com/todo directly
 * In development: Client calls /api/todos which returns mock data
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const tab = searchParams.get('tab') || 'all'; // all, watchlist, deferred
  const includeDone = searchParams.get('includeDone') === 'true';
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  let todos = [...MOCK_TODOS];

  // Filter by tab
  switch (tab) {
    case 'watchlist':
      todos = todos.filter((t) => t.in_watchlist === true);
      break;
    case 'deferred':
      todos = todos.filter((t) => t.status === 'DEFERRED');
      break;
    case 'all':
    default:
      // No additional filtering for 'all'
      break;
  }

  // Filter out done tasks unless includeDone is true
  if (!includeDone) {
    todos = todos.filter((t) => t.status !== 'DONE');
  }

  // Search filter
  if (search.trim()) {
    const searchLower = search.toLowerCase();
    todos = todos.filter(
      (t) =>
        t.title.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower) ||
        t.displayId.toLowerCase().includes(searchLower)
    );
  }

  // Sort
  todos.sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortBy) {
      case 'title':
        aVal = a.title.toLowerCase();
        bVal = b.title.toLowerCase();
        break;
      case 'status':
        aVal = a.status || '';
        bVal = b.status || '';
        break;
      case 'priority':
        aVal = a.priority ?? 999;
        bVal = b.priority ?? 999;
        break;
      case 'dueAt':
        aVal = a.dueAt ? new Date(a.dueAt).getTime() : 0;
        bVal = b.dueAt ? new Date(b.dueAt).getTime() : 0;
        break;
      case 'createdAt':
      default:
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate
  const total = todos.length;
  const offset = (page - 1) * limit;
  const paginatedTodos = todos.slice(offset, offset + limit);
  const hasMore = offset + paginatedTodos.length < total;

  // Return response matching the production API format
  const response: TodoAPI.GetTodosResponse = {
    tasks: paginatedTodos,
    links: {
      next: hasMore ? `/api/todos?page=${page + 1}&limit=${limit}` : null,
      prev: page > 1 ? `/api/todos?page=${page - 1}&limit=${limit}` : null,
    },
  };

  // Add a small delay to simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 200));

  return NextResponse.json(response);
}
