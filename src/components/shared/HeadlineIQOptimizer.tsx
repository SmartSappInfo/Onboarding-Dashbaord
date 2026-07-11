'use client';

import * as React from 'react';
import { 
  Sparkles, 
  Flame, 
  BrainCircuit, 
  Eye, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  XCircle 
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { analyzeHeadline } from '@/lib/services/headline-iq';
import { generateHeadlineVariationsAction } from '@/app/actions/headline-iq-actions';
import type { HeadlineVariation } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface HeadlineIQOptimizerProps {
  value: string;
  previewValue?: string;
  onChange: (val: string) => void;
  onPreviewChange?: (val: string) => void;
  emailContext?: string;
  organizationId?: string;
  frameworkDefault?: 'aida' | '4us' | 'pas';
  align?: 'start' | 'center' | 'end';
}

export function HeadlineIQOptimizer({
  value,
  previewValue = '',
  onChange,
  onPreviewChange,
  emailContext = '',
  organizationId,
  frameworkDefault = 'aida',
  align = 'end',
}: HeadlineIQOptimizerProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [framework, setFramework] = React.useState<'aida' | '4us' | 'pas'>(frameworkDefault);
  const [contextText, setContextText] = React.useState(emailContext);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [variations, setVariations] = React.useState<HeadlineVariation[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Sync default framework when prop changes
  React.useEffect(() => {
    setFramework(frameworkDefault);
  }, [frameworkDefault]);

  // Sync contextText when emailContext prop changes
  React.useEffect(() => {
    setContextText(emailContext);
  }, [emailContext]);

  // Clear suggestions when the baseline value changes
  React.useEffect(() => {
    setVariations([]);
    setErrorMsg(null);
  }, [value]);

  // Real-time static score calculation
  const analysis = React.useMemo(() => analyzeHeadline(value), [value]);

  // Handle generation action
  const handleGenerate = React.useCallback(async () => {
    if (!value.trim()) {
      setErrorMsg('Please enter a baseline headline before generating variations.');
      return;
    }
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const response = await generateHeadlineVariationsAction({
        currentTitle: value,
        currentPreviewText: previewValue,
        framework,
        emailContext: contextText,
        organizationId,
      });

      if (response.success && response.result) {
        setVariations(response.result);
      } else {
        setErrorMsg(response.error || 'Failed to generate variations.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  }, [value, previewValue, framework, contextText, organizationId]);

  // Badge styling depending on the score
  const badgeClasses = React.useMemo(() => {
    if (!value.trim()) {
      return 'bg-muted/50 text-muted-foreground border-muted border hover:bg-muted/70';
    }
    if (analysis.score >= 75) {
      return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20';
    }
    if (analysis.score >= 50) {
      return 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20';
    }
    return 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20';
  }, [value, analysis.score]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold select-none cursor-pointer tracking-wide shadow-sm transition-all duration-200 active:scale-[0.97] ease-out',
            badgeClasses
          )}
        >
          <Sparkles className="h-3 w-3 animate-pulse text-current" />
          <span>{value.trim() ? `${analysis.score}/100` : 'Analyze Copy'}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        side="bottom"
        sideOffset={6}
        className="w-[320px] sm:w-[360px] p-4 rounded-3xl border border-border/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl z-[150] space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <h5 className="text-xs font-bold text-foreground">HeadlineIQ Analyzer</h5>
          </div>
          {value.trim() && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              Overall: {analysis.score}/100
            </span>
          )}
        </div>

        {/* Meters */}
        {value.trim() ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <span className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Flame className="h-2.5 w-2.5 text-orange-500" /> Urgency
                </span>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${analysis.urgencyMeter}%` }} 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <BrainCircuit className="h-2.5 w-2.5 text-blue-500" /> Curiosity
                </span>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${analysis.curiosityMeter}%` }} 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Eye className="h-2.5 w-2.5 text-emerald-500" /> Clarity
                </span>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${analysis.clarityMeter}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Checklist recommendations */}
            <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
              {analysis.checklist.map((item, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-[9px] leading-relaxed">
                  {item.type === 'success' && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />}
                  {item.type === 'warning' && <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />}
                  {item.type === 'error' && <XCircle className="h-3 w-3 text-rose-500 shrink-0 mt-0.5" />}
                  <span className={cn(
                    item.type === 'success' && 'text-emerald-700 dark:text-emerald-400 font-medium',
                    item.type === 'warning' && 'text-amber-700 dark:text-amber-400 font-medium',
                    item.type === 'error' && 'text-rose-700 dark:text-rose-400 font-bold'
                  )}>
                    {item.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground text-center py-2">
            Enter a baseline title or subject line to generate scores and recommendations.
          </p>
        )}

        <div className="border-t pt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[9px] font-bold text-muted-foreground uppercase">Framework</Label>
            <Select
              value={framework}
              onValueChange={(v) => setFramework(v as 'aida' | '4us' | 'pas')}
            >
              <SelectTrigger className="h-7 text-[10px] px-2 rounded-lg bg-muted/50 border-none font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="aida">AIDA (Attention / Action)</SelectItem>
                <SelectItem value="pas">PAS (Problem / Solution)</SelectItem>
                <SelectItem value="4us">4 U's (Specificity / Value)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[9px] font-bold text-muted-foreground uppercase">Optional Context</Label>
            <Textarea
              placeholder="e.g. overdue billing notice, term 2 signups"
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              className="h-12 text-[10px] px-3 py-1.5 rounded-xl bg-muted/40 border-none font-medium resize-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          <Button
            type="button"
            disabled={isGenerating || !value.trim()}
            onClick={handleGenerate}
            className="w-full h-8 text-[10px] font-bold rounded-xl bg-primary text-white hover:bg-primary/95 active:scale-[0.97] transition-all shadow-md"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Optimizing Copies...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1.5" />
                Generate AI Suggestions
              </>
            )}
          </Button>

          {errorMsg && (
            <p className="text-[9px] font-semibold text-rose-500 text-center animate-in fade-in duration-200">
              {errorMsg}
            </p>
          )}

          {/* AI Variations Result Panel */}
          {variations.length > 0 && !isGenerating && (
            <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                AI Framework Alternatives
              </span>
              <div className="space-y-2">
                {variations.map((v, idx) => (
                  <div 
                    key={idx} 
                    className="p-2.5 rounded-2xl bg-muted/30 border border-border/40 space-y-1.5 hover:bg-muted/50 transition-colors group text-left"
                  >
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold text-foreground leading-snug">{v.title}</p>
                      {v.previewText && (
                        <p className="text-[9px] text-muted-foreground font-medium line-clamp-2 leading-relaxed">
                          {v.previewText}
                        </p>
                      )}
                    </div>
                    {v.explanation && (
                      <p className="text-[8px] font-medium text-primary/80 italic leading-normal">
                        {v.explanation}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onChange(v.title);
                        if (onPreviewChange && v.previewText) {
                          onPreviewChange(v.previewText);
                        }
                        setOpen(false);
                      }}
                      className="inline-flex items-center justify-center w-full h-6 text-[8px] font-bold rounded-lg bg-primary/10 text-primary opacity-90 hover:opacity-100 active:scale-[0.95] transition-all"
                    >
                      Apply Framework Copy
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
