'use client';

// WARNING: AnimatePresence has caused React hooks error #310 during fast navigation.
// If crashes return, remove this component from layout.tsx and use {children} directly.
// See commit history for the stable non-AnimatePresence version.

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useMotionConfig } from '@/components/motion-provider';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { duration, easeOut, prefersReducedMotion } = useMotionConfig();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={pageVariants}
        transition={{ 
          duration: prefersReducedMotion ? 0 : duration.normal, 
          ease: easeOut 
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
