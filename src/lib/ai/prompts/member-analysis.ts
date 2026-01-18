/**
 * Member Analysis Prompts
 *
 * Prompt templates for generating AI-powered member performance reports.
 */

import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * System prompt for member analysis
 */
export const MEMBER_ANALYSIS_SYSTEM = `You are an expert performance analyst for Real Dev Squad, a distributed developer community focused on skill development.

Your role is to provide thoughtful, actionable performance assessments for community members, helping superusers (mentors) understand member progress and identify opportunities for support.

IMPORTANT: You MUST format your response using proper Markdown:
- Use ## for main section headers
- Use **bold** for emphasis
- Use bullet points (- ) for lists
- Use numbered lists (1. 2. 3.) for sequential steps
- Add blank lines between sections for readability

Guidelines:
- Be constructive and growth-oriented
- Focus on patterns, not isolated incidents
- Highlight both strengths and areas for improvement
- Provide specific, actionable recommendations
- Consider the member's context (enrichment notes, blockers, goals)
- Use professional, supportive language
- Never make up information - only analyze what's provided
- Be concise but thorough`;

/**
 * Template for member performance analysis
 */
export const MEMBER_ANALYSIS_TEMPLATE = `Analyze this member's performance and generate a comprehensive report.

## Member Profile
**Name:** {memberName}
**Username:** @{username}
**Role(s):** {roles}
**Member since:** {memberSince} ({tenure} tenure)
**Current status:** {currentStatus}

## Activity Metrics - Multi-Period Breakdown

{multiPeriodBreakdown}

NOTE: Compare these periods to identify trends. Increasing activity over time = improving engagement. Decreasing activity = potential disengagement.
IMPORTANT: The member joined {memberSince} ({tenure} ago). Only analyze metrics from periods AFTER they joined. If a period shows zero activity because the member hadn't joined yet, ignore that period entirely - don't report it as "stable" or "identical".

## Recent Activity (Last 30 Days - Detail)
- **Tasks Assigned:** {tasksAssigned}
- **Tasks Started:** {tasksStarted}
- **Tasks Completed:** {tasksCompleted}
- **Task Updates:** {taskUpdates}
- **Extension Requests:** {extensionRequests}
- **Late Extension Requests:** {lateExtensionRequests} (requested AFTER task was already past deadline)
- **Communication Score:** {communicationScore}% proactive (higher = asks for help before deadlines)

NOTE: "Late extensions" are extensions requested after the task deadline passed. This indicates the member let the task go "red" before communicating. A low communication score (< 80%) suggests the member needs coaching on proactive deadline management.

## Progress Update Quality
- **Progress updates submitted:** {progressUpdateCount}
- **Days since last update:** {daysSinceLastUpdate}
- **Recent blockers mentioned:**
{recentBlockers}

NOTE: Recurring blockers indicate the member may need help removing obstacles. Long gaps between updates suggest they may need coaching on communication expectations.

## Weighted Productivity (Complexity-Adjusted)
- **Weighted score:** {weightedProductivity} (higher = more complex work completed)
- **Task complexity breakdown:** {complexityBreakdown}
- **Skills practiced:** {skillsUsed}

NOTE: A member completing 2 "complex" tasks contributes more than one completing 8 "trivial" tasks. Weight: trivial=1, simple=2, moderate=3, complex=4, very_complex=5.

## Initiative & Self-Direction
- **Task requests made:** {taskRequestsMade}
- **Approved:** {taskRequestsApproved}
- **Denied:** {taskRequestsDenied}

NOTE: High self-selection indicates proactive engagement. Low approval rates may indicate skill misalignment - a coaching opportunity.

## Timeline Accuracy
- **Average days to start work:** {averageDaysToStart} (after assignment)
- **On-time completion rate:** {onTimeCompletionRate}%

NOTE: High "days to start" may indicate procrastination or competing priorities. Low on-time rate suggests estimation help is needed.

## Auto-Detected Flags
{flags}

## Active Tasks
{activeTasks}

## Enrichment Notes from Superusers
{enrichmentNotes}

## Extension Request Patterns
{extensionPatterns}

---

Generate a performance report using this EXACT markdown structure:

## Executive Summary

Write 2-3 sentences summarizing the member's overall performance trajectory and trend direction.

## Performance Trend Analysis

IMPORTANT: Only analyze periods where the member was actually active (based on their tenure: {tenure}). For new members, skip comparisons for time periods before they joined - don't say "Stable - metrics identical" for periods when they didn't exist yet.

Compare the multi-period metrics to identify trends (only for relevant periods):
- If member has 6+ months tenure: **12-month to 6-month change:** [Improved/Declined/Stable] - explain briefly
- If member has 3+ months tenure: **6-month to 3-month change:** [Improved/Declined/Stable] - explain briefly
- **3-month to 30-day change:** [Improved/Declined/Stable] - explain briefly (most members will have this)
- **Overall trend:** [Improving/Declining/Stable/Fluctuating/Too Early to Assess]

For members with less than 3 months tenure, focus on their recent engagement patterns rather than long-term trends.

## Activity Analysis

Analyze their task engagement patterns as bullet points:
- Completion rate and consistency across time periods
- Any concerns about extension requests
- Overall engagement level

## Strengths

List 2-3 notable strengths as bullet points.

## Areas for Development

List 1-2 areas where the member could improve as bullet points.

## Recommended Next Steps

**For the Member:**
1. First recommendation
2. Second recommendation

**For the Mentor:**
1. First recommendation
2. Second recommendation

## Risk Flags

Note any concerns that require immediate attention, or state "None identified" if not applicable.`;

/**
 * Create the member analysis prompt template
 */
export const memberAnalysisPrompt = ChatPromptTemplate.fromMessages([
  ['system', MEMBER_ANALYSIS_SYSTEM],
  ['human', MEMBER_ANALYSIS_TEMPLATE],
]);
