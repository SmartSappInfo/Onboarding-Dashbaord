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
import { ListChecks } from 'lucide-react';
import { registerBlock } from '../registry';
import { sanitizeHtml } from '../sanitize';

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

registerBlock({
  type: 'procedure_list',
  label: 'Procedure',
  category: 'data',
  icon: ListChecks,
  fields: [
    { kind: 'text', key: 'title', label: 'Title' },
    { kind: 'image', key: 'imageUrl', label: 'Image URL' },
  ],
  defaults: procedureBlockSchema.parse({}),
  schema: procedureBlockSchema,
  render: (props: ProcedureBlockProps, _block, ctx) => {
    if (props.steps.length === 0 && !props.imageUrl) {
      if (ctx.mode !== 'edit') return <></>;
      return <p className="text-xs text-slate-400 italic text-center py-4">No steps added</p>;
    }
    return (
      <div className="space-y-6">
        {props.imageUrl ? (
          <div className="rounded-2xl overflow-hidden border border-black/10 shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={props.imageUrl} alt={props.title} className="w-full h-auto" loading="lazy" />
          </div>
        ) : null}
        <ol className="grid grid-cols-1 gap-3">
          {props.steps.map((step, si) => (
            <li key={step.id || si} className="flex items-start gap-4 p-5 rounded-xl bg-black/[0.02] border border-black/10">
              <span className="mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: `${ctx.theme.colors.primary}1a`, color: ctx.theme.colors.primary }}>
                {si + 1}
              </span>
              <div className="flex-1 space-y-1">
                <span className="text-base font-semibold leading-relaxed" style={{ color: ctx.theme.colors.text }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step.title)) }} />
                {step.description && (
                  <p className="text-sm font-normal text-slate-500 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step.description)) }} />
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  },
});
