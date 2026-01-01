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

/**
 * Experimental users who have access to AI features.
 * Set via environment variable as comma-separated usernames or user IDs.
 * Example: EXPERIMENTAL_AI_USERS=ankush,john,jane
 *
 * If not set or empty, AI features are disabled for all users.
 * Set to "*" to enable for all authenticated users.
 */
export function getExperimentalAIUsers(): string[] {
  const users = process.env.EXPERIMENTAL_AI_USERS || '';
  if (!users.trim()) return [];
  return users.split(',').map((u) => u.trim().toLowerCase()).filter(Boolean);
}

/**
 * Check if a user has access to AI features
 * @param userId - User ID to check
 * @param username - Username to check (optional)
 * @returns true if user has AI access
 */
export function hasAIAccess(userId?: string, username?: string): boolean {
  // First check if AI is globally enabled
  if (!isAIEnabled()) return false;

  const experimentalUsers = getExperimentalAIUsers();

  // If "*" is in the list, allow all authenticated users
  if (experimentalUsers.includes('*')) return true;

  // If no experimental users configured, disable for everyone
  if (experimentalUsers.length === 0) return false;

  // Check if user is in the experimental list (by ID or username)
  const userIdLower = userId?.toLowerCase();
  const usernameLower = username?.toLowerCase();

  return experimentalUsers.some(
    (u) => u === userIdLower || u === usernameLower
  );
}
