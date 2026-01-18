/**
 * Extension Enrichment Suggestion Prompts
 *
 * Prompt templates for AI-powered extension request enrichment suggestions.
 * Analyzes extension reason to suggest avoidability and root cause.
 */

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AVOIDABILITY_OPTIONS, ROOT_CAUSE_OPTIONS } from '@/lib/extension-enrichment-types';

// Build avoidability descriptions with weights
const avoidabilityDescriptions = Object.entries(AVOIDABILITY_OPTIONS)
  .map(([key, val]) => `- ${key} (weight ${val.weight}): ${val.description}`)
  .join('\n');

// Build root cause descriptions
const rootCauseDescriptions = Object.entries(ROOT_CAUSE_OPTIONS)
  .map(([key, val]) => `- ${key}: ${val.description}`)
  .join('\n');

/**
 * System prompt for extension enrichment analysis
 */
export const EXTENSION_ENRICHMENT_SYSTEM = `You are a technical project analyst for Real Dev Squad, a distributed developer community.

Your role is to analyze extension request reasons and classify them for member performance tracking. Be fair but honest - the goal is to help members improve, not to punish them.

Guidelines:
- Analyze the extension reason objectively
- Consider the context (task title, days extended)
- Be empathetic but honest about avoidability
- Multiple avoidability factors can apply to a single extension request
- When unclear, lean toward lower avoidability weights
- Return valid JSON only

Avoidability options (weight 0-3, higher = more concerning):
${avoidabilityDescriptions}

Root cause options:
${rootCauseDescriptions}`;

/**
 * Template for extension enrichment suggestions
 */
export const EXTENSION_ENRICHMENT_TEMPLATE = `Analyze this extension request and suggest enrichment values:

**Task Title:** {taskTitle}
**Assignee:** {assigneeName}
**Days Extended:** {daysExtended}
**Extension Reason:** {reason}

Return a JSON object with these fields:
- avoidabilities: array of 1-3 avoidability keys that apply (e.g., ["didnt_ask_for_help", "over_commitment"])
- rootCause: one of the root cause keys above
- reasoning: brief explanation of your classification (1-2 sentences)

Consider:
1. Does the reason mention external factors (waiting on others, scope changes)?
2. Does it mention personal circumstances (health, emergencies)?
3. Does it suggest planning issues (underestimated, started late)?
4. Does it show awareness and corrective action?
5. Could multiple factors have contributed? (e.g., both poor time management AND didn't ask for help)

JSON response:`;

/**
 * Create the extension enrichment suggestion prompt template
 */
export const extensionEnrichmentSuggestionPrompt = ChatPromptTemplate.fromMessages([
  ['system', EXTENSION_ENRICHMENT_SYSTEM],
  ['human', EXTENSION_ENRICHMENT_TEMPLATE],
]);
