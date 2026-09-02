'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Identity Experiment Variants Subcomponent
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Inline A/B Variant Studio: Allows adding and configuring copy variants (Variant B, C...) directly on the Identity page.
 * 2. Slash Command Variable Autocomplete: Uses SlashInput and SlashTextarea for inline "/" variable pills.
 * 3. AI Variant Copy Generator: Uses suggestSurveyVariantCopyAction to generate 3 diverse CRO angles (Conversational, Fast Pulse, Value-Driven).
 * 4. Strict Zero-Any Invariant: All props, variant models, and action return types are strictly typed.
 */

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Trophy,
  Sparkles,
  MousePointerClick,
  Send,
  CheckCircle2,
  Wand2,
  Loader2,
  RefreshCw,
  ArrowRight,
  MessageSquare,
  Zap,
  Target,
  Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getSurveyExperimentResultsAction,
  promoteWinningVariantAction,
  suggestSurveyVariantCopyAction,
  type VariantCopySuggestion,
} from '@/lib/surveys/survey-experiment-actions';
import type { SurveyExperimentConfig, SurveyExperimentVariant, TemplateVariable } from '@/lib/types';
import { SlashInput, SlashTextarea } from '@/components/messaging/SlashInput';

interface IdentityExperimentVariantsProps {
  surveyId?: string;
  workspaceId?: string;
  templateVariables?: TemplateVariable[];
}

export function IdentityExperimentVariants({
  surveyId,
  workspaceId,
  templateVariables = [],
}: IdentityExperimentVariantsProps) {
  const { watch, setValue, getValues } = useFormContext();
  const { toast } = useToast();

  const expConfig: SurveyExperimentConfig = watch('experimentConfig') || {
    enabled: true,
    trafficAllocation: 100,
    status: 'running',
    variants: [],
  };

  const mainTitle = watch('title') || '';
  const mainDescription = watch('description') || '';
  const mainStartButtonText = watch('startButtonText') || "Let's Start";
  const mainSubmitButtonText = watch('submitButtonText') || 'Submit Response';

  const [isLoadingResults, setIsLoadingResults] = React.useState(false);
  const [resultsData, setResultsData] = React.useState<{
    winningVariantId?: string | null;
    totalCompletions: number;
    evaluatedVariants: SurveyExperimentVariant[];
  } | null>(null);

  // AI Suggestion Modal State
  const [aiModalOpen, setAiModalOpen] = React.useState(false);
  const [activeTargetVariantId, setActiveTargetVariantId] = React.useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = React.useState(false);
  const [aiSuggestions, setAiSuggestions] = React.useState<VariantCopySuggestion[]>([]);
  const [customPrompt, setCustomPrompt] = React.useState('');

  // Fetch telemetry if survey already exists
  React.useEffect(() => {
    if (!surveyId || !workspaceId) return;

    let isMounted = true;
    setIsLoadingResults(true);

    getSurveyExperimentResultsAction(surveyId, workspaceId)
      .then((res) => {
        if (isMounted && res.success) {
          setResultsData({
            winningVariantId: res.winningVariantId,
            totalCompletions: res.totalCompletions,
            evaluatedVariants: res.evaluatedVariants,
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load experiment results:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingResults(false);
      });

    return () => {
      isMounted = false;
    };
  }, [surveyId, workspaceId]);

  const variants = expConfig.variants || [];
  const treatmentVariants = variants.filter((v) => !v.isControl);

  const handleAddVariant = () => {
    const letters = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const nextLetter = letters[treatmentVariants.length] || `V${treatmentVariants.length + 2}`;

    const newVariant: SurveyExperimentVariant = {
      id: `var_${Date.now()}`,
      label: `Variant ${nextLetter}`,
      weight: 50,
      isControl: false,
    };

    const updatedVariants = [...variants, newVariant];

    setValue('experimentConfig.variants', updatedVariants, { shouldDirty: true });
    toast({
      title: 'Variant Added',
      description: `${newVariant.label} has been added to the copy test split.`,
    });
  };

  const handleRemoveVariant = (variantId: string) => {
    const updatedVariants = variants.filter((v) => v.id !== variantId);
    setValue('experimentConfig.variants', updatedVariants, { shouldDirty: true });
    toast({
      title: 'Variant Removed',
      description: 'The variant has been removed from the copy experiment.',
    });
  };

  const handleUpdateVariant = (variantId: string, updates: Partial<SurveyExperimentVariant>) => {
    const currentVariants = (getValues('experimentConfig.variants') as SurveyExperimentVariant[]) || [];
    const updated = currentVariants.map((v) => (v.id === variantId ? { ...v, ...updates } : v));
    setValue('experimentConfig.variants', updated, { shouldDirty: true });
  };

  const handlePromoteVariant = async (variantId: string) => {
    const target = variants.find((v) => v.id === variantId);
    if (!target) return;

    if (target.titleOverride) setValue('title', target.titleOverride, { shouldDirty: true });
    if (target.introProseOverride) setValue('description', target.introProseOverride, { shouldDirty: true });
    if (target.startButtonTextOverride) setValue('startButtonText', target.startButtonTextOverride, { shouldDirty: true });
    if (target.submitButtonTextOverride) setValue('submitButtonText', target.submitButtonTextOverride, { shouldDirty: true });

    if (surveyId && workspaceId) {
      const res = await promoteWinningVariantAction(surveyId, variantId, workspaceId);
      if (res.success) {
        toast({
          title: 'Winning Copy Adopted',
          description: `${target.label} headline and button copy are now your primary survey configuration.`,
        });
      }
    } else {
      toast({
        title: 'Winning Copy Adopted',
        description: `${target.label} copy has been applied to the primary survey details.`,
      });
    }
  };

  // Trigger AI generation modal
  const handleOpenAiModal = (variantId?: string) => {
    setActiveTargetVariantId(variantId || null);
    setAiModalOpen(true);
    handleGenerateSuggestions();
  };

  const handleGenerateSuggestions = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await suggestSurveyVariantCopyAction({
        currentTitle: mainTitle,
        currentDescription: mainDescription,
        currentStartButton: mainStartButtonText,
        currentSubmitButton: mainSubmitButtonText,
        customPrompt: customPrompt.trim() || undefined,
      });

      if (res.success && res.suggestions) {
        setAiSuggestions(res.suggestions);
      } else {
        toast({
          title: 'AI Suggestion Error',
          description: res.error || 'Failed to generate copy suggestions.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      console.error('Failed to generate variant suggestions:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleApplyAiSuggestion = (suggestion: VariantCopySuggestion) => {
    if (activeTargetVariantId) {
      // Apply to existing variant
      handleUpdateVariant(activeTargetVariantId, {
        titleOverride: suggestion.titleOverride,
        introProseOverride: suggestion.introProseOverride,
        startButtonTextOverride: suggestion.startButtonTextOverride,
        submitButtonTextOverride: suggestion.submitButtonTextOverride,
      });
      toast({
        title: 'AI Copy Applied',
        description: `Applied "${suggestion.angleName}" to the selected variant.`,
      });
    } else {
      // Create new variant with this copy
      const letters = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const nextLetter = letters[treatmentVariants.length] || `V${treatmentVariants.length + 2}`;

      const newVariant: SurveyExperimentVariant = {
        id: `var_${Date.now()}`,
        label: `Variant ${nextLetter} (${suggestion.angleName.split('&')[0].trim()})`,
        weight: 50,
        isControl: false,
        titleOverride: suggestion.titleOverride,
        introProseOverride: suggestion.introProseOverride,
        startButtonTextOverride: suggestion.startButtonTextOverride,
        submitButtonTextOverride: suggestion.submitButtonTextOverride,
      };

      const updatedVariants = [...variants, newVariant];
      setValue('experimentConfig.variants', updatedVariants, { shouldDirty: true });
      toast({
        title: 'AI Variant Created',
        description: `Created ${newVariant.label} with optimized copy.`,
      });
    }

    setAiModalOpen(false);
  };

  return (
    <div className="space-y-4 pt-2 animate-in fade-in-50 duration-300">
      {/* Variants Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Test Variants ({treatmentVariants.length})
          </span>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Compared against Control A
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenAiModal()}
            className="h-8 px-3 gap-1.5 text-xs font-bold rounded-xl text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10 active:scale-[0.97]"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            <span>AI Suggest Angles</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddVariant}
            className="h-8 px-3 gap-1.5 text-xs font-semibold rounded-xl text-foreground border-border hover:bg-muted active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Variant</span>
          </Button>
        </div>
      </div>

      {/* List of Treatment Variants */}
      {treatmentVariants.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-purple-500/30 bg-purple-500/[0.02] text-center space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-foreground">No test variants created yet.</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Add a variant or use AI to generate high-converting headline, description, and CTA button variations.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenAiModal()}
              className="h-8 px-3.5 text-xs font-bold rounded-xl text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10 active:scale-[0.97]"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1 text-purple-500" /> Generate with AI
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddVariant}
              className="h-8 px-3.5 text-xs font-semibold rounded-xl active:scale-[0.97]"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Blank Variant
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {treatmentVariants.map((variant) => {
            const isWinner = resultsData?.winningVariantId === variant.id;
            const evalStats = resultsData?.evaluatedVariants?.find((v) => v.id === variant.id);

            return (
              <Card
                key={variant.id}
                className="p-4 sm:p-5 rounded-2xl border border-purple-500/20 bg-purple-500/[0.02] space-y-4 shadow-xs relative"
              >
                {/* Variant Header */}
                <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                      {variant.label.slice(0, 2).toUpperCase()}
                    </div>
                    <Input
                      value={variant.label}
                      onChange={(e) => handleUpdateVariant(variant.id, { label: e.target.value })}
                      className="h-7 w-48 text-xs font-bold bg-transparent border-transparent hover:border-border focus:border-border rounded-md px-1.5"
                    />
                    {isWinner && (
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[9px] font-bold uppercase gap-1 py-0.5">
                        <Trophy className="h-3 w-3 text-amber-500" /> Winning Copy
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {watch('previewVariantId') === variant.id ? (
                      <Badge className="h-7 px-2.5 text-[10px] font-bold rounded-lg bg-purple-600 text-white gap-1 shadow-xs border-none">
                        <Eye className="h-3 w-3" />
                        <span>Live in Preview</span>
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setValue('previewVariantId', variant.id, { shouldDirty: true });
                          toast({
                            title: `Previewing ${variant.label}`,
                            description: 'The simulation canvas has been updated to show this variant.',
                          });
                        }}
                        className="h-7 px-2.5 text-[11px] font-semibold rounded-lg border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 gap-1 active:scale-[0.97]"
                        title={`Preview ${variant.label} on simulation canvas`}
                      >
                        <Eye className="h-3 w-3 text-purple-500" />
                        <span>Preview</span>
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAiModal(variant.id)}
                      className="h-7 px-2.5 text-[11px] font-bold rounded-lg text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10 gap-1 active:scale-[0.97]"
                    >
                      <Sparkles className="h-3 w-3 text-purple-500" />
                      <span>AI Suggest</span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveVariant(variant.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg active:scale-[0.97]"
                      title="Remove Variant"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Telemetry Strip (If data exists) */}
                {evalStats?.metrics && (
                  <div className="flex flex-wrap items-center justify-between p-2.5 rounded-xl bg-card border border-border/60 text-xs gap-3">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Completions</span>
                        <span className="font-bold text-foreground">{evalStats.metrics.completions}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Conversion Rate</span>
                        <span className="font-bold text-foreground">{evalStats.metrics.completionRate}%</span>
                      </div>
                      {evalStats.metrics.averageRating !== undefined && (
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Avg Score</span>
                          <span className="font-bold text-foreground">{evalStats.metrics.averageRating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handlePromoteVariant(variant.id)}
                      className="h-7 text-xs font-bold rounded-lg border-primary/30 text-primary hover:bg-primary/10 active:scale-[0.97]"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Adopt as Primary
                    </Button>
                  </div>
                )}

                {/* Copy Overrides with SlashInput & SlashTextarea */}
                <div className="space-y-3.5">
                  {/* Title Override */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground">
                        Public Title Override <span className="text-muted-foreground font-normal">(Optional)</span>
                      </Label>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Type <kbd className="px-1 py-0.2 rounded bg-muted text-[9px] font-mono border">/</kbd> for variables
                      </span>
                    </div>
                    <SlashInput
                      value={variant.titleOverride || ''}
                      onChange={(val) => handleUpdateVariant(variant.id, { titleOverride: val })}
                      variables={templateVariables}
                      placeholder={mainTitle ? `Defaults to: "${mainTitle.slice(0, 45)}..."` : 'Defaults to primary survey title'}
                      className="h-10 text-xs rounded-xl bg-card border border-border/60"
                    />
                  </div>

                  {/* Intro Prose Override */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground">
                        Introductory Prose Override <span className="text-muted-foreground font-normal">(Optional)</span>
                      </Label>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Type <kbd className="px-1 py-0.2 rounded bg-muted text-[9px] font-mono border">/</kbd> for variables
                      </span>
                    </div>
                    <SlashTextarea
                      value={variant.introProseOverride || ''}
                      onChange={(val) => handleUpdateVariant(variant.id, { introProseOverride: val })}
                      variables={templateVariables}
                      placeholder={mainDescription ? `Defaults to: "${mainDescription.slice(0, 45)}..."` : 'Defaults to primary survey description'}
                      className="min-h-[75px] text-xs rounded-xl bg-card border border-border/60 leading-relaxed"
                    />
                  </div>

                  {/* CTA Button Overrides */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                        <MousePointerClick className="h-3 w-3 text-muted-foreground" /> Start Button CTA Override
                      </Label>
                      <Input
                        value={variant.startButtonTextOverride || ''}
                        onChange={(e) => handleUpdateVariant(variant.id, { startButtonTextOverride: e.target.value })}
                        placeholder={mainStartButtonText ? `Defaults to: "${mainStartButtonText}"` : "Defaults to 'Let's Start'"}
                        className="h-9 text-xs rounded-xl bg-card border border-border/60"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Send className="h-3 w-3 text-muted-foreground" /> Submit Button CTA Override
                      </Label>
                      <Input
                        value={variant.submitButtonTextOverride || ''}
                        onChange={(e) => handleUpdateVariant(variant.id, { submitButtonTextOverride: e.target.value })}
                        placeholder={mainSubmitButtonText ? `Defaults to: "${mainSubmitButtonText}"` : "Defaults to 'Submit Response'"}
                        className="h-9 text-xs rounded-xl bg-card border border-border/60"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* AI SUGGESTION MODAL */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              AI Variant Copy Suggestions
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select an optimized copy angle to populate the variant headline, description, and CTA buttons.
            </DialogDescription>
          </DialogHeader>

          {/* Optional Prompt Guidance */}
          <div className="flex gap-2">
            <Input
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Optional: e.g. Make it punchier for mobile or focus on parents..."
              className="h-9 text-xs rounded-xl bg-card border border-border/60"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGenerateSuggestions();
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleGenerateSuggestions}
              disabled={isGeneratingAi}
              className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shrink-0 active:scale-[0.97]"
            >
              {isGeneratingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span>{isGeneratingAi ? 'Thinking...' : 'Regenerate'}</span>
            </Button>
          </div>

          {/* Suggestions List */}
          {isGeneratingAi ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">Analyzing baseline copy & psychometric angles...</p>
                <p className="text-[11px] text-muted-foreground">Crafting high-converting title and CTA variants.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1">
              {aiSuggestions.map((sug, idx) => (
                <Card
                  key={idx}
                  className="p-4 rounded-2xl border border-border/70 hover:border-purple-500/50 bg-card transition-all space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-purple-500/10 text-purple-600">
                        {idx === 0 ? <MessageSquare className="h-3.5 w-3.5" /> : idx === 1 ? <Zap className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground">{sug.angleName}</span>
                        <p className="text-[10px] text-muted-foreground">{sug.angleDescription}</p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleApplyAiSuggestion(sug)}
                      className="h-7 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white gap-1 active:scale-[0.97]"
                    >
                      <span>Apply</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider">Title Override</span>
                      <p className="font-semibold text-foreground">{sug.titleOverride}</p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider">Intro Description</span>
                      <p className="text-muted-foreground leading-relaxed text-[11px]">{sug.introProseOverride}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2 rounded-xl bg-muted/30 text-[11px]">
                        <span className="text-[9px] font-bold text-muted-foreground block uppercase">Start CTA</span>
                        <span className="font-semibold text-foreground">{sug.startButtonTextOverride}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-muted/30 text-[11px]">
                        <span className="text-[9px] font-bold text-muted-foreground block uppercase">Submit CTA</span>
                        <span className="font-semibold text-foreground">{sug.submitButtonTextOverride}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
