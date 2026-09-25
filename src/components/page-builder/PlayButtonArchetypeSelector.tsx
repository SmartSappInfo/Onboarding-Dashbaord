'use client';

/**
 * @fileOverview PlayButtonArchetypeSelector — Visual Play Button Style Selector
 *
 * Displays 4 distinct motion & play trigger archetypes with live visual wireframes:
 * 1. Radar Pulse (Concentric expanding waves + glowing disc)
 * 2. Glassmorphic Pill (Frosted pill with "Watch Demo ▶")
 * 3. Minimal Bottom Badge (Discreet corner badge)
 * 4. Classic Disc (Standard centered disc)
 *
 * Standards:
 * - Minimum 44px touch targets (min-h-[58px]).
 * - ARIA radiogroup and radio semantics with roving tabindex and DOM focus movement via buttonRefs.
 * - Tactile micro-interactions (active:scale-[0.97], 150-200ms transitions).
 * - Strict typing with zero any.
 */

import React, { useRef } from 'react';
import { Play, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VideoPlayButtonArchetype } from '@/lib/page-builder/blocks/video';

export interface PlayButtonOption {
  value: string;
  label: string;
}

export interface PlayButtonArchetypeSelectorProps {
  value?: string;
  options: ReadonlyArray<PlayButtonOption>;
  onChange: (value: VideoPlayButtonArchetype) => void;
  className?: string;
}

/**
 * Renders miniature wireframes for play button trigger styles.
 */
function renderPlayButtonMiniature(archetypeKey: string) {
  switch (archetypeKey) {
    case 'pulse':
      return (
        <div className="w-full h-8 bg-slate-950 rounded flex items-center justify-center relative overflow-hidden">
          <div className="absolute w-6 h-6 rounded-full bg-blue-500/35 animate-ping pointer-events-none motion-reduce:hidden" />
          <div className="absolute w-4 h-4 rounded-full bg-blue-500/20 animate-pulse pointer-events-none" />
          <div className="relative w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
          </div>
        </div>
      );

    case 'glass-pill':
      return (
        <div className="w-full h-8 bg-slate-950 rounded flex items-center justify-center p-1 overflow-hidden">
          <div className="px-2 py-1 rounded-full bg-white/15 dark:bg-white/10 backdrop-blur-xs border border-white/20 flex items-center gap-1 shadow-xs">
            <Play className="w-2 h-2 text-white fill-current" />
            <span className="text-[8px] font-bold text-white tracking-tight leading-none whitespace-nowrap">Watch Demo</span>
          </div>
        </div>
      );

    case 'minimal-badge':
      return (
        <div className="w-full h-8 bg-slate-950 rounded relative p-1 overflow-hidden">
          <div className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded-sm bg-black/80 border border-white/20 flex items-center gap-0.5">
            <Play className="w-1.5 h-1.5 text-white fill-current" />
            <span className="text-[7px] font-bold text-white/90">2 min</span>
          </div>
        </div>
      );

    case 'standard':
    default:
      return (
        <div className="w-full h-8 bg-slate-950 rounded flex items-center justify-center overflow-hidden">
          <div className="w-5 h-5 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-xs">
            <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
          </div>
        </div>
      );
  }
}

export function PlayButtonArchetypeSelector({
  value,
  options,
  onChange,
  className,
}: PlayButtonArchetypeSelectorProps) {
  const currentVal = value || options[0]?.value;
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectStyle = (key: string, idx?: number) => {
    onChange(key as VideoPlayButtonArchetype);
    if (typeof idx === 'number' && buttonRefs.current[idx]) {
      buttonRefs.current[idx]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      selectStyle(options[currentIndex].value, currentIndex);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (currentIndex + 1) % options.length;
      selectStyle(options[nextIdx].value, nextIdx);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (currentIndex - 1 + options.length) % options.length;
      selectStyle(options[prevIdx].value, prevIdx);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Play Button Style"
      className={cn("grid grid-cols-2 gap-2 w-full select-none", className)}
    >
      {options.map((opt, idx) => {
        const isSelected = currentVal === opt.value;

        return (
          <button
            key={opt.value}
            ref={(el) => { buttonRefs.current[idx] = el; }}
            type="button"
            role="radio"
            aria-label={opt.label}
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => selectStyle(opt.value, idx)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "group relative flex flex-col p-1.5 rounded-xl border text-left transition-all duration-200 cursor-pointer outline-none min-h-[58px]",
              "active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-primary/[0.04] dark:bg-primary/[0.1] border-primary shadow-xs ring-1 ring-primary/40"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-850/60"
            )}
          >
            {/* Miniature Wireframe View */}
            <div className="relative w-full rounded-md overflow-hidden mb-1">
              {renderPlayButtonMiniature(opt.value)}

              {/* Selected Checkmark Badge */}
              {isSelected && (
                <div className="absolute top-1 right-1 p-0.5 rounded-full bg-primary text-white shadow-sm animate-in zoom-in-75 duration-150 z-20">
                  <CheckCircle2 className="w-2.5 h-2.5 text-white fill-current" />
                </div>
              )}
            </div>

            {/* Archetype Label */}
            <div className="px-0.5 w-full">
              <span
                className={cn(
                  "text-[10px] font-bold leading-tight block truncate",
                  isSelected
                    ? "text-primary dark:text-primary font-black"
                    : "text-slate-800 dark:text-slate-200 group-hover:text-foreground"
                )}
                title={opt.label}
              >
                {opt.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
