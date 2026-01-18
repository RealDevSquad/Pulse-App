'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { AvailabilityTaskCard, AvailabilityTaskCardOverlay } from './availability-task-card';
import { AvailabilityUserCard } from './availability-user-card';
import { TaskDetailModal } from './task-detail-modal';
import type { TaskWithAssignee } from '@/lib/tasks-cache';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ClipboardList,
  Users,
  Monitor,
  Smartphone,
  Search,
  ChevronDown,
  X,
  EyeOff,
  UserPlus,
} from 'lucide-react';

export interface AvailableTask {
  id: string;
  title: string;
  type?: string;
  priority?: string;
  status: string;
  createdBy?: string;
  createdAt?: number;
  github?: {
    issue?: {
      id?: number;
      html_url?: string;
    };
  };
}

export interface IdleUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  picture?: {
    url: string;
  };
  isOnboarding?: boolean;
}

type TaskSort = 'priority' | 'newest' | 'oldest';
type UserSort = 'name' | 'name-desc';

export function AvailabilityPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data state
  const [tasks, setTasks] = useState<AvailableTask[]>([]);
  const [users, setUsers] = useState<IdleUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drag state
  const [activeTask, setActiveTask] = useState<AvailableTask | null>(null);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [recentAssignments, setRecentAssignments] = useState<Map<string, string>>(new Map());

  // Task detail modal state
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter state (initialized from URL)
  const [taskSearch, setTaskSearch] = useState(searchParams.get('taskSearch') || '');
  const [taskSort, setTaskSort] = useState<TaskSort>((searchParams.get('taskSort') as TaskSort) || 'priority');
  const [taskPriority, setTaskPriority] = useState(searchParams.get('taskPriority') || 'all');
  const [userSearch, setUserSearch] = useState(searchParams.get('userSearch') || '');
  const [userSort, setUserSort] = useState<UserSort>((searchParams.get('userSort') as UserSort) || 'name');

  // Mobile filter panel
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Hidden users state
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(searchParams.get('showHidden') === 'true');
  const [showOnboarding, setShowOnboarding] = useState(searchParams.get('showOnboarding') === 'true');

  // Update URL when filters change
  const updateURL = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== 'priority' && value !== 'name') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/availability${newUrl}`, { scroll: false });
  }, [router, searchParams]);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        // First fetch availability data
        const availabilityRes = await fetch('/api/availability');
        if (!availabilityRes.ok) {
          throw new Error('Failed to fetch availability data');
        }

        const data = await availabilityRes.json();
        const fetchedUsers = data.users || [];
        setTasks(data.tasks || []);
        setUsers(fetchedUsers);

        // Then check which users are hidden (pass userIds to check)
        if (fetchedUsers.length > 0) {
          const userIds = fetchedUsers.map((u: IdleUser) => u.id).join(',');
          const hiddenRes = await fetch(`/api/availability/hidden-users?userIds=${userIds}`);
          if (hiddenRes.ok) {
            const hiddenData = await hiddenRes.json();
            setHiddenUserIds(new Set(hiddenData.userIds || []));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Search filter
    if (taskSearch && taskSearch.length >= 2) {
      const searchLower = taskSearch.toLowerCase();
      result = result.filter((t) =>
        t.title.toLowerCase().includes(searchLower)
      );
    }

    // Priority filter
    if (taskPriority !== 'all') {
      result = result.filter((t) => t.priority?.toUpperCase() === taskPriority);
    }

    // Sort
    result.sort((a, b) => {
      if (taskSort === 'priority') {
        const priorityMap: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (priorityMap[b.priority?.toUpperCase() || ''] || 0) - (priorityMap[a.priority?.toUpperCase() || ''] || 0);
      }
      if (taskSort === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
      if (taskSort === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
      return 0;
    });

    return result;
  }, [tasks, taskSearch, taskPriority, taskSort]);

  // Count onboarding users for toggle label
  const onboardingCount = useMemo(() => users.filter((u) => u.isOnboarding).length, [users]);

  // Filtered and sorted users
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Hide onboarding users unless showOnboarding is true
    if (!showOnboarding) {
      result = result.filter((u) => !u.isOnboarding);
    }

    // Hide hidden users unless showHidden is true
    if (!showHidden) {
      result = result.filter((u) => !hiddenUserIds.has(u.id));
    }

    // Search filter
    if (userSearch && userSearch.length >= 2) {
      const searchLower = userSearch.toLowerCase();
      result = result.filter((u) =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchLower) ||
        u.username.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    result.sort((a, b) => {
      const nameA = `${a.first_name} ${a.last_name}`;
      const nameB = `${b.first_name} ${b.last_name}`;
      if (userSort === 'name') return nameA.localeCompare(nameB);
      if (userSort === 'name-desc') return nameB.localeCompare(nameA);
      return 0;
    });

    return result;
  }, [users, userSearch, userSort, showHidden, hiddenUserIds, showOnboarding]);

  // Sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const task = filteredTasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  }, [filteredTasks]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const overId = String(over.id);
    if (!overId.startsWith('user-')) return;

    const userId = overId.replace('user-', '');
    const user = users.find((u) => u.id === userId);
    const task = tasks.find((t) => t.id === active.id);

    if (!user || !task) return;

    setAssigningUserId(userId);

    try {
      const response = await fetch(`/api/tasks/${task.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assigneeId: user.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign task');
      }

      setTasks((prev) => prev.filter((t) => t.id !== task.id));

      setRecentAssignments((prev) => {
        const next = new Map(prev);
        next.set(user.id, task.title);
        return next;
      });

      setTimeout(() => {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        setRecentAssignments((prev) => {
          const next = new Map(prev);
          next.delete(user.id);
          return next;
        });
      }, 2000);

    } catch (error) {
      console.error('Failed to assign task:', error);
      alert(error instanceof Error ? error.message : 'Failed to assign task');
    } finally {
      setAssigningUserId(null);
    }
  }, [tasks, users]);

  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
  }, []);

  // Handle task click to open detail modal
  const handleTaskClick = useCallback((task: AvailableTask) => {
    // Convert AvailableTask to TaskWithAssignee (unassigned tasks have no assignee)
    const taskWithAssignee: TaskWithAssignee = {
      id: task.id,
      title: task.title,
      status: task.status as TaskWithAssignee['status'],
      type: task.type,
      priority: task.priority,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      github: task.github,
      assigneeUser: null,
    };
    setSelectedTask(taskWithAssignee);
    setIsModalOpen(true);
  }, []);

  // Handle hide/show user toggle
  const handleToggleHide = useCallback(async (userId: string, hide: boolean) => {
    try {
      const response = await fetch('/api/availability/hidden-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: hide ? 'hide' : 'show' }),
      });

      if (!response.ok) {
        throw new Error('Failed to update hidden status');
      }

      // Update local state
      setHiddenUserIds((prev) => {
        const next = new Set(prev);
        if (hide) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to toggle hide:', error);
      alert(error instanceof Error ? error.message : 'Failed to update');
    }
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setTaskSearch('');
    setTaskSort('priority');
    setTaskPriority('all');
    setUserSearch('');
    setUserSort('name');
    setShowHidden(false);
    setShowOnboarding(false);
    router.replace('/availability', { scroll: false });
  }, [router]);

  const hasActiveFilters = taskSearch || taskPriority !== 'all' || taskSort !== 'priority' || userSearch || userSort !== 'name' || showHidden || showOnboarding;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-full" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-full" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-destructive">
        <p className="font-medium">Error loading data</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile notice */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground lg:hidden">
        <Smartphone className="h-4 w-4 shrink-0" />
        <span>Drag-and-drop works best on desktop.</span>
        <Monitor className="h-4 w-4 shrink-0 ml-auto" />
      </div>

      {/* Mobile collapsible filters */}
      <div className="lg:hidden">
        <Button
          variant="outline"
          className="w-full justify-between h-10"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
        >
          <span className="text-sm font-medium">
            Filters {hasActiveFilters && <span className="text-primary">(active)</span>}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
        </Button>

        {showMobileFilters && (
          <div className="mt-3 space-y-4 p-4 bg-muted/30 rounded-lg">
            {/* Task filters */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Tasks</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={taskSearch}
                  onChange={(e) => {
                    setTaskSearch(e.target.value);
                    updateURL({ taskSearch: e.target.value });
                  }}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={taskPriority}
                  onValueChange={(value) => {
                    setTaskPriority(value);
                    updateURL({ taskPriority: value });
                  }}
                >
                  <SelectTrigger className="h-9 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={taskSort}
                  onValueChange={(value: TaskSort) => {
                    setTaskSort(value);
                    updateURL({ taskSort: value });
                  }}
                >
                  <SelectTrigger className="h-9 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Sort: Priority</SelectItem>
                    <SelectItem value="newest">Sort: Newest</SelectItem>
                    <SelectItem value="oldest">Sort: Oldest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4">
              {/* User filters */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Members</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      updateURL({ userSearch: e.target.value });
                    }}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <Select
                  value={userSort}
                  onValueChange={(value: UserSort) => {
                    setUserSort(value);
                    updateURL({ userSort: value });
                  }}
                >
                  <SelectTrigger className="h-9 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Sort: A-Z</SelectItem>
                    <SelectItem value="name-desc">Sort: Z-A</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex flex-col gap-2 pt-2">
                  {onboardingCount > 0 && (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="show-onboarding-mobile"
                        checked={showOnboarding}
                        onCheckedChange={(checked) => {
                          setShowOnboarding(checked);
                          updateURL({ showOnboarding: checked ? 'true' : '' });
                        }}
                      />
                      <Label htmlFor="show-onboarding-mobile" className="text-xs flex items-center gap-1">
                        <UserPlus className="h-3 w-3" />
                        Show onboarding ({onboardingCount})
                      </Label>
                    </div>
                  )}
                  {hiddenUserIds.size > 0 && (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="show-hidden-mobile"
                        checked={showHidden}
                        onCheckedChange={(checked) => {
                          setShowHidden(checked);
                          updateURL({ showHidden: checked ? 'true' : '' });
                        }}
                      />
                      <Label htmlFor="show-hidden-mobile" className="text-xs flex items-center gap-1">
                        <EyeOff className="h-3 w-3" />
                        Show hidden ({hiddenUserIds.size})
                      </Label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-full text-muted-foreground"
              >
                <X className="h-4 w-4 mr-2" />
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Available Tasks Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">Available Tasks</h2>
              <span className="text-sm text-muted-foreground">
                ({filteredTasks.length}{filteredTasks.length !== tasks.length && ` of ${tasks.length}`})
              </span>
            </div>

            {/* Desktop task filters */}
            <div className="hidden lg:block space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={taskSearch}
                  onChange={(e) => {
                    setTaskSearch(e.target.value);
                    updateURL({ taskSearch: e.target.value });
                  }}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={taskPriority}
                  onValueChange={(value) => {
                    setTaskPriority(value);
                    updateURL({ taskPriority: value });
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={taskSort}
                  onValueChange={(value: TaskSort) => {
                    setTaskSort(value);
                    updateURL({ taskSort: value });
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Sort: Priority</SelectItem>
                    <SelectItem value="newest">Sort: Newest</SelectItem>
                    <SelectItem value="oldest">Sort: Oldest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                <ClipboardList className="h-12 w-12 mb-3 opacity-50" />
                {tasks.length === 0 ? (
                  <>
                    <p className="font-medium">No available tasks</p>
                    <p className="text-sm mt-1">All feature tasks are currently assigned</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">No tasks match your filters</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={clearFilters}
                      className="mt-2"
                    >
                      Clear filters
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <SortableContext
                items={filteredTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {filteredTasks.map((task) => (
                    <AvailabilityTaskCard
                      key={task.id}
                      task={task}
                      isDragging={activeTask?.id === task.id}
                      onTaskClick={handleTaskClick}
                    />
                  ))}
                </div>
              </SortableContext>
            )}
          </div>

          {/* Idle Members Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">Idle Members</h2>
              <span className="text-sm text-muted-foreground">
                ({filteredUsers.length}{filteredUsers.length !== users.length && ` of ${users.length}`})
              </span>
            </div>

            {/* Desktop user filters */}
            <div className="hidden lg:block space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    updateURL({ userSearch: e.target.value });
                  }}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Select
                  value={userSort}
                  onValueChange={(value: UserSort) => {
                    setUserSort(value);
                    updateURL({ userSort: value });
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Sort: A-Z</SelectItem>
                    <SelectItem value="name-desc">Sort: Z-A</SelectItem>
                  </SelectContent>
                </Select>
                {onboardingCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="show-onboarding-desktop"
                      checked={showOnboarding}
                      onCheckedChange={(checked) => {
                        setShowOnboarding(checked);
                        updateURL({ showOnboarding: checked ? 'true' : '' });
                      }}
                    />
                    <Label htmlFor="show-onboarding-desktop" className="text-xs flex items-center gap-1 whitespace-nowrap">
                      <UserPlus className="h-3 w-3" />
                      Show onboarding ({onboardingCount})
                    </Label>
                  </div>
                )}
                {hiddenUserIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="show-hidden-desktop"
                      checked={showHidden}
                      onCheckedChange={(checked) => {
                        setShowHidden(checked);
                        updateURL({ showHidden: checked ? 'true' : '' });
                      }}
                    />
                    <Label htmlFor="show-hidden-desktop" className="text-xs flex items-center gap-1 whitespace-nowrap">
                      <EyeOff className="h-3 w-3" />
                      Show hidden ({hiddenUserIds.size})
                    </Label>
                  </div>
                )}
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                <Users className="h-12 w-12 mb-3 opacity-50" />
                {users.length === 0 ? (
                  <>
                    <p className="font-medium">No idle members</p>
                    <p className="text-sm mt-1">All members are currently active</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">No members match your search</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={clearFilters}
                      className="mt-2"
                    >
                      Clear search
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <AvailabilityUserCard
                    key={user.id}
                    user={user}
                    isAssigning={assigningUserId === user.id}
                    assignedTaskTitle={recentAssignments.get(user.id)}
                    isHidden={hiddenUserIds.has(user.id)}
                    onToggleHide={handleToggleHide}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? <AvailabilityTaskCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Note about difference from status site */}
      <div className="text-xs text-muted-foreground border-t pt-4 mt-6">
        <p>
          <strong>Note:</strong> This panel shows tasks in <strong>Backlog</strong> status,
          while the status site shows tasks marked as <strong>Available/Unassigned</strong>.
          Backlog tasks are waiting to be picked up and assigned.
        </p>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  );
}
