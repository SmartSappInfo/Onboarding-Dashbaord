'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Memoized SVG Background Pattern
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Isolated SVG Pattern Namespaces: Uses `idPrefix` to prevent DOM collision across nested frames/previews.
 * 2. High-Performance Memoization: Pure functional SVG rendering without layout thrashing.
 * 3. Supports all 7 archetypes: none, dots, grid, circuit, topography, cubes, gradient.
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { Survey } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface BackgroundPatternProps {
  pattern?: Survey['backgroundPattern'] | string;
  color?: string;
  idPrefix?: string;
  className?: string;
}

export function BackgroundPattern({
  pattern = 'none',
  color = '#3B82F6',
  idPrefix = 'survey-pat',
  className,
}: BackgroundPatternProps): React.JSX.Element | null {
  if (!pattern || pattern === 'none') return null;

  if (pattern === 'gradient') {
    return (
      <div
        className={cn(
          'absolute inset-0 pointer-events-none opacity-20 transition-opacity duration-500',
          className
        )}
        style={{
          background: `radial-gradient(circle at 50% 30%, ${color}33 0%, transparent 70%)`,
        }}
      />
    );
  }

  const patternId = `${idPrefix}-${pattern}`;

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none transition-opacity duration-500 overflow-hidden',
        className || 'opacity-20'
      )}
      style={{ color }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          {pattern === 'dots' && (
            <pattern id={patternId} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="currentColor" opacity="0.4" />
            </pattern>
          )}

          {pattern === 'grid' && (
            <pattern id={patternId} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
            </pattern>
          )}

          {pattern === 'circuit' && (
            <pattern id={patternId} x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <path
                d="M 0 40 H 40 V 80 M 40 40 L 80 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.3"
              />
              <circle cx="40" cy="40" r="3.5" fill="currentColor" opacity="0.4" />
              <circle cx="0" cy="40" r="2" fill="currentColor" opacity="0.3" />
            </pattern>
          )}

          {pattern === 'topography' && (
            <pattern id={patternId} x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <path
                d="M 0 50 Q 25 25, 50 50 T 100 50 M 0 75 Q 25 50, 50 75 T 100 75 M 0 25 Q 25 0, 50 25 T 100 25"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.3"
              />
            </pattern>
          )}

          {pattern === 'cubes' && (
            <pattern id={patternId} x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <path
                d="M 24 0 L 48 12 L 24 24 L 0 12 Z M 0 12 L 0 36 L 24 48 L 24 24 Z M 48 12 L 48 36 L 24 48"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                opacity="0.3"
              />
            </pattern>
          )}
        </defs>

        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
