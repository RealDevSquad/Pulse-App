'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, GripVertical } from 'lucide-react';
import type { AvailableTask } from './availability-panel';

interface AvailabilityTaskCardProps {
  task: AvailableTask;
  isDragging?: boolean;
  onTaskClick?: (task: AvailableTask) => void;
}

export function AvailabilityTaskCard({ task, isDragging, onTaskClick }: AvailabilityTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColor = {
    HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    LOW: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  }[task.priority?.toUpperCase() || 'MEDIUM'] || 'bg-gray-100 text-gray-800';

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger click if dragging or if clicking on a link
    if (isDragging || (e.target as HTMLElement).closest('a')) return;
    onTaskClick?.(task);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-50 shadow-lg scale-105 z-50' : 'hover:shadow-md hover:border-primary/50'
      }`}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <GripVertical className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-sm leading-tight line-clamp-2">
                {task.title}
              </h3>
              {task.github?.issue?.html_url && (
                <a
                  href={task.github.issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {task.priority && (
                <Badge variant="secondary" className={priorityColor}>
                  {task.priority}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {task.type || 'feature'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Static version for drag overlay
export function AvailabilityTaskCardOverlay({ task }: { task: AvailableTask }) {
  const priorityColor = {
    HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    LOW: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  }[task.priority?.toUpperCase() || 'MEDIUM'] || 'bg-gray-100 text-gray-800';

  return (
    <Card className="cursor-grabbing shadow-xl scale-105 bg-background border-primary">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <GripVertical className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <h3 className="font-medium text-sm leading-tight line-clamp-2">
              {task.title}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {task.priority && (
                <Badge variant="secondary" className={priorityColor}>
                  {task.priority}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {task.type || 'feature'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
