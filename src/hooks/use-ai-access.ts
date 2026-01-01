'use client';

import { useState, useEffect } from 'react';

interface UseAIAccessReturn {
  /** Whether the user has AI access */
  hasAccess: boolean;
  /** Whether access check is loading */
  isLoading: boolean;
}

/**
 * Hook to check if the current user has access to AI features.
 *
 * Caches the result in sessionStorage to avoid repeated API calls.
 *
 * @example
 * ```tsx
 * const { hasAccess, isLoading } = useAIAccess();
 *
 * if (!hasAccess) return null;
 * return <AISummaryCard ... />;
 * ```
 */
export function useAIAccess(): UseAIAccessReturn {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      // Check cache first
      const cached = sessionStorage.getItem('ai_access');
      console.log('[useAIAccess] Cached value:', cached);
      if (cached !== null) {
        setHasAccess(cached === 'true');
        setIsLoading(false);
        return;
      }

      try {
        console.log('[useAIAccess] Fetching /api/ai/access...');
        const response = await fetch('/api/ai/access');
        if (response.ok) {
          const data = await response.json();
          console.log('[useAIAccess] Response:', data);
          setHasAccess(data.hasAccess);
          // Cache for the session
          sessionStorage.setItem('ai_access', String(data.hasAccess));
        } else {
          console.log('[useAIAccess] Response not ok:', response.status);
          setHasAccess(false);
        }
      } catch (err) {
        console.error('[useAIAccess] Error:', err);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, []);

  return { hasAccess, isLoading };
}

/**
 * Clear the cached AI access status.
 * Call this when the user logs out or when you need to recheck.
 */
export function clearAIAccessCache(): void {
  sessionStorage.removeItem('ai_access');
}
