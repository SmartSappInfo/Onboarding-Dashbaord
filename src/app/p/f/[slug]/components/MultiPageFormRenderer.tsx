'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Form, FormFieldInstance, AppField, OrgBranding } from '@/lib/types';
import type { FormPage, FormComponent } from '@/lib/forms/form-types';
import { processFormSubmissionAction } from '@/lib/forms-actions';
import { initializeFormSessionAction, recordFormEventAction } from '@/lib/forms/form-session-actions';
import { recordFormTelemetryEventAction } from '@/lib/forms/form-analytics-actions';
import { saveFormDraftAction, loadFormDraftAction } from '@/lib/forms/form-draft-actions';
import { FormDraftService } from '@/lib/forms/form-draft-service';
import { evaluateFormLogic } from '@/lib/forms/logic-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  Bookmark,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import FormSuccessScreen from './FormSuccessScreen';
import Footer from '@/components/footer';
import { useIframeHeightReporter } from '@/hooks/useIframeHeightReporter';

import type { KnownRespondentProfile } from '@/lib/forms/identity-resolution';

export interface ResolvedField extends FormFieldInstance {
  fieldDefinition: AppField;
}

interface MultiPageFormRendererProps {
  form: Form;
  pages: FormPage[];
  resolvedFields: ResolvedField[];
  orgBranding?: OrgBranding;
  isEmbed?: boolean;
  entityId?: string;
  trackingParams?: Record<string, string>;
  initialDraftToken?: string;
  knownProfile?: KnownRespondentProfile;
}

export default function MultiPageFormRenderer({
  form,
  pages,
  resolvedFields,
  orgBranding,
  isEmbed = false,
  entityId,
  trackingParams = {},
  initialDraftToken,
  knownProfile,
}: MultiPageFormRendererProps) {
  useIframeHeightReporter(form.slug);

  const [currentPageIndex, setCurrentPageIndex] = React.useState(0);
  const [direction, setDirection] = React.useState<1 | -1>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | null>(null);

  // Resume Later State
  const [isResumeModalOpen, setIsResumeModalOpen] = React.useState(false);
  const [resumeEmail, setResumeEmail] = React.useState('');
  const [generatedResumeUrl, setGeneratedResumeUrl] = React.useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);
  const [draftSavedTime, setDraftSavedTime] = React.useState<string | null>(null);

  // 1. Resolve Fields Map
  const fieldsMap = React.useMemo(() => {
    const map = new Map<string, ResolvedField>();
    resolvedFields.forEach(rf => map.set(rf.id, rf));
    return map;
  }, [resolvedFields]);

  // 2. Build Zod Validation Schema
  const schemaObject: Record<string, z.ZodTypeAny> = {};
  resolvedFields.forEach(field => {
    const varName = field.fieldDefinition.variableName;
    const isRequired = field.required ?? field.fieldDefinition.validationRules?.required;
    const type = field.fieldDefinition.type;

    if (type === 'email') {
      let emailValidator = z.string().email('Please enter a valid email address');
      if (isRequired) {
        schemaObject[varName] = emailValidator;
      } else {
        schemaObject[varName] = emailValidator.optional().or(z.literal(''));
      }
    } else if (type === 'number' || type === 'currency') {
      let numValidator = z.coerce.number();
      if (!isRequired) {
        schemaObject[varName] = numValidator.optional();
      } else {
        schemaObject[varName] = numValidator;
      }
    } else {
      let strValidator = z.string();
      if (isRequired) {
        schemaObject[varName] = strValidator.min(1, `${field.labelOverride || field.fieldDefinition.label} is required`);
      } else {
        schemaObject[varName] = strValidator.optional().or(z.literal(''));
      }
    }
  });

  const schema = z.object(schemaObject);

  // Default values with Progressive Profiling auto-fill
  const defaultValues: Record<string, unknown> = {};
  resolvedFields.forEach(f => {
    const varName = f.fieldDefinition.variableName;
    if (knownProfile?.knownValues[varName] !== undefined) {
      defaultValues[varName] = knownProfile.knownValues[varName];
    } else if (f.defaultValueOverride !== undefined) {
      defaultValues[varName] = f.defaultValueOverride;
    }
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
  });

  const watchedValues = watch();

  // Field Alias Map: bridges field instance ID <-> CRM variableName
  const fieldAliasMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    resolvedFields.forEach(rf => {
      map[rf.id] = rf.fieldDefinition.variableName;
      map[rf.fieldDefinition.variableName] = rf.id;
    });
    return map;
  }, [resolvedFields]);

  // Evaluate dynamic logic rules
  const logicResult = React.useMemo(() => {
    return evaluateFormLogic(
      form.logicRules || [],
      form.scoreRules || [],
      form.calculations || [],
      watchedValues,
      fieldAliasMap
    );
  }, [form.logicRules, form.scoreRules, form.calculations, watchedValues, fieldAliasMap]);

  // Local Autosave (debounced)
  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (Object.keys(watchedValues).length > 0) {
        FormDraftService.saveLocalDraft(form.id, watchedValues, currentPageIndex);
        setDraftSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    }, 800);
    return () => clearTimeout(handler);
  }, [form.id, watchedValues, currentPageIndex]);

  // Restore Draft on Mount (Token or LocalStorage)
  React.useEffect(() => {
    (async () => {
      if (initialDraftToken) {
        const res = await loadFormDraftAction(initialDraftToken);
        if (res.success && res.draft) {
          Object.entries(res.draft.data).forEach(([k, v]) => setValue(k, v));
          const targetPageIdx = pages.findIndex(p => p.id === res.draft?.currentPageId);
          if (targetPageIdx >= 0) setCurrentPageIndex(targetPageIdx);
          return;
        }
      }

      // Check local storage draft
      const local = FormDraftService.getLocalDraft(form.id);
      if (local && local.data) {
        Object.entries(local.data).forEach(([k, v]) => setValue(k, v));
        if (local.currentPageIndex < pages.length) {
          setCurrentPageIndex(local.currentPageIndex);
        }
      }
    })();
  }, [form.id, initialDraftToken, pages, setValue]);

  // Session Telemetry & Tracking References
  const hasStartedRef = React.useRef(false);
  const startTimeRef = React.useRef(Date.now());

  // Initialize Session Telemetry
  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const deviceType = typeof window !== 'undefined'
          ? window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop'
          : 'desktop';

        const res = await initializeFormSessionAction({
          formId: form.id,
          versionId: form.publishedVersionId || form.currentVersionId,
          workspaceId: form.workspaceId,
          organizationId: form.organizationId,
          utmSource: trackingParams.utmSource,
          utmMedium: trackingParams.utmMedium,
          utmCampaign: trackingParams.utmCampaign,
          device: deviceType,
        });
        if (isMounted && res.success && res.sessionId) {
          setSessionId(res.sessionId);
          // Dispatch daily rollup page view
          recordFormTelemetryEventAction({
            formId: form.id,
            workspaceId: form.workspaceId,
            organizationId: form.organizationId,
            eventType: 'page_view',
            sessionId: res.sessionId,
            deviceType: deviceType as 'desktop' | 'mobile' | 'tablet',
            utmSource: trackingParams.utmSource,
            utmMedium: trackingParams.utmMedium,
            utmCampaign: trackingParams.utmCampaign,
            referrer: typeof document !== 'undefined' ? document.referrer : undefined,
          }).catch(() => {});
        }
      } catch {
        // Non-blocking telemetry
      }
    })();
    return () => { isMounted = false; };
  }, [form.id, form.publishedVersionId, form.currentVersionId, form.workspaceId, form.organizationId, trackingParams]);

  // Record first form interaction start
  const handleFormInteraction = React.useCallback(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    recordFormTelemetryEventAction({
      formId: form.id,
      workspaceId: form.workspaceId,
      organizationId: form.organizationId,
      eventType: 'form_started',
      sessionId: sessionId || 'anon',
    }).catch(() => {});
  }, [form.id, form.workspaceId, form.organizationId, sessionId]);

  // Active Page & Navigation
  const activePage = pages[currentPageIndex] || pages[0];
  const isFirstPage = currentPageIndex === 0;
  const isLastPage = currentPageIndex === pages.length - 1;
  const progressPercent = Math.round(((currentPageIndex + 1) / pages.length) * 100);

  // Validate only fields on the active page before advancing
  const handleNextPage = async () => {
    if (!activePage) return;

    // Get variable names of fields on the current page
    const pageVarNames: string[] = [];
    activePage.components.forEach(c => {
      const fieldId = c.fieldId || c.field?.id;
      if (fieldId && fieldsMap.has(fieldId)) {
        const rf = fieldsMap.get(fieldId)!;
        if (!logicResult.hiddenFieldIds.has(fieldId)) {
          pageVarNames.push(rf.fieldDefinition.variableName);
        }
      }
    });

    const isPageValid = await trigger(pageVarNames);
    if (!isPageValid) return;

    // Check dynamic logic branching jump
    if (logicResult.nextPageId) {
      const targetIdx = pages.findIndex(p => p.id === logicResult.nextPageId);
      if (targetIdx >= 0 && targetIdx > currentPageIndex) {
        setDirection(1);
        setCurrentPageIndex(targetIdx);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Telemetry
        recordFormTelemetryEventAction({
          formId: form.id,
          workspaceId: form.workspaceId,
          organizationId: form.organizationId,
          eventType: 'page_step',
          sessionId: sessionId || 'anon',
          pageIndex: targetIdx,
          pageId: pages[targetIdx]?.id,
        }).catch(() => {});
        return;
      }
    }

    // Step forward, skipping any hidden pages
    let nextIdx = currentPageIndex + 1;
    while (nextIdx < pages.length && logicResult.hiddenPageIds.has(pages[nextIdx].id)) {
      nextIdx++;
    }
    if (nextIdx < pages.length) {
      setDirection(1);
      setCurrentPageIndex(nextIdx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Telemetry
      recordFormTelemetryEventAction({
        formId: form.id,
        workspaceId: form.workspaceId,
        organizationId: form.organizationId,
        eventType: 'page_step',
        sessionId: sessionId || 'anon',
        pageIndex: nextIdx,
        pageId: pages[nextIdx]?.id,
      }).catch(() => {});
    }
  };

  const handlePrevPage = () => {
    let prevIdx = currentPageIndex - 1;
    while (prevIdx >= 0 && logicResult.hiddenPageIds.has(pages[prevIdx].id)) {
      prevIdx--;
    }
    if (prevIdx >= 0) {
      setDirection(-1);
      setCurrentPageIndex(prevIdx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Handle Save & Resume Later
  const handleSaveAndResume = async () => {
    setIsSavingDraft(true);
    try {
      const res = await saveFormDraftAction({
        formId: form.id,
        versionId: form.publishedVersionId || form.currentVersionId,
        email: resumeEmail || undefined,
        data: watchedValues,
        currentPageId: activePage.id,
      });

      if (res.success && res.draftToken) {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const url = `${baseUrl}/p/f/${form.slug}?draft=${res.draftToken}`;
        setGeneratedResumeUrl(url);
      }
    } catch {
      alert('Could not save draft. Please try again.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Final Form Submission
  const onSubmit = async (data: Record<string, unknown>) => {
    if (logicResult.isDisqualified) {
      alert(logicResult.disqualificationMessage || 'Thank you for your interest.');
      return;
    }

    setIsSubmitting(true);
    try {
      const mergedData = {
        ...data,
        ...logicResult.overrideValues,
      };

      const result = await processFormSubmissionAction({
        formId: form.id,
        data: mergedData,
        entityId,
        metadata: {
          ...trackingParams,
          totalScore: logicResult.totalScore,
          scoreBreakdown: logicResult.scoreBreakdown,
          appliedTags: logicResult.appliedTags,
        },
      });

      if (result.success) {
        FormDraftService.clearLocalDraft(form.id);
        const dwellSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
        if (sessionId) {
          recordFormEventAction({
            sessionId,
            formId: form.id,
            eventType: 'form_submit',
          }).catch(() => {});
        }
        recordFormTelemetryEventAction({
          formId: form.id,
          workspaceId: form.workspaceId,
          organizationId: form.organizationId,
          eventType: 'form_submitted',
          sessionId: sessionId || 'anon',
          dwellSeconds,
        }).catch(() => {});
        setIsSubmitted(true);
      } else {
        alert(result.error || 'Failed to submit form.');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Submission error:', msg);
      alert('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <FormSuccessScreen
        form={form}
        orgBranding={orgBranding}
        trackingParams={trackingParams}
        isInModal={isEmbed}
      />
    );
  }

  const theme = form.theme || {
    preset: 'professional',
    cardWidth: 'md',
    inputStyle: 'outline',
    labelPlacement: 'top',
    ctaLabel: 'Submit Application',
    ctaStyle: 'solid',
    ctaWidth: 'full',
    ctaAlignment: 'center',
    backgroundStyle: 'solid',
  };

  const isGlass = theme.backgroundStyle === 'glass';

  return (
    <div className={cn("min-h-screen flex flex-col justify-between", isEmbed && "min-h-0")}>
      <div className={cn(
        "w-full mx-auto p-4 sm:p-8 md:p-10 my-4 sm:my-8 rounded-3xl transition-all",
        theme.cardWidth === 'sm' ? 'max-w-lg' : theme.cardWidth === 'lg' ? 'max-w-4xl' : theme.cardWidth === 'full' ? 'max-w-full' : 'max-w-2xl',
        isGlass
          ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/30 shadow-2xl'
          : 'bg-card border border-border shadow-xl'
      )}>
        {/* Progressive Profiling Pre-Fill Indicator */}
        {knownProfile?.name && (
          <div className="mb-6 p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">
              👋 Pre-filled for <span className="font-bold text-primary">{knownProfile.name}</span>
            </span>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Data synchronized with your CRM record
            </span>
          </div>
        )}

        {/* Top Header & Progressive Stepper */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Step {currentPageIndex + 1} of {pages.length}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {activePage?.title || form.title}
              </h1>
            </div>
            
            {/* Save & Resume Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsResumeModalOpen(true)}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 shrink-0"
            >
              <Bookmark className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Save & Resume</span>
            </Button>
          </div>

          {activePage?.description && (
            <p className="text-sm text-muted-foreground">{activePage.description}</p>
          )}

          {/* Step Breadcrumbs / Progress Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {pages.map((p, idx) => {
              const isCurrent = idx === currentPageIndex;
              const isPast = idx < currentPageIndex;
              const isHidden = logicResult.hiddenPageIds.has(p.id);
              if (isHidden) return null;

              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl transition-all shrink-0 select-none",
                    isCurrent
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isPast
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/40 text-muted-foreground"
                  )}
                >
                  <span className="text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span className="hidden sm:inline truncate max-w-[120px]">
                    {p.title || `Page ${idx + 1}`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress Bar & Autosave Status */}
          <div className="space-y-1.5 pt-1">
            <Progress value={progressPercent} className="h-2 rounded-full" />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{progressPercent}% completed</span>
              {draftSavedTime && (
                <span className="flex items-center gap-1 opacity-70">
                  <Clock className="h-3 w-3" /> Autosaved at {draftSavedTime}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Multi-Page Animated Canvas */}
        <form onSubmit={handleSubmit(onSubmit)} onFocusCapture={handleFormInteraction} className="space-y-8">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activePage?.id || currentPageIndex}
              custom={direction}
              initial={{ opacity: 0, x: direction === 1 ? 40 : -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction === 1 ? -40 : 40 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 gap-y-6">
                {(activePage?.components || []).map((comp: FormComponent) => {
                  const fieldId = comp.fieldId || comp.field?.id;
                  if (!fieldId || !fieldsMap.has(fieldId)) return null;

                  const field = fieldsMap.get(fieldId)!;
                  const type = field.fieldDefinition.type;

                  const isConcealedByProgressiveProfiling = 
                    Boolean((form.actions?.progressiveProfiling?.hideKnownFields || (form.actions as any)?.hideKnownFields) &&
                    knownProfile?.alreadyCapturedFieldKeys.includes(field.fieldDefinition.variableName));

                  if (field.hidden || logicResult.hiddenFieldIds.has(field.id) || isConcealedByProgressiveProfiling) {
                    return (
                      <input
                        key={field.id}
                        type="hidden"
                        {...register(field.fieldDefinition.variableName)}
                      />
                    );
                  }

                  const displayLabel = logicResult.labelOverrides[field.id] || field.labelOverride || field.fieldDefinition.label;
                  const displayHelp = logicResult.helpTextOverrides[field.id] || field.helpTextOverride || field.fieldDefinition.helpText;
                  const isDisabled = logicResult.disabledFieldIds.has(field.id);
                  const isReq = field.required || logicResult.requiredFieldIds.has(field.id);

                  return (
                    <div key={field.id} className="space-y-2">
                      <Label
                        htmlFor={field.fieldDefinition.variableName}
                        className="text-sm font-semibold text-foreground ml-1"
                      >
                        {displayLabel}
                        {isReq && <span className="text-rose-500 ml-1">*</span>}
                      </Label>

                      {type === 'long_text' ? (
                        <Textarea
                          id={field.fieldDefinition.variableName}
                          disabled={isDisabled}
                          placeholder={field.placeholderOverride || field.fieldDefinition.placeholder}
                          {...register(field.fieldDefinition.variableName)}
                          className={cn(
                            "min-h-[120px] transition-all focus:ring-2 rounded-2xl",
                            errors[field.fieldDefinition.variableName] && "border-rose-500 focus:ring-rose-200",
                            isDisabled && "opacity-50 cursor-not-allowed"
                          )}
                        />
                      ) : type === 'select' && (field.fieldDefinition.options?.length || 0) > 0 ? (
                        <select
                          id={field.fieldDefinition.variableName}
                          disabled={isDisabled}
                          {...register(field.fieldDefinition.variableName)}
                          className={cn(
                            "h-12 w-full px-3.5 bg-background border border-input rounded-2xl text-sm transition-all focus:ring-2 focus:ring-primary focus:outline-none",
                            errors[field.fieldDefinition.variableName] && "border-rose-500 focus:ring-rose-200",
                            isDisabled && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <option value="">{field.placeholderOverride || field.fieldDefinition.placeholder || 'Select an option...'}</option>
                          {field.fieldDefinition.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label || opt.value}
                            </option>
                          ))}
                        </select>
                      ) : type === 'yes_no' ? (
                        <div className="flex items-center gap-4 pt-1">
                          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                            <input
                              type="radio"
                              value="yes"
                              disabled={isDisabled}
                              {...register(field.fieldDefinition.variableName)}
                              className="h-4 w-4 text-primary focus:ring-primary"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                            <input
                              type="radio"
                              value="no"
                              disabled={isDisabled}
                              {...register(field.fieldDefinition.variableName)}
                              className="h-4 w-4 text-primary focus:ring-primary"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      ) : type === 'checkbox' ? (
                        <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium pt-1">
                          <input
                            type="checkbox"
                            disabled={isDisabled}
                            {...register(field.fieldDefinition.variableName)}
                            className="h-4 w-4 rounded text-primary focus:ring-primary"
                          />
                          <span>{field.placeholderOverride || field.fieldDefinition.placeholder || displayLabel}</span>
                        </label>
                      ) : (
                        <Input
                          id={field.fieldDefinition.variableName}
                          disabled={isDisabled}
                          type={
                            type === 'email' ? 'email' :
                            type === 'phone' ? 'tel' :
                            type === 'number' || type === 'currency' ? 'number' :
                            type === 'date' ? 'date' : 'text'
                          }
                          placeholder={field.placeholderOverride || field.fieldDefinition.placeholder}
                          {...register(field.fieldDefinition.variableName)}
                          className={cn(
                            "h-12 transition-all focus:ring-2 rounded-2xl",
                            errors[field.fieldDefinition.variableName] && "border-rose-500 focus:ring-rose-200",
                            isDisabled && "opacity-50 cursor-not-allowed"
                          )}
                        />
                      )}

                      {displayHelp && (
                        <p className="text-xs text-muted-foreground mt-1 ml-1 leading-normal">
                          {displayHelp}
                        </p>
                      )}

                      {errors[field.fieldDefinition.variableName] && (
                        <p className="text-xs font-bold text-rose-500 mt-1 ml-1 uppercase tracking-tighter">
                          {String(errors[field.fieldDefinition.variableName]?.message || '')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Active Warning Messages */}
              {logicResult.activeMessages.length > 0 && (
                <div className="space-y-2">
                  {logicResult.activeMessages.map((msg, i) => (
                    <div key={i} className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                      {msg}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Stepper Navigation Actions */}
          <div className="pt-6 border-t flex items-center justify-between gap-4 sticky bottom-0 bg-background/95 backdrop-blur-md p-4 -mx-4 -mb-4 sm:static sm:p-0 sm:m-0 sm:bg-transparent rounded-b-3xl z-10">
            {!isFirstPage ? (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevPage}
                className="h-12 px-6 rounded-2xl font-bold gap-2 text-sm"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            ) : <div />}

            {!isLastPage ? (
              <Button
                type="button"
                onClick={handleNextPage}
                className="h-12 px-8 rounded-2xl font-bold gap-2 text-sm shadow-md"
              >
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-14 px-8 rounded-2xl font-bold gap-2 text-base shadow-lg transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {theme.ctaLabel || 'Submit Application'}
                    <Send className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Resume Later Dialog */}
      <Dialog open={isResumeModalOpen} onOpenChange={setIsResumeModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-primary" /> Save & Resume Later
            </DialogTitle>
            <DialogDescription className="text-xs">
              Save your progress securely. You can return and complete this form anytime within the next 30 days.
            </DialogDescription>
          </DialogHeader>

          {generatedResumeUrl ? (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-600 text-xs font-semibold">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Your draft has been securely saved!</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Your Unique Resume Link</Label>
                <div className="flex items-center gap-2">
                  <Input value={generatedResumeUrl} readOnly className="text-xs font-mono h-9 rounded-xl" />
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedResumeUrl);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="h-9 px-3 rounded-xl shrink-0"
                  >
                    {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Email Address (Optional)</Label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={resumeEmail}
                  onChange={e => setResumeEmail(e.target.value)}
                  className="text-xs h-10 rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground">
                  Provide your email if you want a direct magic resume link sent to your inbox.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {generatedResumeUrl ? (
              <Button onClick={() => setIsResumeModalOpen(false)} className="w-full rounded-xl font-bold">
                Done
              </Button>
            ) : (
              <Button
                onClick={handleSaveAndResume}
                disabled={isSavingDraft}
                className="w-full rounded-xl font-bold gap-2"
              >
                {isSavingDraft && <Loader2 className="h-4 w-4 animate-spin" />}
                Generate Resume Link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isEmbed && <Footer />}
    </div>
  );
}
