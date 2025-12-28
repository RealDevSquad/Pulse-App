'use client';

import type { Variants } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';

import { cn } from '@/lib/utils';

export interface FolderOpenIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface FolderOpenIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  animateOnMount?: boolean;
}

const VARIANTS: Variants = {
  normal: { rotate: 0 },
  animate: {
    rotate: [0, -8, 6, -4, 0],
    transition: {
      ease: 'easeInOut',
      rotate: {
        duration: 0.6,
      },
    },
  },
};

const FolderOpenIcon = forwardRef<FolderOpenIconHandle, FolderOpenIconProps>(
  ({ className, size = 28, animateOnMount = false, ...props }, ref) => {
    const controls = useAnimation();

    // Animate once on mount if animateOnMount is true
    useEffect(() => {
      if (animateOnMount) {
        controls.start('animate');
      }
    }, [animateOnMount, controls]);

    return (
      <div
        className={cn('inline-flex', className)}
        {...props}
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            variants={VARIANTS}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 12px' }}
            d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"
          />
        </motion.svg>
      </div>
    );
  }
);

FolderOpenIcon.displayName = 'FolderOpenIcon';

export { FolderOpenIcon };
