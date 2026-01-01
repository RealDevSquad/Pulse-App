import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// Status Formatting
// ============================================================================

export type StatusType = 'done' | 'active' | 'review' | 'blocked' | 'backlog' | 'unknown';

export interface StatusInfo {
  label: string;
  type: StatusType;
  textClass: string;
  badgeClass: string;
  hoverClass: string;
}

const STATUS_MAP: Record<string, StatusInfo> = {
  // Done statuses (green)
  COMPLETED: { label: 'Done[C]', type: 'done', textClass: 'text-green-600', badgeClass: 'border-green-500 text-green-600', hoverClass: 'hover:bg-green-500 hover:text-white' },
  DONE: { label: 'Done', type: 'done', textClass: 'text-green-600', badgeClass: 'border-green-500 text-green-600', hoverClass: 'hover:bg-green-500 hover:text-white' },
  MERGED: { label: 'Merged', type: 'done', textClass: 'text-green-600', badgeClass: 'border-green-500 text-green-600', hoverClass: 'hover:bg-green-500 hover:text-white' },
  
  // Active statuses
  IN_PROGRESS: { label: 'In Progress', type: 'active', textClass: 'text-blue-600', badgeClass: 'border-blue-500 text-blue-600', hoverClass: 'hover:bg-blue-500 hover:text-white' },
  ASSIGNED: { label: 'Assigned', type: 'active', textClass: 'text-purple-600', badgeClass: 'border-purple-500 text-purple-600', hoverClass: 'hover:bg-purple-500 hover:text-white' },
  VERIFIED: { label: 'Verified', type: 'active', textClass: 'text-blue-600', badgeClass: 'border-blue-500 text-blue-600', hoverClass: 'hover:bg-blue-500 hover:text-white' },
  
  // Review statuses (yellow)
  NEEDS_REVIEW: { label: 'Needs Review', type: 'review', textClass: 'text-yellow-600', badgeClass: 'border-yellow-500 text-yellow-600', hoverClass: 'hover:bg-yellow-500 hover:text-white' },
  IN_REVIEW: { label: 'In Review', type: 'review', textClass: 'text-yellow-600', badgeClass: 'border-yellow-500 text-yellow-600', hoverClass: 'hover:bg-yellow-500 hover:text-white' },
  SANITY_CHECK: { label: 'Sanity Check', type: 'review', textClass: 'text-yellow-600', badgeClass: 'border-yellow-500 text-yellow-600', hoverClass: 'hover:bg-yellow-500 hover:text-white' },
  
  // Blocked status (red)
  BLOCKED: { label: 'Blocked', type: 'blocked', textClass: 'text-red-600', badgeClass: 'border-red-500 text-red-600', hoverClass: 'hover:bg-red-500 hover:text-white' },
  
  // Backlog statuses (gray)
  BACKLOG: { label: 'Backlog', type: 'backlog', textClass: 'text-gray-500', badgeClass: 'border-gray-400 text-gray-500', hoverClass: 'hover:bg-gray-400 hover:text-white' },
  TODO: { label: 'Todo', type: 'backlog', textClass: 'text-gray-500', badgeClass: 'border-gray-400 text-gray-500', hoverClass: 'hover:bg-gray-400 hover:text-white' },
};

const UNKNOWN_STATUS: StatusInfo = {
  label: 'Unknown',
  type: 'unknown',
  textClass: 'text-gray-500',
  badgeClass: 'border-gray-400 text-gray-500',
  hoverClass: 'hover:bg-gray-400 hover:text-white',
};

/**
 * Get status information for display
 */
export function getStatusInfo(status?: string): StatusInfo {
  if (!status) return UNKNOWN_STATUS;
  const info = STATUS_MAP[status.toUpperCase()];
  if (!info) {
    return { ...UNKNOWN_STATUS, label: status };
  }
  return info;
}

/**
 * Get simple status style (text color only) - for mobile cards
 */
export function getStatusStyle(status?: string): { label: string; className: string } {
  const info = getStatusInfo(status);
  return { label: info.label, className: info.textClass };
}

/**
 * Get badge status style (border + hover) - for tables
 */
export function getStatusBadgeStyle(status?: string): { label: string; className: string } {
  const info = getStatusInfo(status);
  const baseClass = 'inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium transition-colors';
  return {
    label: info.label,
    className: `${baseClass} ${info.badgeClass} ${info.hoverClass}`,
  };
}

// ============================================================================
// Priority Formatting
// ============================================================================

export type PriorityLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface PriorityInfo {
  label: string;
  level: PriorityLevel;
  textClass: string;
  fillClass: string;
  bars: number; // 1-3 bars to fill
}

const PRIORITY_MAP: Record<string, PriorityInfo> = {
  HIGH: { label: 'High', level: 'high', textClass: 'text-red-600', fillClass: 'bg-red-500', bars: 3 },
  MEDIUM: { label: 'Medium', level: 'medium', textClass: 'text-yellow-600', fillClass: 'bg-yellow-500', bars: 2 },
  LOW: { label: 'Low', level: 'low', textClass: 'text-green-600', fillClass: 'bg-green-500', bars: 1 },
};

const UNKNOWN_PRIORITY: PriorityInfo = { 
  label: '-', 
  level: 'unknown', 
  textClass: 'text-muted-foreground',
  fillClass: 'bg-gray-400',
  bars: 0,
};

/** List of all known priorities */
export const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;

/**
 * Get priority information
 */
export function getPriorityInfo(priority?: string): PriorityInfo {
  if (!priority) return UNKNOWN_PRIORITY;
  const info = PRIORITY_MAP[priority.toUpperCase()];
  if (!info) {
    return { ...UNKNOWN_PRIORITY, label: priority };
  }
  return info;
}

export function getPriorityStyle(priority?: string): { label: string; className: string } {
  const info = getPriorityInfo(priority);
  return { label: info.label, className: info.textClass };
}

// ============================================================================
// Task Type Formatting
// ============================================================================

export type TaskType = 'feature' | 'bug' | 'enhancement' | 'documentation' | 'refactor' | 'unknown';

export interface TaskTypeInfo {
  label: string;
  type: TaskType;
  textClass: string;
  /** Lucide icon name */
  icon: 'sparkles' | 'bug' | 'zap' | 'file-text' | 'wrench' | 'help-circle';
}

const TASK_TYPE_MAP: Record<string, TaskTypeInfo> = {
  feature: { label: 'Feature', type: 'feature', textClass: 'text-purple-600', icon: 'sparkles' },
  bug: { label: 'Bug', type: 'bug', textClass: 'text-red-600', icon: 'bug' },
  enhancement: { label: 'Enhancement', type: 'enhancement', textClass: 'text-blue-600', icon: 'zap' },
  documentation: { label: 'Docs', type: 'documentation', textClass: 'text-teal-600', icon: 'file-text' },
  refactor: { label: 'Refactor', type: 'refactor', textClass: 'text-orange-600', icon: 'wrench' },
};

const UNKNOWN_TASK_TYPE: TaskTypeInfo = { 
  label: '-', 
  type: 'unknown', 
  textClass: 'text-muted-foreground',
  icon: 'help-circle',
};

/** List of all known task types */
export const TASK_TYPES = Object.keys(TASK_TYPE_MAP) as TaskType[];

/**
 * Get task type information
 */
export function getTaskTypeInfo(type?: string): TaskTypeInfo {
  if (!type) return UNKNOWN_TASK_TYPE;
  const info = TASK_TYPE_MAP[type.toLowerCase()];
  if (!info) {
    return { ...UNKNOWN_TASK_TYPE, label: type };
  }
  return info;
}

/**
 * Get task type style for display
 */
export function getTypeStyle(type?: string): { label: string; className: string } {
  const info = getTaskTypeInfo(type);
  return { label: info.label, className: info.textClass };
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Get the latest activity timestamp for a task.
 * Returns the most recent of: latestActivityAt (includes progress updates), updatedAt, or updated_at
 * All converted to milliseconds.
 * 
 * Note: `latestActivityAt` is populated by tasks-cache and includes the latest progress update timestamp.
 */
export function getTaskLatestActivity(task: {
  latestActivityAt?: number;
  updatedAt?: number;
  updated_at?: number;
}): number | undefined {
  // latestActivityAt is already the max of (updatedAt, updated_at, latest progress)
  // computed in tasks-cache, so use it directly if available
  if (task.latestActivityAt) {
    return task.latestActivityAt;
  }
  
  // Fallback for tasks not from cache
  const candidates: number[] = [];
  
  // updatedAt is in seconds
  if (task.updatedAt) {
    candidates.push(task.updatedAt * 1000);
  }
  
  // updated_at is in ms
  if (task.updated_at) {
    candidates.push(task.updated_at);
  }
  
  if (candidates.length === 0) return undefined;
  
  return Math.max(...candidates);
}

/**
 * Format a timestamp as relative time (e.g., "2d ago", "Yesterday")
 */
export function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return '-';

  // Handle both seconds and milliseconds
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const now = Date.now();
  const diff = now - ms;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return 'In future';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Format a due date with overdue detection
 */
export function formatDueDate(timestamp: number | undefined, isDone: boolean = false): { text: string; isOverdue: boolean } {
  if (!timestamp) return { text: '-', isOverdue: false };

  // Handle both seconds and milliseconds
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const now = Date.now();
  const diff = ms - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  const isOverdue = days < 0 && !isDone;
  let text: string;

  if (days < -365) text = isDone ? `${Math.floor(-days / 365)}y ago` : `${Math.floor(-days / 365)}y overdue`;
  else if (days < -30) text = isDone ? `${Math.floor(-days / 30)}mo ago` : `${Math.floor(-days / 30)}mo overdue`;
  else if (days < -7) text = isDone ? `${Math.floor(-days / 7)}w ago` : `${Math.floor(-days / 7)}w overdue`;
  else if (days < -1) text = isDone ? `${-days}d ago` : `${-days}d overdue`;
  else if (days === -1) text = 'Yesterday';
  else if (days === 0) text = 'Today';
  else if (days === 1) text = 'Tomorrow';
  else if (days < 7) text = `In ${days}d`;
  else if (days < 30) text = `In ${Math.floor(days / 7)}w`;
  else if (days < 365) text = `In ${Math.floor(days / 30)}mo`;
  else text = `In ${Math.floor(days / 365)}y`;

  return { text, isOverdue };
}

/**
 * Check if a task is urgent (in progress/review with <= 2 days left)
 * Used to show warning styling on progress bars and due dates
 */
export function isTaskUrgent(status?: string, endsOn?: number): boolean {
  if (!status || !endsOn) return false;
  
  const upperStatus = status.toUpperCase();
  const isActiveStatus = upperStatus === 'IN_PROGRESS' || 
                         upperStatus === 'NEEDS_REVIEW' || 
                         upperStatus === 'IN_REVIEW';
  
  if (!isActiveStatus) return false;
  
  // Handle both seconds and milliseconds
  const ms = endsOn > 1e12 ? endsOn : endsOn * 1000;
  const now = Date.now();
  const diff = ms - now;
  const days = diff / (1000 * 60 * 60 * 24);
  
  // Urgent if <= 2 days left (including already overdue)
  return days <= 2;
}

/**
 * Check if a task's last update is stale (>= 2 days ago and task not done)
 * Used to show warning styling on the "Updated" column
 */
export function isTaskUpdateStale(status?: string, lastUpdated?: number): boolean {
  if (!lastUpdated) return false;
  
  // Don't show stale warning for completed tasks
  const upperStatus = status?.toUpperCase();
  const isDone = upperStatus === 'COMPLETED' || upperStatus === 'DONE';
  if (isDone) return false;
  
  // Handle both seconds and milliseconds
  const ms = lastUpdated > 1e12 ? lastUpdated : lastUpdated * 1000;
  const now = Date.now();
  const daysSinceUpdate = (now - ms) / (1000 * 60 * 60 * 24);
  
  // Stale if >= 2 days since last update
  return daysSinceUpdate >= 2;
}
