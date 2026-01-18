/**
 * Extension Analysis Prompts
 *
 * Prompt templates for analyzing user performance based on extension requests.
 */

import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * System prompt for extension analysis
 */
export const EXTENSION_ANALYSIS_SYSTEM = `You are a helpful project management assistant for Real Dev Squad, a distributed developer community.

Your role is to analyze a developer's task progress in relation to their extension request history. Provide constructive, actionable insights.

Guidelines:
- Be empathetic but honest about patterns you observe
- Focus on actionable insights, not blame
- Consider that extensions can be legitimate (scope changes, blockers, life events)
- Highlight positive patterns when present
- Keep it concise (2-3 sentences)
- Use a supportive, coaching tone`;

/**
 * Template for extension analysis
 */
export const EXTENSION_ANALYSIS_TEMPLATE = `Analyze this developer's task progress and extension history:

**Task:** {title}
**Status:** {status}
**Progress:** {percentCompleted}%
**Assignee:** {assignee}
**Original due date:** {originalDueDate}
**Current due date:** {currentDueDate}
**Days on task:** {daysOnTask}

**Extension History:**
Total extensions requested: {totalExtensions}
Approved: {approvedCount}
Denied: {deniedCount}
Pending: {pendingCount}
**Late extensions:** {lateExtensionCount} (requested AFTER task was already past deadline)

**Extension Details:**
{extensionDetails}

IMPORTANT: "Late extensions" are extensions requested AFTER the deadline had already passed (task was "red"). This is a communication concern - the developer should have asked for help BEFORE the deadline, not after. If lateExtensionCount > 0, this should be flagged as a coaching opportunity for proactive communication.

Provide a 2-3 sentence analysis covering:
1. How the developer is progressing (considering extensions)
2. Any patterns or concerns (multiple extensions, short intervals, late requests after deadline)
3. A constructive suggestion or encouragement

Be supportive but honest.`;

/**
 * Create the extension analysis prompt template
 */
export const extensionAnalysisPrompt = ChatPromptTemplate.fromMessages([
  ['system', EXTENSION_ANALYSIS_SYSTEM],
  ['human', EXTENSION_ANALYSIS_TEMPLATE],
]);
