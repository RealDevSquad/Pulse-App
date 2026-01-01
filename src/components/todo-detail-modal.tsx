'use client';

import { useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon, User, Layers, Clock, AlertCircle, Eye, FileText, Tag, Flag,
  Pencil, X, Check, Loader2, ChevronDown, PauseCircle, PlayCircle
} from 'lucide-react';
import { GoogleIcon } from '@/components/ui/google-icon';
import { AISummaryCard } from '@/components/ai/ai-summary-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getTodoStatusStyle, getPriorityInfo, formatTodoDueDate } from '@/lib/todos';
import type { TodoAPI } from '@/types';

// =============================================================================
// Types
// =============================================================================

interface EditableFields {
  title: string;
  description: string;
  status: TodoAPI.Status | null;
  priority: TodoAPI.PriorityNumber | null;
  dueAt: string | null;
}

// =============================================================================
// Animation Variants
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 500,
      damping: 30,
    },
  },
};

const badgeVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 500,
      damping: 25,
    },
  },
};

const labelVariants = {
  hidden: { opacity: 0, scale: 0.8, x: -5 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    x: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 20,
      delay: i * 0.05,
    },
  }),
};

const sectionVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

const separatorVariants = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: {
    scaleX: 1,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut' as const,
    },
  },
};

const gridItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 25,
      delay: i * 0.08,
    },
  }),
};

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

function saturateColor(hex: string, factor: number = 0.3): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  s = Math.min(1, s * (1 + factor));
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getLabelStyle(color: string): { backgroundColor: string; color: string } {
  return {
    backgroundColor: hexToRgba(saturateColor(color, 0.8), 0.2),
    color: darkenColor(color, 0.4),
  };
}

/**
 * Renders text with URLs converted to clickable links
 */
function renderTextWithLinks(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  if (parts.length === 1) {
    return text;
  }
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// =============================================================================
// Detail Item Component
// =============================================================================

interface DetailItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  index: number;
  isChanged?: boolean;
}

function DetailItem({ icon, label, value, valueClassName, index, isChanged }: DetailItemProps) {
  return (
    <motion.div 
      custom={index}
      variants={gridItemVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "space-y-1.5 p-2 -m-2 rounded-md transition-colors",
        isChanged && "bg-yellow-100 dark:bg-yellow-900/30"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground/70">
        {icon}
        <span>{label}</span>
      </div>
      <p className={cn('text-sm font-medium text-foreground', valueClassName)}>
        {value}
      </p>
    </motion.div>
  );
}

// =============================================================================
// Status and Priority Options
// =============================================================================

const STATUS_OPTIONS: { value: TodoAPI.Status; label: string }[] = [
  { value: 'TODO', label: 'Todo' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DONE', label: 'Done' },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: 'High' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'Low' },
  { value: 'none', label: 'None' },
];

// =============================================================================
// Component
// =============================================================================

type TeamsMap = Record<string, string>;

interface TodoDetailModalProps {
  todo: TodoAPI.Todo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamsMap?: TeamsMap;
  onSave?: (todoId: string, updates: Partial<EditableFields>) => Promise<void>;
  onDefer?: (todoId: string, deferredTill: string) => Promise<void>;
  onUndefer?: (todoId: string) => Promise<void>;
}

export function TodoDetailModal({ todo, open, onOpenChange, teamsMap, onSave, onDefer, onUndefer }: TodoDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isQuickStatusSaving, setIsQuickStatusSaving] = useState(false);
  const [isDeferring, setIsDeferring] = useState(false);
  const [isDeferPopoverOpen, setIsDeferPopoverOpen] = useState(false);
  const [isFloatingDeferOpen, setIsFloatingDeferOpen] = useState(false);
  const [editedFields, setEditedFields] = useState<EditableFields>({
    title: '',
    description: '',
    status: null,
    priority: null,
    dueAt: null,
  });

  // Initialize edit fields when entering edit mode
  const startEditing = useCallback(() => {
    if (!todo) return;
    setEditedFields({
      title: todo.title,
      description: todo.description || '',
      status: todo.status ?? null,
      priority: todo.priority ?? null,
      dueAt: todo.dueAt ? todo.dueAt.split('T')[0] : null,
    });
    setIsEditing(true);
  }, [todo]);

  // Discard changes
  const discardChanges = useCallback(() => {
    setIsEditing(false);
    setEditedFields({
      title: '',
      description: '',
      status: null,
      priority: null,
      dueAt: null,
    });
  }, []);

  // Check which fields have changed
  const changedFields = useMemo(() => {
    if (!todo || !isEditing) return new Set<string>();
    const changes = new Set<string>();
    
    if (editedFields.title !== todo.title) changes.add('title');
    if (editedFields.description !== (todo.description || '')) changes.add('description');
    if (editedFields.status !== (todo.status ?? null)) changes.add('status');
    if (editedFields.priority !== (todo.priority ?? null)) changes.add('priority');
    
    const originalDueDate = todo.dueAt ? todo.dueAt.split('T')[0] : null;
    if (editedFields.dueAt !== originalDueDate) changes.add('dueAt');
    
    return changes;
  }, [todo, isEditing, editedFields]);

  const hasChanges = changedFields.size > 0;

  // Save changes
  const saveChanges = useCallback(async () => {
    if (!todo || !onSave || !hasChanges) return;
    
    setIsSaving(true);
    try {
      const updates: Partial<EditableFields> = {};
      if (changedFields.has('title')) updates.title = editedFields.title;
      if (changedFields.has('description')) updates.description = editedFields.description;
      if (changedFields.has('status')) updates.status = editedFields.status;
      if (changedFields.has('priority')) updates.priority = editedFields.priority;
      if (changedFields.has('dueAt')) {
        updates.dueAt = editedFields.dueAt ? `${editedFields.dueAt}T00:00:00Z` : null;
      }
      
      await onSave(todo.id, updates);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setIsSaving(false);
    }
  }, [todo, onSave, hasChanges, changedFields, editedFields]);

  // Quick status change (without entering edit mode)
  const handleQuickStatusChange = useCallback(async (newStatus: TodoAPI.Status) => {
    if (!todo || !onSave || newStatus === todo.status) return;
    
    setIsQuickStatusSaving(true);
    try {
      await onSave(todo.id, { status: newStatus });
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsQuickStatusSaving(false);
    }
  }, [todo, onSave]);

  // Defer task
  const handleDefer = useCallback(async (date: Date) => {
    if (!todo || !onDefer) return;
    
    setIsDeferring(true);
    try {
      const deferredTill = date.toISOString();
      await onDefer(todo.id, deferredTill);
      setIsDeferPopoverOpen(false);
    } catch (error) {
      console.error('Failed to defer task:', error);
    } finally {
      setIsDeferring(false);
    }
  }, [todo, onDefer]);

  // Undefer task
  const handleUndefer = useCallback(async () => {
    if (!todo || !onUndefer) return;
    
    setIsDeferring(true);
    try {
      await onUndefer(todo.id);
    } catch (error) {
      console.error('Failed to undefer task:', error);
    } finally {
      setIsDeferring(false);
    }
  }, [todo, onUndefer]);

  // Quick defer options
  const getQuickDeferDate = useCallback((option: 'tomorrow' | 'nextWeek' | 'nextMonth') => {
    const date = new Date();
    switch (option) {
      case 'tomorrow':
        date.setDate(date.getDate() + 1);
        break;
      case 'nextWeek':
        date.setDate(date.getDate() + 7);
        break;
      case 'nextMonth':
        date.setMonth(date.getMonth() + 1);
        break;
    }
    return date;
  }, []);

  // Reset edit state when modal closes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setIsEditing(false);
      setIsDeferPopoverOpen(false);
      setIsFloatingDeferOpen(false);
      setEditedFields({
        title: '',
        description: '',
        status: null,
        priority: null,
        dueAt: null,
      });
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  // Parse date for calendar
  const selectedDate = useMemo(() => {
    if (!editedFields.dueAt) return undefined;
    return new Date(editedFields.dueAt + 'T00:00:00');
  }, [editedFields.dueAt]);

  if (!todo) return null;

  const statusStyle = getTodoStatusStyle(isEditing ? editedFields.status : todo.status);
  const priorityInfo = getPriorityInfo(isEditing ? editedFields.priority : todo.priority);
  const dueInfo = formatTodoDueDate(isEditing ? editedFields.dueAt : todo.dueAt);
  const teamId = todo.assignee?.team_id;
  const teamName = teamId ? (teamsMap?.[teamId] || teamId) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {open && (
            <motion.div
              key={todo.id}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <DialogHeader className="space-y-3">
                <motion.div 
                  variants={itemVariants}
                  className="flex items-start justify-between gap-4"
                >
                  <div className="flex items-center gap-2">
                    {todo.in_watchlist && (
                      <motion.div
                        initial={{ opacity: 0, rotate: -20 }}
                        animate={{ opacity: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
                      >
                        <Eye className="h-5 w-5 text-blue-500 shrink-0" />
                      </motion.div>
                    )}
                    <motion.div variants={badgeVariants}>
                      <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                        {todo.displayId}
                      </Badge>
                    </motion.div>
                  </div>
                  
                </motion.div>
                
                {/* Title - Editable */}
                <motion.div variants={itemVariants}>
                  {isEditing ? (
                    <Input
                      value={editedFields.title}
                      onChange={(e) => setEditedFields(prev => ({ ...prev, title: e.target.value }))}
                      className={cn(
                        "text-xl font-semibold h-auto py-1 px-2",
                        changedFields.has('title') && "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400"
                      )}
                    />
                  ) : (
                    <DialogTitle className="text-xl font-semibold leading-tight pr-8">
                      {todo.title}
                    </DialogTitle>
                  )}
                </motion.div>
              </DialogHeader>

              <div className="space-y-6 pt-4">
                {/* Status and Priority Row - Editable */}
                <motion.div 
                  variants={sectionVariants}
                  className="flex flex-wrap items-center gap-2"
                >
                  {isEditing ? (
                    <>
                      <Select
                        value={editedFields.status || undefined}
                        onValueChange={(value) => setEditedFields(prev => ({ 
                          ...prev, 
                          status: value as TodoAPI.Status 
                        }))}
                      >
                        <SelectTrigger className={cn(
                          "w-[140px] h-9",
                          changedFields.has('status') && "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400"
                        )}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select
                        value={editedFields.priority?.toString() || 'none'}
                        onValueChange={(value) => setEditedFields(prev => ({ 
                          ...prev, 
                          priority: value === 'none' ? null : parseInt(value) as TodoAPI.PriorityNumber
                        }))}
                      >
                        <SelectTrigger className={cn(
                          "w-[140px] h-9",
                          changedFields.has('priority') && "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400"
                        )}>
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <>
                      {/* Priority badge first */}
                      {priorityInfo.label !== '-' && (
                        <motion.span
                          variants={badgeVariants}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium cursor-default',
                            priorityInfo.bgColor,
                            priorityInfo.color
                          )}
                        >
                          <motion.span
                            animate={{ rotate: [0, -10, 10, -10, 0] }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                          >
                            <Flag className="h-3.5 w-3.5" />
                          </motion.span>
                          {priorityInfo.label}
                        </motion.span>
                      )}
                      {/* Hover-triggered status dropdown */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <motion.button
                            variants={badgeVariants}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={isQuickStatusSaving}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-base font-medium cursor-pointer border-0 outline-none',
                              statusStyle.className,
                              isQuickStatusSaving && 'opacity-50'
                            )}
                          >
                            {isQuickStatusSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            {statusStyle.label}
                            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                          </motion.button>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="w-40 p-1" 
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                          <div className="flex flex-col gap-0.5">
                            {STATUS_OPTIONS.map(opt => {
                              const optStyle = getTodoStatusStyle(opt.value);
                              const isSelected = opt.value === todo.status;
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => handleQuickStatusChange(opt.value)}
                                  className={cn(
                                    'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-left transition-colors',
                                    isSelected 
                                      ? 'bg-muted font-medium' 
                                      : 'hover:bg-muted/50'
                                  )}
                                >
                                  <span className={cn(
                                    'w-2 h-2 rounded-full',
                                    optStyle.dotColor
                                  )} />
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Defer/Undefer button */}
                      {todo.deferredDetails ? (
                        // Undefer button for already deferred tasks
                        <motion.button
                          variants={badgeVariants}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleUndefer}
                          disabled={isDeferring}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer',
                            'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                            'hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors',
                            isDeferring && 'opacity-50'
                          )}
                        >
                          {isDeferring ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PlayCircle className="h-3.5 w-3.5" />
                          )}
                          Resume
                        </motion.button>
                      ) : (
                        // Defer button with popover
                        <Popover open={isDeferPopoverOpen} onOpenChange={setIsDeferPopoverOpen}>
                          <PopoverTrigger asChild>
                            <motion.button
                              variants={badgeVariants}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={isDeferring}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer',
                                'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                                'hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors',
                                isDeferring && 'opacity-50'
                              )}
                            >
                              {isDeferring ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <PauseCircle className="h-3.5 w-3.5" />
                              )}
                              Defer
                            </motion.button>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-auto p-3" 
                            align="start"
                            side="bottom"
                            sideOffset={4}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                            <div className="space-y-3">
                              <div className="text-sm font-medium">Defer until</div>
                              
                              {/* Quick options */}
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 h-8 text-xs"
                                  onClick={() => handleDefer(getQuickDeferDate('tomorrow'))}
                                  disabled={isDeferring}
                                >
                                  Tomorrow
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 h-8 text-xs"
                                  onClick={() => handleDefer(getQuickDeferDate('nextWeek'))}
                                  disabled={isDeferring}
                                >
                                  Next Week
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 h-8 text-xs"
                                  onClick={() => handleDefer(getQuickDeferDate('nextMonth'))}
                                  disabled={isDeferring}
                                >
                                  Next Month
                                </Button>
                              </div>

                              <Separator />

                              {/* Custom date picker */}
                              <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">Or pick a date</div>
                                <Calendar
                                  mode="single"
                                  selected={undefined}
                                  onSelect={(date) => date && handleDefer(date)}
                                  disabled={(date) => date < new Date()}
                                  className="rounded-md border"
                                />
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </>
                  )}
                </motion.div>

                {/* Description - Editable */}
                <motion.div variants={sectionVariants} className="space-y-2">
                  <motion.div 
                    variants={itemVariants}
                    className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground/70"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Description
                  </motion.div>
                  {isEditing ? (
                    <textarea
                      value={editedFields.description}
                      onChange={(e) => setEditedFields(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className={cn(
                        "w-full text-sm text-foreground leading-relaxed rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring",
                        changedFields.has('description') && "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400"
                      )}
                      placeholder="Add a description..."
                    />
                  ) : (
                    <motion.p 
                      variants={itemVariants}
                      className="text-sm text-foreground leading-relaxed"
                    >
                      {todo.description ? renderTextWithLinks(todo.description) : (
                        <span className="text-muted-foreground">No description</span>
                      )}
                    </motion.p>
                  )}
                </motion.div>

                {/* AI Summary */}
                {!isEditing && (
                  <motion.div variants={sectionVariants}>
                    <AISummaryCard
                      data={todo}
                      type="todo"
                      assigneeName={todo.assignee?.assignee_name || todo.assignee?.name}
                      teamName={teamName || undefined}
                      autoGenerate={true}
                    />
                  </motion.div>
                )}

                {/* Labels */}
                {todo.labels && todo.labels.length > 0 && (
                  <motion.div variants={sectionVariants} className="space-y-2">
                    <motion.div
                      variants={itemVariants}
                      className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground/70"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      Labels
                    </motion.div>
                    <div className="flex flex-wrap gap-2">
                      {todo.labels.map((label, index) => (
                        <motion.span
                          key={label.id}
                          custom={index}
                          variants={labelVariants}
                          initial="hidden"
                          animate="visible"
                          whileHover={{ scale: 1.08, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-default"
                          style={getLabelStyle(label.color)}
                        >
                          {label.name}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                )}

                <motion.div 
                  variants={separatorVariants}
                  style={{ originX: 0 }}
                >
                  <Separator />
                </motion.div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {/* Team */}
                  <DetailItem
                    icon={<Layers className="h-3.5 w-3.5" />}
                    label="Team"
                    value={teamName || 'No team'}
                    valueClassName={teamName ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}
                    index={0}
                  />

                  {/* Assignee */}
                  <DetailItem
                    icon={<User className="h-3.5 w-3.5" />}
                    label="Assignee"
                    value={
                      (todo.assignee?.assignee_name || todo.assignee?.name) ? (
                        <span className="inline-flex items-center gap-1.5">
                          <GoogleIcon className="h-3.5 w-3.5 shrink-0" />
                          {todo.assignee?.assignee_name || todo.assignee?.name}
                        </span>
                      ) : 'Unassigned'
                    }
                    valueClassName={!(todo.assignee?.assignee_name || todo.assignee?.name) ? 'text-muted-foreground' : undefined}
                    index={1}
                  />

                  {/* Due Date - Editable with Calendar */}
                  {isEditing ? (
                    <motion.div 
                      custom={2}
                      variants={gridItemVariants}
                      initial="hidden"
                      animate="visible"
                      className={cn(
                        "space-y-1.5 p-2 -m-2 rounded-md transition-colors",
                        changedFields.has('dueAt') && "bg-yellow-100 dark:bg-yellow-900/30"
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground/70">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        <span>Due date</span>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-9",
                              !selectedDate && "text-muted-foreground",
                              changedFields.has('dueAt') && "border-yellow-400"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                              setEditedFields(prev => ({
                                ...prev,
                                dueAt: date ? format(date, 'yyyy-MM-dd') : null
                              }));
                            }}
                            initialFocus
                          />
                          {selectedDate && (
                            <div className="p-2 border-t">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-muted-foreground"
                                onClick={() => setEditedFields(prev => ({ ...prev, dueAt: null }))}
                              >
                                Clear date
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </motion.div>
                  ) : (
                    <DetailItem
                      icon={<CalendarIcon className="h-3.5 w-3.5" />}
                      label="Due date"
                      value={
                        <>
                          {todo.dueAt 
                            ? format(new Date(todo.dueAt), 'MMM d, yyyy')
                            : 'No due date'}
                          {dueInfo.isOverdue && (
                            <motion.span 
                              className="ml-1.5 text-xs font-normal"
                              animate={{ opacity: [1, 0.5, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              ({dueInfo.text})
                            </motion.span>
                          )}
                        </>
                      }
                      valueClassName={dueInfo.isOverdue ? 'text-red-600' : (!todo.dueAt ? 'text-muted-foreground' : undefined)}
                      index={2}
                    />
                  )}

                  {/* Created By */}
                  <DetailItem
                    icon={<User className="h-3.5 w-3.5" />}
                    label="Created by"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <GoogleIcon className="h-3.5 w-3.5 shrink-0" />
                        {todo.createdBy?.name || 'Unknown'}
                      </span>
                    }
                    index={3}
                  />

                  {/* Created */}
                  <DetailItem
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Created"
                    value={format(new Date(todo.createdAt), 'MMM d, yyyy')}
                    index={4}
                  />
                </div>

                {/* Deferred Details */}
                {todo.deferredDetails && (
                  <>
                    <motion.div 
                      variants={separatorVariants}
                      style={{ originX: 0 }}
                    >
                      <Separator />
                    </motion.div>
                    <motion.div 
                      variants={sectionVariants}
                      className="space-y-3"
                    >
                      <motion.div 
                        variants={itemVariants}
                        className="flex items-center gap-1.5 text-sm font-medium text-orange-600"
                      >
                        <motion.span
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <AlertCircle className="h-4 w-4" />
                        </motion.span>
                        Deferred
                      </motion.div>
                      <motion.div 
                        variants={itemVariants}
                        whileHover={{ scale: 1.01 }}
                        className="rounded-lg border border-orange-200 dark:border-orange-900/50 p-4"
                      >
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground/70">Until</p>
                            <p className="text-sm font-medium text-foreground">
                              {format(new Date(todo.deferredDetails.deferredTill), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground/70">By</p>
                            <p className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
                              <GoogleIcon className="h-3.5 w-3.5 shrink-0" />
                              {todo.deferredDetails.deferredBy?.name || 'Unknown'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground/70">On</p>
                            <p className="text-sm font-medium text-foreground">
                              {format(new Date(todo.deferredDetails.deferredAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Bottom Action Buttons */}
        {isEditing ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center justify-end gap-2 pt-4 mt-4 border-t"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={discardChanges}
              disabled={isSaving}
              className="h-9 px-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1.5" />
              Discard
            </Button>
            <Button
              size="sm"
              onClick={saveChanges}
              disabled={!hasChanges || isSaving}
              className={cn(
                "h-9 px-4",
                hasChanges && !isSaving
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : ""
              )}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1.5" />
              )}
              Save
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-4 right-4 flex items-center gap-2"
          >
            {/* Defer button with popover */}
            {onDefer && !todo?.deferredDetails && (
              <Popover open={isFloatingDeferOpen} onOpenChange={setIsFloatingDeferOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isDeferring}
                    className="h-10 w-10 rounded-full shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {isDeferring ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-3" 
                  align="end"
                  side="top"
                  sideOffset={8}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Defer until</div>
                    
                    {/* Quick options */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => {
                          handleDefer(getQuickDeferDate('tomorrow'));
                          setIsFloatingDeferOpen(false);
                        }}
                        disabled={isDeferring}
                      >
                        Tomorrow
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => {
                          handleDefer(getQuickDeferDate('nextWeek'));
                          setIsFloatingDeferOpen(false);
                        }}
                        disabled={isDeferring}
                      >
                        Next Week
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => {
                          handleDefer(getQuickDeferDate('nextMonth'));
                          setIsFloatingDeferOpen(false);
                        }}
                        disabled={isDeferring}
                      >
                        Next Month
                      </Button>
                    </div>

                    <Separator />

                    {/* Custom date picker */}
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Or pick a date</div>
                      <Calendar
                        mode="single"
                        selected={undefined}
                        onSelect={(date) => {
                          if (date) {
                            handleDefer(date);
                            setIsFloatingDeferOpen(false);
                          }
                        }}
                        disabled={(date) => date < new Date()}
                        className="rounded-md border"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {/* Edit button */}
            <Button
              variant="outline"
              size="icon"
              onClick={startEditing}
              className="h-10 w-10 rounded-full shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
