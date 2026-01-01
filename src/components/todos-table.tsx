'use client';

import { useState } from 'react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import Link from 'next/link';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, Layers } from 'lucide-react';
import { GoogleIcon } from '@/components/ui/google-icon';
import { FolderOpenIcon } from '@/components/ui/folder-open';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableRowMotion } from '@/components/ui/motion';
import { Skeleton } from '@/components/ui/skeleton';
import { TodoDetailModal } from '@/components/todo-detail-modal';
import { cn } from '@/lib/utils';
import { getTodoStatusStyle, getPriorityInfo, formatTodoDueDate } from '@/lib/todos';
import type { TodoAPI } from '@/types';
import type { TodoStatusFilter, TodoSortField, SortOrder } from '@/lib/todos';

// =============================================================================
// Color utilities for label styling (matching todo-frontend approach)
// =============================================================================

/**
 * Convert hex color to rgba with alpha
 */
function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Darken a hex color for readable text
 */
function darkenColor(hex: string, factor: number = 0.3): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  const darken = (value: number) => Math.floor(value * (1 - factor));

  const newR = darken(r).toString(16).padStart(2, '0');
  const newG = darken(g).toString(16).padStart(2, '0');
  const newB = darken(b).toString(16).padStart(2, '0');

  return `#${newR}${newG}${newB}`;
}

/**
 * Increase saturation for more vibrant colors
 */
function saturateColor(hex: string, factor: number = 0.3): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  // Convert RGB to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  // Increase saturation
  s = Math.min(1, s * (1 + factor));

  // Convert HSL back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  // Convert back to hex
  const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Get label styles with pastel background and dark text
 */
function getLabelStyle(color: string): { backgroundColor: string; color: string } {
  return {
    backgroundColor: hexToRgba(saturateColor(color, 0.8), 0.2),
    color: darkenColor(color, 0.4),
  };
}

/** Map of team_id -> team name for lookup */
export type TeamsMap = Record<string, string>;

/**
 * Generate an abbreviation from a team name
 * e.g., "Real Dev Squad" -> "RDS", "RDS Caretakers" -> "RDSC", "Test" -> "Test"
 */
function getTeamAbbreviation(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    // Single word - return as-is if short, or first 4 chars
    return words[0].length <= 4 ? words[0] : words[0].slice(0, 4);
  }
  // Multiple words - take first letter of each word
  return words.map(w => w[0].toUpperCase()).join('');
}

/** Editable fields for a todo */
export interface EditableFields {
  title: string;
  description: string;
  status: TodoAPI.Status | null;
  priority: TodoAPI.PriorityNumber | null;
  dueAt: string | null;
}

interface TodosTableProps {
  todos: TodoAPI.Todo[];
  sortBy: TodoSortField;
  sortOrder: SortOrder;
  tab: TodoStatusFilter;
  search: string;
  includeDone: boolean;
  /** Map of team_id -> team name for displaying team info */
  teamsMap?: TeamsMap;
  /** Callback when a todo is saved */
  onSave?: (todoId: string, updates: Partial<EditableFields>) => Promise<void>;
  /** Callback when a todo is deferred */
  onDefer?: (todoId: string, deferredTill: string) => Promise<void>;
  /** Callback when a todo is undeferred */
  onUndefer?: (todoId: string) => Promise<void>;
}

function buildUrl(params: {
  tab: TodoStatusFilter;
  search: string;
  includeDone: boolean;
  sortBy: TodoSortField;
  sortOrder: SortOrder;
}) {
  const urlParams = new URLSearchParams();
  urlParams.set('tab', params.tab);
  urlParams.set('page', '1');
  if (params.search) {
    urlParams.set('search', params.search);
  }
  if (params.includeDone) {
    urlParams.set('includeDone', 'true');
  }
  urlParams.set('sortBy', params.sortBy);
  urlParams.set('sortOrder', params.sortOrder);
  return `/todos?${urlParams.toString()}`;
}

function SortableHeader({
  label,
  sortKey,
  currentSortBy,
  currentSortOrder,
  tab,
  search,
  includeDone,
}: {
  label: string;
  sortKey: TodoSortField;
  currentSortBy: TodoSortField;
  currentSortOrder: SortOrder;
  tab: TodoStatusFilter;
  search: string;
  includeDone: boolean;
}) {
  const isActive = currentSortBy === sortKey;
  const nextOrder = isActive && currentSortOrder === 'asc' ? 'desc' : 'asc';

  return (
    <Link
      href={buildUrl({ tab, search, includeDone, sortBy: sortKey, sortOrder: nextOrder })}
      className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium"
    >
      {label}
      {isActive ? (
        currentSortOrder === 'asc' ? (
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

export function TodosTableSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b-0">
            <TableHead className="h-12 px-4 bg-muted/30 first:rounded-tl-xl min-w-[300px]">
              <span className="font-medium">Name</span>
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[120px]">
              <span className="font-medium">Status</span>
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[180px]">
              <span className="font-medium">Label</span>
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[100px]">
              <span className="font-medium">Due</span>
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[100px]">
              <span className="font-medium">Priority</span>
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[140px]">
              <span className="font-medium">Team</span>
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[150px]">
              <span className="font-medium">Assignee</span>
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 last:rounded-tr-xl w-[150px]">
              <span className="font-medium">Created By</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, index) => (
            <TableRow key={index} className="border-b border-border/50">
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-[250px]" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-[80px] rounded-full" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-[100px]" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-[60px]" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-[60px] rounded-full" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-[100px]" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-[100px]" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-[100px]" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface FilterState {
  sortBy: TodoSortField;
  sortOrder: SortOrder;
  tab: TodoStatusFilter;
  search: string;
  includeDone: boolean;
  teamsMap?: TeamsMap;
}

function createColumns(filters: FilterState): ColumnDef<TodoAPI.Todo>[] {
  return [
    {
      id: 'title',
      accessorKey: 'title',
      header: () => (
        <SortableHeader
          label="Name"
          sortKey="title"
          currentSortBy={filters.sortBy}
          currentSortOrder={filters.sortOrder}
          tab={filters.tab}
          search={filters.search}
          includeDone={filters.includeDone}
        />
      ),
      size: 300,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.in_watchlist && (
            <Eye className="h-4 w-4 text-blue-500 shrink-0" />
          )}
          <span className="font-medium text-foreground line-clamp-2">
            {row.original.title}
          </span>
        </div>
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: () => (
        <SortableHeader
          label="Status"
          sortKey="status"
          currentSortBy={filters.sortBy}
          currentSortOrder={filters.sortOrder}
          tab={filters.tab}
          search={filters.search}
          includeDone={filters.includeDone}
        />
      ),
      size: 120,
      cell: ({ row }) => {
        const statusStyle = getTodoStatusStyle(row.original.status);
        return (
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              statusStyle.className
            )}
          >
            {statusStyle.label}
          </span>
        );
      },
    },
    {
      id: 'labels',
      header: 'Label',
      size: 180,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.labels.length > 0 ? (
            row.original.labels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center px-2.5 py-0.5 rounded-xl text-xs font-medium"
                style={getLabelStyle(label.color)}
              >
                {label.name}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground/60">-</span>
          )}
        </div>
      ),
    },
    {
      id: 'dueAt',
      accessorKey: 'dueAt',
      header: () => (
        <SortableHeader
          label="Due"
          sortKey="dueAt"
          currentSortBy={filters.sortBy}
          currentSortOrder={filters.sortOrder}
          tab={filters.tab}
          search={filters.search}
          includeDone={filters.includeDone}
        />
      ),
      size: 100,
      cell: ({ row }) => {
        const dueInfo = formatTodoDueDate(row.original.dueAt);
        return (
          <span
            className={cn(
              'text-sm',
              dueInfo.isOverdue
                ? 'text-red-600 font-semibold'
                : 'text-muted-foreground'
            )}
          >
            {dueInfo.text}
          </span>
        );
      },
    },
    {
      id: 'priority',
      accessorKey: 'priority',
      header: () => (
        <SortableHeader
          label="Priority"
          sortKey="priority"
          currentSortBy={filters.sortBy}
          currentSortOrder={filters.sortOrder}
          tab={filters.tab}
          search={filters.search}
          includeDone={filters.includeDone}
        />
      ),
      size: 100,
      cell: ({ row }) => {
        const priorityInfo = getPriorityInfo(row.original.priority);
        if (priorityInfo.label === '-') {
          return <span className="text-muted-foreground/60">-</span>;
        }
        return (
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              priorityInfo.bgColor,
              priorityInfo.color
            )}
          >
            {priorityInfo.label}
          </span>
        );
      },
    },
    {
      id: 'team',
      header: 'Team',
      size: 140,
      cell: ({ row }) => {
        const teamId = row.original.assignee?.team_id;
        if (!teamId) {
          return <span className="text-muted-foreground/60">-</span>;
        }
        const teamName = filters.teamsMap?.[teamId] || teamId;
        const abbreviation = getTeamAbbreviation(teamName);
        return (
          <div className="group/team flex items-center gap-1.5 cursor-default">
            <Layers className="h-3.5 w-3.5 text-violet-500 shrink-0" />
            <div className="flex items-center overflow-hidden">
              {/* Abbreviation - fades out and collapses on hover */}
              <span className="text-sm font-medium text-violet-600 dark:text-violet-400 whitespace-nowrap transition-all duration-200 ease-out group-hover/team:max-w-0 group-hover/team:opacity-0 max-w-[50px]">
                {abbreviation}
              </span>
              {/* Full name - expands and fades in on hover */}
              <span className="text-sm font-medium text-violet-600 dark:text-violet-400 whitespace-nowrap transition-all duration-200 ease-out max-w-0 opacity-0 group-hover/team:max-w-[200px] group-hover/team:opacity-100">
                {teamName}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: 'assignee',
      header: 'Assignee',
      size: 150,
      cell: ({ row }) => {
        const assignee = row.original.assignee;
        if (!assignee) {
          return <span className="text-muted-foreground/60">Unassigned</span>;
        }
        // Get assignee name from new structure or fallback to old
        const assigneeName = assignee.assignee_name || assignee.name || 'Unknown';
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
            <GoogleIcon className="h-3.5 w-3.5 shrink-0" />
            {assigneeName}
          </span>
        );
      },
    },
    {
      id: 'createdBy',
      header: 'Created By',
      size: 150,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <GoogleIcon className="h-3.5 w-3.5 shrink-0" />
          {row.original.createdBy.name}
        </span>
      ),
    },
  ];
}

export function TodosTable({
  todos,
  sortBy,
  sortOrder,
  tab,
  search,
  includeDone,
  teamsMap,
  onSave,
  onDefer,
  onUndefer,
}: TodosTableProps) {
  const [selectedTodo, setSelectedTodo] = useState<TodoAPI.Todo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filters: FilterState = { sortBy, sortOrder, tab, search, includeDone, teamsMap };
  const columns = createColumns(filters);

  const table = useReactTable({
    data: todos,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
  });

  const totalSize = table.getCenterTotalSize();

  const handleRowClick = (todo: TodoAPI.Todo) => {
    setSelectedTodo(todo);
    setIsModalOpen(true);
  };

  if (todos.length === 0) {
    return (
      <div className="rounded-xl border bg-card shadow-sm p-12">
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <FolderOpenIcon size={32} animateOnMount className="text-muted-foreground/50" />
          <span>No todos found</span>
        </div>
      </div>
    );
  }

  return (
    <>
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
            {table.getRowModel().rows.map((row, index) => (
              <TableRowMotion
                key={row.id}
                index={index}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => handleRowClick(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRowMotion>
            ))}
          </TableBody>
        </Table>
      </div>

      <TodoDetailModal
        todo={selectedTodo}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        teamsMap={teamsMap}
        onSave={onSave}
        onDefer={onDefer}
        onUndefer={onUndefer}
      />
    </>
  );
}
