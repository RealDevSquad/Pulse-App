'use client';

import { motion } from 'framer-motion';
import { useMotionConfig } from '@/components/motion-provider';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0 },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  const { duration, easeOut, prefersReducedMotion } = useMotionConfig();

  // Simple fade-in animation without AnimatePresence
  // This avoids the hooks count issue during fast navigation
  return (
    <motion.div
      initial="initial"
      animate="enter"
      variants={pageVariants}
      transition={{ 
        duration: prefersReducedMotion ? 0 : duration.normal, 
        ease: easeOut 
      }}
    >
      {children}
    </motion.div>
  );
}
