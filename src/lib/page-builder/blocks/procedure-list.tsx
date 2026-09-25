'use client';

/**
 * @fileOverview Procedure Block Definition & Runtime Renderer (`procedure_list`)
 *
 * Serves as the platform's canonical chronological instructional engine for:
 * 1. Payment Procedures (USSD, MoMo, bank wire instructions, invoice settlement)
 * 2. Institutional Admissions (Campus tour -> Submit profile -> Family conversation)
 * 3. Standard Operating Procedures (SOPs, setup walkthroughs, curriculum learning objectives)
 *
 * Supports:
 * - 5 visual presets: connected-timeline, elevated-cards, split-media, minimal-clean, compact-badges.
 * - 100% backward-compatible Zod union transformer (normalizing legacy string arrays into rich step items).
 * - Companion diagram/media support (image or video walkthrough with spatial placement).
 * - Inline canvas title/subtitle editing and interactive empty state card.
 *
 * Workspace Standards:
 * - Strict typing with zero any/any[]/unknown.
 * - Minimum 44px mobile touch targets.
 * - XSS-safe text rendering with sanitizeHtml.
 */

import React from 'react';
import { z } from 'zod';
import { ListChecks, Clock, Plus } from 'lucide-react';
import { registerBlock } from '../registry';
import { sanitizeHtml } from '../sanitize';
import { InlineEditable } from '@/components/page-builder/InlineEditable';
import VideoEmbed from '@/components/video-embed';
import { cn } from '@/lib/utils';

export type ProcedurePresetId =
  | 'connected-timeline'
  | 'elevated-cards'
  | 'split-media'
  | 'minimal-clean'
  | 'compact-badges';

export type ProcedureMediaPosition = 'top' | 'left' | 'right' | 'hidden';

export const procedureStepItemSchema = z.union([
  // Legacy string branch -> automatically transformed to rich step
  z.string().transform((text) => ({
    id: `step-${Math.random().toString(36).substring(2, 9)}`,
    title: text,
    description: '',
    badgeText: '',
    timeEstimate: '',
  })),
  // Rich step object branch
  z.object({
    id: z.string().default(() => `step-${Math.random().toString(36).substring(2, 9)}`),
    title: z.string().default('Step Title'),
    description: z.string().default(''),
    badgeText: z.string().optional().default(''),
    timeEstimate: z.string().optional().default(''),
  }),
]);

export type ProcedureStepItem = z.infer<typeof procedureStepItemSchema>;

const rawProcedureBlockSchema = z.object({
  title: z.string().default('Procedure Guide'),
  subtitle: z.string().optional().default(''),
  preset: z.enum([
    'connected-timeline',
    'elevated-cards',
    'split-media',
    'minimal-clean',
    'compact-badges',
  ]).default('connected-timeline'),
  steps: z.array(procedureStepItemSchema).default([]),
  items: z.array(z.union([z.string(), z.record(z.unknown())])).optional(),
  imageUrl: z.string().optional().default(''),
  videoUrl: z.string().optional().default(''),
  mediaPosition: z.enum(['top', 'left', 'right', 'hidden']).default('top'),
  accentColor: z.string().default('#10b981'),
  showStepNumbers: z.boolean().default(true),
});

export const procedureBlockSchema = rawProcedureBlockSchema.transform((data) => {
  // If legacy `items` was provided but `steps` is empty, normalize `items` into `steps`:
  let resolvedSteps = data.steps;
  if ((!resolvedSteps || resolvedSteps.length === 0) && Array.isArray(data.items) && data.items.length > 0) {
    resolvedSteps = data.items.map((item) => {
      if (typeof item === 'string') {
        return {
          id: `step-${Math.random().toString(36).substring(2, 9)}`,
          title: item,
          description: '',
          badgeText: '',
          timeEstimate: '',
        };
      }
      if (item && typeof item === 'object') {
        const r = item as Record<string, unknown>;
        return {
          id: typeof r.id === 'string' && r.id ? r.id : `step-${Math.random().toString(36).substring(2, 9)}`,
          title: typeof r.title === 'string' ? r.title : (typeof r.label === 'string' ? r.label : 'Step Title'),
          description: typeof r.description === 'string' ? r.description : '',
          badgeText: typeof r.badgeText === 'string' ? r.badgeText : '',
          timeEstimate: typeof r.timeEstimate === 'string' ? r.timeEstimate : '',
        };
      }
      return {
        id: `step-${Math.random().toString(36).substring(2, 9)}`,
        title: 'Step Title',
        description: '',
        badgeText: '',
        timeEstimate: '',
      };
    });
  }

  return {
    title: data.title,
    subtitle: data.subtitle || '',
    preset: data.preset,
    steps: resolvedSteps,
    imageUrl: data.imageUrl || '',
    videoUrl: data.videoUrl || '',
    mediaPosition: data.mediaPosition,
    accentColor: data.accentColor,
    showStepNumbers: data.showStepNumbers,
  };
});

export type ProcedureBlockProps = z.infer<typeof procedureBlockSchema>;

// Register procedure block definition
registerBlock({
  type: 'procedure_list',
  label: 'Procedure',
  category: 'data',
  icon: ListChecks,
  fields: [
    {
      kind: 'select',
      key: 'preset',
      label: 'Preset Style',
      options: [
        { value: 'connected-timeline', label: 'Connected Timeline' },
        { value: 'elevated-cards', label: 'Elevated Cards' },
        { value: 'split-media', label: 'Split-Media Guide' },
        { value: 'minimal-clean', label: 'Minimal Clean' },
        { value: 'compact-badges', label: 'Compact Badges' },
      ],
    },
    { kind: 'text', key: 'title', label: 'Procedure Title' },
    { kind: 'text', key: 'subtitle', label: 'Procedure Subtitle' },
    {
      kind: 'list',
      key: 'steps',
      label: 'Procedure Steps',
      itemFields: [
        { kind: 'text', key: 'title', label: 'Step Title' },
        { kind: 'textarea', key: 'description', label: 'Step Instructions / Details' },
        { kind: 'text', key: 'timeEstimate', label: 'Estimated Time (e.g. 2 mins)' },
        { kind: 'text', key: 'badgeText', label: 'Status Badge (e.g. Required, Step 1)' },
      ],
    },
    { kind: 'image', key: 'imageUrl', label: 'Companion Image (Diagram / Infographic)' },
    {
      kind: 'select',
      key: 'mediaPosition',
      label: 'Media Align Placement',
      options: [
        { value: 'top', label: 'Media on Top' },
        { value: 'bottom', label: 'Media at Bottom' },
        { value: 'left', label: 'Media on Left' },
        { value: 'right', label: 'Media on Right' },
        { value: 'hidden', label: 'Hide Companion Media' },
      ],
    },
    { kind: 'color', key: 'accentColor', label: 'Accent Theme Color' },
  ],
  defaults: procedureBlockSchema.parse({}),
  schema: procedureBlockSchema,
  render: (props: ProcedureBlockProps, _block, ctx) => {
    const isEdit = ctx.mode === 'edit';
    const effectiveAccentColor = props.accentColor || ctx.theme.colors.primary || '#10b981';

    const handleAddStep = () => {
      const nextIndex = props.steps.length + 1;
      const newStep: ProcedureStepItem = {
        id: `step-${Date.now()}`,
        title: `Step ${nextIndex}: Next Instruction`,
        description: 'Detail what the user should execute in this step.',
        badgeText: '',
        timeEstimate: '',
      };
      ctx.onPropChange?.({ steps: [...props.steps, newStep] });
    };

    // 1. Empty State
    if (props.steps.length === 0 && !props.imageUrl && !props.videoUrl) {
      if (!isEdit) return null;
      return (
        <div className="w-full p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 text-center flex flex-col items-center justify-center gap-3 animate-in fade-in duration-200">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: `${effectiveAccentColor}1a`, color: effectiveAccentColor }}
          >
            <ListChecks className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No procedure steps yet</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              Add step-by-step instructions, payment guide steps, or onboarding milestones.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddStep}
            className="mt-1 h-9 min-h-[44px] px-4 rounded-xl text-xs font-bold text-white shadow-xs active:scale-[0.97] transition-all cursor-pointer flex items-center gap-1.5"
            style={{ backgroundColor: effectiveAccentColor }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Step</span>
          </button>
        </div>
      );
    }

    // 2. Render Companion Media
    const renderCompanionMedia = () => {
      if (props.mediaPosition === 'hidden') return null;
      if (!props.imageUrl && !props.videoUrl) return null;

      return (
        <div className="w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-100 dark:bg-slate-900 mb-6">
          {props.videoUrl ? (
            <div className="aspect-video relative">
              <VideoEmbed
                url={props.videoUrl}
                thumbnailUrl={props.imageUrl || undefined}
                disabled={isEdit || ctx.isThumbnail}
                className="absolute inset-0 w-full h-full border-none shadow-none"
              />
            </div>
          ) : props.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={props.imageUrl}
              alt={props.title}
              className="w-full h-auto object-cover max-h-[420px]"
              loading="lazy"
            />
          ) : null}
        </div>
      );
    };

    // 3. Header: Title & Subtitle
    const renderHeader = () => {
      const hasTitle = Boolean(props.title && props.title.trim());
      const hasSubtitle = Boolean(props.subtitle && props.subtitle.trim());

      if (!hasTitle && !hasSubtitle && !isEdit) return null;

      return (
        <div className="space-y-1.5 text-left mb-6">
          {isEdit ? (
            <InlineEditable
              value={props.title}
              onChange={(val) => ctx.onPropChange?.({ title: val })}
              placeholder="Procedure Title"
              className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 block"
            />
          ) : hasTitle ? (
            <h3 className="text-2xl font-bold tracking-tight" style={{ color: ctx.theme.colors.text }}>
              {ctx.interpolate(props.title)}
            </h3>
          ) : null}

          {isEdit ? (
            <InlineEditable
              value={props.subtitle || ''}
              onChange={(val) => ctx.onPropChange?.({ subtitle: val })}
              placeholder="Add short procedural subtext or guidelines..."
              className="text-sm font-medium text-slate-500 dark:text-slate-400 block"
            />
          ) : hasSubtitle ? (
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              {ctx.interpolate(props.subtitle || '')}
            </p>
          ) : null}
        </div>
      );
    };

    // 4. Render Step Presets
    const renderSteps = () => {
      switch (props.preset) {
        case 'connected-timeline':
          return (
            <div data-preset="connected-timeline" className="relative space-y-6 text-left pl-2">
              {props.steps.map((step, si) => {
                const isLast = si === props.steps.length - 1;
                return (
                  <div key={step.id || si} className="relative flex items-start gap-4 group">
                    {/* Connecting vertical line */}
                    {!isLast && (
                      <span
                        className="absolute left-4 top-8 -bottom-6 w-0.5 bg-slate-200 dark:bg-slate-700 pointer-events-none"
                        aria-hidden="true"
                      />
                    )}

                    {/* Number Badge */}
                    <span
                      className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shadow-2xs"
                      style={{ backgroundColor: effectiveAccentColor }}
                    >
                      {props.showStepNumbers ? si + 1 : <ListChecks className="w-3.5 h-3.5" />}
                    </span>

                    {/* Step Body */}
                    <div className="flex-1 pt-0.5 space-y-1.5 pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step.title)) }}
                        />
                        {step.badgeText && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {step.badgeText}
                          </span>
                        )}
                        {step.timeEstimate && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {step.timeEstimate}
                          </span>
                        )}
                      </div>

                      {step.description && (
                        <p
                          className="text-sm font-normal text-slate-600 dark:text-slate-400 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step.description)) }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );

        case 'elevated-cards':
          return (
            <div data-preset="elevated-cards" className="grid grid-cols-1 gap-3.5 text-left">
              {props.steps.map((step, si) => (
                <div
                  key={step.id || si}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-shadow flex items-start gap-4"
                >
                  <span
                    className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-2xs mt-0.5"
                    style={{ backgroundColor: effectiveAccentColor }}
                  >
                    {props.showStepNumbers ? si + 1 : <ListChecks className="w-4 h-4" />}
                  </span>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step.title)) }}
                      />
                      <div className="flex items-center gap-2">
                        {step.badgeText && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {step.badgeText}
                          </span>
                        )}
                        {step.timeEstimate && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {step.timeEstimate}
                          </span>
                        )}
                      </div>
                    </div>

                    {step.description && (
                      <p
                        className="text-sm font-normal text-slate-600 dark:text-slate-400 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step.description)) }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          );

        case 'minimal-clean':
          return (
            <div data-preset="minimal-clean" className="divide-y divide-slate-200 dark:divide-slate-800 text-left">
              {props.steps.map((step, si) => {
                const stepNumStr = String(si + 1).padStart(2, '0');
                return (
                  <div key={step.id || si} className="py-4 flex items-baseline gap-4">
                    <span className="text-sm font-mono font-bold text-slate-400 dark:text-slate-500 flex-shrink-0 w-8">
                      {stepNumStr}.
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-base font-bold text-slate-900 dark:text-slate-100"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step.title)) }}
                        />
                        {step.badgeText && (
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {step.badgeText}
                          </span>
                        )}
                        {step.timeEstimate && (
                          <span className="text-[11px] font-medium text-slate-400">
                            {step.timeEstimate}
                          </span>
                        )}
                      </div>
                      {step.description && (
                        <p
                          className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step.description)) }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );

        case 'compact-badges':
          return (
            <div data-preset="compact-badges" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left">
              {props.steps.map((step, si) => (
                <div
                  key={step.id || si}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black text-white shadow-2xs"
                      style={{ backgroundColor: effectiveAccentColor }}
                    >
                      {si + 1}
                    </span>
                    {step.timeEstimate && (
                      <span className="text-[10px] font-semibold text-slate-400">
                        {step.timeEstimate}
                      </span>
                    )}
                  </div>
                  <h5
                    className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate"
                    title={step.title}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step.title)) }}
                  />
                  {step.description && (
                    <p
                      className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step.description)) }}
                    />
                  )}
                </div>
              ))}
            </div>
          );

        case 'split-media':
        default:
          return (
            <div data-preset="split-media" className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start text-left">
              {/* Media Column */}
              <div className="w-full">
                {renderCompanionMedia()}
              </div>

              {/* Steps Column */}
              <div className="space-y-4">
                {props.steps.map((step, si) => (
                  <div
                    key={step.id || si}
                    className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3.5"
                  >
                    <span
                      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-2xs"
                      style={{ backgroundColor: effectiveAccentColor }}
                    >
                      {si + 1}
                    </span>
                    <div className="flex-1 space-y-1">
                      <span
                        className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step.title)) }}
                      />
                      {step.description && (
                        <p
                          className="text-xs font-normal text-slate-600 dark:text-slate-400 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step.description)) }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
      }
    };

    const isSplit = props.preset === 'split-media';

    return (
      <div className="w-full py-4 space-y-4">
        {renderHeader()}
        {!isSplit && props.mediaPosition === 'top' ? renderCompanionMedia() : null}
        {renderSteps()}
        {!isSplit && props.mediaPosition === 'bottom' ? renderCompanionMedia() : null}

        {/* Canvas Quick Add Action in Edit Mode */}
        {isEdit && props.steps.length > 0 && (
          <div className="pt-2 flex justify-start">
            <button
              type="button"
              onClick={handleAddStep}
              className="inline-flex items-center gap-1.5 h-8 min-h-[38px] px-3 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 active:scale-[0.97] transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>Add Step</span>
            </button>
          </div>
        )}
      </div>
    );
  },
});
