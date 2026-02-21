'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, GraduationCap, Clock, Megaphone, 
  ChevronDown, ChevronRight, User, Sparkles, Heart, Target
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Application } from '@/types';

// =============================================================================
// Types
// =============================================================================

interface ApplicationDetailModalProps {
  application: Application | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// Animation variants
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

const collapseVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { 
    opacity: 1, 
    height: 'auto',
    transition: { duration: 0.2 }
  }
};

// =============================================================================
// Helper functions
// =============================================================================

function getStatusStyle(status: Application['status']) {
  switch (status) {
    case 'accepted':
      return {
        label: 'Accepted',
        className: 'border-green-500 text-green-600 bg-transparent dark:text-green-400',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        className: 'border-red-500 text-red-600 bg-transparent dark:text-red-400',
      };
    case 'pending':
    default:
      return {
        label: 'Pending',
        className: 'border-yellow-500 text-yellow-600 bg-transparent dark:text-yellow-400',
      };
  }
}

function formatDate(dateString: string): string {
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
}

// =============================================================================
// Collapsible Section Component
// =============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, icon, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors w-full py-1"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {icon}
        <span>{title}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={collapseVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="overflow-hidden pl-6"
          >
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function ApplicationDetailModal({ application, open, onOpenChange }: ApplicationDetailModalProps) {
  if (!application) return null;

  const statusStyle = getStatusStyle(application.status);
  const fullName = `${application.biodata.firstName} ${application.biodata.lastName}`;
  const location = [
    application.location.city,
    application.location.state,
    application.location.country,
  ].filter(Boolean).join(', ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {open && (
            <motion.div
              key={application.id}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <DialogHeader className="space-y-3">
                {/* Status badge */}
                <motion.div 
                  variants={itemVariants}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                    statusStyle.className
                  )}>
                    {statusStyle.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Applied {formatDate(application.createdAt)}
                  </span>
                </motion.div>

                {/* Name */}
                <DialogTitle asChild>
                  <motion.h2 
                    variants={itemVariants}
                    className="text-xl font-semibold leading-tight capitalize"
                  >
                    {fullName}
                  </motion.h2>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Quick info */}
                <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {/* Location */}
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    <span>{location}</span>
                  </div>
                  
                  {/* Institution */}
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4" />
                    <span>{application.professional.institution}</span>
                  </div>

                  {/* Hours */}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>{application.intro.numberOfHours} hrs/week</span>
                  </div>

                  {/* Found from */}
                  <div className="flex items-center gap-1.5">
                    <Megaphone className="h-4 w-4" />
                    <span>{application.foundFrom}</span>
                  </div>
                </motion.div>

                <Separator />

                {/* Collapsible sections */}
                <motion.div variants={itemVariants} className="space-y-3">
                  {/* Introduction - open by default */}
                  <CollapsibleSection 
                    title="Introduction" 
                    icon={<User className="h-4 w-4 text-muted-foreground" />}
                    defaultOpen={true}
                  >
                    {application.intro.introduction || 'No introduction provided.'}
                  </CollapsibleSection>

                  {/* Skills */}
                  <CollapsibleSection 
                    title="Skills" 
                    icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
                  >
                    {application.professional.skills || 'No skills listed.'}
                  </CollapsibleSection>

                  {/* Why RDS */}
                  <CollapsibleSection 
                    title="Why RDS?" 
                    icon={<Target className="h-4 w-4 text-muted-foreground" />}
                  >
                    {application.intro.whyRds || 'No reason provided.'}
                  </CollapsibleSection>

                  {/* Fun Fact */}
                  <CollapsibleSection 
                    title="Fun Fact" 
                    icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
                  >
                    {application.intro.funFact || 'No fun fact provided.'}
                  </CollapsibleSection>

                  {/* For Fun */}
                  <CollapsibleSection 
                    title="For Fun" 
                    icon={<Heart className="h-4 w-4 text-muted-foreground" />}
                  >
                    {application.intro.forFun || 'Nothing listed.'}
                  </CollapsibleSection>
                </motion.div>

                {/* Feedback if available */}
                {application.feedback && (
                  <>
                    <Separator />
                    <motion.div variants={itemVariants} className="space-y-2">
                      <h3 className="text-sm font-medium">Feedback</h3>
                      <p className="text-sm text-muted-foreground">
                        {application.feedback}
                      </p>
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
