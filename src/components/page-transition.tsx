'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useMotionConfig } from '@/components/motion-provider';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const noMotionVariants = {
  initial: { opacity: 1, y: 0 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 1, y: 0 },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { duration, easeOut, prefersReducedMotion } = useMotionConfig();

  // Always render AnimatePresence to maintain consistent hook count
  // Use no-op variants when reduced motion is preferred
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={prefersReducedMotion ? noMotionVariants : pageVariants}
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
