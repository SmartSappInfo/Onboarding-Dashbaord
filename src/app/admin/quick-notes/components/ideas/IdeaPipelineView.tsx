'use client';

import * as React from 'react';
import {
  type Idea,
  type IdeaLifecycleStage,
} from '@/lib/quick-notes-types';
import {
  getLifecycleStageDisplayLabel,
  getValidationStatusDisplayLabel,
  calculateIdeaValidationSummary,
} from '@/lib/quick-notes-domain';
import {
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface IdeaPipelineViewProps {
  ideas: Idea[];
  onSelectIdea: (idea: Idea) => void;
  onAdvanceStage: (idea: Idea, nextStage: IdeaLifecycleStage) => void;
  onNewIdeaClick: () => void;
}

const ACTIVE_STAGES: IdeaLifecycleStage[] = [
  'captured',
  'exploring',
  'structured',
  'validating',
  'validated',
  'approved',
  'implemented',
];

export function IdeaPipelineView({
  ideas,
  onSelectIdea,
  onAdvanceStage,
  onNewIdeaClick,
}: IdeaPipelineViewProps) {
  // Group ideas by lifecycle stage
  const stageMap = React.useMemo(() => {
    const map = new Map<IdeaLifecycleStage, Idea[]>();
    ACTIVE_STAGES.forEach((s) => map.set(s, []));
    ideas.forEach((idea) => {
      const list = map.get(idea.lifecycleStage) || [];
      list.push(idea);
      map.set(idea.lifecycleStage, list);
    });
    return map;
  }, [ideas]);

  const getNextStage = (current: IdeaLifecycleStage): IdeaLifecycleStage | null => {
    const idx = ACTIVE_STAGES.indexOf(current);
    if (idx !== -1 && idx < ACTIVE_STAGES.length - 1) {
      return ACTIVE_STAGES[idx + 1];
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Horizontal Pipeline Columns Container with horizontal scroll on small viewports */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin">
        {ACTIVE_STAGES.map((stage) => {
          const stageIdeas = stageMap.get(stage) || [];
          const { label, colorClass: _colorClass, badgeBg } = getLifecycleStageDisplayLabel(stage);

          return (
            <div
              key={stage}
              className="flex-shrink-0 w-[290px] sm:w-[320px] snap-start flex flex-col rounded-2xl border border-border/60 bg-muted/20 backdrop-blur-sm p-3.5 shadow-sm min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${badgeBg.split(' ')[0]}`} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {label}
                  </h3>
                  <span className="text-[11px] font-semibold text-muted-foreground px-1.5 py-0.5 rounded-full bg-background border border-border/50">
                    {stageIdeas.length}
                  </span>
                </div>

                {stage === 'captured' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onNewIdeaClick}
                    className="h-7 px-2 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/10 rounded-lg"
                  >
                    + New
                  </Button>
                )}
              </div>

              {/* Ideas Cards in Column */}
              <div className="flex-1 space-y-3 pt-3 overflow-y-auto max-h-[calc(100vh-320px)] pr-0.5">
                {stageIdeas.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/40 rounded-xl">
                    <p className="text-xs text-muted-foreground">No ideas in {label.toLowerCase()}</p>
                  </div>
                ) : (
                  stageIdeas.map((idea) => {
                    const validationSummary = calculateIdeaValidationSummary(idea);
                    const { badgeClass: validationBadgeClass } = getValidationStatusDisplayLabel(
                      idea.validationStatus
                    );
                    const nextStage = getNextStage(idea.lifecycleStage);

                    return (
                      <div
                        key={idea.id}
                        onClick={() => onSelectIdea(idea)}
                        className="group relative flex flex-col rounded-xl border border-border/70 bg-card p-3.5 shadow-xs hover:shadow-md hover:border-primary/40 transition-all cursor-pointer select-none active:scale-[0.98]"
                      >
                        {/* Top Badges: ICE Score & Validation */}
                        <div className="flex items-center justify-between gap-1.5 mb-2">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20"
                            title="ICE Prioritization Score = (Impact × Confidence) / Effort"
                          >
                            <TrendingUp className="h-3 w-3" />
                            ICE {idea.iceScore}
                          </span>

                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${validationBadgeClass}`}
                          >
                            {idea.validationStatus}
                          </span>
                        </div>

                        {/* Title & Problem Preview */}
                        <h4 className="text-xs font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                          {idea.title}
                        </h4>

                        {idea.problem && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                            {idea.problem}
                          </p>
                        )}

                        {/* Validation Progress & Evidence Bar */}
                        <div className="mt-3 pt-2.5 border-t border-border/40 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                            <span>Validation Progress</span>
                            <span>{validationSummary.validationPercentage}%</span>
                          </div>
                          <Progress
                            value={validationSummary.validationPercentage}
                            className="h-1.5 bg-muted rounded-full"
                          />
                        </div>

                        {/* Metadata Footer */}
                        <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                          <div className="flex items-center gap-2">
                            <span>{idea.assumptions?.length || 0} Assumptions</span>
                            <span>•</span>
                            <span>{idea.hypotheses?.length || 0} Hypotheses</span>
                          </div>

                          {/* Quick Advance Button */}
                          {nextStage && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAdvanceStage(idea, nextStage);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline p-1 rounded hover:bg-primary/10 min-h-[32px]"
                              title={`Advance to ${nextStage}`}
                            >
                              <span>Next</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
