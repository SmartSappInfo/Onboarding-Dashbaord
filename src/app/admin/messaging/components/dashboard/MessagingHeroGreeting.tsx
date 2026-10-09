'use client';

/**
 * @fileOverview SmartSapp Messaging Dashboard — Hero Greeting Banner
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Visual flagship card matching user mockup (media_1791516336748_2f0e908d.jpg).
 * - Hydration-safe time-of-day greeting ("Good morning / afternoon / evening, [First Name] 👋").
 * - Dynamic workspace terminology injection via useTerminology() (Rule 3).
 * - Interactive glassmorphic AI prompt bar trigger.
 * - Mobile ergonomics: Stacks cleanly on mobile viewports (< 768px) with min-h-[44px] touch targets.
 * - Theme adaptability: Institutional gradient in light mode; deep slate/indigo accent in dark mode.
 * - Strict Zero-Any Invariant (Rule 4).
 */

import * as React from 'react';
import { Bot, ArrowRight } from 'lucide-react';
import { useUser } from '@/firebase';
import { useTerminology } from '@/hooks/use-terminology';
import {
  formatGreetingHeadline,
  buildHeroSubtitle,
  extractFirstName,
} from '@/lib/messaging/greeting-utils';
import { MessagingAiPromptModal } from './MessagingAiPromptModal';
import { cn } from '@/lib/utils';

export interface MessagingHeroGreetingProps {
  userDisplayName?: string | null;
  className?: string;
  onOpenAiPrompt?: () => void;
}

export function MessagingHeroGreeting({
  userDisplayName,
  className,
  onOpenAiPrompt,
}: MessagingHeroGreetingProps) {
  const { user } = useUser();
  const terminology = useTerminology();
  const [mounted, setMounted] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Prevent SSR hydration mismatch for timezone-dependent greeting
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const activeName = userDisplayName ?? user?.displayName ?? null;
  const headline = mounted
    ? formatGreetingHeadline(activeName)
    : `Welcome, ${extractFirstName(activeName)} 👋`;

  const subtitle = buildHeroSubtitle(terminology?.singular);

  const handlePillClick = () => {
    if (onOpenAiPrompt) {
      onOpenAiPrompt();
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <div
        className={cn(
          // Gradient container: Royal blue to deep indigo in light mode; rich dark slate in dark mode
          'relative overflow-hidden rounded-2xl sm:rounded-3xl',
          'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 dark:from-slate-900 dark:via-blue-950/60 dark:to-slate-900',
          'border border-blue-500/20 dark:border-blue-800/40 shadow-xl dark:shadow-2xl',
          'p-6 sm:p-7 md:p-8 text-white',
          className
        )}
      >
        {/* Subtle decorative background ambient glow */}
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 dark:bg-blue-500/10 blur-3xl pointer-events-none"
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5 lg:gap-8">
          {/* Left Text Block */}
          <div className="space-y-1.5 max-w-xl">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              {headline}
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 dark:text-blue-200/80 leading-relaxed font-normal">
              {subtitle}
            </p>
          </div>

          {/* Right AI Prompt Bar Pill */}
          <div className="shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={handlePillClick}
              aria-label="Ask AI to draft a message, find contacts, or analyze campaign results"
              className={cn(
                'w-full md:w-auto inline-flex items-center justify-between gap-3',
                'px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-full',
                'bg-white/10 hover:bg-white/15 dark:bg-white/5 dark:hover:bg-white/10',
                'border border-white/20 dark:border-white/10',
                'backdrop-blur-md shadow-inner text-white',
                'transition-all duration-200 cursor-pointer',
                'active:scale-[0.98] min-h-[44px] group'
              )}
            >
              {/* Bot Icon */}
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-white/20 dark:bg-blue-500/30 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                <Bot className="h-4 w-4" />
              </div>

              {/* Middle Prompt Snippet */}
              <span className="text-xs sm:text-sm text-white/90 dark:text-white/80 font-normal truncate max-w-[210px] sm:max-w-xs md:max-w-[260px] lg:max-w-sm text-left">
                Ask AI to draft a message, find {terminology?.plural ? terminology.plural.toLowerCase() : 'contacts'}, or analyze results...
              </span>

              {/* Arrow Circle Button */}
              <div className="h-7 w-7 rounded-full bg-blue-500 group-hover:bg-blue-400 dark:bg-blue-600 dark:group-hover:bg-blue-500 flex items-center justify-center text-white shrink-0 shadow-sm transition-all group-hover:translate-x-0.5">
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* AI Assistant Modal */}
      <MessagingAiPromptModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        entityTermSingular={terminology?.singular}
        entityTermPlural={terminology?.plural}
      />
    </>
  );
}
