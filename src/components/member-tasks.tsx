'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TaskWithAssignee } from '@/lib/tasks-cache';

interface MemberTasksProps {
  userId: string;
  initialTasks: TaskWithAssignee[];
}

export function MemberTasks({ userId, initialTasks }: MemberTasksProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Fetch fresh tasks in background
    const fetchFreshTasks = async () => {
      setIsRefreshing(true);
      try {
        const res = await fetch(`/api/users/${userId}/tasks`);
        if (res.ok) {
          const data = await res.json();
          setTasks(data.tasks);
        }
      } catch (error) {
        console.error('Failed to fetch fresh tasks:', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    fetchFreshTasks();
  }, [userId]);

  if (tasks.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Active Tasks ({tasks.length})
          {isRefreshing && (
            <span className="text-xs text-muted-foreground font-normal">updating...</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border">
              <div className="flex-1 min-w-0">
                <div className="font-medium line-clamp-1">{task.title}</div>
                {task.github?.issue?.html_url && (
                  <a
                    href={task.github.issue.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View on GitHub
                  </a>
                )}
              </div>
              <Badge variant="outline" className="shrink-0">
                {task.status?.replace('_', ' ')}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
