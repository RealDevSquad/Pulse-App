/**
 * Shared types for pulseAppOnly collection events
 *
 * All events in the pulseAppOnly collection should use these shared types
 * to ensure consistency and type safety across the codebase.
 */

/**
 * Target entity types for pulseAppOnly events
 * Use this literal type to ensure correct values (prevents 'User' vs 'user' typos)
 */
export type TargetType = 'user' | 'task' | 'extension';

/**
 * Base meta structure for all pulseAppOnly events
 */
export interface PulseEventMeta {
  /** Event type for filtering (e.g., 'member_enrichment', 'task_enrichment') */
  type: string;
  /** userId of the person who created this event */
  by: string;
  /** Type of entity being targeted */
  target: TargetType;
}

/**
 * Base structure for all pulseAppOnly events
 */
export interface BasePulseEvent {
  /** Firestore document ID (auto-generated) */
  id?: string;
  /** Meta information for querying */
  meta: PulseEventMeta;
  /** Target entity ID (user ID, task ID, etc.) - unified field for all event types */
  targetId: string;
  /** Creation timestamp (ms since epoch) */
  timestamp: number;
}

/**
 * Constants for target types - use these instead of string literals
 * to get autocompletion and prevent typos
 */
export const TARGET_TYPES = {
  USER: 'user' as const,
  TASK: 'task' as const,
  EXTENSION: 'extension' as const,
} satisfies Record<string, TargetType>;
