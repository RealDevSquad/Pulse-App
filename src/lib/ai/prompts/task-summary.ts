/**
 * Task Summary Prompts
 *
 * Prompt templates for generating AI summaries of tasks and todos.
 */

import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * System prompt for task analysis
 */
export const TASK_SUMMARY_SYSTEM = `You are a helpful project management assistant for Real Dev Squad, a distributed developer community.

Your role is to provide concise, actionable summaries of tasks to help team members understand status at a glance.

Guidelines:
- Be direct and concise (2-3 sentences max)
- Focus on actionable insights
- Highlight blockers or risks if any
- Use a professional, friendly tone
- Never make up information - only summarize what's provided`;

/**
 * Template for Firestore task summaries
 */
export const TASK_SUMMARY_TEMPLATE = `Analyze this task and provide a brief summary:

**Task:** {title}
**Status:** {status}
**Type:** {type}
**Priority:** {priority}
**Progress:** {percentCompleted}%
**Assignee:** {assignee}
**Days until due:** {daysUntilDue}
**Last updated:** {lastUpdated}

{additionalContext}

Provide a 2-3 sentence summary covering:
1. Current state assessment
2. Any concerns or blockers (if applicable)
3. Suggested focus or next step`;

/**
 * Template for TODO API task summaries
 */
export const TODO_SUMMARY_TEMPLATE = `Analyze this todo item and provide a brief summary:

**Todo:** {title}
**Description:** {description}
**Status:** {status}
**Priority:** {priority}
**Assignee:** {assignee}
**Team:** {team}
**Labels:** {labels}
**Due date:** {dueDate}
**Deferred:** {deferredInfo}
**In watchlist:** {inWatchlist}
**Created by:** {createdBy}
**Created:** {createdAt}

Provide a 2-3 sentence summary covering:
1. Current state assessment
2. Any concerns or blockers (if applicable)
3. Suggested focus or next step`;

/**
 * Create the task summary prompt template
 */
export const taskSummaryPrompt = ChatPromptTemplate.fromMessages([
  ['system', TASK_SUMMARY_SYSTEM],
  ['human', TASK_SUMMARY_TEMPLATE],
]);

/**
 * Create the todo summary prompt template
 */
export const todoSummaryPrompt = ChatPromptTemplate.fromMessages([
  ['system', TASK_SUMMARY_SYSTEM],
  ['human', TODO_SUMMARY_TEMPLATE],
]);
