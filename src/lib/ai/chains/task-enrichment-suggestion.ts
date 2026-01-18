/**
 * Task Enrichment Suggestion Chain
 *
 * Uses AI to analyze a task and suggest enrichment values.
 * Returns structured JSON with skills, complexity, and unknowns.
 */

import { createOpenRouterClient } from '../openrouter-client';
import { taskEnrichmentSuggestionPrompt } from '../prompts/task-enrichment-suggestion';
import { AI_MODELS } from '../config';
import {
  getAllSkills,
  COMPLEXITY_LEVELS,
  type ComplexityLevel,
} from '@/lib/task-enrichment-types';

export interface TaskEnrichmentSuggestion {
  skills: string[];
  complexity: ComplexityLevel;
  unknownFactors: string[];
  reasoning: string;
}

export interface TaskForSuggestion {
  title: string;
  type?: string;
  status?: string;
  priority?: string;
}

/**
 * Generate AI-powered enrichment suggestions for a task
 */
export async function generateEnrichmentSuggestion(
  task: TaskForSuggestion
): Promise<TaskEnrichmentSuggestion> {
  // Use fast model for this simple classification task
  const client = createOpenRouterClient({
    model: AI_MODELS.FAST,
    streaming: false,
    temperature: 0.3, // Lower temperature for more consistent classifications
    maxTokens: 512,
  });

  const chain = taskEnrichmentSuggestionPrompt.pipe(client);

  const response = await chain.invoke({
    title: task.title,
    type: task.type || 'Unknown',
    status: task.status || 'Unknown',
    priority: task.priority || 'Unknown',
  });

  // Extract the content from the response
  const content = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);

  // Parse the JSON response
  const suggestion = parseJsonResponse(content);

  // Validate and sanitize the suggestion
  return sanitizeSuggestion(suggestion);
}

/**
 * Parse JSON from LLM response, handling markdown code blocks
 */
function parseJsonResponse(content: string): Record<string, unknown> {
  // Remove markdown code blocks if present
  let jsonStr = content.trim();

  // Handle ```json ... ``` format
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Try to find JSON object in the response
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    console.error('Failed to parse AI response as JSON:', content);
    // Return safe defaults
    return {
      skills: [],
      complexity: 'moderate',
      unknownFactors: [],
      reasoning: 'Could not parse AI response',
    };
  }
}

/**
 * Validate and sanitize the AI suggestion
 */
function sanitizeSuggestion(raw: Record<string, unknown>): TaskEnrichmentSuggestion {
  const validSkills = getAllSkills();
  const validComplexities = Object.keys(COMPLEXITY_LEVELS);

  // Filter skills to only valid ones
  const skills = Array.isArray(raw.skills)
    ? (raw.skills as string[]).filter((s) => validSkills.includes(s))
    : [];

  // Validate complexity
  const complexity = validComplexities.includes(raw.complexity as string)
    ? (raw.complexity as ComplexityLevel)
    : 'moderate';

  // Sanitize unknown factors
  const unknownFactors = Array.isArray(raw.unknownFactors)
    ? (raw.unknownFactors as string[])
        .filter((f) => typeof f === 'string')
        .slice(0, 5) // Max 5 unknown factors
        .map((f) => f.slice(0, 100)) // Max 100 chars each
    : [];

  // Get reasoning
  const reasoning = typeof raw.reasoning === 'string'
    ? raw.reasoning.slice(0, 200)
    : '';

  return {
    skills,
    complexity,
    unknownFactors,
    reasoning,
  };
}
