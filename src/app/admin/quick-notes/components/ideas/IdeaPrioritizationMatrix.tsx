'use client';

import * as React from 'react';
import {
  type Idea,
  type IceQuadrantType,
} from '@/lib/quick-notes-types';
import {
  getIceQuadrant,
  getLifecycleStageDisplayLabel,
  getValidationStatusDisplayLabel,
} from '@/lib/quick-notes-domain';
import {
  TrendingUp,
  Zap,
  Target,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface IdeaPrioritizationMatrixProps {
  ideas: Idea[];
  onSelectIdea: (idea: Idea) => void;
}

export function IdeaPrioritizationMatrix({
  ideas,
  onSelectIdea,
}: IdeaPrioritizationMatrixProps) {
  const [selectedQuadrant, setSelectedQuadrant] = React.useState<IceQuadrantType | 'all'>('all');
  const [_hoveredIdea, _setHoveredIdea] = React.useState<Idea | null>(null);

  // Group ideas into 4 quadrants
  const quadrantData = React.useMemo(() => {
    const map = {
      quick_wins: [] as Idea[],
      strategic_bets: [] as Idea[],
      fill_ins: [] as Idea[],
      hard_slogs: [] as Idea[],
    };

    ideas.forEach((idea) => {
      const q = getIceQuadrant(idea.impact, idea.effort);
      map[q].push(idea);
    });

    return map;
  }, [ideas]);

  // Ranked ideas by ICE score
  const rankedIdeas = React.useMemo(() => {
    return [...ideas].sort((a, b) => (b.iceScore || 0) - (a.iceScore || 0));
  }, [ideas]);

  return (
    <div className="space-y-6">
      {/* 2D Interactive Quadrant Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quadrant 1: Quick Wins (Top-Left: High Impact, Low Effort) */}
        <div
          onClick={() => setSelectedQuadrant(selectedQuadrant === 'quick_wins' ? 'all' : 'quick_wins')}
          className={`flex flex-col justify-between rounded-2xl border p-4.5 transition-all cursor-pointer ${
            selectedQuadrant === 'quick_wins' || selectedQuadrant === 'all'
              ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-950/15 shadow-sm'
              : 'opacity-50 border-border bg-muted/20'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Quick Wins
                </h3>
                <p className="text-[10px] text-muted-foreground">High Impact (≥6) • Low Effort (≤5)</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              {quadrantData.quick_wins.length} Ideas
            </Badge>
          </div>

          <div className="space-y-2 py-3 min-h-[140px] max-h-[220px] overflow-y-auto">
            {quadrantData.quick_wins.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">No quick win ideas</p>
            ) : (
              quadrantData.quick_wins.map((idea) => (
                <div
                  key={idea.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectIdea(idea);
                  }}
                  className="flex items-center justify-between p-2 rounded-xl bg-background/80 hover:bg-background border border-border/50 hover:border-emerald-500/40 transition-all shadow-xs active:scale-[0.98]"
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-bold text-foreground truncate">{idea.title}</h4>
                    <p className="text-[10px] text-muted-foreground">
                      Impact: {idea.impact}/10 • Effort: {idea.effort}/10
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    ICE {idea.iceScore}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quadrant 2: Strategic Bets (Top-Right: High Impact, High Effort) */}
        <div
          onClick={() => setSelectedQuadrant(selectedQuadrant === 'strategic_bets' ? 'all' : 'strategic_bets')}
          className={`flex flex-col justify-between rounded-2xl border p-4.5 transition-all cursor-pointer ${
            selectedQuadrant === 'strategic_bets' || selectedQuadrant === 'all'
              ? 'border-purple-500/50 bg-purple-500/5 dark:bg-purple-950/15 shadow-sm'
              : 'opacity-50 border-border bg-muted/20'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400">
                <Target className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-purple-700 dark:text-purple-300">
                  Strategic Bets
                </h3>
                <p className="text-[10px] text-muted-foreground">High Impact (≥6) • High Effort (≥6)</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
              {quadrantData.strategic_bets.length} Ideas
            </Badge>
          </div>

          <div className="space-y-2 py-3 min-h-[140px] max-h-[220px] overflow-y-auto">
            {quadrantData.strategic_bets.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">No strategic bets</p>
            ) : (
              quadrantData.strategic_bets.map((idea) => (
                <div
                  key={idea.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectIdea(idea);
                  }}
                  className="flex items-center justify-between p-2 rounded-xl bg-background/80 hover:bg-background border border-border/50 hover:border-purple-500/40 transition-all shadow-xs active:scale-[0.98]"
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-bold text-foreground truncate">{idea.title}</h4>
                    <p className="text-[10px] text-muted-foreground">
                      Impact: {idea.impact}/10 • Effort: {idea.effort}/10
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300">
                    ICE {idea.iceScore}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quadrant 3: Fill-ins / Low Hanging Fruit (Bottom-Left: Low Impact, Low Effort) */}
        <div
          onClick={() => setSelectedQuadrant(selectedQuadrant === 'fill_ins' ? 'all' : 'fill_ins')}
          className={`flex flex-col justify-between rounded-2xl border p-4.5 transition-all cursor-pointer ${
            selectedQuadrant === 'fill_ins' || selectedQuadrant === 'all'
              ? 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-950/15 shadow-sm'
              : 'opacity-50 border-border bg-muted/20'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  Fill-ins / Low Hanging Fruit
                </h3>
                <p className="text-[10px] text-muted-foreground">Low Impact (≤5) • Low Effort (≤5)</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
              {quadrantData.fill_ins.length} Ideas
            </Badge>
          </div>

          <div className="space-y-2 py-3 min-h-[140px] max-h-[220px] overflow-y-auto">
            {quadrantData.fill_ins.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">No fill-in ideas</p>
            ) : (
              quadrantData.fill_ins.map((idea) => (
                <div
                  key={idea.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectIdea(idea);
                  }}
                  className="flex items-center justify-between p-2 rounded-xl bg-background/80 hover:bg-background border border-border/50 hover:border-amber-500/40 transition-all shadow-xs active:scale-[0.98]"
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-bold text-foreground truncate">{idea.title}</h4>
                    <p className="text-[10px] text-muted-foreground">
                      Impact: {idea.impact}/10 • Effort: {idea.effort}/10
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    ICE {idea.iceScore}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quadrant 4: Hard Slogs / Re-evaluate (Bottom-Right: Low Impact, High Effort) */}
        <div
          onClick={() => setSelectedQuadrant(selectedQuadrant === 'hard_slogs' ? 'all' : 'hard_slogs')}
          className={`flex flex-col justify-between rounded-2xl border p-4.5 transition-all cursor-pointer ${
            selectedQuadrant === 'hard_slogs' || selectedQuadrant === 'all'
              ? 'border-slate-500/50 bg-slate-500/5 dark:bg-slate-950/15 shadow-sm'
              : 'opacity-50 border-border bg-muted/20'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-500/20">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-500/20 text-slate-600 dark:text-slate-400">
                <AlertCircle className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Hard Slogs / Re-evaluate
                </h3>
                <p className="text-[10px] text-muted-foreground">Low Impact (≤5) • High Effort (≥6)</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/30">
              {quadrantData.hard_slogs.length} Ideas
            </Badge>
          </div>

          <div className="space-y-2 py-3 min-h-[140px] max-h-[220px] overflow-y-auto">
            {quadrantData.hard_slogs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">No hard slogs</p>
            ) : (
              quadrantData.hard_slogs.map((idea) => (
                <div
                  key={idea.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectIdea(idea);
                  }}
                  className="flex items-center justify-between p-2 rounded-xl bg-background/80 hover:bg-background border border-border/50 hover:border-slate-500/40 transition-all shadow-xs active:scale-[0.98]"
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-bold text-foreground truncate">{idea.title}</h4>
                    <p className="text-[10px] text-muted-foreground">
                      Impact: {idea.impact}/10 • Effort: {idea.effort}/10
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-700 dark:text-slate-300">
                    ICE {idea.iceScore}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Prioritized Ranked Leaderboard Table */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              ICE Prioritization Leaderboard
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Ranked by (Impact × Confidence) / Effort
          </span>
        </div>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/30 text-[11px] text-muted-foreground">
                <th className="py-2.5 font-bold">Rank</th>
                <th className="py-2.5 font-bold">Idea Title</th>
                <th className="py-2.5 font-bold">Stage</th>
                <th className="py-2.5 font-bold">Validation</th>
                <th className="py-2.5 font-bold text-center">Impact</th>
                <th className="py-2.5 font-bold text-center">Effort</th>
                <th className="py-2.5 font-bold text-center">Confidence</th>
                <th className="py-2.5 font-bold text-right">ICE Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {rankedIdeas.map((idea, idx) => {
                const { label: stageLabel, badgeBg } = getLifecycleStageDisplayLabel(idea.lifecycleStage);
                const { badgeClass } = getValidationStatusDisplayLabel(idea.validationStatus);

                return (
                  <tr
                    key={idea.id}
                    onClick={() => onSelectIdea(idea)}
                    className="hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 font-extrabold text-muted-foreground">#{idx + 1}</td>
                    <td className="py-3 font-bold text-foreground max-w-[280px] truncate">
                      {idea.title}
                    </td>
                    <td className="py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeBg}`}>
                        {stageLabel}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badgeClass}`}>
                        {idea.validationStatus}
                      </span>
                    </td>
                    <td className="py-3 text-center font-semibold text-foreground">{idea.impact}/10</td>
                    <td className="py-3 text-center font-semibold text-foreground">{idea.effort}/10</td>
                    <td className="py-3 text-center font-semibold text-foreground">{idea.confidence}/10</td>
                    <td className="py-3 text-right font-extrabold text-primary text-sm">
                      {idea.iceScore}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
