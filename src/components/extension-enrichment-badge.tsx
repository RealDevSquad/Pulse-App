'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AVOIDABILITY_OPTIONS,
  ROOT_CAUSE_OPTIONS,
  getAvoidabilityColorClasses,
  getRootCauseColorClasses,
  type ExtensionEnrichmentEvent,
  type AvoidabilityType,
  type RootCauseType,
} from '@/lib/extension-enrichment-types';
import { CheckCircle2, AlertTriangle, Circle } from 'lucide-react';

interface ExtensionEnrichmentBadgeProps {
  enrichment: ExtensionEnrichmentEvent | null | undefined;
  /** Show inline details (avoidability, root cause) below the badge */
  showDetails?: boolean;
  /** Compact mode - only shows icon with tooltip */
  compact?: boolean;
}

/**
 * Visual indicator for extension request enrichment status
 *
 * Usage:
 * - In extension tables: <ExtensionEnrichmentBadge enrichment={enrichment} compact />
 * - In extension cards: <ExtensionEnrichmentBadge enrichment={enrichment} showDetails />
 */
export function ExtensionEnrichmentBadge({
  enrichment,
  showDetails = false,
  compact = false,
}: ExtensionEnrichmentBadgeProps) {
  if (!enrichment) {
    if (compact) {
      return (
        <span className="text-muted-foreground/50 flex items-center gap-1" title="Not enriched">
          <Circle className="h-3 w-3" />
        </span>
      );
    }
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Circle className="h-3 w-3" />
        Not enriched
      </span>
    );
  }

  // Get avoidability labels (sorted by weight descending for display)
  const sortedAvoidabilities = [...enrichment.avoidabilities].sort(
    (a, b) => AVOIDABILITY_OPTIONS[b].weight - AVOIDABILITY_OPTIONS[a].weight
  );
  const primaryAvoidability = sortedAvoidabilities[0];
  const primaryAvoidabilityInfo = primaryAvoidability
    ? AVOIDABILITY_OPTIONS[primaryAvoidability]
    : null;
  const rootCauseInfo = ROOT_CAUSE_OPTIONS[enrichment.rootCause as RootCauseType];
  const hasFlags =
    enrichment.flags.repeatOffender ||
    enrichment.flags.sameTaskRepeat ||
    enrichment.flags.shortInterval ||
    enrichment.flags.significantDelay;

  // Compact mode - icon with tooltip
  if (compact) {
    const Icon = enrichment.maxAvoidabilityWeight >= 2 ? AlertTriangle : CheckCircle2;
    const iconColor =
      enrichment.maxAvoidabilityWeight >= 3
        ? 'text-red-600 dark:text-red-400'
        : enrichment.maxAvoidabilityWeight >= 2
          ? 'text-orange-600 dark:text-orange-400'
          : enrichment.maxAvoidabilityWeight >= 1
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-gray-500 dark:text-gray-400';

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`${iconColor} cursor-help`}>
              <Icon className="h-4 w-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-sm">
              <p className="font-medium">Extension Enriched</p>
              <p>
                <span className="text-muted-foreground">Avoidability:</span>{' '}
                {sortedAvoidabilities.map((a) => AVOIDABILITY_OPTIONS[a].label).join(', ')}
              </p>
              <p>
                <span className="text-muted-foreground">Root Cause:</span> {rootCauseInfo.label}
              </p>
              {hasFlags && (
                <div className="pt-1 border-t border-border mt-1">
                  <p className="text-muted-foreground">Flags:</p>
                  <ul className="text-xs">
                    {enrichment.flags.repeatOffender && <li>Repeat Offender</li>}
                    {enrichment.flags.sameTaskRepeat && <li>Same Task Repeat</li>}
                    {enrichment.flags.shortInterval && <li>Short Interval</li>}
                    {enrichment.flags.significantDelay && <li>Significant Delay</li>}
                  </ul>
                </div>
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
      {/* Main badges */}
      <div className="flex flex-wrap gap-1">
        {sortedAvoidabilities.map((avoidability) => (
          <Badge
            key={avoidability}
            variant="outline"
            className={`${getAvoidabilityColorClasses(avoidability)} text-xs`}
          >
            {AVOIDABILITY_OPTIONS[avoidability].label}
          </Badge>
        ))}
        <Badge variant="outline" className={`${getRootCauseColorClasses()} text-xs`}>
          {rootCauseInfo.label}
        </Badge>
      </div>

      {/* Flag indicators */}
      {showDetails && hasFlags && (
        <div className="flex flex-wrap gap-1">
          {enrichment.flags.repeatOffender && (
            <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300">
              Repeat Offender
            </Badge>
          )}
          {enrichment.flags.sameTaskRepeat && (
            <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300">
              Same Task
            </Badge>
          )}
          {enrichment.flags.shortInterval && (
            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300">
              Short Interval
            </Badge>
          )}
          {enrichment.flags.significantDelay && (
            <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300">
              Significant Delay
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline enrichment summary for extension request list rows
 */
export function ExtensionEnrichmentInline({
  enrichment,
}: {
  enrichment: ExtensionEnrichmentEvent | null | undefined;
}) {
  if (!enrichment) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Circle className="h-3 w-3" />
        Not enriched
      </span>
    );
  }

  // Get primary avoidability (highest weight)
  const sortedAvoidabilities = [...enrichment.avoidabilities].sort(
    (a, b) => AVOIDABILITY_OPTIONS[b].weight - AVOIDABILITY_OPTIONS[a].weight
  );
  const primaryAvoidability = sortedAvoidabilities[0];
  const primaryLabel = primaryAvoidability
    ? AVOIDABILITY_OPTIONS[primaryAvoidability].label
    : 'Unknown';
  const rootCauseInfo = ROOT_CAUSE_OPTIONS[enrichment.rootCause as RootCauseType];

  const textColor =
    enrichment.maxAvoidabilityWeight >= 3
      ? 'text-red-600 dark:text-red-400'
      : enrichment.maxAvoidabilityWeight >= 2
        ? 'text-orange-600 dark:text-orange-400'
        : enrichment.maxAvoidabilityWeight >= 1
          ? 'text-yellow-600 dark:text-yellow-400'
          : 'text-gray-600 dark:text-gray-400';

  // Show count if multiple avoidabilities
  const countSuffix = sortedAvoidabilities.length > 1 ? ` +${sortedAvoidabilities.length - 1}` : '';

  return (
    <span className={`text-xs ${textColor} flex items-center gap-1`}>
      <CheckCircle2 className="h-3 w-3" />
      {primaryLabel}{countSuffix} • {rootCauseInfo.label}
    </span>
  );
}
