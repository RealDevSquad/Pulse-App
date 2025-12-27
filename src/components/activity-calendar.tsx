'use client';

import { useMemo, useState } from 'react';
import { ListTodo, FileText, Plane, User, CalendarDays, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

export type ActivityType = 'task_update' | 'progress' | 'ooo' | 'task_request' | 'profile_update';

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

export type ActivityFilter = ActivityType | 'all';

interface ActivityCalendarProps {
  data: ActivityDay[];
  className?: string;
  filter?: ActivityFilter;
  onFilterChange?: (filter: ActivityFilter) => void;
  showFilters?: boolean;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getIntensityClass(count: number, isSelected: boolean, isOOO: boolean): string {
  const base = isSelected ? 'ring-2 ring-foreground ring-offset-2 ' : '';
  
  // OOO days are yellow
  if (isOOO) {
    return base + 'bg-amber-400 dark:bg-amber-500';
  }
  
  if (count === 0) return base + 'bg-muted';
  if (count === 1) return base + 'bg-emerald-200 dark:bg-emerald-900';
  if (count <= 3) return base + 'bg-emerald-300 dark:bg-emerald-700';
  if (count <= 5) return base + 'bg-emerald-400 dark:bg-emerald-600';
  return base + 'bg-emerald-500 dark:bg-emerald-500';
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
    case 'progress':
      return <FileText className="h-4 w-4 text-emerald-500" />;
    case 'ooo':
      return <Plane className="h-4 w-4 text-amber-500" />;
    case 'task_request':
      return <CalendarDays className="h-4 w-4 text-purple-500" />;
    case 'profile_update':
      return <User className="h-4 w-4 text-gray-500" />;
  }
}

function getActivityLabel(type: ActivityType, count: number): string {
  switch (type) {
    case 'task_update':
      return `${count} task update${count > 1 ? 's' : ''}`;
    case 'progress':
      return `${count} progress update${count > 1 ? 's' : ''}`;
    case 'ooo':
      return 'Out of Office';
    case 'task_request':
      return `${count} task request${count > 1 ? 's' : ''}`;
    case 'profile_update':
      return `${count} profile update${count > 1 ? 's' : ''}`;
  }
}

function getActivityDescription(type: ActivityType): string {
  switch (type) {
    case 'task_update':
      return 'Status changes, progress percentage updates, or deadline modifications';
    case 'progress':
      return 'Daily standup progress reports submitted';
    case 'ooo':
      return 'Member was out of office on this day';
    case 'task_request':
      return 'Requested to work on new tasks';
    case 'profile_update':
      return 'Updated profile information';
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
          <div className="max-h-48 overflow-y-auto">
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
  { value: 'all', label: 'All', icon: CalendarDays },
  { value: 'task_update', label: 'Task Updates', icon: ListTodo },
  { value: 'task_request', label: 'Task Requests', icon: CalendarDays },
  { value: 'progress', label: 'Progress', icon: FileText },
  { value: 'ooo', label: 'OOO', icon: Plane },
];

export function ActivityCalendar({ data, className = '', filter: externalFilter, onFilterChange, showFilters = false }: ActivityCalendarProps) {
  const [hoveredDay, setHoveredDay] = useState<SelectedDay | null>(null);
  const [pinnedDay, setPinnedDay] = useState<SelectedDay | null>(null);
  const [yearOffset, setYearOffset] = useState(0); // 0 = current year, -1 = last year, etc.
  const [internalFilter, setInternalFilter] = useState<ActivityFilter>('all');
  
  const filter = externalFilter ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;
  
  const activeDay = pinnedDay || hoveredDay;

  // Build a map of date -> activity for quick lookup, applying filter
  const activityMap = useMemo(() => {
    const map = new Map<string, ActivityDay>();
    for (const day of data) {
      if (filter === 'all') {
        map.set(day.date, day);
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

  // Generate 365 days for the selected year
  const { weeks, monthLabels, yearLabel, canGoNext } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // End date is today minus yearOffset years
    const endDate = new Date(today);
    endDate.setFullYear(endDate.getFullYear() + yearOffset);
    
    // Don't allow going into the future
    if (endDate > today) {
      endDate.setTime(today.getTime());
    }
    
    // Start from the beginning of the week, 52 weeks before end date
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 364 - startDate.getDay());
    
    const weeksArray: { date: Date; dateStr: string }[][] = [];
    const labels: { month: string; weekIndex: number }[] = [];
    
    let currentDate = new Date(startDate);
    let currentWeek: { date: Date; dateStr: string }[] = [];
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
      currentWeek.push({ date: new Date(currentDate), dateStr });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    if (currentWeek.length > 0) {
      weeksArray.push(currentWeek);
    }
    
    // Generate year label (e.g., "2024" or "2023-2024" if spanning years)
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const label = startYear === endYear ? `${endYear}` : `${startYear}-${endYear}`;
    
    return { 
      weeks: weeksArray, 
      monthLabels: labels, 
      yearLabel: label,
      canGoNext: yearOffset < 0 
    };
  }, [yearOffset]);

  const getDayData = (dateStr: string): SelectedDay => {
    const activity = activityMap.get(dateStr);
    return {
      date: dateStr,
      count: activity?.count || 0,
      activities: activity?.activities || [],
    };
  };

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
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = filter === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  isActive
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendar */}
        <div className="flex-1 overflow-x-auto">
          <div className="inline-block min-w-fit">
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
          
          <div className="flex gap-0.5 mt-2">
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
                  const isOOO = activity?.activities?.some(a => a.type === 'ooo') || false;
                  
                  return (
                    <button
                      key={day.dateStr}
                      onClick={() => handleDayClick(day.dateStr)}
                      onMouseEnter={() => handleDayHover(day.dateStr)}
                      onMouseLeave={handleDayLeave}
                      className={`w-3 h-3 rounded-sm transition-all hover:ring-1 hover:ring-foreground ${getIntensityClass(count, isSelected, isOOO)}`}
                      title={`${formatShortDate(day.dateStr)}: ${count} activities${isOOO ? ' (OOO)' : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground justify-end flex-wrap">
            <div className="flex items-center gap-1">
              <span>Less</span>
              <div className="flex gap-0.5">
                <div className="w-3 h-3 rounded-sm bg-muted" />
                <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
                <div className="w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-700" />
                <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-600" />
                <div className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-500" />
              </div>
              <span>More</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-amber-400 dark:bg-amber-500" />
              <span>OOO</span>
            </div>
          </div>
        </div>
      </div>

        {/* Detail Panel */}
        <div className="lg:w-72 shrink-0 border rounded-lg bg-card min-h-[200px]">
          <ActivityDetail selected={activeDay} isPinned={!!pinnedDay} />
        </div>
      </div>
    </div>
  );
}
