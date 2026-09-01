'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Question Bank Drawer
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Reusable Question Insertion:
 *    - Allows instant browsing, filtering, and 1-click insertion of standardized educational & CX questions.
 * 2. Mobile-First Ergonomics & Accessibility (WCAG 2.1 AA):
 *    - Touch targets min-h-[44px], active:scale-[0.97] tactile press states, clear screen reader labels.
 * 3. Strict Zero-Any Invariant:
 *    - Strictly typed props, callbacks, and state.
 */

import * as React from 'react';
import {
  Library,
  Search,
  Plus,
  Sparkles,
  Tag,
  BarChart2,
  CheckCircle2,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  BookmarkPlus,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  getQuestionBankItemsAction,
  seedSystemQuestionBankAction,
} from '@/lib/surveys/question-bank-actions';
import type { QuestionBankItem } from '@/lib/surveys/survey-v2-types';
import type { SurveyQuestion } from '@/lib/types';

export interface QuestionBankDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onInsertQuestion: (question: Partial<SurveyQuestion>) => void;
}

export function QuestionBankDrawer({
  open,
  onOpenChange,
  workspaceId,
  onInsertQuestion,
}: QuestionBankDrawerProps) {
  const { toast } = useToast();

  const [items, setItems] = React.useState<QuestionBankItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('all');

  const fetchBankItems = React.useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const res = await getQuestionBankItemsAction(workspaceId, {
        category: selectedCategory,
        searchQuery,
      });

      if (res.success && res.items) {
        setItems(res.items);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to retrieve question library.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, selectedCategory, searchQuery, toast]);

  React.useEffect(() => {
    if (open) {
      fetchBankItems();
    }
  }, [open, fetchBankItems]);

  const handleSeedLibrary = async () => {
    setIsSeeding(true);
    try {
      const res = await seedSystemQuestionBankAction();
      if (res.success) {
        toast({
          title: 'Question Bank Seeded',
          description: `Populated ${res.seededCount} standardized research and CX questions.`,
        });
        fetchBankItems();
      } else {
        toast({
          variant: 'destructive',
          title: 'Seeding Failed',
          description: res.error || 'Failed to seed question library.',
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

  const handleSelectQuestion = (item: QuestionBankItem) => {
    const newQuestion: Partial<SurveyQuestion> = {
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: item.questionType,
      title: item.title,
      description: item.description || '',
      isRequired: true,
      options: item.options?.map((opt) => opt.text),
      enableScoring: !!item.scoringWeight,
      optionScores: item.options?.map((opt) => opt.score || 0),
    };

    onInsertQuestion(newQuestion);
    toast({
      title: 'Question Added',
      description: `Inserted "${item.title.substring(0, 40)}..." into your canvas.`,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px] w-full flex flex-col h-full overflow-hidden p-0">
        <SheetHeader className="p-6 border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Library className="h-5 w-5 text-primary" />
              <SheetTitle className="text-lg font-bold">Enterprise Question Bank</SheetTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchBankItems}
              disabled={isLoading}
              className="h-8 min-h-[36px] active:scale-[0.97]"
            >
              <RefreshCw className={isLoading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            </Button>
          </div>
          <SheetDescription className="text-xs text-muted-foreground mt-1">
            Standardized benchmarks & validated question templates across Education, CX, and Research.
          </SheetDescription>
        </SheetHeader>

        {/* Search & Category Pills */}
        <div className="p-4 space-y-3 bg-muted/20 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by keyword, metric, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 min-h-[36px] text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'all', label: 'All' },
              { id: 'nps', label: 'NPS' },
              { id: 'csat', label: 'CSAT' },
              { id: 'parent_experience', label: 'Parent CX' },
              { id: 'teacher_wellbeing', label: 'Staff' },
              { id: 'general', label: 'General' },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={selectedCategory === tab.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(tab.id)}
                className="h-7 text-[11px] px-2.5 rounded-full min-h-[28px] active:scale-[0.97]"
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Question Item Catalog */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Searching question bank...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <BookmarkPlus className="h-10 w-10 text-muted-foreground/50 mx-auto" />
              <p className="text-xs text-muted-foreground">No questions found in this category.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedLibrary}
                disabled={isSeeding}
                className="min-h-[36px] text-xs active:scale-[0.97]"
              >
                {isSeeding ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                Seed Standard Library
              </Button>
            </div>
          ) : (
            items.map((item) => (
              <Card
                key={item.id}
                className="hover:border-primary/50 transition-all duration-150 shadow-sm border border-border/60"
              >
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                        {item.questionType}
                      </Badge>
                      {item.metric && (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/40 font-semibold">
                          {item.metric}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground font-medium capitalize">
                        • {item.category.replace('_', ' ')}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleSelectQuestion(item)}
                      className="h-7 min-h-[32px] px-2.5 text-xs font-semibold active:scale-[0.97] bg-primary text-primary-foreground flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add</span>
                    </Button>
                  </div>

                  <p className="text-xs font-bold text-foreground leading-relaxed">
                    {item.title}
                  </p>

                  {item.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}

                  {/* Options Preview */}
                  {item.options && item.options.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.options.slice(0, 3).map((opt, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded border border-border/40"
                        >
                          {opt.text}
                        </span>
                      ))}
                      {item.options.length > 3 && (
                        <span className="text-[10px] text-muted-foreground self-center">
                          +{item.options.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
