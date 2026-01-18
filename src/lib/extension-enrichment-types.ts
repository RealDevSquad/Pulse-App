/**
 * Extension Request Enrichment Types
 *
 * Types and constants for enriching extension requests with metadata
 * (avoidability, root cause, auto-computed flags) to enable better
 * AI summaries and member reports.
 *
 * Used by: /api/extension-enrichment, extension-enrichment-dialog, AI member analysis
 */

import { TARGET_TYPES } from './pulse-event-types';

/**
 * Avoidability options for extension requests
 *
 * Weight scale: 0 = unavoidable, 1 = partial, 2 = minor avoidable, 3 = clearly avoidable
 * Higher weight = more concerning pattern for AI analysis
 */
export const AVOIDABILITY_OPTIONS = {
  unavoidable: {
    label: 'Unavoidable',
    weight: 0,
    description: 'Circumstances beyond member\'s control',
  },
  partially_avoidable: {
    label: 'Partially Avoidable',
    weight: 1,
    description: 'Some control, but external factors involved',
  },
  procrastination: {
    label: 'Procrastination',
    weight: 3,
    description: 'Started work too late',
  },
  poor_time_management: {
    label: 'Poor Time Management',
    weight: 3,
    description: 'Didn\'t allocate sufficient daily effort',
  },
  over_commitment: {
    label: 'Over-commitment',
    weight: 2,
    description: 'Took on too many tasks simultaneously',
  },
  didnt_ask_for_help: {
    label: 'Didn\'t Ask for Help',
    weight: 2,
    description: 'Struggled alone when help was available',
  },
  missed_updates: {
    label: 'Missed Updates',
    weight: 2,
    description: 'Didn\'t communicate progress/blockers early',
  },
  ignored_guidance: {
    label: 'Ignored Guidance',
    weight: 3,
    description: 'Didn\'t follow mentor advice or best practices',
  },
  poor_task_breakdown: {
    label: 'Poor Task Breakdown',
    weight: 2,
    description: 'Didn\'t scope properly before committing',
  },
  unclear_on_requirements: {
    label: 'Unclear on Requirements',
    weight: 1,
    description: 'Started without fully understanding the task',
  },
  late_escalation: {
    label: 'Late Escalation',
    weight: 2,
    description: 'Knew about blocker but didn\'t raise it early',
  },
  context_switching: {
    label: 'Context Switching',
    weight: 1,
    description: 'Kept jumping between tasks instead of focusing',
  },
} as const;

export type AvoidabilityType = keyof typeof AVOIDABILITY_OPTIONS;

/**
 * Root cause options for extension requests
 */
export const ROOT_CAUSE_OPTIONS = {
  scope_change: {
    label: 'Scope Change',
    description: 'Requirements changed after assignment',
  },
  external_blocker: {
    label: 'External Blocker',
    description: 'Waiting on APIs, approvals, other teams',
  },
  technical_complexity: {
    label: 'Technical Complexity',
    description: 'Underestimated technical difficulty',
  },
  personal_emergency: {
    label: 'Personal Emergency',
    description: 'Life events, health issues',
  },
  poor_estimation: {
    label: 'Poor Estimation',
    description: 'Deadline was too aggressive',
  },
  lack_of_focus: {
    label: 'Lack of Focus',
    description: 'Distractions, context switching',
  },
  knowledge_gap: {
    label: 'Knowledge Gap',
    description: 'Needed to learn unexpected skills',
  },
  communication_gap: {
    label: 'Communication Gap',
    description: 'Requirements unclear or insufficient guidance',
  },
} as const;

export type RootCauseType = keyof typeof ROOT_CAUSE_OPTIONS;

/**
 * Auto-computed flags based on extension request history
 * These are computed at enrichment creation time
 */
export interface AutoComputedFlags {
  /** 3+ extensions from same user in 30 days */
  repeatOffender: boolean;
  /** Multiple extensions on the same task */
  sameTaskRepeat: boolean;
  /** Extension requested < 3 days after previous deadline */
  shortInterval: boolean;
  /** Extension > 7 days from original deadline */
  significantDelay: boolean;
}

/**
 * Extension enrichment event stored in pulseAppOnly collection
 *
 * Uses event trail pattern - each enrichment is an immutable event.
 * Latest enrichment is derived by querying with orderBy timestamp desc, limit 1.
 *
 * Uses composite index: meta.type + targetId + timestamp
 */
export interface ExtensionEnrichmentEvent {
  /** Firestore document ID (auto-generated) */
  id?: string;

  /** Meta information for querying */
  meta: {
    type: 'extension_enrichment';
    /** userId of superuser who created this event */
    by: string;
    /** Entity type being targeted - use TARGET_TYPES.EXTENSION */
    target: typeof TARGET_TYPES.EXTENSION;
  };

  /** Extension request ID being enriched */
  targetId: string;

  /** Task ID for cross-referencing */
  taskId: string;

  /** User ID of the extension request assignee (for user-level queries) */
  userId: string;

  /** Avoidability assessments (multi-select) */
  avoidabilities: AvoidabilityType[];

  /** Number of avoidability factors for querying */
  avoidabilityCount: number;

  /** Max avoidability weight for querying (0-3 scale, uses highest selected) */
  maxAvoidabilityWeight: number;

  /** Root cause classification */
  rootCause: RootCauseType;

  /** Auto-computed flags based on history */
  flags: AutoComputedFlags;

  /** Optional notes from the enricher */
  notes?: string;

  /** Creation timestamp (ms since epoch) */
  timestamp: number;
}

/**
 * Input for creating extension enrichment
 */
export interface ExtensionEnrichmentInput {
  extensionId: string;
  taskId: string;
  userId: string;
  avoidabilities: AvoidabilityType[];
  rootCause: RootCauseType;
  notes?: string;
}

/**
 * Type guard to check if a string is a valid AvoidabilityType
 */
export function isValidAvoidability(value: unknown): value is AvoidabilityType {
  return typeof value === 'string' && value in AVOIDABILITY_OPTIONS;
}

/**
 * Type guard to check if a string is a valid RootCauseType
 */
export function isValidRootCause(value: unknown): value is RootCauseType {
  return typeof value === 'string' && value in ROOT_CAUSE_OPTIONS;
}

/**
 * Get all avoidability keys as an array (for UI dropdowns)
 */
export function getAvoidabilityKeys(): AvoidabilityType[] {
  return Object.keys(AVOIDABILITY_OPTIONS) as AvoidabilityType[];
}

/**
 * Get all root cause keys as an array (for UI dropdowns)
 */
export function getRootCauseKeys(): RootCauseType[] {
  return Object.keys(ROOT_CAUSE_OPTIONS) as RootCauseType[];
}

/**
 * Validate extension enrichment input with strict type checking
 */
export function validateExtensionEnrichmentInput(
  input: unknown
): { valid: true; data: ExtensionEnrichmentInput } | { valid: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Invalid input' };
  }

  const data = input as Record<string, unknown>;

  // Validate extensionId
  if (!data.extensionId || typeof data.extensionId !== 'string') {
    return { valid: false, error: 'extensionId is required' };
  }

  // Validate taskId
  if (!data.taskId || typeof data.taskId !== 'string') {
    return { valid: false, error: 'taskId is required' };
  }

  // Validate userId
  if (!data.userId || typeof data.userId !== 'string') {
    return { valid: false, error: 'userId is required' };
  }

  // Validate avoidabilities (array) with strict type checking
  if (!Array.isArray(data.avoidabilities) || data.avoidabilities.length === 0) {
    return { valid: false, error: 'At least one avoidability factor is required' };
  }

  for (const avoidability of data.avoidabilities) {
    if (!isValidAvoidability(avoidability)) {
      const validOptions = getAvoidabilityKeys().join(', ');
      return {
        valid: false,
        error: `Invalid avoidability: "${avoidability}". Must be one of: ${validOptions}`,
      };
    }
  }

  // Validate rootCause with strict type checking
  if (!data.rootCause || typeof data.rootCause !== 'string') {
    return { valid: false, error: 'rootCause is required' };
  }

  if (!isValidRootCause(data.rootCause)) {
    const validOptions = getRootCauseKeys().join(', ');
    return {
      valid: false,
      error: `Invalid rootCause: "${data.rootCause}". Must be one of: ${validOptions}`,
    };
  }

  // Validate notes (optional)
  if (data.notes !== undefined && typeof data.notes !== 'string') {
    return { valid: false, error: 'notes must be a string' };
  }

  return {
    valid: true,
    data: {
      extensionId: data.extensionId,
      taskId: data.taskId,
      userId: data.userId,
      avoidabilities: data.avoidabilities as AvoidabilityType[],
      rootCause: data.rootCause,
      notes: data.notes as string | undefined,
    },
  };
}

/**
 * Calculate max avoidability weight from an array of avoidabilities
 */
export function calculateMaxAvoidabilityWeight(avoidabilities: AvoidabilityType[]): number {
  if (avoidabilities.length === 0) return 0;
  return Math.max(...avoidabilities.map(a => AVOIDABILITY_OPTIONS[a].weight));
}

/**
 * Get color classes for avoidability based on weight
 */
export function getAvoidabilityColorClasses(avoidability: AvoidabilityType): string {
  const weight = AVOIDABILITY_OPTIONS[avoidability].weight;

  if (weight === 0) {
    return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300';
  }
  if (weight === 1) {
    return 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300';
  }
  if (weight === 2) {
    return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300';
  }
  // weight === 3
  return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300';
}

/**
 * Get color classes for root cause (neutral coloring)
 */
export function getRootCauseColorClasses(): string {
  return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300';
}

/**
 * Get color classes for flags
 */
export function getFlagColorClasses(active: boolean): string {
  if (active) {
    return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300';
  }
  return 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
}

/**
 * Get avoidability weight for a given type
 */
export function getAvoidabilityWeight(avoidability: AvoidabilityType): number {
  return AVOIDABILITY_OPTIONS[avoidability].weight;
}

/**
 * Get avoidability label for display
 */
export function getAvoidabilityLabel(avoidability: AvoidabilityType): string {
  return AVOIDABILITY_OPTIONS[avoidability].label;
}

/**
 * Get avoidability description
 */
export function getAvoidabilityDescription(avoidability: AvoidabilityType): string {
  return AVOIDABILITY_OPTIONS[avoidability].description;
}

/**
 * Get root cause label for display
 */
export function getRootCauseLabel(rootCause: RootCauseType): string {
  return ROOT_CAUSE_OPTIONS[rootCause].label;
}

/**
 * Get root cause description
 */
export function getRootCauseDescription(rootCause: RootCauseType): string {
  return ROOT_CAUSE_OPTIONS[rootCause].description;
}

/**
 * Group avoidability options by severity for UI display
 */
export function getAvoidabilityByWeight(): Record<number, AvoidabilityType[]> {
  const byWeight: Record<number, AvoidabilityType[]> = { 0: [], 1: [], 2: [], 3: [] };

  for (const key of getAvoidabilityKeys()) {
    const weight = AVOIDABILITY_OPTIONS[key].weight;
    byWeight[weight].push(key);
  }

  return byWeight;
}

/**
 * Calculate aggregated enrichment statistics for a user
 */
export function calculateEnrichmentStats(enrichments: ExtensionEnrichmentEvent[]): {
  total: number;
  byAvoidability: Record<AvoidabilityType, number>;
  byRootCause: Record<RootCauseType, number>;
  avgAvoidabilityWeight: number;
  flagCounts: {
    repeatOffender: number;
    sameTaskRepeat: number;
    shortInterval: number;
    significantDelay: number;
  };
} {
  const byAvoidability = {} as Record<AvoidabilityType, number>;
  const byRootCause = {} as Record<RootCauseType, number>;

  // Initialize counts
  for (const key of getAvoidabilityKeys()) {
    byAvoidability[key] = 0;
  }
  for (const key of getRootCauseKeys()) {
    byRootCause[key] = 0;
  }

  let totalWeight = 0;
  const flagCounts = {
    repeatOffender: 0,
    sameTaskRepeat: 0,
    shortInterval: 0,
    significantDelay: 0,
  };

  for (const enrichment of enrichments) {
    // Count each avoidability factor
    for (const avoidability of enrichment.avoidabilities) {
      byAvoidability[avoidability]++;
    }
    byRootCause[enrichment.rootCause]++;
    totalWeight += enrichment.maxAvoidabilityWeight;

    if (enrichment.flags.repeatOffender) flagCounts.repeatOffender++;
    if (enrichment.flags.sameTaskRepeat) flagCounts.sameTaskRepeat++;
    if (enrichment.flags.shortInterval) flagCounts.shortInterval++;
    if (enrichment.flags.significantDelay) flagCounts.significantDelay++;
  }

  return {
    total: enrichments.length,
    byAvoidability,
    byRootCause,
    avgAvoidabilityWeight: enrichments.length > 0 ? totalWeight / enrichments.length : 0,
    flagCounts,
  };
}
