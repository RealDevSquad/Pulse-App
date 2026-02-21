'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { format, differenceInDays } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SkeletonPulse } from '@/components/ui/skeleton';
import { FolderOpenIcon } from '@/components/ui/folder-open';
import { ExtensionRequestDetailModal } from '@/components/extension-request-detail-modal';
import { ExtensionEnrichmentBadge } from '@/components/extension-enrichment-badge';
import { cn } from '@/lib/utils';
import type { ExtensionRequestWithUser } from '@/lib/extension-requests-cache';
import type { ExtensionEnrichmentEvent } from '@/lib/extension-enrichment-types';

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusStyle(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'border-green-500 text-green-600 bg-transparent dark:text-green-400';
    case 'DENIED':
      return 'border-red-500 text-red-600 bg-transparent dark:text-red-400';
    case 'PENDING':
    default:
      return 'border-yellow-500 text-yellow-600 bg-transparent dark:text-yellow-400';
  }
}

function formatDate(timestamp: number | undefined, isSeconds = true): string {
  if (!timestamp) return 'N/A';
  try {
    const ms = isSeconds && timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    return format(new Date(ms), 'MMM d');
  } catch {
    return 'N/A';
  }
}

function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return 'Unknown';
  try {
    // Convert seconds to milliseconds if needed
    const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    const now = Date.now();
    const diff = now - ms;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return 'In future';
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return 'Unknown';
  }
}

function getDaysDiff(oldEndsOn: number, newEndsOn: number): number {
  try {
    const oldDate = new Date(oldEndsOn * 1000);
    const newDate = new Date(newEndsOn * 1000);
    return differenceInDays(newDate, oldDate);
  } catch {
    return 0;
  }
}

function getInitials(firstName?: string, lastName?: string, username?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (username) {
    return username.slice(0, 2).toUpperCase();
  }
  return '??';
}

// =============================================================================
// Component
// =============================================================================

interface ExtensionRequestsTableProps {
  extensionRequests: ExtensionRequestWithUser[];
  /** Whether the current user is an admin */
  isAdmin?: boolean;
}

export function ExtensionRequestsTable({
  extensionRequests,
  isAdmin = false,
}: ExtensionRequestsTableProps) {
  const [selectedRequest, setSelectedRequest] = useState<ExtensionRequestWithUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [enrichments, setEnrichments] = useState<Record<string, ExtensionEnrichmentEvent>>({});

  // Fetch enrichments for all visible extension requests
  useEffect(() => {
    if (extensionRequests.length === 0) return;

    const extensionIds = extensionRequests.map((er) => er.id).join(',');
    fetch(`/api/extension-enrichment?extensionIds=${extensionIds}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.enrichments) {
          setEnrichments(data.enrichments);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch extension enrichments:', err);
      });
  }, [extensionRequests]);

  const handleRowClick = (request: ExtensionRequestWithUser) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
  };

  const handleEnrichmentUpdated = (extensionId: string, enrichment: ExtensionEnrichmentEvent) => {
    setEnrichments((prev) => ({
      ...prev,
      [extensionId]: enrichment,
    }));
  };

  const columns: ColumnDef<ExtensionRequestWithUser>[] = useMemo(
    () => [
      {
        id: 'task',
        header: 'Task',
        size: 220,
        cell: ({ row }) => (
          <span className="font-medium line-clamp-1">
            {row.original.taskTitle || row.original.title || 'Unknown Task'}
          </span>
        ),
      },
      {
        id: 'assignee',
        header: 'Assignee',
        size: 160,
        cell: ({ row }) => {
          const user = row.original.assigneeUser;
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.picture?.url} />
                <AvatarFallback className="text-xs">
                  {getInitials(user?.first_name, user?.last_name, user?.username)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm truncate">
                {user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.username || 'Unknown'}
              </span>
            </div>
          );
        },
      },
      {
        id: 'dates',
        header: 'ETA Change',
        size: 180,
        cell: ({ row }) => {
          const { oldEndsOn, newEndsOn } = row.original;
          const daysDiff = getDaysDiff(oldEndsOn, newEndsOn);
          return (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{formatDate(oldEndsOn)}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{formatDate(newEndsOn)}</span>
              {daysDiff > 0 && (
                <span className="text-xs text-orange-600 dark:text-orange-400">
                  +{daysDiff}d
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'enrichment',
        header: 'Enriched',
        size: 50,
        cell: ({ row }) => (
          <ExtensionEnrichmentBadge
            enrichment={enrichments[row.original.id]}
            compact
          />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        size: 100,
        cell: ({ row }) => (
          <Badge className={cn('text-xs', getStatusStyle(row.original.status))}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: 'created',
        header: 'Created',
        size: 100,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatRelativeTime(row.original.timestamp)}
          </span>
        ),
      },
    ],
    [enrichments]
  );

  const table = useReactTable({
    data: extensionRequests,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.column.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <FolderOpenIcon size={32} animateOnMount className="text-muted-foreground/50" />
                    <span>No extension requests found</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ExtensionRequestDetailModal
        extensionRequest={selectedRequest}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        isAdmin={isAdmin}
        onEnrichmentUpdated={handleEnrichmentUpdated}
      />
    </>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

export function ExtensionRequestsTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead style={{ width: 220 }}>Task</TableHead>
            <TableHead style={{ width: 160 }}>Assignee</TableHead>
            <TableHead style={{ width: 180 }}>ETA Change</TableHead>
            <TableHead style={{ width: 50 }}>Enriched</TableHead>
            <TableHead style={{ width: 100 }}>Status</TableHead>
            <TableHead style={{ width: 100 }}>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><SkeletonPulse className="h-4 w-48" /></TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <SkeletonPulse className="h-7 w-7 rounded-full" />
                  <SkeletonPulse className="h-4 w-24" />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <SkeletonPulse className="h-4 w-16" />
                  <SkeletonPulse className="h-3 w-3" />
                  <SkeletonPulse className="h-4 w-16" />
                </div>
              </TableCell>
              <TableCell><SkeletonPulse className="h-4 w-4 rounded-full" /></TableCell>
              <TableCell><SkeletonPulse className="h-6 w-16 rounded-full" /></TableCell>
              <TableCell><SkeletonPulse className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
