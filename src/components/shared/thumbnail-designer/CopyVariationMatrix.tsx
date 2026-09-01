'use client';

/**
 * ARCHITECTURE:
 * Headline & Copy Variation Generator Panel (Phase 3 - AI Creative Director)
 * 
 * Generates 5 psychological copy variants (Curiosity, FOMO, Data-driven, Direct Benefit, Contrarian)
 * with one-click direct application to canvas headline elements.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState } from 'react';
import type { CopyVariation } from '@/lib/creative/creative-types';
import { generateCopyVariationsAction } from '@/app/actions/creative-ai-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, ArrowRight, Check, Loader2, Zap, HelpCircle, AlertCircle, TrendingUp, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyVariationMatrixProps {
  initialTopic?: string;
  onApplyCopy: (headline: string, subtitle?: string, badge?: string) => void;
}

export function CopyVariationMatrix({ initialTopic = '', onApplyCopy }: CopyVariationMatrixProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [variations, setVariations] = useState<CopyVariation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim() || isLoading) return;

    setIsLoading(true);
    const res = await generateCopyVariationsAction(topic.trim());
    setIsLoading(false);

    if (res.success && res.data) {
      setVariations(res.data);
    }
  };

  const getHookBadge = (type: CopyVariation['hookType']) => {
    switch (type) {
      case 'curiosity':
        return { label: 'Curiosity Gap', icon: <HelpCircle className="w-3 h-3 text-cyan-400" />, color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' };
      case 'fear_of_missing_out':
        return { label: 'FOMO / Pain', icon: <AlertCircle className="w-3 h-3 text-rose-400" />, color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      case 'data_driven':
        return { label: 'Data & Proof', icon: <TrendingUp className="w-3 h-3 text-emerald-400" />, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'direct_benefit':
        return { label: 'Direct Benefit', icon: <Award className="w-3 h-3 text-amber-400" />, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'contrarian':
      default:
        return { label: 'Contrarian Hook', icon: <Zap className="w-3 h-3 text-purple-400" />, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Search / Topic Bar */}
      <form onSubmit={handleGenerate} className="flex gap-2">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic or narrative (e.g. Master School Admissions)..."
          className="h-10 bg-slate-900 border-slate-800 text-xs font-semibold text-white rounded-xl"
        />
        <Button
          type="submit"
          disabled={isLoading || !topic.trim()}
          className="h-10 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-slate-950 font-black text-xs rounded-xl shrink-0"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          Generate Hooks
        </Button>
      </form>

      {/* Variations List */}
      <div className="space-y-2.5">
        {variations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-slate-850 rounded-2xl bg-slate-900/20">
            Type a topic or seed phrase above to generate 5 high-CTR psychological copy formulas.
          </div>
        ) : (
          variations.map((v) => {
            const badge = getHookBadge(v.hookType);
            const isApplied = appliedId === v.id;

            return (
              <div
                key={v.id}
                className={cn(
                  'p-3.5 rounded-2xl border transition-all space-y-2 bg-slate-900/50',
                  isApplied ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-slate-800 hover:border-slate-700'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold', badge.color)}>
                    {badge.icon}
                    <span>{badge.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{v.predictedImpact}</span>
                </div>

                <div>
                  <div className="text-sm font-black text-white">{v.headline}</div>
                  {v.subtitle && <div className="text-xs text-slate-400 font-medium mt-0.5">{v.subtitle}</div>}
                </div>

                <div className="pt-1 flex items-center justify-between">
                  {v.badge && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-amber-400">
                      Badge: {v.badge}
                    </span>
                  )}
                  <Button
                    onClick={() => {
                      onApplyCopy(v.headline, v.subtitle, v.badge);
                      setAppliedId(v.id);
                    }}
                    size="sm"
                    className={cn(
                      'h-7 px-3 text-[11px] font-bold rounded-lg ml-auto',
                      isApplied ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    )}
                  >
                    {isApplied ? (
                      <>
                        <Check className="w-3 h-3 mr-1" /> Applied
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3 h-3 mr-1" /> Apply to Canvas
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
