'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { ExternalLink, Github } from 'lucide-react';
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
import { TaskRequestDetailModal } from '@/components/task-request-detail-modal';
import { cn } from '@/lib/utils';
import type { TaskRequest, TaskRequestUser } from '@/types';

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

function getRequestTypeStyle(type: string) {
  switch (type) {
    case 'CREATION':
      return 'border-blue-500 text-blue-600 bg-transparent dark:text-blue-400';
    case 'ASSIGNMENT':
    default:
      return 'border-purple-500 text-purple-600 bg-transparent dark:text-purple-400';
  }
}

function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return 'Unknown';
  try {
    const now = Date.now();
    const diff = now - timestamp;
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

interface TaskRequestsTableProps {
  taskRequests: TaskRequest[];
}

export function TaskRequestsTable({ taskRequests }: TaskRequestsTableProps) {
  const [selectedRequest, setSelectedRequest] = useState<TaskRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleRowClick = (request: TaskRequest) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
  };

  const columns: ColumnDef<TaskRequest>[] = [
    {
      id: 'task',
      header: 'Task',
      size: 300,
      cell: ({ row }) => {
        const request = row.original;
        const githubUrl = request.externalIssueHtmlUrl;
        return (
          <div className="space-y-1">
            <span className="font-medium line-clamp-1">
              {request.taskTitle || 'Untitled Task'}
            </span>
            {githubUrl && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-3 w-3" />
                GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        );
      },
    },
    {
      id: 'type',
      header: 'Type',
      size: 120,
      cell: ({ row }) => (
        <Badge className={cn('text-xs', getRequestTypeStyle(row.original.requestType))}>
          {row.original.requestType}
        </Badge>
      ),
    },
    {
      id: 'requestors',
      header: 'Requestors',
      size: 140,
      cell: ({ row }) => {
        const users = row.original.users || [];
        const count = row.original.usersCount || users.length;
        const displayUsers = users.slice(0, 3);

        return (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {displayUsers.map((user: TaskRequestUser, index: number) => (
                <Avatar
                  key={user.userId || index}
                  className="h-7 w-7 border-2 border-background"
                >
                  <AvatarImage src={user.picture} />
                  <AvatarFallback className="text-xs">
                    {getInitials(user.first_name, user.last_name, user.username)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">({count})</span>
          </div>
        );
      },
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
          {formatRelativeTime(row.original.createdAt)}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data: taskRequests,
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
                    <span>No task requests found</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TaskRequestDetailModal
        taskRequest={selectedRequest}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

export function TaskRequestsTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead style={{ width: 300 }}>Task</TableHead>
            <TableHead style={{ width: 120 }}>Type</TableHead>
            <TableHead style={{ width: 140 }}>Requestors</TableHead>
            <TableHead style={{ width: 100 }}>Status</TableHead>
            <TableHead style={{ width: 100 }}>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="space-y-2">
                  <SkeletonPulse className="h-4 w-48" />
                  <SkeletonPulse className="h-3 w-20" />
                </div>
              </TableCell>
              <TableCell><SkeletonPulse className="h-6 w-20 rounded-full" /></TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <SkeletonPulse className="h-7 w-7 rounded-full" />
                    <SkeletonPulse className="h-7 w-7 rounded-full" />
                  </div>
                  <SkeletonPulse className="h-4 w-6" />
                </div>
              </TableCell>
              <TableCell><SkeletonPulse className="h-6 w-16 rounded-full" /></TableCell>
              <TableCell><SkeletonPulse className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
