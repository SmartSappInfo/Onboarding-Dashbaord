'use client';

import * as React from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const CAMPAIGN_URL = '/school-visibility-and-enrollment-initiative';

// ─── Animated check — circle scales in, then the tick draws itself ───────────

function AnimatedCheck() {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 }}
      className="relative mx-auto flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center"
    >
      <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping [animation-iteration-count:3]" />
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_16px_40px_-12px_rgba(16,185,129,0.6)]" />
      <svg viewBox="0 0 52 52" className="relative h-12 w-12 sm:h-14 sm:w-14 text-white" fill="none">
        <motion.path
          d="M14 27 L22 35 L38 17"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.55, ease: 'easeOut' }}
        />
      </svg>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VisibilityThankYouClient() {
  // Confetti explosion on load — center burst plus two side cannons.
  React.useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const burst = (opts: confetti.Options) =>
      confetti({
        disableForReducedMotion: true,
        colors: ['#5f30e2', '#ffc629', '#10b981', '#3B5FFF', '#e63946'],
        ...opts,
      });

    burst({ particleCount: 160, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.55 } });
    const sides = setTimeout(() => {
      burst({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
      burst({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
    }, 350);

    return () => clearTimeout(sides);
  }, []);

  return (
    <div className="light min-h-screen bg-white font-body text-slate-900 flex flex-col selection:bg-primary/10">
      {/* Soft background glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-400/10 rounded-full blur-[120px]" />
        <div className="absolute top-[30%] -right-[10%] w-[35%] h-[35%] bg-primary/10 rounded-full blur-[110px]" />
        <div className="absolute -bottom-[15%] left-[25%] w-[45%] h-[45%] bg-[#ffc629]/10 rounded-full blur-[140px]" />
      </div>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-2xl text-center space-y-6 sm:space-y-8"
        >
          <AnimatedCheck />

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight text-slate-900 max-w-xl mx-auto">
            Congratulations! Your School has secured a seat on the{' '}
            <span className="text-emerald-600">School Visibility &amp; Enrollment Initiative</span>
          </h1>

          <div className="space-y-3">
            <p className="text-base sm:text-xl text-slate-600 font-medium">
              A team member will reach out to you shortly for your next steps.
            </p>
            <p className="text-sm sm:text-base text-slate-400 font-semibold italic">
              Congratulations once again!
            </p>
          </div>

          <div className="pt-2 sm:pt-4">
            <Button
              size="lg"
              className="w-full sm:w-auto h-14 sm:h-16 px-10 rounded-2xl bg-primary text-white text-base sm:text-lg font-bold shadow-[0_12px_24px_-8px_rgba(59,95,255,0.4)] hover:shadow-[0_16px_32px_-8px_rgba(59,95,255,0.5)] hover:-translate-y-0.5 transition-all duration-300 group"
              asChild
            >
              <Link href={CAMPAIGN_URL} className="flex items-center justify-center gap-2">
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                Go Back
              </Link>
            </Button>
          </div>
        </motion.div>
      </main>

      <footer className="relative z-10 py-8 px-6 text-center">
        <p className="text-slate-400 text-sm">
          &copy; {new Date().getFullYear()} SmartSapp. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
