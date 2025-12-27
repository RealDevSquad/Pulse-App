'use client';

import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Sparkles, Bug, Zap, FileText, Wrench, HelpCircle, Github } from 'lucide-react';
import Link from 'next/link';
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
import { formatRelativeTime, getTaskTypeInfo, getPriorityInfo } from '@/lib/utils';
import type { TaskWithAssignee } from '@/lib/tasks-cache';

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
              : 'bg-gray-200'
          }`}
          style={{ height: `${bar * 4 + 4}px` }}
        />
      ))}
    </div>
  );
}

export type FutureSortField = 'title' | 'priority' | 'type' | 'updatedAt' | 'createdAt';
type SortOrder = 'asc' | 'desc';

interface FilterState {
  sortBy: FutureSortField;
  sortOrder: SortOrder;
}

interface FutureTasksTableProps {
  tasks: TaskWithAssignee[];
  filters: FilterState;
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState> = {}) {
  const params = new URLSearchParams();
  params.set('tab', 'future');
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('page', '1');
  return `/tasks?${params.toString()}`;
}



function SortableHeader({
  label,
  sortKey,
  filters,
}: {
  label: string;
  sortKey: FutureSortField;
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

function createColumns(filters: FilterState): ColumnDef<TaskWithAssignee>[] {
  return [
    {
      id: 'title',
      accessorKey: 'title',
      header: () => <SortableHeader label="Title" sortKey="title" filters={filters} />,
      size: 350,
      cell: ({ row }) => (
        <div className="group">
          <a
            href={`https://status.realdevsquad.com/tasks/${row.original.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium line-clamp-2 hover:text-foreground hover:underline transition-colors"
          >
            {row.original.title}
          </a>
        </div>
      ),
    },
    {
      id: 'priority',
      accessorKey: 'priority',
      header: () => <SortableHeader label="Priority" sortKey="priority" filters={filters} />,
      size: 100,
      cell: ({ row }) => {
        const priority = row.original.priority;
        if (!priority) {
          return <span className="text-muted-foreground">-</span>;
        }
        const info = getPriorityInfo(priority);
        return (
          <div className="flex items-center group">
            <PriorityBars priority={priority} />
            <span className={`${info.textClass} max-w-0 overflow-hidden group-hover:max-w-20 group-hover:ml-1.5 transition-all duration-200 whitespace-nowrap`}>
              {info.label}
            </span>
          </div>
        );
      },
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: () => <SortableHeader label="Type" sortKey="type" filters={filters} />,
      size: 120,
      cell: ({ row }) => {
        const type = row.original.type;
        if (!type) {
          return <span className="text-muted-foreground">-</span>;
        }
        const info = getTaskTypeInfo(type);
        return (
          <div className="flex items-center group">
            <TaskTypeIcon type={type} />
            <span className={`${info.textClass} max-w-0 overflow-hidden group-hover:max-w-24 group-hover:ml-1.5 transition-all duration-200 whitespace-nowrap`}>{info.label}</span>
          </div>
        );
      },
    },
    {
      id: 'updated',
      accessorKey: 'updatedAt',
      header: 'Updated',
      size: 100,
      cell: ({ row }) => {
        const time = formatRelativeTime(row.original.updatedAt || row.original.updated_at);
        return <span className="text-muted-foreground">{time}</span>;
      },
    },
    {
      id: 'created',
      accessorKey: 'createdAt',
      header: () => <SortableHeader label="Created" sortKey="createdAt" filters={filters} />,
      size: 100,
      cell: ({ row }) => {
        const time = formatRelativeTime(row.original.createdAt);
        return <span className="text-muted-foreground">{time}</span>;
      },
    },
    {
      id: 'github',
      header: () => <Github className="h-4 w-4 text-muted-foreground" />,
      size: 50,
      cell: ({ row }) => {
        const url = row.original.github?.issue?.html_url;
        if (!url) return null;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="View on GitHub"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }) => {
        const user = row.original.assigneeUser;
        const assigneeName = user 
          ? `${user.first_name} ${user.last_name}`.trim() 
          : undefined;
        return (
          <TaskActionsMenu
            taskId={row.original.id}
            taskTitle={row.original.title}
            taskType={row.original.type}
            taskPriority={row.original.priority}
            taskEndsOn={row.original.endsOn}
            hasAssignee={!!row.original.assignee}
            assigneeName={assigneeName}
            assigneePicture={user?.picture?.url}
          />
        );
      },
    },
  ];
}

export function FutureTasksTable({ tasks, filters }: FutureTasksTableProps) {
  const columns = createColumns(filters);

  const table = useReactTable({
    data: tasks,
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
                No future tasks found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
