'use client';

/**
 * SmartSapp Forms 2.0: In-Canvas AI Assistant Copilot Drawer
 * 
 * Embedded AI assistant that provides contextual capabilities during form building:
 * 1. 💡 Suggest next follow-up questions
 * 2. ⚡ Synthesize conditional branching logic from plain English
 * 3. 🎯 Real-time friction & drop-off risk health auditor
 * 4. ✍️ Question label and placeholder tone adaptation
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Wand2,
  HelpCircle,
  Zap,
  ShieldCheck,
  Type,
  Plus,
  Check,
  AlertTriangle,
  Loader2,
  X,
  Clock,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Form, FormFieldInstance } from '@/lib/types';
import type { FormPage } from '@/lib/forms/form-types';
import type { FormLogicRule } from '@/lib/forms/form-logic-types';
import {
  suggestFormQuestionsAction,
  optimizeFormWithAiAction,
  generateFormLogicWithAiAction,
  rewriteQuestionCopyAction,
} from '@/lib/forms/form-ai-actions';
import type {
  QuestionSuggestion,
  FormFrictionReport,
  SynthesizedLogicResult,
  QuestionCopyRefinement,
} from '@/lib/forms/form-ai-types';

interface AiFormAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  form: Form;
  pages: FormPage[];
  activePageId?: string;
  fields: FormFieldInstance[];
  onAddQuestion: (question: FormFieldInstance) => void;
  onAddLogicRule: (rule: FormLogicRule) => void;
  onUpdateField: (fieldId: string, patch: Partial<FormFieldInstance>) => void;
}

export default function AiFormAssistantDrawer({
  isOpen,
  onClose,
  form,
  pages,
  fields,
  onAddQuestion,
  onAddLogicRule,
  onUpdateField,
}: AiFormAssistantDrawerProps) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<'suggest' | 'logic' | 'friction' | 'tone'>('suggest');

  // Tab 1: Suggest State
  const [suggestPrompt, setSuggestPrompt] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<QuestionSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [addedSuggestionIds, setAddedSuggestionIds] = React.useState<Set<string>>(new Set());

  // Tab 2: Logic Synthesizer State
  const [logicPrompt, setLogicPrompt] = React.useState('');
  const [synthesizedLogic, setSynthesizedLogic] = React.useState<SynthesizedLogicResult | null>(null);
  const [isSynthesizing, setIsSynthesizing] = React.useState(false);

  // Tab 3: Friction Audit State
  const [frictionReport, setFrictionReport] = React.useState<FormFrictionReport | null>(null);
  const [isAuditing, setIsAuditing] = React.useState(false);

  // Tab 4: Tone Rewriter State
  const [selectedFieldId, setSelectedFieldId] = React.useState<string>(fields[0]?.id || '');
  const [targetTone, setTargetTone] = React.useState<'professional' | 'friendly' | 'concise' | 'accessible'>('friendly');
  const [refinedCopy, setRefinedCopy] = React.useState<QuestionCopyRefinement | null>(null);
  const [isRefining, setIsRefining] = React.useState(false);

  // Keyboard shortcut listener (Cmd+J / Ctrl+J)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Set default selected field if fields change
  React.useEffect(() => {
    if (!selectedFieldId && fields.length > 0) {
      setSelectedFieldId(fields[0].id);
    }
  }, [fields, selectedFieldId]);

  // ────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────

  const handleFetchSuggestions = async () => {
    setIsSuggesting(true);
    try {
      const existing = fields.map(f => ({
        id: f.id,
        label: f.labelOverride || f.id,
        type: 'text',
      }));

      const res = await suggestFormQuestionsAction({
        formTitle: form.title || form.internalName || 'Untitled Form',
        formDescription: form.description,
        existingQuestions: existing,
        contextPrompt: suggestPrompt.trim() || undefined,
      });

      if (res.success) {
        setSuggestions(res.suggestions);
      } else {
        toast({ variant: 'destructive', title: 'Suggestions Failed', description: res.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAddSuggestionToForm = (suggestion: QuestionSuggestion) => {
    const newField: FormFieldInstance = {
      id: `f_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      appFieldId: `custom_${Date.now().toString(36)}`,
      required: Boolean(suggestion.isRequired),
      hidden: false,
      order: fields.length,
      width: 'full',
      labelOverride: suggestion.label,
      placeholderOverride: suggestion.placeholder,
      helpTextOverride: suggestion.helpText,
      optionsOverride: suggestion.options,
    };

    onAddQuestion(newField);
    setAddedSuggestionIds(prev => new Set(prev).add(suggestion.id));
    toast({ title: 'Question Added', description: `"${suggestion.label}" added to your form canvas.` });
  };

  const handleSynthesizeLogic = async () => {
    if (!logicPrompt.trim()) return;
    setIsSynthesizing(true);
    try {
      const availableFields = fields.map(f => ({
        id: f.id,
        label: f.labelOverride || f.id,
        type: 'text',
        options: f.optionsOverride?.map(o => ({ label: o.label, value: o.value })),
      }));
      const availablePages = pages.map(p => ({ id: p.id, title: p.title || p.id }));

      const res = await generateFormLogicWithAiAction({
        instruction: logicPrompt.trim(),
        availableFields,
        availablePages,
      });

      if (res.success && res.result) {
        setSynthesizedLogic(res.result);
      } else {
        toast({ variant: 'destructive', title: 'Logic Synthesis Failed', description: res.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleApplySynthesizedRule = (rule: FormLogicRule) => {
    onAddLogicRule(rule);
    toast({ title: 'Logic Rule Added ✨', description: `Rule "${rule.name}" added to Logic Studio.` });
  };

  const handleRunFrictionAudit = async () => {
    setIsAuditing(true);
    try {
      const questions = fields.map(f => ({
        id: f.id,
        label: f.labelOverride || f.id,
        type: 'text',
        isRequired: Boolean(f.required),
      }));

      const res = await optimizeFormWithAiAction({
        formTitle: form.title || form.internalName || 'Untitled Form',
        pagesCount: Math.max(pages.length, 1),
        questions,
      });

      if (res.success && res.report) {
        setFrictionReport(res.report);
      } else {
        toast({ variant: 'destructive', title: 'Audit Failed', description: res.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleRewriteCopy = async () => {
    const targetField = fields.find(f => f.id === selectedFieldId);
    if (!targetField) return;

    setIsRefining(true);
    try {
      const res = await rewriteQuestionCopyAction({
        label: targetField.labelOverride || targetField.id,
        placeholder: targetField.placeholderOverride,
        helpText: targetField.helpTextOverride,
        targetTone,
      });

      if (res.success && res.refined) {
        setRefinedCopy(res.refined);
      } else {
        toast({ variant: 'destructive', title: 'Rewrite Failed', description: res.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsRefining(false);
    }
  };

  const handleApplyRefinedCopy = () => {
    if (!refinedCopy || !selectedFieldId) return;
    onUpdateField(selectedFieldId, {
      labelOverride: refinedCopy.label,
      placeholderOverride: refinedCopy.placeholder,
      helpTextOverride: refinedCopy.helpText,
    });
    toast({ title: 'Copy Updated', description: 'Question wording updated in the form.' });
    setRefinedCopy(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none flex justify-end">
        {/* Backdrop for mobile */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/40 backdrop-blur-sm pointer-events-auto sm:bg-transparent sm:backdrop-blur-none"
        />

        {/* Drawer Container */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md bg-background border-l border-border/60 shadow-2xl h-full flex flex-col pointer-events-auto z-10"
        >
          {/* Drawer Header */}
          <div className="p-4 border-b border-border/40 bg-gradient-to-r from-indigo-950/40 via-background to-background flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                  AI Form Copilot
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                    Beta
                  </span>
                </h3>
                <p className="text-[10px] text-muted-foreground">Smart assistant for questions, logic & friction</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-4 p-1.5 bg-muted/20 border-b border-border/30 gap-1 text-[11px] font-semibold">
            {[
              { id: 'suggest', label: 'Suggest', icon: HelpCircle },
              { id: 'logic', label: 'Logic', icon: Zap },
              { id: 'friction', label: 'Audit', icon: ShieldCheck },
              { id: 'tone', label: 'Tone', icon: Type },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1.5 transition-all min-h-[36px] active:scale-[0.97] ${
                    activeTab === tab.id
                      ? 'bg-background text-primary shadow-sm font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Drawer Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* ── TAB 1: QUESTION SUGGESTIONS ── */}
            {activeTab === 'suggest' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">
                    What questions should we suggest?
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={suggestPrompt}
                      onChange={(e) => setSuggestPrompt(e.target.value)}
                      placeholder="e.g. Add dietary preference & room options..."
                      className="rounded-xl text-xs bg-muted/10 h-10"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFetchSuggestions(); }}
                    />
                    <Button
                      onClick={handleFetchSuggestions}
                      disabled={isSuggesting}
                      className="rounded-xl h-10 px-3 font-bold text-xs gap-1.5 shrink-0 min-h-[44px]"
                    >
                      {isSuggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                      Suggest
                    </Button>
                  </div>
                </div>

                {suggestions.length === 0 && !isSuggesting && (
                  <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-border/60 bg-muted/5 space-y-2">
                    <HelpCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs font-semibold text-foreground">No suggestions yet</p>
                    <p className="text-[10px] text-muted-foreground max-w-xs mx-auto">
                      Click &quot;Suggest&quot; or type a specific topic above to generate tailored intake questions.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {suggestions.map((sug) => {
                    const isAdded = addedSuggestionIds.has(sug.id);
                    return (
                      <div
                        key={sug.id}
                        className="p-3.5 rounded-2xl border border-border/60 bg-card hover:border-primary/40 transition-all space-y-2.5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {sug.type}
                            </span>
                            <h4 className="text-xs font-bold text-foreground mt-1">{sug.label}</h4>
                          </div>
                          <Button
                            size="sm"
                            variant={isAdded ? 'secondary' : 'default'}
                            onClick={() => handleAddSuggestionToForm(sug)}
                            disabled={isAdded}
                            className="rounded-xl h-8 px-2.5 text-[10px] font-bold gap-1 shrink-0 active:scale-95"
                          >
                            {isAdded ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-500" /> Added
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3" /> Add
                              </>
                            )}
                          </Button>
                        </div>
                        {sug.placeholder && (
                          <p className="text-[10px] text-muted-foreground italic">&ldquo;{sug.placeholder}&rdquo;</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/80 leading-relaxed bg-muted/20 p-2 rounded-xl">
                          💡 <span className="font-medium">{sug.rationale}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TAB 2: LOGIC SYNTHESIZER ── */}
            {activeTab === 'logic' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">
                    Describe your branching rule in plain English
                  </Label>
                  <Textarea
                    value={logicPrompt}
                    onChange={(e) => setLogicPrompt(e.target.value)}
                    placeholder="e.g. If applicant selects boarding, show room preferences. If age is under 18, require parent consent."
                    rows={3}
                    className="rounded-xl text-xs bg-muted/10 resize-none"
                  />
                  <Button
                    onClick={handleSynthesizeLogic}
                    disabled={isSynthesizing || !logicPrompt.trim()}
                    className="w-full rounded-xl h-10 font-bold text-xs gap-1.5 min-h-[44px]"
                  >
                    {isSynthesizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    Synthesize Logic Rule
                  </Button>
                </div>

                {synthesizedLogic && (
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        Compiled AST Rules ({synthesizedLogic.rules.length})
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground font-medium leading-relaxed">
                      {synthesizedLogic.explanation}
                    </p>

                    <div className="space-y-2 pt-2 border-t border-border/30">
                      {synthesizedLogic.rules.map((rule) => (
                        <div key={rule.id} className="p-3 rounded-xl bg-card border border-border/40 space-y-2">
                          <p className="text-xs font-bold text-foreground">{rule.name}</p>
                          <div className="text-[10px] text-muted-foreground space-y-1">
                            <p>WHEN: {rule.conditionGroup.conditions.map(c => `${c.fieldId} ${c.operator} "${c.value}"`).join(` ${rule.conditionGroup.combinator} `)}</p>
                            <p>THEN: {rule.actions.map(a => `${a.type} -> ${a.targetFieldId || a.targetPageId || a.tagId}`).join(', ')}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleApplySynthesizedRule(rule)}
                            className="w-full rounded-lg h-7 text-[10px] font-bold gap-1 mt-1"
                          >
                            <Plus className="h-3 w-3" /> Apply to Logic Studio
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: FRICTION & DROP-OFF AUDIT ── */}
            {activeTab === 'friction' && (
              <div className="space-y-4">
                <Button
                  onClick={handleRunFrictionAudit}
                  disabled={isAuditing}
                  className="w-full rounded-xl h-10 font-bold text-xs gap-1.5 min-h-[44px]"
                >
                  {isAuditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Run UX & Drop-Off Friction Audit
                </Button>

                {frictionReport && (
                  <div className="space-y-4">
                    {/* Score Card */}
                    <div className="p-4 rounded-2xl bg-card border border-border/60 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">UX Health Score</p>
                        <p className="text-2xl font-bold tracking-tight text-foreground">
                          {frictionReport.healthScore} <span className="text-xs font-semibold text-muted-foreground">/ 100</span>
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                          <Clock className="h-3 w-3 text-primary" /> Est. {frictionReport.estimatedCompletionSeconds}s
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                          <BookOpen className="h-3 w-3 text-emerald-500" /> {frictionReport.readabilityLevel} reading level
                        </p>
                      </div>
                    </div>

                    {/* Friction Points */}
                    {frictionReport.frictionPoints.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                          Identified Drop-Off Friction Points
                        </Label>
                        {frictionReport.frictionPoints.map((fp, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>{fp.issue}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{fp.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 4: TONE & COPY REWRITER ── */}
            {activeTab === 'tone' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">Select Question to Polish</Label>
                  <select
                    value={selectedFieldId}
                    onChange={(e) => setSelectedFieldId(e.target.value)}
                    aria-label="Select Question to Polish"
                    className="w-full h-10 rounded-xl px-3 text-xs bg-muted/20 border border-border/60 text-foreground"
                  >
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.labelOverride || f.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">Target Tone</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['professional', 'friendly', 'concise', 'accessible'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTargetTone(t)}
                        className={`h-8 rounded-xl text-[11px] font-semibold capitalize border transition-all active:scale-[0.97] ${
                          targetTone === t
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted text-muted-foreground border-border/60'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleRewriteCopy}
                  disabled={isRefining || !selectedFieldId}
                  className="w-full rounded-xl h-10 font-bold text-xs gap-1.5 min-h-[44px]"
                >
                  {isRefining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Type className="h-3.5 w-3.5" />}
                  Rewrite Copy
                </Button>

                {refinedCopy && (
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Rewritten Copy Preview</p>
                    <div className="space-y-1.5 text-xs">
                      <p><span className="font-bold">Label:</span> {refinedCopy.label}</p>
                      {refinedCopy.placeholder && <p><span className="font-bold">Placeholder:</span> {refinedCopy.placeholder}</p>}
                      {refinedCopy.helpText && <p><span className="font-bold">Help Text:</span> {refinedCopy.helpText}</p>}
                    </div>
                    <p className="text-[10px] text-muted-foreground italic bg-background/50 p-2 rounded-xl">
                      {refinedCopy.toneExplanation}
                    </p>
                    <Button
                      onClick={handleApplyRefinedCopy}
                      className="w-full rounded-xl h-9 text-xs font-bold gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" /> Apply Rewritten Copy
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
