'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  COMPLEXITY_LEVELS,
  getSkillColorClasses,
  getComplexityColorClasses,
  type TaskEnrichmentEvent,
} from '@/lib/task-enrichment-types';
import { CheckCircle2 } from 'lucide-react';

interface TaskEnrichmentBadgeProps {
  enrichment: TaskEnrichmentEvent | null | undefined;
  /** Show inline details (skills, complexity) below the badge */
  showDetails?: boolean;
  /** Maximum number of skill badges to show */
  maxSkills?: number;
  /** Compact mode - only shows checkmark icon */
  compact?: boolean;
}

/**
 * Visual indicator for task enrichment status
 *
 * Usage:
 * - In task tables: <TaskEnrichmentBadge enrichment={enrichment} compact />
 * - In task cards: <TaskEnrichmentBadge enrichment={enrichment} showDetails />
 */
export function TaskEnrichmentBadge({
  enrichment,
  showDetails = false,
  maxSkills = 3,
  compact = false,
}: TaskEnrichmentBadgeProps) {
  if (!enrichment) {
    if (compact) {
      return (
        <span className="text-muted-foreground/50" title="Not enriched">
          -
        </span>
      );
    }
    return null;
  }

  const complexityInfo = COMPLEXITY_LEVELS[enrichment.complexity];
  const displaySkills = enrichment.skills.slice(0, maxSkills);
  const remainingSkills = enrichment.skills.length - maxSkills;

  // Compact mode - just a checkmark with tooltip
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-green-600 dark:text-green-400 cursor-help">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-sm">
              <p className="font-medium">Task Enriched</p>
              <p>
                <span className="text-muted-foreground">Skills:</span>{' '}
                {enrichment.skills.join(', ')}
              </p>
              <p>
                <span className="text-muted-foreground">Complexity:</span>{' '}
                <span className={getComplexityColorClasses(enrichment.complexity)}>
                  {complexityInfo.label} ({complexityInfo.weight}x)
                </span>
              </p>
              {enrichment.unknownCount > 0 && (
                <p>
                  <span className="text-muted-foreground">Unknowns:</span>{' '}
                  {enrichment.unknownCount}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full display with optional details
  return (
    <div className="space-y-1">
      {/* Skill badges */}
      <div className="flex flex-wrap gap-1">
        {displaySkills.map((skill) => (
          <Badge
            key={skill}
            variant="outline"
            className={`${getSkillColorClasses(skill)} text-xs`}
          >
            {skill}
          </Badge>
        ))}
        {remainingSkills > 0 && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            +{remainingSkills} more
          </Badge>
        )}
      </div>

      {/* Complexity and unknowns */}
      {showDetails && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={getComplexityColorClasses(enrichment.complexity)}>
            {complexityInfo.label} ({complexityInfo.weight}x)
          </span>
          {enrichment.unknownCount > 0 && (
            <>
              <span>•</span>
              <span>{enrichment.unknownCount} unknown{enrichment.unknownCount !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline enrichment summary for task list rows
 */
export function TaskEnrichmentInline({
  enrichment,
}: {
  enrichment: TaskEnrichmentEvent | null | undefined;
}) {
  if (!enrichment) return null;

  const complexityInfo = COMPLEXITY_LEVELS[enrichment.complexity];
  const skillsPreview = enrichment.skills.slice(0, 2).join(', ');
  const moreSkills = enrichment.skills.length > 2 ? ` +${enrichment.skills.length - 2}` : '';

  return (
    <span className="text-xs text-muted-foreground">
      {skillsPreview}
      {moreSkills} •{' '}
      <span className={getComplexityColorClasses(enrichment.complexity)}>
        {complexityInfo.weight}x
      </span>
      {enrichment.unknownCount > 0 && (
        <> • {enrichment.unknownCount} unknowns</>
      )}
    </span>
  );
}
