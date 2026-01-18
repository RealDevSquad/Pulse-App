import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { isAdminUser } from '@/lib/users';
import { fetchTaskRequests, getTaskRequestCounts } from '@/lib/task-requests-cache';
import { Button } from '@/components/ui/button';
import { TaskRequestsTable } from '@/components/task-requests-table';
import { TaskRequestsMobileCards } from '@/components/task-requests-mobile-cards';
import { TaskRequestsFilterBar } from '@/components/task-requests-filter-bar';
import type { TaskRequestStatus, TaskRequestType } from '@/types';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    requestType?: string;
    sortBy?: string;
    sortOrder?: string;
    cursor?: string;
  }>;
}

const ITEMS_PER_PAGE = 20;

export default async function TaskRequestsPage({ searchParams }: PageProps) {
  // Fetch session and params in parallel
  const [session, params] = await Promise.all([
    getSession(),
    searchParams,
  ]);

  // Access check: only admins can view task requests
  if (!session?.userId || !(await isAdminUser(session.userId))) {
    redirect('/');
  }

  // Parse filter params
  const status = (['all', 'PENDING', 'APPROVED', 'DENIED'].includes(params.status || '')
    ? params.status
    : 'PENDING') as TaskRequestStatus | 'all';

  const requestType = (['all', 'ASSIGNMENT', 'CREATION'].includes(params.requestType || '')
    ? params.requestType
    : 'all') as TaskRequestType | 'all';

  // Parse sort params (UI uses 'created'/'requestors', Firestore uses 'createdAt'/'usersCount')
  const sortByParam = (['created', 'requestors'].includes(params.sortBy || '')
    ? params.sortBy
    : 'created') as 'created' | 'requestors';
    
  // Map to Firestore field names
  const firestoreSortBy = sortByParam === 'requestors' ? 'usersCount' : 'createdAt';

  const sortOrder = (['asc', 'desc'].includes(params.sortOrder || '')
    ? params.sortOrder
    : 'desc') as 'asc' | 'desc';

  const cursor = params.cursor;
  
  // Filter state uses frontend field names for the filter bar
  const filters = { status, requestType, sortBy: sortByParam, sortOrder };

  // Fetch task requests and counts
  const [result, counts] = await Promise.all([
    fetchTaskRequests({
      status,
      requestType,
      sortBy: firestoreSortBy,
      sortOrder,
      size: ITEMS_PER_PAGE,
      cursor,
    }),
    getTaskRequestCounts(),
  ]);

  const { taskRequests, next } = result;

  // Calculate total from counts
  const total = status === 'all' ? counts.all : counts[status] || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Task Requests
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {total} {total === 1 ? 'request' : 'requests'} found
        </p>
      </div>

      {/* Filter Bar */}
      <TaskRequestsFilterBar filters={filters} counts={counts} />

      {/* Desktop Table */}
      <div className="hidden md:block">
        <TaskRequestsTable taskRequests={taskRequests} />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        <TaskRequestsMobileCards taskRequests={taskRequests} />
      </div>

      {/* Pagination */}
      {next && (
        <div className="sticky bottom-0 flex items-center justify-between gap-4 py-4 border-t bg-background">
          <p className="text-sm text-muted-foreground shrink-0">
            Showing {taskRequests.length} of {total}
          </p>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-10"
          >
            <Link
              href={`/task-requests?status=${status}&requestType=${requestType}&sortBy=${sortByParam}&sortOrder=${sortOrder}&cursor=${next}`}
            >
              <span className="hidden sm:inline">Load More</span>
              <span className="sm:hidden">More</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
