'use client';

import * as React from 'react';
import { type Idea } from '@/lib/quick-notes-types';
import {
  getLifecycleStageDisplayLabel,
  getValidationStatusDisplayLabel,
  calculateIdeaValidationSummary,
} from '@/lib/quick-notes-domain';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface IdeaAccessibilityViewProps {
  ideas: Idea[];
  onSelectIdea: (idea: Idea) => void;
}

/**
 * Section 84 Spec-Compliant Accessible Structured Idea View.
 *
 * Provides full keyboard accessibility, semantic table structure, and ARIA landmarks
 * for screen-reader and keyboard-only users who cannot interact with the 2D visual canvas.
 */
export function IdeaAccessibilityView({
  ideas,
  onSelectIdea,
}: IdeaAccessibilityViewProps) {
  const [search, setSearch] = React.useState('');

  const filtered = React.useMemo(() => {
    if (!search.trim()) return ideas;
    const q = search.toLowerCase().trim();
    return ideas.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.problem && i.problem.toLowerCase().includes(q)) ||
        (i.proposedSolution && i.proposedSolution.toLowerCase().includes(q)) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [ideas, search]);

  return (
    <div className="space-y-4" role="region" aria-label="Accessible Idea List and Evidence Table">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ideas, problems, or assumptions..."
            className="pl-9 text-xs h-9"
            aria-label="Filter accessible idea table"
          />
        </div>
        <span className="text-xs text-muted-foreground font-medium" aria-live="polite">
          Showing {filtered.length} of {ideas.length} ideas
        </span>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" role="table" aria-label="Ideas and Evidence Matrix">
            <thead className="bg-muted/40 border-b border-border/50">
              <tr>
                <th scope="col" className="p-3.5 font-bold text-foreground">Idea & Problem</th>
                <th scope="col" className="p-3.5 font-bold text-foreground">Lifecycle Stage</th>
                <th scope="col" className="p-3.5 font-bold text-foreground">Validation Status</th>
                <th scope="col" className="p-3.5 font-bold text-foreground">Assumptions</th>
                <th scope="col" className="p-3.5 font-bold text-foreground">Hypotheses</th>
                <th scope="col" className="p-3.5 font-bold text-foreground text-center">Impact / Effort</th>
                <th scope="col" className="p-3.5 font-bold text-foreground text-right">ICE Score</th>
                <th scope="col" className="p-3.5 font-bold text-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-muted-foreground italic">
                    No ideas match your search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((idea) => {
                  const { label: stageLabel, badgeBg } = getLifecycleStageDisplayLabel(idea.lifecycleStage);
                  const { badgeClass } = getValidationStatusDisplayLabel(idea.validationStatus);
                  const valSummary = calculateIdeaValidationSummary(idea);

                  return (
                    <tr
                      key={idea.id}
                      className="hover:bg-muted/30 transition-colors focus-within:bg-muted/40"
                    >
                      <td className="p-3.5 max-w-[280px]">
                        <button
                          type="button"
                          onClick={() => onSelectIdea(idea)}
                          className="font-bold text-foreground hover:text-primary hover:underline text-left block truncate"
                          aria-label={`Open details for idea: ${idea.title}`}
                        >
                          {idea.title}
                        </button>
                        {idea.problem && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {idea.problem}
                          </p>
                        )}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg}`}>
                          {stageLabel}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badgeClass}`}>
                          {idea.validationStatus}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-foreground">
                          {idea.assumptions?.length || 0}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({valSummary.supportedAssumptions} verified)
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-foreground">
                          {idea.hypotheses?.length || 0}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({valSummary.provenHypotheses} proven)
                        </span>
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap font-medium text-foreground">
                        I: {idea.impact} / E: {idea.effort}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap font-extrabold text-primary text-sm">
                        {idea.iceScore}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSelectIdea(idea)}
                          className="h-8 px-2 text-xs font-bold text-primary hover:bg-primary/10"
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
