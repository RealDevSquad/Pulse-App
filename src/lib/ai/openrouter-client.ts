/**
 * OpenRouter Client with LangChain
 *
 * Creates a LangChain ChatOpenAI instance configured for OpenRouter.
 * Supports streaming and model fallback.
 */

import { ChatOpenAI } from '@langchain/openai';
import { AI_MODELS, OPENROUTER_CONFIG, MODEL_PARAMS } from './config';

export type ModelId = (typeof AI_MODELS)[keyof typeof AI_MODELS];

interface OpenRouterClientOptions {
  model?: ModelId;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

/**
 * Create an OpenRouter-connected LangChain client
 *
 * Uses OpenRouter as the LLM gateway, which provides access to
 * multiple models (Claude, GPT, Llama, etc.) through a unified API.
 */
export function createOpenRouterClient(options: OpenRouterClientOptions = {}) {
  const {
    model = AI_MODELS.FAST,
    temperature = MODEL_PARAMS.temperature,
    maxTokens = MODEL_PARAMS.maxTokens,
    streaming = MODEL_PARAMS.streaming,
  } = options;

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  // Configure ChatOpenAI to use OpenRouter's API endpoint
  // OpenRouter is compatible with the OpenAI API format
  return new ChatOpenAI({
    modelName: model,
    openAIApiKey: apiKey,
    temperature,
    maxTokens,
    streaming,
    configuration: {
      baseURL: OPENROUTER_CONFIG.baseUrl,
    },
    modelKwargs: {
      // OpenRouter-specific headers for tracking
      extra_headers: {
        'HTTP-Referer': OPENROUTER_CONFIG.appUrl,
        'X-Title': OPENROUTER_CONFIG.appName,
      },
    },
  });
}

/**
 * Create a client with automatic fallback on failure
 */
export async function withModelFallback<T>(
  primaryModel: ModelId,
  fallbackModel: ModelId,
  operation: (client: ChatOpenAI) => Promise<T>
): Promise<T> {
  try {
    const client = createOpenRouterClient({ model: primaryModel });
    return await operation(client);
  } catch (error) {
    console.warn(`Primary model ${primaryModel} failed, falling back to ${fallbackModel}:`, error);

    const fallbackClient = createOpenRouterClient({ model: fallbackModel });
    return await operation(fallbackClient);
  }
}

/**
 * Get a client for a specific feature
 */
export function getFeatureClient(
  feature: 'taskSummary' | 'todoSummary' | 'smartSearch' | 'teamInsights' | 'contentGeneration'
) {
  const modelMap = {
    taskSummary: AI_MODELS.FAST,
    todoSummary: AI_MODELS.FAST,
    smartSearch: AI_MODELS.BALANCED,
    teamInsights: AI_MODELS.BALANCED,
    contentGeneration: AI_MODELS.BALANCED,
  };

  return createOpenRouterClient({ model: modelMap[feature] });
}
