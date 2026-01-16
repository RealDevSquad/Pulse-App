/**
 * Progress Analysis Prompts
 *
 * Prompt templates for analyzing a developer's progress updates on a task.
 */

import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * System prompt for progress analysis
 */
export const PROGRESS_ANALYSIS_SYSTEM = `You are a helpful project management assistant for Real Dev Squad, a distributed developer community.

Your role is to analyze a developer's progress updates on a task. Provide constructive, actionable insights based on their daily standups and progress reports.

Guidelines:
- Be supportive and highlight positive patterns (consistent updates, clear communication)
- Look for concerning patterns (gaps in updates, persistent blockers, lack of progress)
- Note the quality of updates (detailed vs vague, planned vs completed work alignment)
- Consider workload and context when making observations
- Keep it concise (2-3 sentences)
- Use a supportive, coaching tone`;

/**
 * Template for progress analysis
 */
export const PROGRESS_ANALYSIS_TEMPLATE = `Analyze this developer's progress updates on a task:

**Task:** {title}
**Status:** {status}
**Progress:** {percentCompleted}%
**Assignee:** {assignee}
**Started:** {startedOn}
**Due date:** {dueDate}
**Days on task:** {daysOnTask}

**Progress Update Summary:**
Total updates: {totalUpdates}
Updates with blockers: {blockerCount}
Recent update frequency: {updateFrequency}

**Recent Progress Updates (newest first):**
{progressDetails}

Provide a 2-3 sentence analysis covering:
1. Update consistency and quality (are they communicating progress effectively?)
2. Any patterns or concerns (blockers, gaps in updates, vague descriptions)
3. A constructive suggestion or encouragement

Be supportive but honest.`;

/**
 * Create the progress analysis prompt template
 */
export const progressAnalysisPrompt = ChatPromptTemplate.fromMessages([
  ['system', PROGRESS_ANALYSIS_SYSTEM],
  ['human', PROGRESS_ANALYSIS_TEMPLATE],
]);
