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
  AVOIDABILITY_OPTIONS,
  ROOT_CAUSE_OPTIONS,
  getAvoidabilityColorClasses,
  getRootCauseColorClasses,
  type ExtensionEnrichmentEvent,
  type AvoidabilityType,
  type RootCauseType,
  type AutoComputedFlags,
} from '@/lib/extension-enrichment-types';
import { ExtensionEnrichmentDialog } from './extension-enrichment-dialog';
import {
  ChevronDown,
  ChevronRight,
  Tags,
  AlertTriangle,
  Pencil,
  CheckCircle,
} from 'lucide-react';

interface ExtensionEnrichmentDisplayProps {
  enrichment: ExtensionEnrichmentEvent | null | undefined;
  extensionId: string;
  taskId: string;
  userId: string;
  taskTitle: string;
  assigneeName?: string;
  /** Date change info for context */
  oldEndsOn?: number;
  newEndsOn?: number;
  /** Extension reason for context */
  reason?: string;
  /** Pre-computed flags (for new enrichments) */
  preComputedFlags?: Partial<AutoComputedFlags>;
  isAdmin: boolean;
  onEnrichmentUpdated?: (enrichment: ExtensionEnrichmentEvent) => void;
}

/**
 * Display component for extension request enrichment in detail modal/view
 *
 * Shows:
 * - Avoidability assessment with weight-based coloring
 * - Root cause classification
 * - Auto-computed flags (repeat offender, etc.)
 * - Notes
 * - Edit button (for admins)
 */
export function ExtensionEnrichmentDisplay({
  enrichment,
  extensionId,
  taskId,
  userId,
  taskTitle,
  assigneeName,
  oldEndsOn,
  newEndsOn,
  reason,
  preComputedFlags,
  isAdmin,
  onEnrichmentUpdated,
}: ExtensionEnrichmentDisplayProps) {
  const [isOpen, setIsOpen] = useState(!!enrichment);

  // Empty state
  if (!enrichment) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full py-2">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <Tags className="h-4 w-4" />
            <span>Enrichment Analysis</span>
          </CollapsibleTrigger>
          {isAdmin ? (
            <ExtensionEnrichmentDialog
              extensionId={extensionId}
              taskId={taskId}
              userId={userId}
              taskTitle={taskTitle}
              assigneeName={assigneeName}
              oldEndsOn={oldEndsOn}
              newEndsOn={newEndsOn}
              reason={reason}
              preComputedFlags={preComputedFlags}
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
              Add avoidability assessment and root cause to help AI generate better reports.
            </p>
            {isAdmin && (
              <ExtensionEnrichmentDialog
                extensionId={extensionId}
                taskId={taskId}
                userId={userId}
                taskTitle={taskTitle}
                assigneeName={assigneeName}
                oldEndsOn={oldEndsOn}
                newEndsOn={newEndsOn}
                reason={reason}
                preComputedFlags={preComputedFlags}
                onEnrichmentSaved={onEnrichmentUpdated}
                trigger={
                  <Button variant="outline" size="sm">
                    <Tags className="h-4 w-4 mr-1" />
                    Enrich Extension
                  </Button>
                }
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Sort avoidabilities by weight (highest first)
  const sortedAvoidabilities = [...enrichment.avoidabilities].sort(
    (a, b) => AVOIDABILITY_OPTIONS[b].weight - AVOIDABILITY_OPTIONS[a].weight
  );
  const primaryAvoidability = sortedAvoidabilities[0];
  const primaryAvoidabilityInfo = primaryAvoidability
    ? AVOIDABILITY_OPTIONS[primaryAvoidability]
    : null;
  const rootCauseInfo = ROOT_CAUSE_OPTIONS[enrichment.rootCause as RootCauseType];
  const flags = enrichment.flags;
  const hasFlags =
    flags.repeatOffender || flags.sameTaskRepeat || flags.shortInterval || flags.significantDelay;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-foreground w-full py-2">
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <span>Enrichment Analysis</span>
        {!isOpen && primaryAvoidabilityInfo && (
          <span className="ml-2 text-muted-foreground font-normal">
            {primaryAvoidabilityInfo.label}
            {sortedAvoidabilities.length > 1 ? ` +${sortedAvoidabilities.length - 1}` : ''} • {rootCauseInfo.label}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-6 py-4 space-y-4">
          {/* Avoidability */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Avoidability Factors ({sortedAvoidabilities.length})
            </p>
            <div className="space-y-2">
              {sortedAvoidabilities.map((avoidability) => (
                <div key={avoidability} className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={getAvoidabilityColorClasses(avoidability)}
                  >
                    {AVOIDABILITY_OPTIONS[avoidability].label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {AVOIDABILITY_OPTIONS[avoidability].description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Root Cause */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Root Cause
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getRootCauseColorClasses()}>
                {rootCauseInfo.label}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {rootCauseInfo.description}
              </span>
            </div>
          </div>

          {/* Auto-Computed Flags */}
          {hasFlags && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-orange-500" />
                Auto-Detected Patterns
              </p>
              <div className="flex flex-wrap gap-1.5">
                {flags.repeatOffender && (
                  <Badge
                    variant="outline"
                    className="bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300"
                  >
                    Repeat Offender
                  </Badge>
                )}
                {flags.sameTaskRepeat && (
                  <Badge
                    variant="outline"
                    className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300"
                  >
                    Same Task Repeat
                  </Badge>
                )}
                {flags.shortInterval && (
                  <Badge
                    variant="outline"
                    className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300"
                  >
                    Short Interval
                  </Badge>
                )}
                {flags.significantDelay && (
                  <Badge
                    variant="outline"
                    className="bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300"
                  >
                    Significant Delay
                  </Badge>
                )}
              </div>
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

          {/* Metadata and Edit */}
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Added{' '}
              {new Date(enrichment.timestamp).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            {isAdmin && (
              <ExtensionEnrichmentDialog
                extensionId={extensionId}
                taskId={taskId}
                userId={userId}
                taskTitle={taskTitle}
                assigneeName={assigneeName}
                oldEndsOn={oldEndsOn}
                newEndsOn={newEndsOn}
                reason={reason}
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
