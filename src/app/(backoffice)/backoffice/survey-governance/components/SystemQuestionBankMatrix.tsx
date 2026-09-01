'use client';

/**
 * @fileOverview SmartSapp Platform Control Plane — System Question Bank Matrix
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Global Research & Benchmark Standardization:
 *    - Allows Superadmins to govern cross-tenant question definitions and benchmarking weights.
 * 2. Mobile-First Ergonomics & Accessibility (WCAG 2.1 AA):
 *    - Touch targets min-h-[44px], active:scale-[0.97] tactile press states, clear status labels.
 * 3. Strict Zero-Any Invariant:
 *    - Strictly typed props and state.
 */

import * as React from 'react';
import {
  Library,
  Sparkles,
  Search,
  Plus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Tag,
  BarChart2,
  SlidersHorizontal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  getQuestionBankItemsAction,
  seedSystemQuestionBankAction,
  saveQuestionToBankAction,
} from '@/lib/surveys/question-bank-actions';
import type { QuestionBankItem } from '@/lib/surveys/survey-v2-types';

export default function SystemQuestionBankMatrix() {
  const { toast } = useToast();

  const [items, setItems] = React.useState<QuestionBankItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');

  const fetchItems = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // System library items have visibility === 'system'
      const res = await getQuestionBankItemsAction('system_admin', {
        category: categoryFilter,
        searchQuery,
      });

      if (res.success && res.items) {
        setItems(res.items.filter((i) => i.visibility === 'system'));
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load system question library.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, searchQuery, toast]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSeedSystemBank = async () => {
    setIsSeeding(true);
    try {
      const res = await seedSystemQuestionBankAction();
      if (res.success) {
        toast({
          title: 'System Question Bank Seeded',
          description: `Successfully synchronized ${res.seededCount} standardized benchmark questions.`,
        });
        fetchItems();
      } else {
        toast({
          variant: 'destructive',
          title: 'Seeding Failed',
          description: res.error || 'Failed to seed system question library.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred during seeding.',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="p-6 border-b border-border/40 pb-4 bg-muted/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
              <Library className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                Global System Question Bank
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Standardized benchmarking and CX question catalog available to all tenant workspaces.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedSystemBank}
              disabled={isSeeding}
              className="h-10 min-h-[44px] text-xs font-semibold active:scale-[0.97] gap-1.5"
            >
              {isSeeding ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Sparkles className="h-4 w-4 text-purple-500" />}
              <span>Sync Standard Library</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchItems}
              disabled={isLoading}
              className="h-10 min-h-[44px] px-3 active:scale-[0.97]"
            >
              <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Search & Category Pills */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search benchmark questions, metrics, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 min-h-[44px] text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 no-scrollbar">
            {[
              { id: 'all', label: 'All' },
              { id: 'nps', label: 'NPS' },
              { id: 'csat', label: 'CSAT' },
              { id: 'parent_experience', label: 'Parent CX' },
              { id: 'teacher_wellbeing', label: 'Staff' },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={categoryFilter === tab.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter(tab.id)}
                className="h-8 text-xs px-3 rounded-full min-h-[36px] active:scale-[0.97]"
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Question Matrix Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {isLoading ? (
            <div className="col-span-full flex flex-col items-center justify-center h-48 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
              <p className="text-xs text-muted-foreground">Scanning system question bank...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="col-span-full text-center py-10 space-y-3">
              <Library className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-xs text-muted-foreground">No system benchmark questions found.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedSystemBank}
                disabled={isSeeding}
                className="min-h-[44px] text-xs active:scale-[0.97]"
              >
                <Sparkles className="h-4 w-4 mr-1.5 text-purple-500" />
                Seed Standard Library
              </Button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-border/70 bg-card/60 hover:border-purple-500/40 transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                      {item.questionType}
                    </Badge>
                    {item.metric && (
                      <Badge variant="outline" className="text-[10px] text-purple-500 border-purple-500/30 font-semibold">
                        {item.metric}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground font-medium capitalize">
                      • {item.category.replace('_', ' ')}
                    </span>
                  </div>

                  <span className="text-[10px] font-semibold text-muted-foreground">
                    Used in {item.usageCount || 0} surveys
                  </span>
                </div>

                <p className="text-xs font-bold text-foreground leading-relaxed">
                  {item.title}
                </p>

                {item.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}

                {item.options && item.options.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {item.options.slice(0, 4).map((opt, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded border border-border/40"
                      >
                        {opt.text}
                      </span>
                    ))}
                    {item.options.length > 4 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        +{item.options.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
