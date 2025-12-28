'use client';

import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Database, FileText } from 'lucide-react';
import { FolderOpenIcon } from '@/components/ui/folder-open';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TableRowMotion } from '@/components/ui/motion';
import type { OOOEntry } from '@/lib/ooo-cache';

interface FilterState {
  sortBy: string;
  sortOrder: string;
  showPastRejected: boolean;
}

interface OOOTableProps {
  requests: OOOEntry[];
  filters: FilterState;
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState> = {}) {
  const params = new URLSearchParams();
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('showPastRejected', String(overrides.showPastRejected ?? filters.showPastRejected));
  params.set('page', '1');
  return `/ooo?${params.toString()}`;
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

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', className: 'border-blue-500 text-blue-600 bg-transparent' };
    case 'APPROVED':
      return { label: 'Approved', className: 'border-green-500 text-green-600 bg-transparent' };
    case 'REJECTED':
      return { label: 'Rejected', className: 'border-red-300 text-red-400 bg-transparent' };
    case 'PENDING':
    default:
      return { label: 'Pending', className: 'border-yellow-500 text-yellow-600 bg-transparent' };
  }
}

function isCurrentlyActive(from: number, until: number): boolean {
  const now = Date.now();
  return from <= now && until >= now;
}

function SourceIndicator({ source }: { source: 'requests' | 'usersStatus' }) {
  const isRequests = source === 'requests';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">
            {isRequests ? (
              <FileText className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Database className="h-4 w-4 text-blue-500" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">
            {isRequests ? (
              <>
                Source: <strong>requests</strong> collection
                <br />
                <span className="text-muted-foreground">OOO request with approval workflow</span>
              </>
            ) : (
              <>
                Source: <strong>usersStatus</strong> collection
                <br />
                <span className="text-muted-foreground">Current user status (active OOO)</span>
              </>
            )}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SortableHeader({
  label,
  sortKey,
  filters,
}: {
  label: string;
  sortKey: string;
  filters: FilterState;
}) {
  const isActive = filters.sortBy === sortKey;
  const nextOrder = isActive && filters.sortOrder === 'asc' ? 'desc' : 'asc';

  return (
    <Link
      href={buildUrl(filters, { sortBy: sortKey, sortOrder: nextOrder })}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      {isActive ? (
        filters.sortOrder === 'asc' ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="h-4 w-4 opacity-50" />
      )}
    </Link>
  );
}

function createColumns(filters: FilterState): ColumnDef<OOOEntry>[] {
  return [
    {
      id: 'source',
      header: '',
      size: 40,
      enableResizing: false,
      cell: ({ row }) => <SourceIndicator source={row.original.source} />,
    },
    {
      id: 'avatar',
      header: '',
      size: 50,
      enableResizing: false,
      cell: ({ row }) => (
        <Link href={`/member/${row.original.userId}`}>
          <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all">
            <AvatarImage src={row.original.user?.picture?.url} alt={row.original.user?.username} />
            <AvatarFallback className="text-xs">
              {getInitials(row.original.user?.first_name, row.original.user?.last_name, row.original.user?.username)}
            </AvatarFallback>
          </Avatar>
        </Link>
      ),
    },
    {
      id: 'name',
      accessorFn: (row) => `${row.user?.first_name} ${row.user?.last_name}`,
      header: 'Name',
      size: 180,
      cell: ({ row }) => (
        <Link 
          href={`/member/${row.original.userId}`}
          className="font-medium hover:text-primary hover:underline transition-colors"
        >
          {row.original.user?.first_name} {row.original.user?.last_name}
        </Link>
      ),
    },
    {
      id: 'username',
      accessorFn: (row) => row.user?.username,
      header: 'Username',
      size: 130,
      cell: ({ row }) => (
        <span className="text-muted-foreground">@{row.original.user?.username}</span>
      ),
    },
    {
      id: 'from',
      accessorKey: 'from',
      header: () => <SortableHeader label="Start Date" sortKey="from" filters={filters} />,
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.from)}</span>
      ),
    },
    {
      id: 'until',
      accessorKey: 'until',
      header: () => <SortableHeader label="End Date" sortKey="until" filters={filters} />,
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.until)}</span>
      ),
    },
    {
      id: 'reason',
      accessorKey: 'reason',
      header: 'Reason',
      size: 200,
      cell: ({ row }) => (
        <span className="text-muted-foreground truncate block max-w-[200px]" title={row.original.reason || undefined}>
          {row.original.reason || '-'}
        </span>
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: () => <SortableHeader label="Status" sortKey="status" filters={filters} />,
      size: 100,
      cell: ({ row }) => {
        const info = getStatusBadge(row.original.status);
        return <Badge variant="outline" className={info.className}>{info.label}</Badge>;
      },
    },
    {
      id: 'active',
      header: 'Currently',
      size: 90,
      cell: ({ row }) => {
        const active = isCurrentlyActive(row.original.from, row.original.until);
        return active ? (
          <Badge variant="outline" className="border-green-500 text-green-600 bg-transparent">
            Active
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: () => <SortableHeader label="Created" sortKey="createdAt" filters={filters} />,
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
  ];
}

export function OOOTable({ requests, filters }: OOOTableProps) {
  const columns = createColumns(filters);

  const table = useReactTable({
    data: requests,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
  });

  const totalSize = table.getCenterTotalSize();

  return (
    <div className="rounded-lg border overflow-auto">
      <Table style={{ width: '100%', minWidth: totalSize }}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: `${(header.getSize() / totalSize) * 100}%` }}
                  className="relative group"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 group-hover:opacity-100 hover:bg-primary ${
                        header.column.getIsResizing() ? 'bg-primary opacity-100' : 'bg-border'
                      }`}
                    />
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row, index) => (
              <TableRowMotion key={row.id} index={index}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRowMotion>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <FolderOpenIcon size={32} animateOnMount className="text-muted-foreground/50" />
                  <span>No OOO requests found</span>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
