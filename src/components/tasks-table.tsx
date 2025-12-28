'use client';

import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Sparkles, Bug, Zap, FileText, Wrench, HelpCircle, Github } from 'lucide-react';
import { FolderOpenIcon } from '@/components/ui/folder-open';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableRowMotion } from '@/components/ui/motion';
import { TaskActionsMenu } from '@/components/task-actions-menu';
import { getStatusBadgeStyle, formatRelativeTime, formatDueDate, getTaskTypeInfo, getPriorityInfo } from '@/lib/utils';
import type { TaskWithAssignee, TaskSortField, SortOrder, TaskStatusFilter } from '@/lib/tasks-cache';

/** Task type icon component */
function TaskTypeIcon({ type }: { type?: string }) {
  const info = getTaskTypeInfo(type);
  const iconClass = `h-4 w-4 ${info.textClass}`;
  
  switch (info.icon) {
    case 'sparkles':
      return <Sparkles className={iconClass} />;
    case 'bug':
      return <Bug className={iconClass} />;
    case 'zap':
      return <Zap className={iconClass} />;
    case 'file-text':
      return <FileText className={iconClass} />;
    case 'wrench':
      return <Wrench className={iconClass} />;
    default:
      return <HelpCircle className={iconClass} />;
  }
}

/** Priority bars component - 3 bars, filled based on priority level */
function PriorityBars({ priority }: { priority?: string }) {
  const info = getPriorityInfo(priority);
  
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3].map((bar) => (
        <div
          key={bar}
          className={`w-1 rounded-sm transition-colors ${
            bar <= info.bars 
              ? info.fillClass 
              : 'bg-gray-200 dark:bg-gray-700'
          }`}
          style={{ height: `${bar * 4 + 4}px` }}
        />
      ))}
    </div>
  );
}

interface FilterState {
  sortBy: TaskSortField;
  sortOrder: SortOrder;
  statusFilter: TaskStatusFilter;
}

interface TasksTableProps {
  tasks: TaskWithAssignee[];
  filters: FilterState;
  isRoot?: boolean;
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState> = {}) {
  const params = new URLSearchParams();
  params.set('tab', 'current');
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('status', overrides.statusFilter ?? filters.statusFilter);
  params.set('page', '1');
  return `/tasks?${params.toString()}`;
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

function SortableHeader({
  label,
  sortKey,
  filters,
}: {
  label: string;
  sortKey: TaskSortField;
  filters: FilterState;
}) {
  const isActive = filters.sortBy === sortKey;
  const nextOrder = isActive && filters.sortOrder === 'asc' ? 'desc' : 'asc';

  return (
    <Link
      href={buildUrl(filters, { sortBy: sortKey, sortOrder: nextOrder })}
      className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium"
    >
      {label}
      {isActive ? (
        filters.sortOrder === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </Link>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground font-medium tabular-nums">{percent}%</span>
    </div>
  );
}



function createColumns(filters: FilterState, isRoot: boolean): ColumnDef<TaskWithAssignee>[] {
  return [
    {
      id: 'title',
      accessorKey: 'title',
      header: () => <SortableHeader label="Title" sortKey="title" filters={filters} />,
      size: 300,
      cell: ({ row }) => (
        <a
          href={`https://status.realdevsquad.com/tasks/${row.original.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-foreground line-clamp-2 hover:text-primary hover:underline transition-colors"
        >
          {row.original.title}
        </a>
      ),
    },
    {
      id: 'assignee',
      header: 'Assignee',
      size: 180,
      cell: ({ row }) => {
        const user = row.original.assigneeUser;
        const assigneeId = row.original.assignee;
        if (!user) {
          return <span className="text-muted-foreground/70">Unassigned</span>;
        }
        return (
          <Link
            href={`/member/${assigneeId}`}
            className="flex items-center gap-2.5 hover:text-primary transition-colors group"
          >
            <Avatar className="h-7 w-7 ring-2 ring-background">
              <AvatarImage src={user.picture?.url} alt={user.username} />
              <AvatarFallback className="text-xs font-medium">
                {getInitials(user.first_name, user.last_name, user.username)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground group-hover:underline">
              {user.first_name} {user.last_name}
            </span>
          </Link>
        );
      },
    },
    {
      id: 'type',
      header: 'Type',
      size: 100,
      cell: ({ row }) => {
        const type = row.original.type;
        if (!type) {
          return <span className="text-muted-foreground/60">-</span>;
        }
        const info = getTaskTypeInfo(type);
        return (
          <div className="flex items-center group">
            <TaskTypeIcon type={type} />
            <span className={`${info.textClass} max-w-0 overflow-hidden group-hover:max-w-24 group-hover:ml-1.5 transition-all duration-200 whitespace-nowrap text-sm font-medium`}>
              {info.label}
            </span>
          </div>
        );
      },
    },
    {
      id: 'priority',
      header: 'Priority',
      size: 100,
      cell: ({ row }) => {
        const priority = row.original.priority;
        if (!priority) {
          return <span className="text-muted-foreground/60">-</span>;
        }
        const info = getPriorityInfo(priority);
        return (
          <div className="flex items-center group">
            <PriorityBars priority={priority} />
            <span className={`${info.textClass} max-w-0 overflow-hidden group-hover:max-w-20 group-hover:ml-1.5 transition-all duration-200 whitespace-nowrap text-sm font-medium`}>
              {info.label}
            </span>
          </div>
        );
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: () => <SortableHeader label="Status" sortKey="status" filters={filters} />,
      size: 120,
      cell: ({ row }) => {
        const info = getStatusBadgeStyle(row.original.status);
        return (
          <span className={info.className}>
            {info.label}
          </span>
        );
      },
    },
    {
      id: 'dueDate',
      accessorKey: 'endsOn',
      header: () => <SortableHeader label="Due Date" sortKey="endsOn" filters={filters} />,
      size: 120,
      cell: ({ row }) => {
        const status = row.original.status?.toUpperCase();
        if (status === 'BACKLOG') {
          return <span className="text-muted-foreground/60">-</span>;
        }
        const isDone = status === 'COMPLETED' || status === 'DONE';
        const { text, isOverdue } = formatDueDate(row.original.endsOn, isDone);
        return (
          <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
            {text}
          </span>
        );
      },
    },
    {
      id: 'updated',
      accessorKey: 'updatedAt',
      header: () => <SortableHeader label="Updated" sortKey="updatedAt" filters={filters} />,
      size: 100,
      cell: ({ row }) => {
        const time = formatRelativeTime(row.original.updatedAt || row.original.updated_at);
        const taskId = row.original.id;
        return (
          <a
            href={`https://status.realdevsquad.com/tasks/${taskId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/70 hover:text-foreground hover:underline transition-colors"
          >
            {time}
          </a>
        );
      },
    },
    {
      id: 'progress',
      accessorKey: 'percentCompleted',
      header: () => <SortableHeader label="Progress" sortKey="percentCompleted" filters={filters} />,
      size: 120,
      cell: ({ row }) => {
        const status = row.original.status?.toUpperCase();
        const isInProgress = status === 'IN_PROGRESS';
        if (!isInProgress) {
          return <span className="text-muted-foreground/60">-</span>;
        }
        const percent = row.original.percentCompleted ?? 0;
        return <ProgressBar percent={percent} />;
      },
    },
    {
      id: 'created',
      accessorKey: 'createdAt',
      header: () => <SortableHeader label="Created" sortKey="createdAt" filters={filters} />,
      size: 100,
      cell: ({ row }) => {
        const time = formatRelativeTime(row.original.createdAt);
        return <span className="text-muted-foreground/70">{time}</span>;
      },
    },
    {
      id: 'github',
      header: () => <Github className="h-4 w-4 text-muted-foreground/70" />,
      size: 50,
      cell: ({ row }) => {
        const url = row.original.github?.issue?.html_url;
        if (!url) return null;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="View on GitHub"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        );
      },
    },
    // Only show actions column for root users
    ...(isRoot ? [{
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }: { row: { original: TaskWithAssignee } }) => {
        const user = row.original.assigneeUser;
        const assigneeName = user 
          ? `${user.first_name} ${user.last_name}`.trim() 
          : undefined;
        return (
          <TaskActionsMenu
            taskId={row.original.id}
            taskTitle={row.original.title}
            taskStatus={row.original.status}
            taskType={row.original.type}
            taskPriority={row.original.priority}
            taskEndsOn={row.original.endsOn}
            hasAssignee={!!row.original.assignee}
            assigneeName={assigneeName}
            assigneePicture={user?.picture?.url}
          />
        );
      },
    }] : []),
  ];
}

export function TasksTable({ tasks, filters, isRoot = false }: TasksTableProps) {
  const columns = createColumns(filters, isRoot);

  const table = useReactTable({
    data: tasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
  });

  const totalSize = table.getCenterTotalSize();

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-auto">
      <Table style={{ width: '100%', minWidth: totalSize }}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-0">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: `${(header.getSize() / totalSize) * 100}%` }}
                  className="relative group h-12 px-4 bg-muted/30 first:rounded-tl-xl last:rounded-tr-xl"
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
              <TableRowMotion 
                key={row.id} 
                index={index}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-3">
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
                  <span>No tasks found</span>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
