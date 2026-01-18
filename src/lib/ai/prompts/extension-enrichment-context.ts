/**
 * Extension Enrichment Context for AI
 *
 * Formats extension enrichment data into AI-consumable context
 * for member performance analysis.
 */

import {
  AVOIDABILITY_OPTIONS,
  ROOT_CAUSE_OPTIONS,
  type ExtensionEnrichmentEvent,
  type AvoidabilityType,
  type RootCauseType,
} from '@/lib/extension-enrichment-types';

/**
 * Aggregated extension patterns for AI context
 */
export interface ExtensionPatternsSummary {
  totalEnriched: number;
  avoidablePercentage: number;
  avgSeverity: number;
  topAvoidabilities: Array<{ type: AvoidabilityType; count: number; label: string }>;
  topRootCauses: Array<{ type: RootCauseType; count: number; label: string }>;
  flagCounts: {
    repeatOffender: number;
    sameTaskRepeat: number;
    shortInterval: number;
    significantDelay: number;
  };
  recentEnrichments: ExtensionEnrichmentEvent[];
}

/**
 * Calculate extension patterns summary from enrichment events
 */
export function calculateExtensionPatterns(
  enrichments: ExtensionEnrichmentEvent[]
): ExtensionPatternsSummary {
  if (enrichments.length === 0) {
    return {
      totalEnriched: 0,
      avoidablePercentage: 0,
      avgSeverity: 0,
      topAvoidabilities: [],
      topRootCauses: [],
      flagCounts: {
        repeatOffender: 0,
        sameTaskRepeat: 0,
        shortInterval: 0,
        significantDelay: 0,
      },
      recentEnrichments: [],
    };
  }

  // Count avoidabilities (each enrichment can have multiple)
  const avoidabilityCounts: Record<AvoidabilityType, number> = {} as Record<
    AvoidabilityType,
    number
  >;
  const rootCauseCounts: Record<RootCauseType, number> = {} as Record<RootCauseType, number>;

  let totalWeight = 0;
  let avoidableCount = 0;
  const flagCounts = {
    repeatOffender: 0,
    sameTaskRepeat: 0,
    shortInterval: 0,
    significantDelay: 0,
  };

  for (const enrichment of enrichments) {
    // Count each avoidability factor
    for (const avoidability of enrichment.avoidabilities) {
      avoidabilityCounts[avoidability] = (avoidabilityCounts[avoidability] || 0) + 1;
      // Count as avoidable if weight >= 2
      if (AVOIDABILITY_OPTIONS[avoidability].weight >= 2) {
        avoidableCount++;
      }
    }

    // Count root causes
    for (const rootCause of enrichment.rootCauses) {
      if (rootCause in rootCauseCounts) {
        rootCauseCounts[rootCause as keyof typeof rootCauseCounts]++;
      }
    }

    // Sum weights for average
    totalWeight += enrichment.maxAvoidabilityWeight;

    // Count flags
    if (enrichment.flags.repeatOffender) flagCounts.repeatOffender++;
    if (enrichment.flags.sameTaskRepeat) flagCounts.sameTaskRepeat++;
    if (enrichment.flags.shortInterval) flagCounts.shortInterval++;
    if (enrichment.flags.significantDelay) flagCounts.significantDelay++;
  }

  // Calculate total avoidability instances for percentage
  const totalAvoidabilityInstances = Object.values(avoidabilityCounts).reduce((a, b) => a + b, 0);
  const avoidablePercentage =
    totalAvoidabilityInstances > 0
      ? Math.round((avoidableCount / totalAvoidabilityInstances) * 100)
      : 0;

  // Get top avoidabilities (sorted by count descending)
  const topAvoidabilities = Object.entries(avoidabilityCounts)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([type, count]) => ({
      type: type as AvoidabilityType,
      count,
      label: AVOIDABILITY_OPTIONS[type as AvoidabilityType].label,
    }));

  // Get top root causes (sorted by count descending)
  const topRootCauses = Object.entries(rootCauseCounts)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([type, count]) => ({
      type: type as RootCauseType,
      count,
      label: ROOT_CAUSE_OPTIONS[type as RootCauseType].label,
    }));

  // Get recent enrichments (most recent first, limit to 5)
  const recentEnrichments = [...enrichments]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  return {
    totalEnriched: enrichments.length,
    avoidablePercentage,
    avgSeverity: totalWeight / enrichments.length,
    topAvoidabilities,
    topRootCauses,
    flagCounts,
    recentEnrichments,
  };
}

/**
 * Format extension patterns for AI prompt context
 */
export function formatExtensionPatternsForAI(
  enrichments: ExtensionEnrichmentEvent[]
): string {
  if (enrichments.length === 0) {
    return 'No extension request enrichments have been recorded for this member.';
  }

  const patterns = calculateExtensionPatterns(enrichments);

  const lines: string[] = [];

  // Summary stats
  lines.push(`### Extension Request Patterns (${patterns.totalEnriched} enriched)`);
  lines.push(`- **Avoidable Extensions:** ${patterns.avoidablePercentage}% (severity weight >= 2)`);
  lines.push(`- **Average Severity:** ${patterns.avgSeverity.toFixed(1)}/3 (0 = unavoidable, 3 = clearly avoidable)`);

  // Top avoidability factors
  if (patterns.topAvoidabilities.length > 0) {
    lines.push('');
    lines.push('**Most Common Avoidability Factors:**');
    for (const { label, count } of patterns.topAvoidabilities) {
      const pct = Math.round((count / patterns.totalEnriched) * 100);
      lines.push(`- ${label}: ${count} (${pct}%)`);
    }
  }

  // Top root causes
  if (patterns.topRootCauses.length > 0) {
    lines.push('');
    lines.push('**Most Common Root Causes:**');
    for (const { label, count } of patterns.topRootCauses) {
      const pct = Math.round((count / patterns.totalEnriched) * 100);
      lines.push(`- ${label}: ${count} (${pct}%)`);
    }
  }

  // Concerning patterns (flags)
  const concerningFlags: string[] = [];
  if (patterns.flagCounts.repeatOffender > 0) {
    concerningFlags.push(`Repeat Offender (3+ extensions in 30 days): ${patterns.flagCounts.repeatOffender}`);
  }
  if (patterns.flagCounts.sameTaskRepeat > 0) {
    concerningFlags.push(`Same Task Repeat (multiple extensions on same task): ${patterns.flagCounts.sameTaskRepeat}`);
  }
  if (patterns.flagCounts.shortInterval > 0) {
    concerningFlags.push(`Short Interval (< 3 days after previous deadline): ${patterns.flagCounts.shortInterval}`);
  }
  if (patterns.flagCounts.significantDelay > 0) {
    concerningFlags.push(`Significant Delay (> 7 days from original deadline): ${patterns.flagCounts.significantDelay}`);
  }

  if (concerningFlags.length > 0) {
    lines.push('');
    lines.push('**⚠️ Concerning Patterns Detected:**');
    for (const flag of concerningFlags) {
      lines.push(`- ${flag}`);
    }
  }

  // Recent enrichment notes (if any have notes)
  const enrichmentsWithNotes = patterns.recentEnrichments.filter((e) => e.notes);
  if (enrichmentsWithNotes.length > 0) {
    lines.push('');
    lines.push('**Recent Enrichment Notes:**');
    for (const enrichment of enrichmentsWithNotes.slice(0, 3)) {
      const date = new Date(enrichment.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      lines.push(`- [${date}]: "${enrichment.notes}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Get severity level description for AI context
 */
export function getSeverityDescription(avgSeverity: number): string {
  if (avgSeverity < 1) {
    return 'Low concern - most extensions were unavoidable';
  }
  if (avgSeverity < 2) {
    return 'Moderate concern - mix of unavoidable and partially avoidable';
  }
  if (avgSeverity < 2.5) {
    return 'High concern - many extensions were avoidable';
  }
  return 'Critical concern - most extensions were clearly avoidable';
}
