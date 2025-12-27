'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, UserMinus, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TASK_TYPES, getTaskTypeInfo } from '@/lib/utils';

interface TaskActionsMenuProps {
  taskId: string;
  taskTitle: string;
  taskStatus?: string;
  taskType?: string;
  taskPriority?: string;
  taskEndsOn?: number;
  hasAssignee: boolean;
  assigneeName?: string;
  assigneePicture?: string;
}

const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
  { value: 'TBD', label: 'TBD' },
];

const STATUS_OPTIONS = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'TODO', label: 'Todo' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'NEEDS_REVIEW', label: 'Needs Review' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'MERGED', label: 'Merged' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'DONE', label: 'Done' },
];

const TYPE_OPTIONS = TASK_TYPES.map(type => {
  const info = getTaskTypeInfo(type);
  return { value: type, label: info.label };
});

function formatDateForInput(timestamp?: number): string {
  if (!timestamp) return '';
  // Handle both seconds and milliseconds
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const date = new Date(ms);
  return date.toISOString().split('T')[0];
}

function parseDateToTimestamp(dateString: string): number | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return Math.floor(date.getTime() / 1000); // Return seconds
}

function getInitials(name?: string): string {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function TaskActionsMenu({ 
  taskId, 
  taskTitle,
  taskStatus,
  taskType,
  taskPriority,
  taskEndsOn,
  hasAssignee, 
  assigneeName,
  assigneePicture,
}: TaskActionsMenuProps) {
  const router = useRouter();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [title, setTitle] = useState(taskTitle);
  const [status, setStatus] = useState(taskStatus?.toUpperCase() || '');
  const [type, setType] = useState(taskType || '');
  const [priority, setPriority] = useState(taskPriority || '');
  const [dueDate, setDueDate] = useState(formatDateForInput(taskEndsOn));
  const [isAssigned, setIsAssigned] = useState(hasAssignee);
  
  // Track original values to detect changes
  const [originalValues, setOriginalValues] = useState({
    title: taskTitle,
    status: taskStatus?.toUpperCase() || '',
    type: taskType || '',
    priority: taskPriority || '',
    dueDate: formatDateForInput(taskEndsOn),
    isAssigned: hasAssignee,
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isEditModalOpen) {
      setTitle(taskTitle);
      setStatus(taskStatus?.toUpperCase() || '');
      setType(taskType || '');
      setPriority(taskPriority || '');
      setDueDate(formatDateForInput(taskEndsOn));
      setIsAssigned(hasAssignee);
      setOriginalValues({
        title: taskTitle,
        status: taskStatus?.toUpperCase() || '',
        type: taskType || '',
        priority: taskPriority || '',
        dueDate: formatDateForInput(taskEndsOn),
        isAssigned: hasAssignee,
      });
    }
  }, [isEditModalOpen, taskTitle, taskStatus, taskType, taskPriority, taskEndsOn, hasAssignee]);

  const hasChanges = 
    title !== originalValues.title ||
    status !== originalValues.status ||
    type !== originalValues.type ||
    priority !== originalValues.priority ||
    dueDate !== originalValues.dueDate ||
    isAssigned !== originalValues.isAssigned;

  const handleSave = async () => {
    if (isSaving || !hasChanges) return;
    
    setIsSaving(true);
    try {
      // Handle unassign if needed
      if (originalValues.isAssigned && !isAssigned) {
        const unassignResponse = await fetch(`/api/tasks/${taskId}/unassign`, {
          method: 'POST',
        });
        if (!unassignResponse.ok) {
          throw new Error('Failed to unassign task');
        }
      }

      // Build update payload with only changed fields
      const updates: Record<string, unknown> = {};
      
      if (title !== originalValues.title) {
        updates.title = title;
      }
      if (status !== originalValues.status) {
        updates.status = status || null;
      }
      if (type !== originalValues.type) {
        updates.type = type || null;
      }
      if (priority !== originalValues.priority) {
        updates.priority = priority || null;
      }
      if (dueDate !== originalValues.dueDate) {
        updates.endsOn = parseDateToTimestamp(dueDate);
      }

      // Only call PATCH if there are field updates
      if (Object.keys(updates).length > 0) {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error('Failed to update task');
        }
      }

      setIsEditModalOpen(false);
      router.refresh();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnassign = () => {
    setIsAssigned(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                className={title !== originalValues.title ? 'border-yellow-500 bg-yellow-50' : ''}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger 
                  id="status"
                  className={status !== originalValues.status ? 'border-yellow-500 bg-yellow-50' : ''}
                >
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger 
                  id="type"
                  className={type !== originalValues.type ? 'border-yellow-500 bg-yellow-50' : ''}
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger 
                  id="priority"
                  className={priority !== originalValues.priority ? 'border-yellow-500 bg-yellow-50' : ''}
                >
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={dueDate !== originalValues.dueDate ? 'border-yellow-500 bg-yellow-50' : ''}
              />
            </div>

            {/* Assignee Section */}
            <div className={`pt-4 border-t space-y-2 ${isAssigned !== originalValues.isAssigned ? 'bg-yellow-50 -mx-6 px-6 py-2' : ''}`}>
              <Label>Assignee</Label>
              {isAssigned ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={assigneePicture} alt={assigneeName} />
                      <AvatarFallback className="text-xs">
                        {getInitials(assigneeName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{assigneeName}</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleUnassign}
                    className="border-red-500 text-red-600 hover:bg-red-500 hover:text-white h-8 w-8 p-0 gap-0 hover:w-auto hover:px-3 hover:gap-2 transition-all duration-200 group"
                  >
                    <UserMinus className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden group-hover:inline whitespace-nowrap">
                      Unassign
                    </span>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Unassigned</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !hasChanges}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
