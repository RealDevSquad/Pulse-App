'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { ListTodo, FileText, Plane, User, CalendarDays, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ExternalLink, Clock, Check } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export type ActivityType = 'task_update' | 'task_assigned' | 'task_started' | 'task_completed' | 'progress' | 'ooo' | 'task_request' | 'profile_update' | 'extension_request';

export interface ActivityEntry {
  id: string;
  title: string;
  subtitle?: string;
  url?: string;
}

export interface ActivityItem {
  type: ActivityType;
  count: number;
  entries?: ActivityEntry[];
}

export interface ActivityDay {
  date: string; // YYYY-MM-DD
  count: number;
  activities: ActivityItem[];
}

export type ActivityFilter = ActivityType | 'all' | 'key_events';

interface ActivityCalendarProps {
  data: ActivityDay[];
  className?: string;
  filter?: ActivityFilter;
  onFilterChange?: (filter: ActivityFilter) => void;
  showFilters?: boolean;
  /** Extend calendar to show future dates (e.g., for future OOO) */
  extendedEndDate?: Date;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DayStyleInfo {
  isOOO: boolean;
  hasProgress: boolean;
  hasProfile: boolean;
  hasTaskUpdate: boolean;
  hasTaskAssigned: boolean;
  hasTaskStarted: boolean;
  hasTaskCompleted: boolean;
  hasTaskRequest: boolean;
  hasExtension: boolean;
}

interface StyleComponents {
  solid: string | null;       // bg-* class for solid fill
  ring: string | null;        // ring-* classes for solid ring  
  dashed: string | null;      // border-* classes for dashed border
  scale: string | null;       // scale-* for size adjustment
}

function buildDayStyle(count: number, isSelected: boolean, styleInfo: DayStyleInfo): string {
  const selectionRing = isSelected ? 'ring-2 ring-foreground ring-offset-2 ' : '';
  
  if (count === 0) return selectionRing + 'bg-muted';
  
  const { isOOO, hasProgress, hasProfile, hasTaskUpdate, hasTaskAssigned, hasTaskStarted, hasTaskCompleted, hasTaskRequest, hasExtension } = styleInfo;
  
  const style: StyleComponents = {
    solid: null,
    ring: null,
    dashed: null,
    scale: null,
  };
  
  // Determine solid background (priority order)
  if (isOOO) {
    style.solid = 'bg-amber-400 dark:bg-amber-500';
  } else if (hasTaskCompleted) {
    style.solid = 'bg-emerald-500 dark:bg-emerald-500';
  } else if (hasTaskAssigned) {
    style.solid = 'bg-blue-600 dark:bg-blue-500';
  } else if (hasTaskUpdate && !hasProgress && !hasProfile && !hasExtension && !hasTaskStarted && !hasTaskRequest) {
    // Task update only = small blue dot
    style.solid = 'bg-blue-400 dark:bg-blue-500';
    style.scale = 'scale-75';
  }
  
  // Determine ring
  // Extension (red) takes priority, then Started/Request (green), then Progress (green)
  if (hasExtension && !isOOO) {
    style.ring = 'ring-2 ring-inset ring-red-400 dark:ring-red-500';
  } else if ((hasTaskStarted || hasTaskRequest) && !style.solid) {
    style.ring = 'ring-2 ring-inset ring-emerald-500 dark:ring-emerald-400';
  } else if (hasProgress && !isOOO && !style.solid) {
    style.ring = 'ring-2 ring-inset ring-emerald-400 dark:ring-emerald-500';
  }
  
  // Determine dashed border (can combine with others)
  if (hasProfile && !isOOO && !hasTaskCompleted && !hasTaskStarted && !hasTaskAssigned) {
    style.dashed = 'border-2 border-dashed border-purple-400 dark:border-purple-500';
  }
  
  // Build final class string
  const classes: string[] = [selectionRing];
  
  if (style.solid) {
    classes.push(style.solid);
  } else if (style.ring || style.dashed) {
    classes.push('bg-transparent');
  } else {
    // Fallback to intensity-based solid
    if (count === 1) classes.push('bg-emerald-200 dark:bg-emerald-900');
    else if (count <= 3) classes.push('bg-emerald-300 dark:bg-emerald-700');
    else if (count <= 5) classes.push('bg-emerald-400 dark:bg-emerald-600');
    else classes.push('bg-emerald-500 dark:bg-emerald-500');
  }
  
  if (style.ring) classes.push(style.ring);
  if (style.dashed) classes.push(style.dashed);
  if (style.scale) classes.push(style.scale);
  
  return classes.filter(Boolean).join(' ');
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getActivityIcon(type: ActivityType) {
  switch (type) {
    case 'task_update':
      return <ListTodo className="h-4 w-4 text-blue-500" />;
    case 'task_assigned':
      return <span className="h-4 w-4 text-blue-600 font-bold text-sm flex items-center justify-center">A</span>;
    case 'task_started':
      return <span className="h-4 w-4 text-emerald-600 font-bold text-sm flex items-center justify-center">S</span>;
    case 'task_completed':
      return <Check className="h-4 w-4 text-emerald-600" />;
    case 'progress':
      return <FileText className="h-4 w-4 text-emerald-500" />;
    case 'ooo':
      return <Plane className="h-4 w-4 text-amber-500" />;
    case 'task_request':
      return <CalendarDays className="h-4 w-4 text-purple-500" />;
    case 'profile_update':
      return <User className="h-4 w-4 text-gray-500" />;
    case 'extension_request':
      return <Clock className="h-4 w-4 text-red-500" />;
  }
}

function getActivityLabel(type: ActivityType, count: number): string {
  switch (type) {
    case 'task_update':
      return `${count} task update${count > 1 ? 's' : ''}`;
    case 'task_assigned':
      return `${count} task${count > 1 ? 's' : ''} assigned`;
    case 'task_started':
      return `${count} task${count > 1 ? 's' : ''} started`;
    case 'task_completed':
      return `${count} task${count > 1 ? 's' : ''} completed`;
    case 'progress':
      return `${count} progress update${count > 1 ? 's' : ''}`;
    case 'ooo':
      return 'Out of Office';
    case 'task_request':
      return `${count} task request${count > 1 ? 's' : ''}`;
    case 'profile_update':
      return `${count} profile update${count > 1 ? 's' : ''}`;
    case 'extension_request':
      return `${count} extension request${count > 1 ? 's' : ''}`;
  }
}

function getActivityDescription(type: ActivityType): string {
  switch (type) {
    case 'task_update':
      return 'Status changes, progress percentage updates, or deadline modifications';
    case 'task_assigned':
      return 'Task was assigned to this member';
    case 'task_started':
      return 'Started working on a task (moved to IN_PROGRESS)';
    case 'task_completed':
      return 'Finished working on a task';
    case 'progress':
      return 'Daily standup progress reports submitted';
    case 'ooo':
      return 'Member was out of office on this day';
    case 'task_request':
      return 'Requested to work on new tasks';
    case 'profile_update':
      return 'Updated profile information';
    case 'extension_request':
      return 'Requested deadline extension for a task';
  }
}

interface SelectedDay {
  date: string;
  count: number;
  activities: ActivityDay['activities'];
}

function ExpandableActivityRow({ activity }: { activity: ActivityItem }) {
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hasEntries = activity.entries && activity.entries.length > 0;
  
  const isOpen = pinned || expanded;
  
  const handleClick = () => {
    if (hasEntries) {
      setPinned(!pinned);
    }
  };
  
  return (
    <div className="rounded-lg bg-muted/50 overflow-hidden">
      <button
        onClick={handleClick}
        onMouseEnter={() => hasEntries && !pinned && setExpanded(true)}
        onMouseLeave={() => hasEntries && !pinned && setExpanded(false)}
        className={`w-full flex items-start gap-3 p-3 text-left ${hasEntries ? 'cursor-pointer hover:bg-muted/80' : ''}`}
      >
        <div className="mt-0.5">
          {getActivityIcon(activity.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {getActivityLabel(activity.type, activity.count)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {getActivityDescription(activity.type)}
          </p>
        </div>
        {hasEntries && (
          <div className="mt-0.5 text-muted-foreground">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        )}
      </button>
      
      {isOpen && hasEntries && (
        <div className="border-t border-border/50 bg-background/50">
          <div className="max-h-48 overflow-y-auto [scrollbar-gutter:stable]">
            {activity.entries!.map((entry) => (
              <div key={entry.id} className="px-3 py-2 border-b border-border/30 last:border-b-0">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.title}</p>
                    {entry.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{entry.subtitle}</p>
                    )}
                  </div>
                  {entry.url && (
                    <a 
                      href={entry.url}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityDetail({ selected, isPinned }: { selected: SelectedDay | null; isPinned: boolean }) {
  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <CalendarDays className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Hover or click on a day to see activity details
        </p>
      </div>
    );
  }

  if (selected.count === 0) {
    return (
      <div className="p-4">
        <h3 className="font-semibold mb-1">{formatDate(selected.date)}</h3>
        <p className="text-sm text-muted-foreground">No activity on this day</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold">{formatDate(selected.date)}</h3>
        {isPinned && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            pinned
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {selected.count} activit{selected.count > 1 ? 'ies' : 'y'}
      </p>
      <div className="space-y-3">
        {selected.activities.map((activity) => (
          <ExpandableActivityRow key={activity.type} activity={activity} />
        ))}
      </div>
    </div>
  );
}

const FILTER_OPTIONS: { value: ActivityFilter; label: string; icon: typeof ListTodo }[] = [
  { value: 'key_events', label: 'Key Events', icon: CalendarDays },
  { value: 'all', label: 'All', icon: CalendarDays },
  { value: 'task_update', label: 'Task Updates', icon: ListTodo },
  { value: 'task_request', label: 'Task Requests', icon: CalendarDays },
  { value: 'progress', label: 'Progress', icon: FileText },
  { value: 'extension_request', label: 'Extensions', icon: Clock },
  { value: 'ooo', label: 'OOO', icon: Plane },
];

// Key events filter shows: task assigned, task started, task completed, extensions, OOO
const KEY_EVENT_TYPES: ActivityType[] = ['task_assigned', 'task_started', 'task_completed', 'extension_request', 'ooo'];

const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface MobileCalendarProps {
  activityMap: Map<string, ActivityDay>;
  onDayClick: (dateStr: string) => void;
  selectedDate: string | null;
}

/** Mobile calendar - monthly grid with same dot cells as desktop */
function MobileCalendar({ activityMap, onDayClick, selectedDate }: MobileCalendarProps) {
  const [monthOffset, setMonthOffset] = useState(0);
  
  const { weeks, monthLabel, canGoNext } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Target month
    const targetDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    
    // Get first and last day of month
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    
    // Start from the Sunday of the week containing the first day
    const startDate = new Date(firstOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    // End on the Saturday of the week containing the last day
    const endDate = new Date(lastOfMonth);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    // Build weeks array (rows of 7 days each)
    const weeksArray: { date: Date; dateStr: string; inMonth: boolean; isFuture: boolean }[][] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const week: { date: Date; dateStr: string; inMonth: boolean; isFuture: boolean }[] = [];
      
      for (let i = 0; i < 7; i++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const inMonth = currentDate.getMonth() === month;
        const isFuture = currentDate > today;
        week.push({ date: new Date(currentDate), dateStr, inMonth, isFuture });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      weeksArray.push(week);
    }
    
    return {
      weeks: weeksArray,
      monthLabel: `${MONTH_NAMES_FULL[month]} ${year}`,
      canGoNext: monthOffset < 0,
    };
  }, [monthOffset]);
  
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  
  return (
    <div className="w-full">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setMonthOffset(monthOffset - 1)}
          className="p-2 hover:bg-muted rounded transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-medium">{monthLabel}</span>
        <button
          onClick={() => setMonthOffset(monthOffset + 1)}
          disabled={!canGoNext}
          className={`p-2 rounded transition-colors ${canGoNext ? 'hover:bg-muted' : 'opacity-30 cursor-not-allowed'}`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      
      {/* Day labels header */}
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {dayLabels.map((day, i) => (
          <div key={i} className="text-xs text-muted-foreground text-center">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid - same dot cells as desktop */}
      <div className="grid gap-1.5">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1.5 justify-items-center">
            {week.map((day) => {
              // Future or outside month - render empty placeholder
              if (day.isFuture || !day.inMonth) {
                return (
                  <div
                    key={day.dateStr}
                    className="w-5 h-5 rounded-full bg-muted/30"
                  />
                );
              }
              
              const activity = activityMap.get(day.dateStr);
              const count = activity?.count || 0;
              const isSelected = selectedDate === day.dateStr;
              const activities = activity?.activities || [];
              
              const styleInfo: DayStyleInfo = {
                isOOO: activities.some(a => a.type === 'ooo'),
                hasProgress: activities.some(a => a.type === 'progress'),
                hasProfile: activities.some(a => a.type === 'profile_update'),
                hasTaskUpdate: activities.some(a => a.type === 'task_update'),
                hasTaskAssigned: activities.some(a => a.type === 'task_assigned'),
                hasTaskStarted: activities.some(a => a.type === 'task_started'),
                hasTaskCompleted: activities.some(a => a.type === 'task_completed'),
                hasTaskRequest: activities.some(a => a.type === 'task_request'),
                hasExtension: activities.some(a => a.type === 'extension_request'),
              };
              
              // Same cell content as desktop
              let cellContent = null;
              if (styleInfo.hasTaskCompleted) {
                cellContent = <Check className="w-3 h-3 text-white" strokeWidth={3} />;
              } else if (styleInfo.hasTaskStarted) {
                cellContent = <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">S</span>;
              } else if (styleInfo.hasTaskAssigned) {
                cellContent = <span className="text-[10px] font-bold text-white">A</span>;
              } else if (styleInfo.hasTaskRequest) {
                cellContent = <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">R</span>;
              }
              
              // Replace rounded-sm with rounded-full for circles
              const baseStyle = buildDayStyle(count, isSelected, styleInfo).replace(/rounded-sm/g, 'rounded-full');
              
              return (
                <button
                  key={day.dateStr}
                  onClick={() => onDayClick(day.dateStr)}
                  className={`w-5 h-5 rounded-full transition-all hover:ring-1 hover:ring-foreground flex items-center justify-center ${baseStyle}`}
                  title={`${formatShortDate(day.dateStr)}: ${count} activities`}
                >
                  {cellContent}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Legend with circles - all items from desktop */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-4 text-xs text-muted-foreground justify-center">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">A</span>
          </div>
          <span>Assigned</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-transparent ring-2 ring-inset ring-emerald-500 dark:ring-emerald-400 flex items-center justify-center">
            <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400">S</span>
          </div>
          <span>Started</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </div>
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-transparent ring-2 ring-inset ring-emerald-500 dark:ring-emerald-400 flex items-center justify-center">
            <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400">R</span>
          </div>
          <span>Request</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-transparent ring-2 ring-inset ring-red-400 dark:ring-red-500" />
          <span>Extension</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-amber-400 dark:bg-amber-500" />
          <span>OOO</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-400 dark:bg-blue-500" />
          <span>Task Update</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-transparent ring-2 ring-inset ring-emerald-400 dark:ring-emerald-500" />
          <span>Progress</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-transparent border-2 border-dashed border-purple-400 dark:border-purple-500" />
          <span>Profile</span>
        </div>
      </div>
    </div>
  );
}

export function ActivityCalendar({ data, className = '', filter: externalFilter, onFilterChange, showFilters = false, extendedEndDate }: ActivityCalendarProps) {
  const isMobile = useIsMobile();
  const [hoveredDay, setHoveredDay] = useState<SelectedDay | null>(null);
  const [pinnedDay, setPinnedDay] = useState<SelectedDay | null>(null);
  const [yearOffset, setYearOffset] = useState(0); // 0 = current year, -1 = last year, etc.
  const [internalFilter, setInternalFilter] = useState<ActivityFilter>('key_events');
  const [hoveredFilter, setHoveredFilter] = useState<ActivityFilter | null>(null);
  
  const selectedFilter = externalFilter ?? internalFilter;
  const baseSetFilter = onFilterChange ?? setInternalFilter;
  
  // Effective filter: hovered filter for preview, or selected filter
  const filter = hoveredFilter ?? selectedFilter;
  
  // Wrap setFilter to clear selection when filter changes
  const setFilter = (newFilter: ActivityFilter) => {
    setPinnedDay(null);
    setHoveredDay(null);
    baseSetFilter(newFilter);
  };
  
  const activeDay = pinnedDay || hoveredDay;

  // Build a map of date -> activity for quick lookup, applying filter
  const activityMap = useMemo(() => {
    const map = new Map<string, ActivityDay>();
    for (const day of data) {
      if (filter === 'all') {
        map.set(day.date, day);
      } else if (filter === 'key_events') {
        // Key events: task assigned/completed (task_update), extensions, OOO
        const filteredActivities = day.activities.filter(a => KEY_EVENT_TYPES.includes(a.type));
        if (filteredActivities.length > 0) {
          const filteredCount = filteredActivities.reduce((sum, a) => sum + a.count, 0);
          map.set(day.date, {
            ...day,
            count: filteredCount,
            activities: filteredActivities,
          });
        }
      } else {
        // Filter activities to only show selected type
        const filteredActivities = day.activities.filter(a => a.type === filter);
        if (filteredActivities.length > 0) {
          const filteredCount = filteredActivities.reduce((sum, a) => sum + a.count, 0);
          map.set(day.date, {
            ...day,
            count: filteredCount,
            activities: filteredActivities,
          });
        }
      }
    }
    return map;
  }, [data, filter]);

  // Generate 365 days for the selected year (plus extended future dates if provided)
  const { weeks, monthLabels, yearLabel, canGoNext } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // End date is today minus yearOffset years, or extendedEndDate if in the future
    const endDate = new Date(today);
    endDate.setFullYear(endDate.getFullYear() + yearOffset);
    
    // Allow going into the future if extendedEndDate is provided and we're viewing current year
    if (yearOffset === 0 && extendedEndDate && extendedEndDate > endDate) {
      endDate.setTime(extendedEndDate.getTime());
    } else if (endDate > today && !extendedEndDate) {
      // Don't allow going into the future unless extended
      endDate.setTime(today.getTime());
    }
    
    // Start from the beginning of the week, 52 weeks before end date
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 364 - startDate.getDay());
    
    const weeksArray: { date: Date; dateStr: string; isFuture: boolean }[][] = [];
    const labels: { month: string; weekIndex: number }[] = [];
    
    let currentDate = new Date(startDate);
    let currentWeek: { date: Date; dateStr: string; isFuture: boolean }[] = [];
    let lastMonth = -1;
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeksArray.push(currentWeek);
        currentWeek = [];
      }
      
      // Track month labels
      const month = currentDate.getMonth();
      if (month !== lastMonth && dayOfWeek === 0) {
        labels.push({ month: MONTHS[month], weekIndex: weeksArray.length });
        lastMonth = month;
      }
      
      const dateStr = currentDate.toISOString().split('T')[0];
      const isFuture = currentDate > today;
      currentWeek.push({ date: new Date(currentDate), dateStr, isFuture });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    if (currentWeek.length > 0) {
      weeksArray.push(currentWeek);
    }
    
    // Generate year label (e.g., "2024" or "2023-2024" if spanning years)
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const label = startYear === endYear ? `${endYear}` : `${startYear}-${endYear}`;
    
    // Can go next if viewing past year, or if extended end date would be even further
    const canGoNextYear = yearOffset < 0;
    
    return { 
      weeks: weeksArray, 
      monthLabels: labels, 
      yearLabel: label,
      canGoNext: canGoNextYear 
    };
  }, [yearOffset, extendedEndDate]);

  const getDayData = (dateStr: string): SelectedDay => {
    const activity = activityMap.get(dateStr);
    return {
      date: dateStr,
      count: activity?.count || 0,
      activities: activity?.activities || [],
    };
  };

  // Flatten weeks into a grid for keyboard navigation
  const flatDays = useMemo(() => {
    const days: { dateStr: string; weekIndex: number; dayIndex: number }[] = [];
    weeks.forEach((week, weekIndex) => {
      week.forEach((day, dayIndex) => {
        days.push({ dateStr: day.dateStr, weekIndex, dayIndex });
      });
    });
    return days;
  }, [weeks]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const currentDate = pinnedDay?.date || hoveredDay?.date;
    if (!currentDate) return;
    
    // Find current position in grid
    const currentIndex = flatDays.findIndex(d => d.dateStr === currentDate);
    if (currentIndex === -1) return;
    
    const current = flatDays[currentIndex];
    let newIndex = -1;
    
    switch (e.key) {
      case 'ArrowLeft':
        // Move to previous day (previous week, same row)
        newIndex = currentIndex - 7;
        break;
      case 'ArrowRight':
        // Move to next day (next week, same row)
        newIndex = currentIndex + 7;
        break;
      case 'ArrowUp':
        // Move up one row (previous day in week)
        if (current.dayIndex > 0) {
          newIndex = currentIndex - 1;
        }
        break;
      case 'ArrowDown':
        // Move down one row (next day in week)
        if (current.dayIndex < 6) {
          newIndex = currentIndex + 1;
        }
        break;
      case 'Escape':
        setPinnedDay(null);
        setHoveredDay(null);
        return;
      default:
        return;
    }
    
    if (newIndex >= 0 && newIndex < flatDays.length) {
      e.preventDefault();
      const newDay = flatDays[newIndex];
      const dayData = getDayData(newDay.dateStr);
      setPinnedDay(dayData);
    }
  }, [pinnedDay, hoveredDay, flatDays, getDayData]);

  // Add keyboard listener when a day is selected
  useEffect(() => {
    if (pinnedDay || hoveredDay) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [pinnedDay, hoveredDay, handleKeyDown]);

  const handleDayClick = (dateStr: string) => {
    const dayData = getDayData(dateStr);
    // Toggle pin if clicking the same day
    if (pinnedDay?.date === dateStr) {
      setPinnedDay(null);
    } else {
      setPinnedDay(dayData);
    }
  };

  const handleDayHover = (dateStr: string) => {
    if (!pinnedDay) {
      setHoveredDay(getDayData(dateStr));
    }
  };

  const handleDayLeave = () => {
    if (!pinnedDay) {
      setHoveredDay(null);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filters */}
      {showFilters && (
        <div 
          className="flex flex-wrap gap-2"
          onMouseLeave={() => setHoveredFilter(null)}
        >
          {FILTER_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedFilter === option.value;
            const isPreview = hoveredFilter === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                onMouseEnter={() => setHoveredFilter(option.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-foreground text-background border-foreground'
                    : isPreview
                    ? 'bg-muted text-foreground border-foreground'
                    : 'bg-background text-muted-foreground border-border'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      
      {/* Mobile: Monthly Calendar View */}
      {isMobile ? (
        <div className="space-y-4">
          <MobileCalendar
            activityMap={activityMap}
            onDayClick={handleDayClick}
            selectedDate={activeDay?.date || null}
          />
          
          {/* Detail Panel for mobile */}
          {activeDay && (
            <div className="border rounded-lg bg-card">
              <ActivityDetail selected={activeDay} isPinned={!!pinnedDay} />
            </div>
          )}
        </div>
      ) : (
        /* Desktop: Horizontal Year View */
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Calendar */}
          <div className="flex-1 overflow-x-auto">
            <div className="inline-block min-w-fit">
              {/* Year navigation */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setYearOffset(yearOffset - 1)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous Year</span>
                </button>
                <span className="text-sm font-medium">{yearLabel}</span>
                <button
                  onClick={() => setYearOffset(yearOffset + 1)}
                  disabled={!canGoNext}
                  className={`flex items-center gap-1 text-sm transition-colors px-2 py-1 rounded ${
                    canGoNext 
                      ? 'text-muted-foreground hover:text-foreground hover:bg-muted' 
                      : 'text-muted-foreground/30 cursor-not-allowed'
                  }`}
                >
                  <span className="hidden sm:inline">Next Year</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              
              {/* Month labels */}
              <div className="flex text-xs text-muted-foreground mb-1 ml-8 relative h-4">
              {monthLabels.map((label, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{ left: `${label.weekIndex * 14 + 32}px` }}
                >
                  {label.month}
                </div>
              ))}
            </div>
            
            <div className="flex gap-0.5 mt-2 mb-2">
              {/* Day labels */}
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mr-1">
                {DAYS_OF_WEEK.map((day, i) => (
                  <div key={day} className="h-3 flex items-center" style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}>
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-0.5">
                  {week.map((day) => {
                    const activity = activityMap.get(day.dateStr);
                    const count = activity?.count || 0;
                    const isSelected = activeDay?.date === day.dateStr;
                    const activities = activity?.activities || [];
                    const isFuture = day.isFuture;
                    
                    const styleInfo: DayStyleInfo = {
                      isOOO: activities.some(a => a.type === 'ooo'),
                      hasProgress: activities.some(a => a.type === 'progress'),
                      hasProfile: activities.some(a => a.type === 'profile_update'),
                      hasTaskUpdate: activities.some(a => a.type === 'task_update'),
                      hasTaskAssigned: activities.some(a => a.type === 'task_assigned'),
                      hasTaskStarted: activities.some(a => a.type === 'task_started'),
                      hasTaskCompleted: activities.some(a => a.type === 'task_completed'),
                      hasTaskRequest: activities.some(a => a.type === 'task_request'),
                      hasExtension: activities.some(a => a.type === 'extension_request'),
                    };
                    
                    // Determine what symbol to show in the cell
                    let cellContent = null;
                    if (styleInfo.hasTaskCompleted) {
                      cellContent = <Check className="w-2.5 h-2.5 text-white dark:text-white" strokeWidth={3} />;
                    } else if (styleInfo.hasTaskStarted) {
                      cellContent = <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400">S</span>;
                    } else if (styleInfo.hasTaskAssigned) {
                      cellContent = <span className="text-[8px] font-bold text-white">A</span>;
                    } else if (styleInfo.hasTaskRequest) {
                      cellContent = <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400">R</span>;
                    }
                    
                    // Future dates without activity get a subtle dashed border
                    const futureEmptyStyle = isFuture && count === 0 ? 'border border-dashed border-muted-foreground/30' : '';
                    
                    return (
                      <button
                        key={day.dateStr}
                        onClick={() => handleDayClick(day.dateStr)}
                        onMouseEnter={() => handleDayHover(day.dateStr)}
                        onMouseLeave={handleDayLeave}
                        className={`w-3 h-3 rounded-sm transition-all hover:ring-1 hover:ring-foreground flex items-center justify-center ${buildDayStyle(count, isSelected, styleInfo)} ${futureEmptyStyle}`}
                        title={`${formatShortDate(day.dateStr)}${isFuture ? ' (upcoming)' : ''}: ${count} activities`}
                      >
                        {cellContent}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground justify-end flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">A</span>
                </div>
                <span>Assigned</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-transparent ring-2 ring-inset ring-emerald-500 dark:ring-emerald-400 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400">S</span>
                </div>
                <span>Started</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-emerald-500 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                </div>
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-transparent ring-2 ring-inset ring-emerald-500 dark:ring-emerald-400 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400">R</span>
                </div>
                <span>Request</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-transparent ring-2 ring-inset ring-red-400 dark:ring-red-500" />
                <span>Extension</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-amber-400 dark:bg-amber-500" />
                <span>OOO</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-blue-400 dark:bg-blue-500" />
                <span>Task Update</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-transparent ring-2 ring-inset ring-emerald-400 dark:ring-emerald-500" />
                <span>Progress</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-transparent border-2 border-dashed border-purple-400 dark:border-purple-500" />
                <span>Profile</span>
              </div>
            </div>
          </div>
        </div>

          {/* Detail Panel */}
          <div className="lg:w-72 shrink-0 border rounded-lg bg-card min-h-[200px] max-h-[400px] overflow-y-auto [scrollbar-gutter:stable]">
            <ActivityDetail selected={activeDay} isPinned={!!pinnedDay} />
          </div>
        </div>
      )}
    </div>
  );
}
