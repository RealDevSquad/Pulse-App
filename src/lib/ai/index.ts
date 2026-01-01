/**
 * AI Module Exports
 *
 * Central export point for all AI-related functionality.
 */

// Configuration
export {
  AI_MODELS,
  FEATURE_MODELS,
  OPENROUTER_CONFIG,
  RATE_LIMIT_CONFIG,
  MODEL_PARAMS,
  isAIEnabled,
  isStreamingEnabled,
} from './config';

// OpenRouter client
export { createOpenRouterClient, withModelFallback, getFeatureClient } from './openrouter-client';
export type { ModelId } from './openrouter-client';

// Chains
export {
  generateTaskSummary,
  generateTodoSummary,
  generateTaskSummarySync,
  generateTodoSummarySync,
} from './chains/task-summary';
export type { TaskSummaryInput, TodoSummaryInput } from './chains/task-summary';
