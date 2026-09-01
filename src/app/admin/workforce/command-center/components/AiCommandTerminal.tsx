'use client';

/**
 * @fileOverview AI Natural Language Command Terminal (Phase 9)
 *
 * Prompt interface allowing administrators to express high-level operational intents
 * and generate structured action proposals with simulated impact analysis.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring easing and accessible keyboard bindings.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight, Loader2, Command } from 'lucide-react';

interface AiCommandTerminalProps {
  onGenerateProposal: (prompt: string) => Promise<void>;
  isGenerating: boolean;
}

const PRESET_PROMPTS = [
  'Review inactive Finance administrators',
  'Find duplicate roles and merge overlapping permissions',
  'Prepare access review campaign for Sales department',
  'Rebalance inactive sales rep deal portfolios',
  'Prune dormant accounts with 0 activity in 90+ days',
  'Audit high-privilege members lacking MFA enforcement',
];

export function AiCommandTerminal({ onGenerateProposal, isGenerating }: AiCommandTerminalProps) {
  const [prompt, setPrompt] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerateProposal(prompt.trim());
  };

  const handlePresetClick = (p: string) => {
    setPrompt(p);
    onGenerateProposal(p);
  };

  return (
    <Card className="border bg-card shadow-sm overflow-hidden">
      <CardContent className="p-4 sm:p-6 space-y-4">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none text-muted-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>

          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Review inactive Finance administrators and trim unused permissions..."
            className="pl-10 pr-24 h-12 text-sm bg-muted/20 border focus-visible:ring-1"
            disabled={isGenerating}
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <Button
              type="submit"
              size="sm"
              disabled={!prompt.trim() || isGenerating}
              className="h-8 px-3 text-xs font-semibold active:scale-[0.97]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Simulating...
                </>
              ) : (
                <>
                  Generate Proposal <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Preset Quick-Action Chips */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
            <Command className="w-3 h-3 text-primary" /> Quick-Action Presets
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESET_PROMPTS.map((p, i) => (
              <Badge
                key={i}
                variant="outline"
                onClick={() => handlePresetClick(p)}
                className="text-[11px] py-1 px-2.5 cursor-pointer hover:bg-primary/10 hover:border-primary/40 transition-colors active:scale-[0.97]"
              >
                {p}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AiCommandTerminal;
