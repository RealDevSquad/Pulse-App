/**
 * AI Configuration
 *
 * Model selection and settings for different AI features.
 * Uses OpenRouter for multi-model access.
 */

// Model IDs available through OpenRouter
export const AI_MODELS = {
  // Fast, cost-effective for simple tasks
  FAST: 'anthropic/claude-3-haiku',
  // Balanced performance and quality
  BALANCED: 'anthropic/claude-3.5-sonnet',
  // Highest quality for complex reasoning
  POWERFUL: 'anthropic/claude-3-opus',
  // Fallback models
  FALLBACK_FAST: 'openai/gpt-3.5-turbo',
  FALLBACK_BALANCED: 'openai/gpt-4-turbo',
} as const;

// Feature-specific model assignments
export const FEATURE_MODELS = {
  taskSummary: AI_MODELS.FAST,
  todoSummary: AI_MODELS.FAST,
  smartSearch: AI_MODELS.BALANCED,
  teamInsights: AI_MODELS.BALANCED,
  contentGeneration: AI_MODELS.BALANCED,
} as const;

// OpenRouter configuration
export const OPENROUTER_CONFIG = {
  baseUrl: 'https://openrouter.ai/api/v1',
  appName: 'Pulse App',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://pulse.realdevsquad.com',
} as const;

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 30,
  maxRequestsPerHour: 200,
  retryDelayMs: 1000,
  maxRetries: 3,
} as const;

// Model parameters
export const MODEL_PARAMS = {
  temperature: 0.7,
  maxTokens: 1024,
  streaming: true,
} as const;

// Feature flags
export function isAIEnabled(): boolean {
  return process.env.FEATURE_AI_ENABLED !== 'false';
}

export function isStreamingEnabled(): boolean {
  return process.env.FEATURE_AI_STREAMING !== 'false';
}
