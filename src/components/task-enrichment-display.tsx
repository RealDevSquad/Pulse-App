'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  COMPLEXITY_LEVELS,
  getSkillColorClasses,
  getComplexityColorClasses,
  calculateTaskScore,
  type TaskEnrichmentEvent,
} from '@/lib/task-enrichment-types';
import { TaskEnrichmentDialog } from './task-enrichment-dialog';
import { ChevronDown, ChevronRight, Tags, AlertTriangle, Pencil } from 'lucide-react';

interface TaskEnrichmentDisplayProps {
  enrichment: TaskEnrichmentEvent | null | undefined;
  taskId: string;
  taskTitle: string;
  /** Optional task metadata for better AI suggestions */
  taskType?: string;
  taskStatus?: string;
  taskPriority?: string;
  isAdmin: boolean;
  onEnrichmentUpdated?: (enrichment: TaskEnrichmentEvent) => void;
}

/**
 * Display component for task enrichment in task detail modal/view
 *
 * Shows:
 * - Skills as badges
 * - Complexity with weight
 * - Unknown factors list
 * - Notes
 * - Productivity score preview
 * - Edit button (for admins)
 */
export function TaskEnrichmentDisplay({
  enrichment,
  taskId,
  taskTitle,
  taskType,
  taskStatus,
  taskPriority,
  isAdmin,
  onEnrichmentUpdated,
}: TaskEnrichmentDisplayProps) {
  const [isOpen, setIsOpen] = useState(!!enrichment);

  // Empty state
  if (!enrichment) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-full py-2">
          <CollapsibleTrigger className="flex items-center gap-2 hover:text-foreground flex-1">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <Tags className="h-4 w-4" />
            <span>Task Enrichment</span>
          </CollapsibleTrigger>
          {isAdmin ? (
            <TaskEnrichmentDialog
              taskId={taskId}
              taskTitle={taskTitle}
              taskType={taskType}
              taskStatus={taskStatus}
              taskPriority={taskPriority}
              onEnrichmentSaved={onEnrichmentUpdated}
              trigger={
                <Badge
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors group"
                >
                  <span className="group-hover:hidden">Not enriched</span>
                  <span className="hidden group-hover:inline">+ Enrich</span>
                </Badge>
              }
            />
          ) : (
            <Badge variant="outline" className="text-xs">
              Not enriched
            </Badge>
          )}
        </div>
        <CollapsibleContent>
          <div className="pl-6 py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Add skills, complexity, and other metadata to help measure productivity more accurately.
            </p>
            {isAdmin && (
              <TaskEnrichmentDialog
                taskId={taskId}
                taskTitle={taskTitle}
                taskType={taskType}
                taskStatus={taskStatus}
                taskPriority={taskPriority}
                onEnrichmentSaved={onEnrichmentUpdated}
                trigger={
                  <Button variant="outline" size="sm">
                    <Tags className="h-4 w-4 mr-1" />
                    Enrich This Task
                  </Button>
                }
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  const complexityInfo = COMPLEXITY_LEVELS[enrichment.complexity];
  const score = calculateTaskScore(enrichment.complexity);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-foreground w-full py-2">
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Tags className="h-4 w-4" />
        <span>Task Enrichment</span>
        {!isOpen && (
          <span className="ml-2 text-muted-foreground font-normal">
            {enrichment.skills.slice(0, 2).join(', ')}
            {enrichment.skills.length > 2 && ` +${enrichment.skills.length - 2}`}
            {' • '}
            <span className={getComplexityColorClasses(enrichment.complexity)}>
              {complexityInfo.weight}x
            </span>
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-6 py-4 space-y-4">
          {/* Skills */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Skills Required
            </p>
            <div className="flex flex-wrap gap-1.5">
              {enrichment.skills.map((skill) => (
                <Badge
                  key={skill}
                  variant="outline"
                  className={getSkillColorClasses(skill)}
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          {/* Complexity */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Complexity
            </p>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={getComplexityColorClasses(enrichment.complexity)}
              >
                {complexityInfo.label} ({complexityInfo.weight}x)
              </Badge>
              <span className="text-sm text-muted-foreground">
                {complexityInfo.description}
              </span>
            </div>
          </div>

          {/* Unknown Factors */}
          {enrichment.unknownCount > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Unknown Factors ({enrichment.unknownCount})
              </p>
              <ul className="space-y-1 text-sm">
                {enrichment.unknownFactors.map((factor, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {enrichment.notes && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Notes
              </p>
              <p className="text-sm text-muted-foreground italic">
                &ldquo;{enrichment.notes}&rdquo;
              </p>
            </div>
          )}

          {/* Productivity Score */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Productivity Score
            </p>
            <p className="text-sm">
              Base: <strong>1.0</strong> • Complexity:{' '}
              <strong className={getComplexityColorClasses(enrichment.complexity)}>
                {complexityInfo.weight}x
              </strong>{' '}
              • Final: <strong>{score} points</strong>
            </p>
          </div>

          {/* Metadata and Edit */}
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Added {new Date(enrichment.timestamp).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            {isAdmin && (
              <TaskEnrichmentDialog
                taskId={taskId}
                taskTitle={taskTitle}
                taskType={taskType}
                taskStatus={taskStatus}
                taskPriority={taskPriority}
                existingEnrichment={enrichment}
                onEnrichmentSaved={onEnrichmentUpdated}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
