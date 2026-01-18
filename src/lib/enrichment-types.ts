/**
 * Member Enrichment Types
 *
 * These types define the categories of enrichment data superusers can add
 * to provide context about members beyond their activity metrics.
 *
 * Used by:
 * - /member/[id]/enrich (enrichment form page)
 * - /api/member-enrichment (API route)
 * - /member/[id]/report (AI analysis page)
 */

import { TARGET_TYPES } from './pulse-event-types';

export const ENRICHMENT_TYPES = {
  context_note: {
    label: 'Context Note',
    description: 'General observations or context about the member',
    icon: 'MessageSquare',
  },
  goal_set: {
    label: 'Goal Setting',
    description: 'Goals agreed upon with the member',
    icon: 'Target',
  },
  skill_assessment: {
    label: 'Skill Assessment',
    description: 'Evaluation of member skills and capabilities',
    icon: 'Award',
  },
  intervention: {
    label: 'Intervention',
    description: 'Actions taken to help member improve',
    icon: 'Handshake',
  },
} as const;

export const ENRICHMENT_CATEGORIES = {
  mentorship: {
    label: 'Mentorship',
    color: 'blue',
    bgClass: 'bg-blue-100 dark:bg-blue-950',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-300 dark:border-blue-700',
  },
  blocker: {
    label: 'Blocker',
    color: 'red',
    bgClass: 'bg-red-100 dark:bg-red-950',
    textClass: 'text-red-700 dark:text-red-300',
    borderClass: 'border-red-300 dark:border-red-700',
  },
  growth: {
    label: 'Growth',
    color: 'green',
    bgClass: 'bg-green-100 dark:bg-green-950',
    textClass: 'text-green-700 dark:text-green-300',
    borderClass: 'border-green-300 dark:border-green-700',
  },
  recognition: {
    label: 'Recognition',
    color: 'yellow',
    bgClass: 'bg-yellow-100 dark:bg-yellow-950',
    textClass: 'text-yellow-700 dark:text-yellow-300',
    borderClass: 'border-yellow-300 dark:border-yellow-700',
  },
} as const;

export type EnrichmentType = keyof typeof ENRICHMENT_TYPES;
export type EnrichmentCategory = keyof typeof ENRICHMENT_CATEGORIES;

/**
 * Enrichment event stored in pulseAppOnly collection
 * Uses event trail pattern - each enrichment is an immutable event
 *
 * Uses unified field naming for all pulseAppOnly events:
 * - targetId: the subject/target of the event (user ID in this case)
 * - meta.by: who performed the action
 * - meta.target: type of entity being targeted ('user')
 *
 * Uses composite index: meta.type + targetId + timestamp
 */
export interface MemberEnrichmentEvent {
  /** Firestore document ID */
  id?: string;
  /** Meta information for querying */
  meta: {
    type: 'member_enrichment';
    /** userId of superuser who created this event */
    by: string;
    /** Entity type being targeted - use TARGET_TYPES.USER */
    target: typeof TARGET_TYPES.USER;
  };
  /** Target member's userId (unified field for all event types) */
  targetId: string;
  /** Type of enrichment */
  enrichmentType: EnrichmentType;
  /** Content of the enrichment */
  content: {
    text: string;
    category: EnrichmentCategory;
  };
  /** Creation timestamp (ms since epoch) */
  timestamp: number;
}

/**
 * Helper to get enrichment type info
 */
export function getEnrichmentTypeInfo(type: EnrichmentType) {
  return ENRICHMENT_TYPES[type];
}

/**
 * Helper to get enrichment category info
 */
export function getEnrichmentCategoryInfo(category: EnrichmentCategory) {
  return ENRICHMENT_CATEGORIES[category];
}

/**
 * Validate an enrichment event structure
 */
export function isValidEnrichmentEvent(event: unknown): event is Omit<MemberEnrichmentEvent, 'id'> {
  if (!event || typeof event !== 'object') return false;

  const e = event as Record<string, unknown>;

  if (typeof e.meta !== 'object' || e.meta === null) return false;
  const meta = e.meta as Record<string, unknown>;

  if (typeof e.content !== 'object' || e.content === null) return false;
  const content = e.content as Record<string, unknown>;

  return (
    meta.type === 'member_enrichment' &&
    typeof meta.by === 'string' &&
    meta.target === 'user' &&
    typeof e.targetId === 'string' &&
    typeof e.enrichmentType === 'string' &&
    e.enrichmentType in ENRICHMENT_TYPES &&
    typeof content.text === 'string' &&
    typeof content.category === 'string' &&
    content.category in ENRICHMENT_CATEGORIES &&
    typeof e.timestamp === 'number'
  );
}
