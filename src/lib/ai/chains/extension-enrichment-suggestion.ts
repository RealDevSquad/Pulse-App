/**
 * Extension Enrichment Suggestion Chain
 *
 * Uses AI to analyze an extension request reason and suggest enrichment values.
 * Returns structured JSON with avoidability, root cause, and reasoning.
 */

import { createOpenRouterClient } from '../openrouter-client';
import { extensionEnrichmentSuggestionPrompt } from '../prompts/extension-enrichment-suggestion';
import { AI_MODELS } from '../config';
import {
  AVOIDABILITY_OPTIONS,
  ROOT_CAUSE_OPTIONS,
  type AvoidabilityType,
  type RootCauseType,
} from '@/lib/extension-enrichment-types';

export interface ExtensionEnrichmentSuggestion {
  avoidabilities: AvoidabilityType[];
  rootCause: RootCauseType;
  reasoning: string;
}

export interface ExtensionForSuggestion {
  taskTitle: string;
  assigneeName?: string;
  daysExtended?: number;
  reason: string;
}

/**
 * Generate AI-powered enrichment suggestions for an extension request
 */
export async function generateExtensionEnrichmentSuggestion(
  extension: ExtensionForSuggestion
): Promise<ExtensionEnrichmentSuggestion> {
  // Use fast model for this classification task
  const client = createOpenRouterClient({
    model: AI_MODELS.FAST,
    streaming: false,
    temperature: 0.3, // Lower temperature for more consistent classifications
    maxTokens: 512,
  });

  const chain = extensionEnrichmentSuggestionPrompt.pipe(client);

  const response = await chain.invoke({
    taskTitle: extension.taskTitle,
    assigneeName: extension.assigneeName || 'Unknown',
    daysExtended: extension.daysExtended ?? 'Unknown',
    reason: extension.reason || 'No reason provided',
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
      avoidabilities: ['partially_avoidable'],
      rootCause: 'poor_estimation',
      reasoning: 'Could not parse AI response',
    };
  }
}

/**
 * Validate and sanitize the AI suggestion
 */
function sanitizeSuggestion(raw: Record<string, unknown>): ExtensionEnrichmentSuggestion {
  const validAvoidabilities = Object.keys(AVOIDABILITY_OPTIONS);
  const validRootCauses = Object.keys(ROOT_CAUSE_OPTIONS);

  // Validate avoidabilities array
  let avoidabilities: AvoidabilityType[] = [];
  if (Array.isArray(raw.avoidabilities)) {
    avoidabilities = raw.avoidabilities.filter(
      (a): a is AvoidabilityType => validAvoidabilities.includes(a as string)
    );
  } else if (typeof raw.avoidability === 'string' && validAvoidabilities.includes(raw.avoidability)) {
    // Backwards compatibility: if AI returns single avoidability, convert to array
    avoidabilities = [raw.avoidability as AvoidabilityType];
  }

  // Default to partially_avoidable if nothing valid
  if (avoidabilities.length === 0) {
    avoidabilities = ['partially_avoidable'];
  }

  // Validate root cause
  const rootCause = validRootCauses.includes(raw.rootCause as string)
    ? (raw.rootCause as RootCauseType)
    : 'poor_estimation';

  // Get reasoning
  const reasoning = typeof raw.reasoning === 'string'
    ? raw.reasoning.slice(0, 300)
    : '';

  return {
    avoidabilities,
    rootCause,
    reasoning,
  };
}
