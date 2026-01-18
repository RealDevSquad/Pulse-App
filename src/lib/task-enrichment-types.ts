/**
 * Task Enrichment Types
 *
 * Types and constants for enriching tasks with metadata (skills, complexity, etc.)
 * to enable weighted productivity scoring in member analysis.
 *
 * Used by: /api/task-enrichment, task-enrichment-dialog, AI member analysis
 */

import { TARGET_TYPES } from './pulse-event-types';

/**
 * Complexity levels with their productivity weights (linear scale 1-5)
 *
 * Weight scale: 1, 2, 3, 4, 5 (linear for easy math and querying)
 * Query example: where complexityWeight >= 3 (finds moderate+ tasks)
 */
export const COMPLEXITY_LEVELS = {
  trivial: {
    label: 'Trivial',
    weight: 1,
    description: 'Simple fix or update, < 1 hour',
  },
  simple: {
    label: 'Simple',
    weight: 2,
    description: 'Straightforward task, 1-4 hours',
  },
  moderate: {
    label: 'Moderate',
    weight: 3,
    description: 'Requires some design, 4-16 hours',
  },
  complex: {
    label: 'Complex',
    weight: 4,
    description: 'Significant design/implementation, 2-5 days',
  },
  very_complex: {
    label: 'Very Complex',
    weight: 5,
    description: 'Major feature/refactor, 5+ days',
  },
} as const;

export type ComplexityLevel = keyof typeof COMPLEXITY_LEVELS;

/**
 * Skill categories with their associated skills
 */
export const SKILL_CATEGORIES = {
  frontend: {
    label: 'Frontend',
    color: 'blue',
    skills: [
      'React',
      'Next.js',
      'Vue',
      'Angular',
      'TypeScript',
      'JavaScript',
      'CSS',
      'Tailwind',
      'HTML',
    ],
  },
  backend: {
    label: 'Backend',
    color: 'green',
    skills: ['Node.js', 'Express', 'Python', 'Go', 'Java', 'Ruby', 'PHP', 'Django', 'REST APIs'],
  },
  database: {
    label: 'Database',
    color: 'purple',
    skills: ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Firestore', 'Prisma', 'SQL'],
  },
  devops: {
    label: 'DevOps',
    color: 'orange',
    skills: ['Docker', 'Kubernetes', 'CI/CD', 'AWS', 'GCP', 'Azure', 'GitHub Actions', 'Nginx'],
  },
  design: {
    label: 'Design',
    color: 'pink',
    skills: ['UI/UX', 'Figma', 'Responsive Design', 'Accessibility', 'CSS-in-JS'],
  },
  testing: {
    label: 'Testing',
    color: 'indigo',
    skills: ['Jest', 'Cypress', 'Playwright', 'Unit Testing', 'E2E Testing', 'Testing Library'],
  },
  security: {
    label: 'Security',
    color: 'red',
    skills: ['Authentication', 'Authorization', 'Input Validation', 'OWASP', 'Encryption', 'JWT', 'OAuth'],
  },
  documentation: {
    label: 'Documentation',
    color: 'gray',
    skills: ['Technical Writing', 'API Docs', 'README', 'Markdown'],
  },
} as const;

export type SkillCategory = keyof typeof SKILL_CATEGORIES;

/**
 * Get all skills as a flat array
 */
export function getAllSkills(): string[] {
  return Object.values(SKILL_CATEGORIES).flatMap((cat) => cat.skills);
}

/**
 * Get the category for a skill
 */
export function getSkillCategory(skill: string): SkillCategory | null {
  for (const [category, data] of Object.entries(SKILL_CATEGORIES)) {
    if ((data.skills as readonly string[]).includes(skill)) {
      return category as SkillCategory;
    }
  }
  return null;
}

/**
 * Get color classes for a skill based on its category
 */
export function getSkillColorClasses(skill: string): string {
  const category = getSkillCategory(skill);
  if (!category) return 'bg-gray-100 text-gray-700 border-gray-300';

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300',
    green: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300',
    purple: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300',
    orange: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300',
    pink: 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-950 dark:text-pink-300',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300',
    red: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300',
    gray: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300',
  };

  return colorMap[SKILL_CATEGORIES[category].color] || colorMap.gray;
}

/**
 * Get color classes for complexity level
 */
export function getComplexityColorClasses(complexity: ComplexityLevel): string {
  const colorMap: Record<ComplexityLevel, string> = {
    trivial: 'text-gray-600 dark:text-gray-400',
    simple: 'text-blue-600 dark:text-blue-400',
    moderate: 'text-yellow-600 dark:text-yellow-400',
    complex: 'text-orange-600 dark:text-orange-400',
    very_complex: 'text-red-600 dark:text-red-400',
  };
  return colorMap[complexity];
}

/**
 * Task enrichment event stored in pulseAppOnly collection
 *
 * Uses event trail pattern - each enrichment is an immutable event.
 * Latest enrichment is derived by querying with orderBy timestamp desc, limit 1.
 *
 * Uses unified field naming for all pulseAppOnly events:
 * - targetId: the subject/target of the event (task ID in this case)
 * - meta.by: who performed the action (superuser)
 * - meta.target: type of entity being targeted ('task')
 *
 * Uses composite index: meta.type + targetId + timestamp
 * Can query by complexityWeight for filtering: where complexityWeight > 2
 */
export interface TaskEnrichmentEvent {
  /** Firestore document ID (auto-generated) */
  id?: string;

  /** Meta information for querying */
  meta: {
    type: 'task_enrichment';
    /** userId of superuser who created this event */
    by: string;
    /** Entity type being targeted - use TARGET_TYPES.TASK */
    target: typeof TARGET_TYPES.TASK;
  };

  /** Task ID being enriched (unified field for all event types) */
  targetId: string;

  /** Skills required for this task */
  skills: string[];

  /**
   * Number of skills for querying (e.g., where skillCount >= 3)
   */
  skillCount: number;

  /** Task complexity assessment (string key for display) */
  complexity: ComplexityLevel;

  /**
   * Numeric complexity weight for querying (1-5 linear scale)
   * Allows queries like: where complexityWeight >= 3
   */
  complexityWeight: number;

  /** Unknown factors or risks that add difficulty (always an array, may be empty) */
  unknownFactors: string[];

  /**
   * Number of unknown factors for querying (e.g., where unknownCount > 0)
   */
  unknownCount: number;

  /** Optional notes from the enricher */
  notes?: string;

  /** Creation timestamp (ms since epoch) */
  timestamp: number;
}

/**
 * Input for creating/updating task enrichment
 */
export interface TaskEnrichmentInput {
  taskId: string;
  skills: string[];
  complexity: ComplexityLevel;
  unknownFactors?: string[];
  notes?: string;
}

/**
 * Validate task enrichment input
 */
export function validateTaskEnrichmentInput(
  input: unknown
): { valid: true; data: TaskEnrichmentInput } | { valid: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Invalid input' };
  }

  const data = input as Record<string, unknown>;

  // Validate taskId
  if (!data.taskId || typeof data.taskId !== 'string') {
    return { valid: false, error: 'taskId is required' };
  }

  // Validate skills
  if (!Array.isArray(data.skills) || data.skills.length === 0) {
    return { valid: false, error: 'At least one skill is required' };
  }

  const allSkills = getAllSkills();
  for (const skill of data.skills) {
    if (typeof skill !== 'string' || !allSkills.includes(skill)) {
      return { valid: false, error: `Invalid skill: ${skill}` };
    }
  }

  // Validate complexity
  if (!data.complexity || typeof data.complexity !== 'string') {
    return { valid: false, error: 'complexity is required' };
  }

  if (!(data.complexity in COMPLEXITY_LEVELS)) {
    return { valid: false, error: `Invalid complexity: ${data.complexity}` };
  }

  // Validate unknownFactors (optional)
  if (data.unknownFactors !== undefined) {
    if (!Array.isArray(data.unknownFactors)) {
      return { valid: false, error: 'unknownFactors must be an array' };
    }
    for (const factor of data.unknownFactors) {
      if (typeof factor !== 'string') {
        return { valid: false, error: 'Each unknown factor must be a string' };
      }
    }
  }

  // Validate notes (optional)
  if (data.notes !== undefined && typeof data.notes !== 'string') {
    return { valid: false, error: 'notes must be a string' };
  }

  return {
    valid: true,
    data: {
      taskId: data.taskId as string,
      skills: data.skills as string[],
      complexity: data.complexity as ComplexityLevel,
      unknownFactors: data.unknownFactors as string[] | undefined,
      notes: data.notes as string | undefined,
    },
  };
}

/**
 * Calculate weighted productivity score for a task
 */
export function calculateTaskScore(complexity: ComplexityLevel): number {
  return COMPLEXITY_LEVELS[complexity].weight;
}

/**
 * Calculate total weighted productivity score for multiple tasks
 */
export function calculateTotalWeightedScore(
  enrichments: Map<string, TaskEnrichmentEvent>
): {
  totalScore: number;
  byComplexity: Record<ComplexityLevel, number>;
  enrichedCount: number;
  unenrichedCount: number;
} {
  const byComplexity: Record<ComplexityLevel, number> = {
    trivial: 0,
    simple: 0,
    moderate: 0,
    complex: 0,
    very_complex: 0,
  };

  let totalScore = 0;

  for (const enrichment of enrichments.values()) {
    const score = calculateTaskScore(enrichment.complexity);
    totalScore += score;
    byComplexity[enrichment.complexity]++;
  }

  return {
    totalScore,
    byComplexity,
    enrichedCount: enrichments.size,
    unenrichedCount: 0, // Caller should track this
  };
}
