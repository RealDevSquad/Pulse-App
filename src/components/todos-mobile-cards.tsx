'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Eye, Clock, PauseCircle, Layers } from 'lucide-react';
import { FolderOpenIcon } from '@/components/ui/folder-open';
import { SkeletonPulse } from '@/components/ui/skeleton';
import { TodoDetailModal } from '@/components/todo-detail-modal';
import { cn } from '@/lib/utils';
import { getTodoStatusStyle, getPriorityInfo, formatTodoDueDate } from '@/lib/todos';
import type { TodoAPI } from '@/types';
import type { TeamsMap, EditableFields } from '@/components/todos-table';

// =============================================================================
// Color utilities for label styling
// =============================================================================

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

// =============================================================================
// Props
// =============================================================================

interface TodosMobileCardsProps {
  todos: TodoAPI.Todo[];
  teamsMap?: TeamsMap;
  onSave?: (todoId: string, updates: Partial<EditableFields>) => Promise<void>;
  onDefer?: (todoId: string, deferredTill: string) => Promise<void>;
  onUndefer?: (todoId: string) => Promise<void>;
}

// =============================================================================
// Component
// =============================================================================

export function TodosMobileCards({ 
  todos, 
  teamsMap,
  onSave,
  onDefer,
  onUndefer,
}: TodosMobileCardsProps) {
  const [selectedTodo, setSelectedTodo] = useState<TodoAPI.Todo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCardClick = (todo: TodoAPI.Todo) => {
    setSelectedTodo(todo);
    setIsModalOpen(true);
  };

  if (todos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <FolderOpenIcon size={32} animateOnMount className="text-muted-foreground/50" />
        <span>No todos found</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {todos.map((todo) => {
          const statusInfo = getTodoStatusStyle(todo.status);
          const priorityInfo = getPriorityInfo(todo.priority);
          const dueInfo = formatTodoDueDate(todo.dueAt);
          const isDone = todo.status === 'DONE';
          const isDeferred = !!todo.deferredDetails;
          
          // Get team name
          const teamId = todo.assignee?.team_id;
          const teamName = teamId && teamsMap ? teamsMap[teamId] : null;

          return (
            <div 
              key={todo.id} 
              className="p-4 rounded-xl bg-card border shadow-sm space-y-3 cursor-pointer hover:bg-muted/30 transition-colors active:bg-muted/50"
              onClick={() => handleCardClick(todo)}
            >
              {/* Header: Title */}
              <div className="space-y-1.5">
                <h3 className={cn(
                  "font-medium text-foreground leading-snug line-clamp-2",
                  isDone && "line-through text-muted-foreground"
                )}>
                  {todo.title}
                </h3>
                
                {/* Labels */}
                {todo.labels && todo.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {todo.labels.slice(0, 3).map((label) => (
                      <span
                        key={label.id}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: hexToRgba(label.color, 0.15),
                          color: darkenColor(label.color, 0.2),
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                    {todo.labels.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{todo.labels.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Status + Priority Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Badge */}
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  statusInfo.className
                )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', statusInfo.dotColor)} />
                  {statusInfo.label}
                </span>

                {/* Priority Badge */}
                {todo.priority && (
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    priorityInfo.bgColor,
                    priorityInfo.color
                  )}>
                    {priorityInfo.label}
                  </span>
                )}

                {/* Watchlist indicator */}
                {todo.in_watchlist && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    <Eye className="h-3 w-3" />
                    Watching
                  </span>
                )}

                {/* Deferred indicator */}
                {isDeferred && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    <PauseCircle className="h-3 w-3" />
                    Deferred
                  </span>
                )}
              </div>

              {/* Footer: Team + Due Date */}
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                {/* Team */}
                <div className="flex items-center gap-1 min-w-0">
                  {teamName ? (
                    <>
                      <Layers className="h-3 w-3 shrink-0" />
                      <span className="truncate">{teamName}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/60">No team</span>
                  )}
                </div>

                {/* Due Date */}
                {dueInfo.text !== '-' && (
                  <div className={cn(
                    'flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full',
                    dueInfo.isOverdue && !isDone
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium'
                      : 'bg-muted'
                  )}>
                    <Clock className="h-3 w-3" />
                    <span>{dueInfo.text}</span>
                  </div>
                )}
              </div>

              {/* Deferred until info */}
              {isDeferred && todo.deferredDetails && (
                <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Until {format(new Date(todo.deferredDetails.deferredTill), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          );
        })}
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

// =============================================================================
// Skeleton
// =============================================================================

export function TodosMobileCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl bg-card border shadow-sm space-y-3">
          {/* Title */}
          <div className="space-y-1.5">
            <SkeletonPulse className="h-5 w-full max-w-[280px]" />
            <SkeletonPulse className="h-5 w-2/3" />
          </div>

          {/* Status + Priority */}
          <div className="flex items-center gap-2">
            <SkeletonPulse className="h-5 w-20 rounded-full" />
            <SkeletonPulse className="h-5 w-16 rounded-full" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2">
            <SkeletonPulse className="h-4 w-24" />
            <SkeletonPulse className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
