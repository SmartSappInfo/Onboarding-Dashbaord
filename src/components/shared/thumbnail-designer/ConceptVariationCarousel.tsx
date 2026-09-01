'use client';

/**
 * ARCHITECTURE:
 * Multi-Concept Variation Matrix & Carousel Component (Phase 3 - AI Creative Director)
 * 
 * Renders structured strategic concept cards (Growth, Problem/Pain, Curiosity)
 * with predicted CTR scores, emotional triggers, and one-click apply actions.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import type { CreativeConcept } from '@/lib/creative/creative-types';
import ThumbnailCanvas from './ThumbnailCanvas';
import { Button } from '@/components/ui/button';
import { Sparkles, Check, TrendingUp, AlertTriangle, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConceptVariationCarouselProps {
  concepts: CreativeConcept[];
  onApplyConcept: (concept: CreativeConcept) => void;
  activeConceptId?: string;
}

export function ConceptVariationCarousel({
  concepts,
  onApplyConcept,
  activeConceptId,
}: ConceptVariationCarouselProps) {
  if (!concepts || concepts.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 border border-slate-850 rounded-2xl bg-slate-900/20">
        No AI concepts generated yet. Enter a topic or prompt to generate strategic compositions.
      </div>
    );
  }

  const getAngleIcon = (angle?: string) => {
    switch (angle) {
      case 'growth':
        return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
      case 'problem_pain':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
      case 'curiosity':
      default:
        return <Eye className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
      {concepts.map((concept) => {
        const isSelected = activeConceptId === concept.id;
        const elements = concept.elements || concept.documentData?.elements || [];
        const bgGrad = concept.backgroundGradient || concept.documentData?.backgroundGradient;
        const bgColor = concept.backgroundColor || concept.documentData?.backgroundColor || '#0f172a';

        return (
          <div
            key={concept.id}
            className={cn(
              'p-4 rounded-3xl border transition-all flex flex-col justify-between space-y-3 bg-slate-900/60 shadow-xl',
              isSelected ? 'border-emerald-500/60 ring-2 ring-emerald-500/20' : 'border-slate-800 hover:border-slate-700'
            )}
          >
            {/* Header & Score */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  {getAngleIcon(concept.angle)}
                  <span className="truncate">{concept.name}</span>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black font-mono">
                  {concept.predictedCTRScore || concept.healthScore}/100 CTR
                </div>
              </div>

              <div className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {concept.strategy}
              </div>
            </div>

            {/* Visual Canvas Preview Thumbnail */}
            <div className="aspect-video w-full rounded-2xl overflow-hidden relative shadow-lg bg-slate-950 border border-slate-800/80">
              <ThumbnailCanvas
                backgroundColor={bgColor}
                backgroundGradient={bgGrad}
                elements={elements}
                selectedId={null}
                onSelectElement={() => {}}
                onUpdateElement={() => {}}
                onDeleteElement={() => {}}
                zoomPercent={100}
                panX={0}
                panY={0}
                onPanChange={() => {}}
              />
            </div>

            {/* Emotional Trigger & Color Mood */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-semibold">Trigger:</span>
                <span className="text-slate-300 font-bold truncate max-w-[160px]">{concept.emotionalTrigger}</span>
              </div>

              {concept.colorMood && concept.colorMood.length > 0 && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-semibold">Mood:</span>
                  <div className="flex gap-1">
                    {concept.colorMood.map((c, i) => (
                      <span
                        key={i}
                        style={{ backgroundColor: c }}
                        className="w-3.5 h-3.5 rounded-full border border-slate-700 shadow-sm"
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Apply Action Button */}
              <Button
                onClick={() => onApplyConcept(concept)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-slate-950 font-black text-xs h-9 rounded-xl shadow-lg shadow-emerald-500/10 min-h-[36px]"
              >
                {isSelected ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5" /> Active Canvas
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Apply Concept
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
