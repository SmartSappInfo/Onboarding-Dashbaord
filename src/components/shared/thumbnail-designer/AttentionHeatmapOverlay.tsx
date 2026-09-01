'use client';

/**
 * ARCHITECTURE:
 * Interactive Attention Heatmap Overlay (Phase 4 - Creative Intelligence)
 * 
 * Renders visual gaze/saliency intensity hotspots over the design canvas using SVG radial gradients.
 * Equipped with `pointer-events-none` to guarantee zero interference with canvas selection or dragging.
 * 
 * CAUTION:
 * Never attach pointer event listeners to this overlay.
 * Strict typing (0% any).
 */

import * as React from 'react';
import type { SaliencyHotspot } from '@/lib/creative/creative-types';

interface AttentionHeatmapOverlayProps {
  visible: boolean;
  hotspots: SaliencyHotspot[];
}

export function AttentionHeatmapOverlay({ visible, hotspots }: AttentionHeatmapOverlayProps) {
  if (!visible || hotspots.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden rounded-inherit animate-in fade-in duration-300">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {hotspots.map((spot, idx) => (
            <radialGradient
              key={`grad-${idx}`}
              id={`saliency-heat-${idx}`}
              cx={`${spot.x}%`}
              cy={`${spot.y}%`}
              r={`${spot.radius}%`}
              fx={`${spot.x}%`}
              fy={`${spot.y}%`}
            >
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8 * spot.weight} />
              <stop offset="40%" stopColor="#f59e0b" stopOpacity={0.55 * spot.weight} />
              <stop offset="70%" stopColor="#06b6d4" stopOpacity={0.25 * spot.weight} />
              <stop offset="100%" stopColor="#000000" stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>

        {/* Global Darkened Saliency Mask */}
        <rect width="100%" height="100%" fill="rgba(15, 23, 42, 0.45)" />

        {/* Render Hotspot Blooms */}
        {hotspots.map((spot, idx) => (
          <circle
            key={`circle-${idx}`}
            cx={`${spot.x}%`}
            cy={`${spot.y}%`}
            r={`${spot.radius * 1.5}%`}
            fill={`url(#saliency-heat-${idx})`}
            style={{ mixBlendMode: 'screen' }}
          />
        ))}
      </svg>

      {/* Heatmap Legend Badge */}
      <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 backdrop-blur-md flex items-center gap-2 text-[10px] font-bold text-white shadow-xl">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
        <span>Attention Heatmap</span>
        <div className="flex items-center gap-1 font-mono text-[9px] text-slate-400 pl-1 border-l border-slate-800">
          <span className="text-red-400">High</span>
          <span>•</span>
          <span className="text-amber-400">Med</span>
          <span>•</span>
          <span className="text-cyan-400">Low</span>
        </div>
      </div>
    </div>
  );
}
