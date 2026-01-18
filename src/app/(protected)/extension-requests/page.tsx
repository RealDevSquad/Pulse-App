import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ListChecks } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { isAdminUser } from '@/lib/users';
import { fetchExtensionRequests, getExtensionRequestCounts } from '@/lib/extension-requests-cache';
import { Button } from '@/components/ui/button';
import { ExtensionRequestsTable } from '@/components/extension-requests-table';
import { ExtensionRequestsMobileCards } from '@/components/extension-requests-mobile-cards';
import { ExtensionRequestsFilterBar } from '@/components/extension-requests-filter-bar';
import type { ExtensionRequestStatus } from '@/types';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    sortOrder?: string;
    cursor?: string;
    assignee?: string;
  }>;
}

const ITEMS_PER_PAGE = 20;

interface FilterState {
  status: ExtensionRequestStatus | 'all';
  sortOrder: 'asc' | 'desc';
  assignee?: string;
}

export default async function ExtensionRequestsPage({ searchParams }: PageProps) {
  // Fetch session and params in parallel
  const [session, params] = await Promise.all([
    getSession(),
    searchParams,
  ]);

  // Access check: only admins can view extension requests
  if (!session?.userId || !(await isAdminUser(session.userId))) {
    redirect('/');
  }

  // Parse filter params
  const status = (['all', 'PENDING', 'APPROVED', 'DENIED'].includes(params.status || '')
    ? params.status
    : 'PENDING') as ExtensionRequestStatus | 'all';

  const sortOrder = (['asc', 'desc'].includes(params.sortOrder || '')
    ? params.sortOrder
    : 'desc') as 'asc' | 'desc';

  const cursor = params.cursor;
  const assignee = params.assignee;

  const filters: FilterState = { status, sortOrder, assignee };

  // Fetch extension requests and counts
  const [result, counts] = await Promise.all([
    fetchExtensionRequests({
      status,
      sortOrder,
      assignee,
      size: ITEMS_PER_PAGE,
      cursor,
    }),
    getExtensionRequestCounts(),
  ]);

  const { extensionRequests, next } = result;

  // Calculate total from counts
  const total = status === 'all' ? counts.all : counts[status] || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Extension Requests
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {total} {total === 1 ? 'request' : 'requests'} found
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/extension-requests/bulk-enrich">
            <ListChecks className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Bulk Enrich</span>
            <span className="sm:hidden">Enrich</span>
          </Link>
        </Button>
      </div>

      {/* Filter Bar */}
      <ExtensionRequestsFilterBar filters={filters} counts={counts} />

      {/* Desktop Table */}
      <div className="hidden md:block">
        <ExtensionRequestsTable extensionRequests={extensionRequests} isAdmin />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        <ExtensionRequestsMobileCards extensionRequests={extensionRequests} isAdmin />
      </div>

      {/* Pagination */}
      {(next || cursor) && (
        <div className="sticky bottom-0 flex items-center justify-between gap-4 py-4 border-t bg-background">
          <p className="text-sm text-muted-foreground shrink-0">
            Showing {extensionRequests.length} of {total}
          </p>
          <div className="flex gap-2">
            {cursor && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-10"
              >
                <Link
                  href={`/extension-requests?status=${status}&sortOrder=${sortOrder}${assignee ? `&assignee=${assignee}` : ''}`}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">First</span>
                </Link>
              </Button>
            )}
            {next && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-10"
              >
                <Link
                  href={`/extension-requests?status=${status}&sortOrder=${sortOrder}${assignee ? `&assignee=${assignee}` : ''}&cursor=${next}`}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
