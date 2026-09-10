'use client';

import * as React from 'react';
import {
  ShieldAlert,
  Sparkles,
  Copy,
  Check,
  Search,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type ObjectionBattlecard,
  type ObjectionCategory,
} from '@/lib/quick-notes-types';
import {
  getObjectionCategoryMeta,
  formatBattlecardSnippet,
} from '@/lib/quick-notes-domain';
import { useToast } from '@/hooks/use-toast';
import { generateWorkspaceBattlecardsAction } from '@/lib/quick-notes-campaign-actions';
import { useUser } from '@/firebase';

interface ObjectionMatrixViewProps {
  battlecards: ObjectionBattlecard[];
  workspaceId: string;
  onRefresh?: () => void;
}

export function ObjectionMatrixView({
  battlecards,
  workspaceId,
  onRefresh,
}: ObjectionMatrixViewProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<ObjectionCategory | 'all'>('all');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleCopySnippet = (card: ObjectionBattlecard) => {
    const text = formatBattlecardSnippet(card);
    navigator.clipboard.writeText(text);
    setCopiedId(card.id);
    toast({ title: 'Battlecard snippet copied to clipboard' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerateBattlecards = async () => {
    setIsGenerating(true);
    try {
      const res = await generateWorkspaceBattlecardsAction(
        workspaceId,
        user?.uid || 'system'
      );
      if (res.success) {
        toast({
          title: 'Battlecards Synthesized',
          description: `Generated ${res.battlecardsCount ?? 0} tactical battlecards from customer notes.`,
        });
        onRefresh?.();
      } else {
        toast({
          title: 'Generation Failed',
          description: res.error || 'Failed to generate battlecards.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Unexpected error during battlecard synthesis.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredCards = React.useMemo(() => {
    return battlecards.filter((card) => {
      if (selectedCategory !== 'all' && card.category !== selectedCategory) return false;
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const corpus = `${card.topic} ${card.objection} ${card.rebuttalScript} ${card.killerQuestion}`.toLowerCase();
        if (!corpus.includes(query)) return false;
      }
      return true;
    });
  }, [battlecards, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Controls Bar: Search, Category Filter & AI Generator */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/80 shadow-sm">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search objections, competitors, topics..."
              className="pl-9 h-9 text-xs rounded-xl bg-background border-border/70"
            />
          </div>

          <Select
            value={selectedCategory}
            onValueChange={(val) => setSelectedCategory(val as ObjectionCategory | 'all')}
          >
            <SelectTrigger className="w-[180px] h-9 text-xs rounded-xl bg-background border-border/70">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="pricing">Pricing & Budget</SelectItem>
              <SelectItem value="competitor">Competitor / Alt</SelectItem>
              <SelectItem value="trust">Trust & Security</SelectItem>
              <SelectItem value="feature">Feature Gap</SelectItem>
              <SelectItem value="timing">Timing & Delay</SelectItem>
              <SelectItem value="general">General Hesitation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          onClick={handleGenerateBattlecards}
          disabled={isGenerating}
          className="h-9 min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-[0.97] transition-all"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Scanning Customer Notes...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              ✨ Synthesize Battlecards with AI
            </>
          )}
        </Button>
      </div>

      {/* Grid of Objection Battlecards */}
      {filteredCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-muted/20">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-foreground">No Objection Battlecards Found</h4>
          <p className="text-xs text-muted-foreground max-w-md mt-1 mb-4">
            Click &quot;Synthesize Battlecards with AI&quot; to scan your workspace notes, call transcripts, and CRM feedback for recurring sales objections.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={handleGenerateBattlecards}
            disabled={isGenerating}
            className="rounded-xl text-xs font-semibold h-9 min-h-[44px] sm:min-h-[36px]"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Synthesize from Notes Now
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredCards.map((card) => {
            const catMeta = getObjectionCategoryMeta(card.category);
            const isCopied = copiedId === card.id;

            return (
              <div
                key={card.id}
                className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm hover:border-border transition-all space-y-4"
              >
                {/* Header: Category + Topic + Copy */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${catMeta.badgeClass}`}
                    >
                      {catMeta.label}
                    </span>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopySnippet(card)}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-lg px-2"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Copy Script
                        </>
                      )}
                    </Button>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    {card.topic}
                  </h3>
                </div>

                {/* The Prospect Objection */}
                <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-xs">
                  <span className="font-bold text-destructive block mb-0.5">
                    ❌ The Customer Objection
                  </span>
                  <p className="italic text-foreground font-medium">
                    &quot;{card.objection}&quot;
                  </p>
                </div>

                {/* Tactical Rebuttal Script */}
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 block">
                    🛡️ Tactical Rebuttal Script
                  </span>
                  <p className="text-foreground leading-relaxed">
                    {card.rebuttalScript}
                  </p>
                </div>

                {/* Killer Question */}
                <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs space-y-0.5">
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 block">
                    👉 The Killer Reframe Question
                  </span>
                  <p className="italic font-medium text-foreground">
                    &quot;{card.killerQuestion}&quot;
                  </p>
                </div>

                {/* Proof Points */}
                {card.proofPoints && card.proofPoints.length > 0 && (
                  <div className="space-y-1 text-xs">
                    <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase block">
                      Evidence Proof Points
                    </span>
                    <ul className="space-y-1 pt-0.5">
                      {card.proofPoints.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Source Quotes Preview if available */}
                {card.sourceQuotes && card.sourceQuotes.length > 0 && (
                  <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Source Evidence: </span>
                    <span>&quot;{card.sourceQuotes[0]}&quot;</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
