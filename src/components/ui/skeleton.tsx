'use client';

import { motion } from 'framer-motion';
import { cn } from "@/lib/utils"
import { useMotionConfig } from '@/components/motion-provider';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

/**
 * SkeletonPulse - Enhanced skeleton with Framer Motion pulse animation
 * Smoother and more configurable than CSS-only version
 */
function SkeletonPulse({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const { prefersReducedMotion } = useMotionConfig();

  if (prefersReducedMotion) {
    return (
      <div
        className={cn("rounded-md bg-muted", className)}
        style={style}
      />
    );
  }

  return (
    <motion.div
      className={cn("rounded-md bg-muted", className)}
      style={style}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

/**
 * CardSkeleton - Skeleton for metric cards on dashboard
 */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-6 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <SkeletonPulse className="h-4 w-24" />
        <SkeletonPulse className="h-8 w-8 rounded-full" />
      </div>
      <SkeletonPulse className="h-10 w-16" />
    </div>
  );
}

/**
 * TableSkeleton - Skeleton for data tables
 */
function TableSkeleton({ 
  rows = 5, 
  columns = 4,
  className,
}: { 
  rows?: number; 
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border overflow-hidden", className)}>
      {/* Header */}
      <div className="border-b bg-muted/30 p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <SkeletonPulse key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {/* Rows */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4">
            <div className="flex items-center gap-4">
              <SkeletonPulse className="h-8 w-8 rounded-full shrink-0" />
              {Array.from({ length: columns - 1 }).map((_, colIndex) => (
                <SkeletonPulse 
                  key={colIndex} 
                  className="h-4 flex-1" 
                  style={{ maxWidth: colIndex === 0 ? '150px' : '100px' }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { Skeleton, SkeletonPulse, CardSkeleton, TableSkeleton }
