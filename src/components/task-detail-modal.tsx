'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ExternalLink, Github, Calendar, TrendingUp, Timer,
  CheckCircle2, XCircle, AlertCircle, Loader2, ChevronDown, ChevronRight, History
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getStatusBadgeStyle, formatDueDate, getTaskTypeInfo, getPriorityInfo, isTaskUrgent } from '@/lib/utils';
import type { TaskWithAssignee } from '@/lib/tasks-cache';

// =============================================================================
// Types
// =============================================================================

interface UserInfo {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  picture?: { url: string };
}

interface ExtensionRequest {
  id: string;
  taskId: string;
  title?: string;
  assignee: string;
  assigneeUser?: UserInfo;
  oldEndsOn: number;
  newEndsOn: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  timestamp?: { _seconds: number };
  createdAt?: number;
}

interface ExtensionsData {
  currentAssigneeExtensions: ExtensionRequest[];
  pastAssigneeExtensions: ExtensionRequest[];
  totalCount: number;
}

interface TaskDetailModalProps {
  task: TaskWithAssignee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// Animation variants
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

const collapseVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { 
    opacity: 1, 
    height: 'auto',
    transition: { duration: 0.2 }
  }
};

// =============================================================================
// Helper functions
// =============================================================================

function formatEpoch(epoch?: number): string {
  if (!epoch) return '-';
  const ms = epoch > 1e12 ? epoch : epoch * 1000;
  return format(new Date(ms), 'MMM d, yyyy');
}

function getExtensionStatusStyle(status: ExtensionRequest['status']) {
  switch (status) {
    case 'APPROVED':
      return {
        label: 'Approved',
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        icon: CheckCircle2,
      };
    case 'DENIED':
      return {
        label: 'Denied',
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        icon: XCircle,
      };
    case 'PENDING':
    default:
      return {
        label: 'Pending',
        className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        icon: AlertCircle,
      };
  }
}

// =============================================================================
// Extension Card Component
// =============================================================================

function ExtensionCard({ ext, showUser = false }: { ext: ExtensionRequest; showUser?: boolean }) {
  const statusStyle = getExtensionStatusStyle(ext.status);
  const StatusIcon = statusStyle.icon;
  
  return (
    <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
      {/* User info (for past extensions) */}
      {showUser && ext.assigneeUser && (
        <div className="flex items-center gap-2 pb-1">
          <Avatar className="h-5 w-5">
            <AvatarImage src={ext.assigneeUser.picture?.url} alt={ext.assigneeUser.username} />
            <AvatarFallback className="text-[10px]">
              {ext.assigneeUser.first_name?.[0]}{ext.assigneeUser.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium">
            {ext.assigneeUser.first_name} {ext.assigneeUser.last_name}
          </span>
        </div>
      )}
      
      {/* Status and dates */}
      <div className="flex items-center justify-between gap-2">
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          statusStyle.className
        )}>
          <StatusIcon className="h-3 w-3" />
          {statusStyle.label}
        </span>
        <div className="text-xs text-muted-foreground">
          {formatEpoch(ext.oldEndsOn)} → {formatEpoch(ext.newEndsOn)}
        </div>
      </div>
      
      {/* Reason */}
      {ext.reason && (
        <p className="text-sm text-muted-foreground">
          {ext.reason}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function TaskDetailModal({ task, open, onOpenChange }: TaskDetailModalProps) {
  const [extensionsData, setExtensionsData] = useState<ExtensionsData | null>(null);
  const [isLoadingExtensions, setIsLoadingExtensions] = useState(false);
  const [showPastExtensions, setShowPastExtensions] = useState(false);

  // Fetch extensions for the task from our Firestore-backed API
  const fetchExtensions = useCallback(async (taskId: string, assignee?: string) => {
    setIsLoadingExtensions(true);
    try {
      const url = assignee 
        ? `/api/tasks/${taskId}/extensions?assignee=${assignee}`
        : `/api/tasks/${taskId}/extensions`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setExtensionsData({
          currentAssigneeExtensions: data.currentAssigneeExtensions || [],
          pastAssigneeExtensions: data.pastAssigneeExtensions || [],
          totalCount: data.totalCount || 0,
        });
      } else {
        console.log('Extension requests fetch returned:', response.status);
        setExtensionsData(null);
      }
    } catch (error) {
      console.error('Failed to fetch extensions:', error);
      setExtensionsData(null);
    } finally {
      setIsLoadingExtensions(false);
    }
  }, []);

  // Fetch extensions when task changes
  useEffect(() => {
    if (task?.id && open) {
      fetchExtensions(task.id, task.assignee);
      setShowPastExtensions(false); // Reset collapse state
    } else {
      setExtensionsData(null);
    }
  }, [task?.id, task?.assignee, open, fetchExtensions]);

  if (!task) return null;

  const statusInfo = getStatusBadgeStyle(task.status);
  const typeInfo = getTaskTypeInfo(task.type);
  const priorityInfo = getPriorityInfo(task.priority);
  const isDone = task.status?.toUpperCase() === 'COMPLETED' || task.status?.toUpperCase() === 'DONE';
  const dueDate = task.endsOn ? formatDueDate(task.endsOn, isDone) : null;
  const isUrgent = isTaskUrgent(task.status, task.endsOn);

  const currentExtensions = extensionsData?.currentAssigneeExtensions || [];
  const pastExtensions = extensionsData?.pastAssigneeExtensions || [];
  const hasPastExtensions = pastExtensions.length > 0;
  const hasCurrentExtensions = currentExtensions.length > 0;
  const hasNoExtensions = !isLoadingExtensions && !hasCurrentExtensions && !hasPastExtensions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {open && (
            <motion.div
              key={task.id}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <DialogHeader className="space-y-3">
                {/* Status and Type badges */}
                <motion.div 
                  variants={itemVariants}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className={statusInfo.className}>
                    {statusInfo.label}
                  </span>
                  {task.type && (
                    <Badge variant="outline" className={`border-current ${typeInfo.textClass}`}>
                      {typeInfo.label}
                    </Badge>
                  )}
                  {task.priority && (
                    <Badge variant="outline" className={`border-current ${priorityInfo.textClass}`}>
                      {priorityInfo.label}
                    </Badge>
                  )}
                </motion.div>

                {/* Title */}
                <DialogTitle asChild>
                  <motion.h2 
                    variants={itemVariants}
                    className={cn(
                      "text-xl font-semibold leading-tight",
                      isDone && "text-muted-foreground"
                    )}
                  >
                    {task.title}
                  </motion.h2>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Quick info */}
                <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {/* Assignee */}
                  {task.assigneeUser && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={task.assigneeUser.picture?.url} alt={task.assigneeUser.username} />
                        <AvatarFallback className="text-xs">
                          {task.assigneeUser.first_name?.[0]}{task.assigneeUser.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        {task.assigneeUser.first_name} {task.assigneeUser.last_name}
                      </span>
                    </div>
                  )}
                  
                  {/* Due date */}
                  {dueDate && (
                    <div className={cn(
                      'flex items-center gap-1.5',
                      dueDate.isOverdue && !isDone && 'text-red-600 font-medium',
                      !dueDate.isOverdue && isUrgent && 'text-orange-600 font-medium'
                    )}>
                      <Calendar className="h-4 w-4" />
                      <span>{dueDate.text}</span>
                    </div>
                  )}

                  {/* Progress */}
                  {task.percentCompleted !== undefined && task.percentCompleted > 0 && (
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4" />
                      <span>{task.percentCompleted}% complete</span>
                    </div>
                  )}
                </motion.div>

                {/* Progress bar for in-progress tasks */}
                {task.status?.toUpperCase() === 'IN_PROGRESS' && task.percentCompleted !== undefined && (
                  <motion.div variants={itemVariants} className="space-y-1">
                    <div className={cn(
                      "flex justify-between text-xs",
                      isUrgent ? "text-red-600" : "text-muted-foreground"
                    )}>
                      <span>Progress</span>
                      <span>{task.percentCompleted}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          isUrgent ? "bg-red-500" : "bg-primary"
                        )}
                        style={{ width: `${task.percentCompleted}%` }}
                      />
                    </div>
                  </motion.div>
                )}

                {/* External links */}
                <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://status.realdevsquad.com/tasks/${task.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View on RDS Status
                    </a>
                  </Button>
                  {task.github?.issue?.html_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={task.github.issue.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Github className="h-4 w-4 mr-2" />
                        View on GitHub
                      </a>
                    </Button>
                  )}
                </motion.div>

                <Separator />

                {/* Extension Requests Section */}
                <motion.div variants={itemVariants} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Extension Requests</h3>
                    {isLoadingExtensions && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* No extensions message */}
                  {hasNoExtensions && (
                    <p className="text-sm text-muted-foreground py-2">
                      No extension requests for this task.
                    </p>
                  )}

                  {/* Current assignee extensions */}
                  {hasCurrentExtensions && (
                    <div className="space-y-2">
                      {currentExtensions.map((ext) => (
                        <ExtensionCard key={ext.id} ext={ext} showUser={false} />
                      ))}
                    </div>
                  )}

                  {/* Past extensions from other users */}
                  {hasPastExtensions && (
                    <div className="space-y-2">
                      {/* Collapsible header */}
                      <button
                        onClick={() => setShowPastExtensions(!showPastExtensions)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-1"
                      >
                        {showPastExtensions ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <History className="h-3.5 w-3.5" />
                        <span>
                          Past extensions from other assignees ({pastExtensions.length})
                        </span>
                      </button>

                      {/* Collapsible content */}
                      <AnimatePresence>
                        {showPastExtensions && (
                          <motion.div
                            variants={collapseVariants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            className="space-y-2 overflow-hidden"
                          >
                            {pastExtensions.map((ext) => (
                              <ExtensionCard key={ext.id} ext={ext} showUser={true} />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
