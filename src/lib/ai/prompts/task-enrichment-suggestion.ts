/**
 * Task Enrichment Suggestion Prompts
 *
 * Prompt templates for AI-powered task enrichment suggestions.
 * Analyzes task title/description to suggest skills, complexity, and unknowns.
 */

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SKILL_CATEGORIES, COMPLEXITY_LEVELS } from '@/lib/task-enrichment-types';

// Build the skills list from our types
const allSkills = Object.values(SKILL_CATEGORIES)
  .map((cat) => `${cat.label}: ${cat.skills.join(', ')}`)
  .join('\n');

// Build complexity descriptions
const complexityDescriptions = Object.entries(COMPLEXITY_LEVELS)
  .map(([key, val]) => `- ${key}: ${val.description}`)
  .join('\n');

/**
 * System prompt for task enrichment analysis
 */
export const TASK_ENRICHMENT_SYSTEM = `You are a technical project analyst for Real Dev Squad, a distributed developer community.

Your role is to analyze task titles and descriptions to suggest:
1. Required technical skills (from the predefined list)
2. Task complexity level
3. Potential unknown factors or risks

Guidelines:
- Only suggest skills from the provided list - DO NOT invent new skills
- Be conservative with complexity - most bug fixes are "simple", features are "moderate"
- Identify unknowns only when there are genuine ambiguities or risks
- Return valid JSON only

Available skills by category:
${allSkills}

Complexity levels:
${complexityDescriptions}`;

/**
 * Template for task enrichment suggestions
 */
export const TASK_ENRICHMENT_TEMPLATE = `Analyze this task and suggest enrichment values:

**Task Title:** {title}
**Task Type:** {type}
**Task Status:** {status}
**Task Priority:** {priority}

Return a JSON object with these fields:
- skills: array of skill names (from the list above, 1-5 skills)
- complexity: one of "trivial", "simple", "moderate", "complex", "very_complex"
- unknownFactors: array of potential risks/unknowns (0-3 items, short phrases)
- reasoning: brief explanation of your choices (1-2 sentences)

JSON response:`;

/**
 * Create the task enrichment suggestion prompt template
 */
export const taskEnrichmentSuggestionPrompt = ChatPromptTemplate.fromMessages([
  ['system', TASK_ENRICHMENT_SYSTEM],
  ['human', TASK_ENRICHMENT_TEMPLATE],
]);
