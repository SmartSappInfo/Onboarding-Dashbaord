'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormFieldInstance, AppField } from '@/lib/types';
import { processFormSubmissionAction } from '@/lib/forms-actions';
import { initializeFormSessionAction, recordFormEventAction } from '@/lib/forms/form-session-actions';
import { evaluateFormLogic } from '@/lib/forms/logic-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import FormSuccessScreen from './FormSuccessScreen';
import type { OrgBranding } from '@/lib/types';
import Footer from '@/components/footer';
import { useIframeHeightReporter } from '@/hooks/useIframeHeightReporter';
import { useTheme } from 'next-themes';
import { useSearchParams } from 'next/navigation';
import { extractTrackingParams } from '@/lib/tracking-utils';

interface ResolvedField extends FormFieldInstance {
  fieldDefinition: AppField;
}

import type { KnownRespondentProfile } from '@/lib/forms/identity-resolution';

interface FormRendererProps {
  form: Form;
  resolvedFields: ResolvedField[];
  isEmbed?: boolean;
  entityId?: string;
  orgBranding?: OrgBranding | null;
  knownProfile?: KnownRespondentProfile;
}

export default function FormRenderer({ 
  form, 
  resolvedFields, 
  isEmbed, 
  entityId,
  orgBranding,
  knownProfile,
}: FormRendererProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trackingParams, setTrackingParams] = useState<Record<string, string>>({});
  const { setTheme } = useTheme();
  const searchParams = useSearchParams();

  // Auto-report iframe height if embedded
  useIframeHeightReporter(form.slug);

  /**
   * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
   * Theme & Tracking Synchronization
   * ----------------------------------
   * 1. Detects `theme=dark` or `theme=light` query parameter passed from parent page or iframe modal.
   * 2. Listens for `postMessage` theme events for dynamic live preview switching.
   * 3. Prevents XSS by strictly checking theme values against 'dark' | 'light' enums.
   */
  useEffect(() => {
    setTrackingParams(extractTrackingParams());

    const themeParam = searchParams?.get('theme');
    if (themeParam === 'dark' || themeParam === 'light') {
      setTheme(themeParam);
    }

    const handlePostMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object') {
        const type = event.data.type;
        const requestedTheme = event.data.theme;
        if ((type === 'theme_change' || type === 'set_theme') && (requestedTheme === 'dark' || requestedTheme === 'light')) {
          setTheme(requestedTheme);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', handlePostMessage);
      return () => window.removeEventListener('message', handlePostMessage);
    }
  }, [searchParams, setTheme]);

  // 1. Build Dynamic Zod Schema
  const schemaObject: Record<string, any> = {};
  resolvedFields.forEach((field) => {
    let fieldSchema: any = z.string();
    const type = field.fieldDefinition.type;
    
    if (type === 'email') {
      fieldSchema = z.string().email('Invalid email address');
    } else if (type === 'number' || type === 'currency') {
      fieldSchema = z.preprocess(
        (v) => (v === '' ? undefined : Number(v)),
        z.number({ invalid_type_error: 'Must be a number' })
      );
    } else if (type === 'date') {
      fieldSchema = z.string().min(1, 'Date is required');
    }
    
    if (field.required) {
      if (type !== 'number' && type !== 'currency') {
        fieldSchema = fieldSchema.min(1, `${field.labelOverride || field.fieldDefinition.label} is required`);
      }
    } else {
      fieldSchema = fieldSchema.optional().nullable();
    }
    
    schemaObject[field.fieldDefinition.variableName] = fieldSchema;
  });

  const schema = z.object(schemaObject);

  // 2. Initialize Form with Default Values (and Progressive Profiling auto-fill)
  const defaultValues: Record<string, unknown> = {};
  resolvedFields.forEach((field) => {
    const varName = field.fieldDefinition.variableName;
    if (knownProfile?.knownValues[varName] !== undefined) {
      defaultValues[varName] = knownProfile.knownValues[varName];
    } else if (field.defaultValueOverride !== undefined) {
      defaultValues[varName] = field.defaultValueOverride;
    }
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
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

  // Evaluate dynamic logic rules, calculations and scores
  const logicResult = React.useMemo(() => {
    return evaluateFormLogic(
      form.logicRules || [],
      form.scoreRules || [],
      form.calculations || [],
      watchedValues,
      fieldAliasMap
    );
  }, [form.logicRules, form.scoreRules, form.calculations, watchedValues, fieldAliasMap]);

  const [sessionId, setSessionId] = useState<string | null>(null);

  // Initialize session tracking for conversion funnel and drop-off analytics
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await initializeFormSessionAction({
          formId: form.id,
          versionId: form.publishedVersionId || form.currentVersionId,
          workspaceId: form.workspaceId,
          organizationId: form.organizationId,
          utmSource: trackingParams.utmSource,
          utmMedium: trackingParams.utmMedium,
          utmCampaign: trackingParams.utmCampaign,
          device: typeof window !== 'undefined' 
            ? (window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop')
            : 'desktop',
        });
        if (isMounted && res.success && res.sessionId) {
          setSessionId(res.sessionId);
        }
      } catch {
        // Non-blocking telemetry
      }
    })();
    return () => { isMounted = false; };
  }, [form.id, form.publishedVersionId, form.currentVersionId, form.workspaceId, form.organizationId, trackingParams]);

  // 3. Handle Submit
  const onSubmit = async (data: Record<string, unknown>) => {
    if (logicResult.isDisqualified) {
      alert(logicResult.disqualificationMessage || 'Thank you for your submission.');
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
        if (sessionId) {
          recordFormEventAction({
            sessionId,
            formId: form.id,
            eventType: 'form_submit',
          }).catch(() => {});
        }
        setIsSubmitted(true);
      } else {
        alert(result.error || 'Failed to submit form');
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

  // 4. Styles based on Theme
  const theme = form.theme;
  const isGlass = theme.backgroundStyle === 'glass';
  const radiusMap: Record<string, string> = { none: 'rounded-none', small: 'rounded-md', medium: 'rounded-xl', large: 'rounded-3xl' };
  const cardRadius = radiusMap[theme.borderRadius || 'medium'];
  const cardWidthClass = theme.cardWidth === 'sm' ? 'max-w-md' : theme.cardWidth === 'lg' ? 'max-w-4xl' : 'max-w-2xl';

  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-4 min-h-screen transition-all duration-500",
      !isEmbed && "bg-slate-50"
    )} style={{ accentColor: theme.accentColor }}>
      
      <div className={cn(
        "w-full transition-all duration-700",
        cardWidthClass,
        isGlass ? "glass shadow-2xl border border-white/20 p-8 sm:p-12 mb-10" : "bg-white shadow-xl border border-slate-200 p-8 sm:p-12 mb-10",
        cardRadius
      )}>
        {/* Progressive Profiling Pre-Fill Indicator */}
        {knownProfile?.name && (
          <div className="mb-6 p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              👋 Pre-filled for <span className="font-bold text-primary">{knownProfile.name}</span>
            </span>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Data synchronized with your CRM record
            </span>
          </div>
        )}
        
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-3">
            {form.title}
          </h1>
          {form.description && (
            <p className="text-slate-500 text-lg">
              {form.description}
            </p>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 gap-y-6">
            {resolvedFields.map((field) => {
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
                    className="text-sm font-semibold text-slate-700 ml-1"
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
                        "min-h-[120px] transition-all focus:ring-2",
                        isGlass ? "bg-white/50 border-white/30" : "bg-slate-50 border-slate-200",
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
                        "h-12 w-full px-3.5 bg-white border border-slate-200 rounded-xl text-sm transition-all focus:ring-2 focus:ring-primary focus:outline-none",
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
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                        <input
                          type="radio"
                          value="yes"
                          disabled={isDisabled}
                          {...register(field.fieldDefinition.variableName)}
                          className="h-4 w-4 text-primary focus:ring-primary"
                        />
                        <span>Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
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
                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-700 pt-1">
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
                        type === 'date' ? 'date' :
                        'text'
                      }
                      placeholder={field.placeholderOverride || field.fieldDefinition.placeholder}
                      {...register(field.fieldDefinition.variableName)}
                      className={cn(
                        "h-12 transition-all focus:ring-2",
                        isGlass ? "bg-white/50 border-white/30" : "bg-slate-50 border-slate-200",
                        errors[field.fieldDefinition.variableName] && "border-rose-500 focus:ring-rose-200",
                        isDisabled && "opacity-50 cursor-not-allowed"
                      )}
                    />
                  )}

                  {displayHelp && (
                    <p className="text-xs text-slate-500 mt-1 ml-1 leading-normal">
                      {displayHelp}
                    </p>
                  )}
                  
                  {errors[field.fieldDefinition.variableName] && (
                    <p className="text-xs font-bold text-rose-500 mt-1 ml-1 uppercase tracking-tighter">
                      {(errors[field.fieldDefinition.variableName] as any)?.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Logic Warning Messages */}
          {logicResult.activeMessages.length > 0 && (
            <div className="space-y-2">
              {logicResult.activeMessages.map((msg, i) => (
                <div key={i} className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                  {msg}
                </div>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-6">
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full h-14 text-lg font-bold shadow-lg transition-all active:scale-[0.98]",
                "hover:shadow-xl group"
              )}
              style={{ backgroundColor: theme.accentColor }}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <>
                  {theme.ctaLabel || 'Submit Form'}
                  <Send className="ml-2 h-5 w-5 opacity-70 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Branding */}
        {!isEmbed && orgBranding?.landingPageFooterEnabled !== false && (
          <Footer orgBranding={orgBranding} className="mt-12 bg-transparent text-slate-500 pt-8" />
        )}
      </div>
    </div>
  );
}
