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

// Model pricing (per 1M tokens) - from OpenRouter
// Updated: Jan 2025
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'anthropic/claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  'anthropic/claude-3-opus': { input: 15.0, output: 75.0 },
  'openai/gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'openai/gpt-4-turbo': { input: 10.0, output: 30.0 },
  'google/gemini-2.0-flash-001': { input: 0.1, output: 0.4 },
} as const;

/**
 * Calculate cost for a given model and token counts
 * @returns Cost in USD
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || { input: 0.5, output: 1.5 }; // Default fallback
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Estimate token count from text (rough approximation)
 * ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Feature flags
export function isAIEnabled(): boolean {
  return process.env.FEATURE_AI_ENABLED !== 'false';
}

export function isStreamingEnabled(): boolean {
  return process.env.FEATURE_AI_STREAMING !== 'false';
}
