'use client';

import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Github } from 'lucide-react';
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
import { UserInfoPopover } from '@/components/user-info-popover';
import { TableRowMotion } from '@/components/ui/motion';
import type { UserWithActivity } from '@/lib/users-cache';

interface FilterState {
  sortBy: string;
  sortOrder: string;
  inDiscord: boolean;
  archived: boolean;
  hideSuperusers: boolean;
}

interface MembersTableProps {
  users: UserWithActivity[];
  filters: FilterState;
  isRoot?: boolean;
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState> = {}) {
  const params = new URLSearchParams();
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('inDiscord', String(overrides.inDiscord ?? filters.inDiscord));
  params.set('archived', String(overrides.archived ?? filters.archived));
  params.set('hideSuperusers', String(overrides.hideSuperusers ?? filters.hideSuperusers));
  params.set('page', '1');
  return `/members?${params.toString()}`;
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
  });
}

function formatRelativeTime(timestamp: number | null): { text: string; isStale: boolean } {
  if (!timestamp) return { text: '-', isStale: false };

  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const isStale = days > 5;

  let text: string;
  if (days === 0) text = 'Today';
  else if (days === 1) text = 'Yesterday';
  else if (days < 7) text = `${days}d ago`;
  else if (days < 30) text = `${Math.floor(days / 7)}w ago`;
  else if (days < 365) text = `${Math.floor(days / 30)}mo ago`;
  else text = `${Math.floor(days / 365)}y ago`;

  return { text, isStale };
}

function getDiscordBadge(inDiscord?: boolean) {
  return inDiscord
    ? { label: 'Yes', className: 'border-green-500 text-green-600 bg-transparent' }
    : { label: 'No', className: 'border-red-300 text-red-400 bg-transparent' };
}

function getArchivedBadge(archived?: boolean) {
  return archived
    ? { label: 'Yes', className: 'border-red-300 text-red-400 bg-transparent' }
    : { label: 'No', className: 'border-green-500 text-green-600 bg-transparent' };
}

function getRoleBadge(hasRole?: boolean) {
  return hasRole
    ? { label: 'Yes', className: 'border-green-500 text-green-600 bg-transparent' }
    : { label: 'No', className: 'border-muted text-muted-foreground bg-transparent' };
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

function createColumns(filters: FilterState, isRoot: boolean): ColumnDef<UserWithActivity>[] {
  const columns: ColumnDef<UserWithActivity>[] = [
    {
      id: 'avatar',
      header: '',
      size: 50,
      enableResizing: false,
      cell: ({ row }) => (
        <Link href={`/member/${row.original.id}`} className="block">
          <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all">
            <AvatarImage src={row.original.picture?.url} alt={row.original.username} />
            <AvatarFallback className="text-xs">
              {getInitials(row.original.first_name, row.original.last_name, row.original.username)}
            </AvatarFallback>
          </Avatar>
        </Link>
      ),
    },
  ];

  // Only show info popover for root users
  if (isRoot) {
    columns.push({
      id: 'actions',
      header: '',
      size: 50,
      enableResizing: false,
      cell: ({ row }) => <UserInfoPopover userId={row.original.id} />,
    });
  }

  columns.push(
    {
      id: 'name',
      accessorFn: (row) => `${row.first_name} ${row.last_name}`,
      header: () => <SortableHeader label="Name" sortKey="first_name" filters={filters} />,
      size: 200,
      cell: ({ row }) => (
        <div className="group">
          <Link 
            href={`/member/${row.original.id}`}
            className="font-medium hover:text-primary hover:underline transition-colors"
          >
            {row.original.first_name} {row.original.last_name}
          </Link>
          <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-200 ease-out">
            <div className="overflow-hidden">
              <div className="text-sm text-muted-foreground pt-1 space-y-0.5">
                <div>{row.original.username}</div>
                {row.original.github_id && (
                  <a
                    href={`https://github.com/${row.original.github_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Github className="h-3 w-3" />
                    <span>{row.original.github_id}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'roles',
      accessorFn: (row) => row.roles?.member,
      header: 'Roles',
      size: 120,
      cell: ({ row }) => {
        const memberBadge = getRoleBadge(row.original.roles?.member);
        const superUserBadge = getRoleBadge(row.original.roles?.super_user);
        const developerBadge = getRoleBadge(row.original.roles?.developer);
        const designerBadge = getRoleBadge(row.original.roles?.designer);
        return (
          <div className="group">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Member:</span>
              <Badge variant="outline" className={memberBadge.className}>{memberBadge.label}</Badge>
            </div>
            <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-200 ease-out">
              <div className="overflow-hidden">
                <div className="pt-1 space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Super User:</span>
                    <Badge variant="outline" className={superUserBadge.className}>{superUserBadge.label}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Developer:</span>
                    <Badge variant="outline" className={developerBadge.className}>{developerBadge.label}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Designer:</span>
                    <Badge variant="outline" className={designerBadge.className}>{designerBadge.label}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'lastProgress',
      accessorKey: 'lastProgress',
      header: () => <SortableHeader label="Last Progress" sortKey="lastProgress" filters={filters} />,
      size: 120,
      cell: ({ row }) => {
        const { text, isStale } = formatRelativeTime(row.original.lastProgress);
        const taskId = row.original.lastProgressTaskId;
        if (taskId) {
          return (
            <a
              href={`https://status.realdevsquad.com/tasks/${taskId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`hover:underline ${isStale ? 'text-red-500 font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {text}
            </a>
          );
        }
        return (
          <span className={isStale ? 'text-red-500 font-medium' : 'text-muted-foreground'}>
            {text}
          </span>
        );
      },
    },
    {
      id: 'lastTaskUpdate',
      accessorKey: 'lastTaskUpdate',
      header: () => <SortableHeader label="Last Task Update" sortKey="lastTaskUpdate" filters={filters} />,
      size: 140,
      cell: ({ row }) => {
        const { text, isStale } = formatRelativeTime(row.original.lastTaskUpdate);
        const taskId = row.original.lastTaskUpdateId;
        if (taskId) {
          return (
            <a
              href={`https://status.realdevsquad.com/tasks/${taskId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`hover:underline ${isStale ? 'text-red-500 font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {text}
            </a>
          );
        }
        return (
          <span className={isStale ? 'text-red-500 font-medium' : 'text-muted-foreground'}>
            {text}
          </span>
        );
      },
    },
    {
      id: 'activeTasks',
      accessorKey: 'activeTaskCount',
      header: () => <SortableHeader label="Active Tasks" sortKey="activeTaskCount" filters={filters} />,
      size: 110,
      cell: ({ row }) => {
        const count = row.original.activeTaskCount;
        return (
          <span className={count > 0 ? 'font-medium' : 'text-muted-foreground'}>
            {count}
          </span>
        );
      },
    },
    {
      id: 'joined',
      accessorKey: 'created_at',
      header: () => <SortableHeader label="Joined" sortKey="created_at" filters={filters} />,
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.created_at)}</span>
      ),
    },
    {
      id: 'status',
      accessorFn: (row) => row.roles?.in_discord,
      header: 'Status',
      size: 120,
      cell: ({ row }) => {
        const discordBadge = getDiscordBadge(row.original.roles?.in_discord);
        const archivedBadge = getArchivedBadge(row.original.roles?.archived);
        return (
          <div className="group">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Discord:</span>
              <Badge variant="outline" className={discordBadge.className}>{discordBadge.label}</Badge>
            </div>
            <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-200 ease-out">
              <div className="overflow-hidden">
                <div className="pt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Archived:</span>
                    <Badge variant="outline" className={archivedBadge.className}>{archivedBadge.label}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      },
    },
  );

  return columns;
}

export function MembersTable({ users, filters, isRoot = false }: MembersTableProps) {
  const columns = createColumns(filters, isRoot);

  const table = useReactTable({
    data: users,
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
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No members found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
