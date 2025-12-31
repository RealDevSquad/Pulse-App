'use client';

import Link from 'next/link';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
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

interface TodosTableProps {
  todos: TodoAPI.Todo[];
  sortBy: TodoSortField;
  sortOrder: SortOrder;
  tab: TodoStatusFilter;
  search: string;
  includeDone: boolean;
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
              <span className="font-medium">Priority</span>
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[150px]">
              <span className="font-medium">Assignee</span>
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[150px]">
              <span className="font-medium">Created By</span>
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 last:rounded-tr-xl w-[100px]">
              <span className="font-medium">Due</span>
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
                <Skeleton className="h-5 w-[60px] rounded-full" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-[100px]" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-[100px]" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-[60px]" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TodosTable({
  todos,
  sortBy,
  sortOrder,
  tab,
  search,
  includeDone,
}: TodosTableProps) {
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
    <div className="rounded-xl border bg-card shadow-sm overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b-0">
            <TableHead className="h-12 px-4 bg-muted/30 first:rounded-tl-xl min-w-[300px]">
              <SortableHeader
                label="Name"
                sortKey="title"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                tab={tab}
                search={search}
                includeDone={includeDone}
              />
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[120px]">
              <SortableHeader
                label="Status"
                sortKey="status"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                tab={tab}
                search={search}
                includeDone={includeDone}
              />
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[180px]">
              Label
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[100px]">
              <SortableHeader
                label="Priority"
                sortKey="priority"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                tab={tab}
                search={search}
                includeDone={includeDone}
              />
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[150px]">
              Assignee
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 w-[150px]">
              Created By
            </TableHead>
            <TableHead className="h-12 px-4 bg-muted/30 last:rounded-tr-xl w-[100px]">
              <SortableHeader
                label="Due"
                sortKey="dueAt"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                tab={tab}
                search={search}
                includeDone={includeDone}
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {todos.map((todo, index) => {
            const statusStyle = getTodoStatusStyle(todo.status);
            const priorityInfo = getPriorityInfo(todo.priority);
            const dueInfo = formatTodoDueDate(todo.dueAt);

            return (
              <TableRowMotion
                key={todo.id}
                index={index}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                {/* Name */}
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {todo.in_watchlist && (
                      <Eye className="h-4 w-4 text-blue-500 shrink-0" />
                    )}
                    <span className="font-medium text-foreground line-clamp-2">
                      {todo.title}
                    </span>
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      statusStyle.className
                    )}
                  >
                    {statusStyle.label}
                  </span>
                </TableCell>

                {/* Labels */}
                <TableCell className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {todo.labels.length > 0 ? (
                      todo.labels.map((label) => (
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
                </TableCell>

                {/* Priority */}
                <TableCell className="px-4 py-3">
                  {priorityInfo.label !== '-' ? (
                    <span
                      className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        priorityInfo.bgColor,
                        priorityInfo.color
                      )}
                    >
                      {priorityInfo.label}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                </TableCell>

                {/* Assignee */}
                <TableCell className="px-4 py-3">
                  {todo.assignee ? (
                    <span className="text-sm text-foreground">
                      {todo.assignee.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">Unassigned</span>
                  )}
                </TableCell>

                {/* Created By */}
                <TableCell className="px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    {todo.createdBy.name}
                  </span>
                </TableCell>

                {/* Due Date */}
                <TableCell className="px-4 py-3">
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
                </TableCell>
              </TableRowMotion>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
