'use client';

import { motion, type Variants, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useMotionConfig } from '@/components/motion-provider';
import { cn } from '@/lib/utils';

// ============================================================================
// Animation Variants
// ============================================================================

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0 },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0 },
};

export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 15 }
  },
};

// ============================================================================
// Reusable Components
// ============================================================================

interface MotionComponentProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

/**
 * FadeIn - Animates children with fade + slide up effect
 */
export function FadeIn({ children, className, delay = 0 }: MotionComponentProps) {
  const { duration, easeOut, prefersReducedMotion } = useMotionConfig();
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
      transition={{ duration: duration.normal, delay, ease: easeOut }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * FadeInScale - Animates children with fade + scale effect
 */
export function FadeInScale({ children, className, delay = 0 }: MotionComponentProps) {
  const { duration, easeOut, prefersReducedMotion } = useMotionConfig();
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeInScale}
      transition={{ duration: duration.normal, delay, ease: easeOut }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerContainer - Container for staggered child animations
 */
export function StaggerContainer({ 
  children, 
  className,
  delay = 0,
}: MotionComponentProps) {
  const { staggerDelay, prefersReducedMotion } = useMotionConfig();
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: delay,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem - Individual item within a StaggerContainer
 */
export function StaggerItem({ children, className }: Omit<MotionComponentProps, 'delay'>) {
  const { duration, easeOut, prefersReducedMotion } = useMotionConfig();
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={fadeInUp}
      transition={{ duration: duration.normal, ease: easeOut }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * HoverLift - Adds hover lift + tap effect to children
 */
export function HoverLift({ 
  children, 
  className,
  lift = 4,
  scale = 1.02,
}: Omit<MotionComponentProps, 'delay'> & { lift?: number; scale?: number }) {
  const { springConfig, prefersReducedMotion } = useMotionConfig();
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      whileHover={{ y: -lift, scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', ...springConfig }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * SlideIn - Slide in from a direction
 */
export function SlideIn({ 
  children, 
  className,
  delay = 0,
  direction = 'left',
}: MotionComponentProps & { direction?: 'left' | 'right' | 'up' | 'down' }) {
  const { duration, easeOut, prefersReducedMotion } = useMotionConfig();
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const variants: Record<string, Variants> = {
    left: fadeInLeft,
    right: fadeInRight,
    up: fadeInUp,
    down: fadeInDown,
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants[direction]}
      transition={{ duration: duration.normal, delay, ease: easeOut }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * PopIn - Bouncy pop-in effect (great for badges, icons)
 */
export function PopIn({ children, className, delay = 0 }: MotionComponentProps) {
  const { prefersReducedMotion } = useMotionConfig();
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={popIn}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * AnimatedNumber - Animates a number counting up
 */
export function AnimatedNumber({ 
  value, 
  className,
  duration = 1.5,
}: { 
  value: number; 
  className?: string;
  duration?: number;
}) {
  const { prefersReducedMotion } = useMotionConfig();
  const [displayValue, setDisplayValue] = useState(0);
  
  const spring = useSpring(0, { 
    stiffness: 50, 
    damping: 20,
    duration: prefersReducedMotion ? 0 : duration * 1000,
  });
  
  const rounded = useTransform(spring, (latest) => Math.round(latest));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = rounded.on('change', (latest) => {
      setDisplayValue(latest);
    });
    return unsubscribe;
  }, [rounded]);

  if (prefersReducedMotion) {
    return <span className={className}>{value}</span>;
  }

  return <span className={className}>{displayValue}</span>;
}

/**
 * Collapse - Animated height collapse/expand
 */
export function Collapse({ 
  isOpen, 
  children,
  className,
}: { 
  isOpen: boolean; 
  children: React.ReactNode;
  className?: string;
}) {
  const { duration, easeOut, prefersReducedMotion } = useMotionConfig();

  if (prefersReducedMotion) {
    return isOpen ? <div className={className}>{children}</div> : null;
  }

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: duration.normal, ease: easeOut }}
          className={cn('overflow-hidden', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * TableRowMotion - Animated table row wrapper
 */
export function TableRowMotion({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  const { duration, staggerDelay, easeOut, prefersReducedMotion } = useMotionConfig();

  if (prefersReducedMotion) {
    return <tr className={className}>{children}</tr>;
  }

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ 
        duration: duration.normal, 
        delay: index * staggerDelay,
        ease: easeOut,
      }}
      className={className}
    >
      {children}
    </motion.tr>
  );
}

/**
 * NavItemMotion - Animated navigation item with hover effect
 */
export function NavItemMotion({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  const { duration, staggerDelay, springConfig, easeOut, prefersReducedMotion } = useMotionConfig();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ 
        duration: duration.fast, 
        delay: index * staggerDelay,
        ease: easeOut,
      }}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
