'use client';

import { MotionConfig } from 'framer-motion';
import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

type CubicBezier = [number, number, number, number];

interface MotionContextValue {
  prefersReducedMotion: boolean;
  isMobile: boolean;
  duration: {
    fast: number;
    normal: number;
    slow: number;
  };
  staggerDelay: number;
  springConfig: {
    stiffness: number;
    damping: number;
  };
  easeOut: CubicBezier;
}

const MotionContext = createContext<MotionContextValue>({
  prefersReducedMotion: false,
  isMobile: false,
  duration: { fast: 0.15, normal: 0.3, slow: 0.5 },
  staggerDelay: 0.08,
  springConfig: { stiffness: 400, damping: 17 },
  easeOut: [0.22, 1, 0.36, 1] as CubicBezier,
});

export function useMotionConfig() {
  return useContext(MotionContext);
}

export function useReducedMotion() {
  const { prefersReducedMotion } = useContext(MotionContext);
  return prefersReducedMotion;
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const value = useMemo<MotionContextValue>(() => {
    if (prefersReducedMotion) {
      return {
        prefersReducedMotion: true,
        isMobile,
        duration: { fast: 0, normal: 0, slow: 0 },
        staggerDelay: 0,
        springConfig: { stiffness: 1000, damping: 100 },
        easeOut: [0, 0, 1, 1] as CubicBezier,
      };
    }

    // Mobile: 50% faster animations
    if (isMobile) {
      return {
        prefersReducedMotion: false,
        isMobile: true,
        duration: { fast: 0.1, normal: 0.15, slow: 0.25 },
        staggerDelay: 0.03,
        springConfig: { stiffness: 500, damping: 30 },
        easeOut: [0.22, 1, 0.36, 1] as CubicBezier,
      };
    }

    // Desktop: full bold animations
    return {
      prefersReducedMotion: false,
      isMobile: false,
      duration: { fast: 0.15, normal: 0.3, slow: 0.5 },
      staggerDelay: 0.08,
      springConfig: { stiffness: 400, damping: 17 },
      easeOut: [0.22, 1, 0.36, 1] as CubicBezier,
    };
  }, [prefersReducedMotion, isMobile]);

  return (
    <MotionContext.Provider value={value}>
      <MotionConfig reducedMotion={prefersReducedMotion ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </MotionContext.Provider>
  );
}
