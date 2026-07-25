import React from 'react';
import { z } from 'zod';
import { MousePointer2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registerBlock } from '../registry';
import { InlineEditable } from '@/components/page-builder/InlineEditable';
import { genId } from '../tree-operations';

const buttonItemSchema = z.object({
  id: z.string().default(''),
  label: z.string().default('Click Here'),
  url: z.string().default(''),
  variant: z.enum(['primary', 'secondary', 'glass', 'glow']).default('primary'),
  actionType: z.enum(['url', 'form', 'survey', 'meeting', 'qr']).default('url'),
  formId: z.string().default(''),
  surveyId: z.string().default(''),
  meetingId: z.string().default(''),
  qrId: z.string().default(''),
  openInModal: z.boolean().default(false),
  surveyResultMode: z.enum(['modal', 'parent']).default('modal'),
  trackEntity: z.boolean().default(true),
});

const schema = z.object({
  // Legacy fields kept for full backward compatibility
  label: z.string().default('Click Here'),
  url: z.string().default(''),
  variant: z.enum(['primary', 'secondary', 'glass', 'glow']).default('primary'),
  actionType: z.enum(['url', 'form', 'survey', 'meeting', 'qr']).default('url'),
  formId: z.string().default(''),
  surveyId: z.string().default(''),
  meetingId: z.string().default(''),
  qrId: z.string().default(''),
  openInModal: z.boolean().default(false),
  surveyResultMode: z.enum(['modal', 'parent']).default('modal'),
  trackEntity: z.boolean().default(true),

  // Upgraded multi-button list field
  buttons: z.array(buttonItemSchema).optional(),
});

type CtaProps = z.infer<typeof schema>;
type ButtonItemType = z.infer<typeof buttonItemSchema>;



registerBlock({
  type: 'cta',
  label: 'Button',
  category: 'content',
  icon: MousePointer2,
  fields: [
    {
      kind: 'list',
      key: 'buttons',
      label: 'Configure Buttons',
      itemFields: [
        { kind: 'text', key: 'label', label: 'Button Label' },
        { 
          kind: 'select', 
          key: 'actionType', 
          label: 'Action Click Type', 
          options: [
            { value: 'url', label: 'Redirect to URL' },
            { value: 'form', label: 'Form Action' },
            { value: 'survey', label: 'Survey Action' },
            { value: 'meeting', label: 'Meeting Action' },
            { value: 'qr', label: 'QR Code Action' },
          ] 
        },
        { kind: 'url', key: 'url', label: 'Redirect URL' },
        { kind: 'resource', key: 'formId', label: 'Form Target', resource: 'form' },
        { kind: 'resource', key: 'surveyId', label: 'Survey Target', resource: 'survey' },
        { kind: 'resource', key: 'meetingId', label: 'Meeting Target', resource: 'meeting' },
        { kind: 'resource', key: 'qrId', label: 'QR Code Target', resource: 'qr' },
        { kind: 'boolean', key: 'openInModal', label: 'Open in Modal Popup' },
        { kind: 'boolean', key: 'trackEntity', label: 'Track Entity Context' },
        { kind: 'select', key: 'surveyResultMode', label: 'Survey Result Display', options: [
          { value: 'modal', label: 'Show inside Modal' },
          { value: 'parent', label: 'Redirect parent page' },
        ] },
        { kind: 'select', key: 'variant', label: 'Button Style', options: [
          { value: 'primary', label: 'Primary (Solid)' },
          { value: 'secondary', label: 'Secondary (Outline)' },
          { value: 'glass', label: 'Glassmorphism' },
          { value: 'glow', label: 'Glow Pulse' },
        ] },
      ]
    }
  ],
  defaults: {
    label: 'Click Here',
    url: '',
    variant: 'primary',
    actionType: 'url',
    formId: '',
    surveyId: '',
    meetingId: '',
    qrId: '',
    openInModal: false,
    surveyResultMode: 'modal',
    trackEntity: true,
    buttons: [
      {
        id: 'btn_1',
        label: 'Click Here',
        url: '',
        variant: 'primary',
        actionType: 'url',
        formId: '',
        surveyId: '',
        meetingId: '',
        qrId: '',
        openInModal: false,
        surveyResultMode: 'modal',
        trackEntity: true,
      }
    ]
  },
  variants: [
    {
      id: 'cta-single',
      label: 'Single Button',
      description: 'Standard call-to-action button',
      thumbnail: (
        <div className="flex items-center justify-center p-2 rounded-lg bg-emerald-500 text-[10px] text-white font-bold h-7 w-24">
          Get Started
        </div>
      ),
      defaults: {
        buttons: [
          { id: 'btn_1', label: 'Get Started', variant: 'primary', actionType: 'url', url: '', trackEntity: true }
        ]
      }
    },
    {
      id: 'cta-double',
      label: 'Two Buttons',
      description: 'Primary and Secondary button action pair',
      thumbnail: (
        <div className="flex gap-2 items-center justify-center">
          <div className="flex items-center justify-center p-1 rounded-lg bg-emerald-500 text-[8px] text-white font-bold h-6 w-12">
            Accept
          </div>
          <div className="flex items-center justify-center p-1 rounded-lg border border-slate-700 bg-slate-900 text-[8px] text-slate-300 font-bold h-6 w-12">
            Cancel
          </div>
        </div>
      ),
      defaults: {
        buttons: [
          { id: 'btn_1', label: 'Accept', variant: 'primary', actionType: 'url', url: '', trackEntity: true },
          { id: 'btn_2', label: 'Cancel', variant: 'secondary', actionType: 'url', url: '', trackEntity: true }
        ]
      }
    },
    {
      id: 'cta-triple',
      label: 'Three Buttons Group',
      description: 'Multi-action button cluster',
      thumbnail: (
        <div className="flex gap-1 items-center justify-center">
          <div className="flex items-center justify-center p-1 rounded bg-emerald-500 text-[6px] text-white font-bold h-5 w-10">
            Primary
          </div>
          <div className="flex items-center justify-center p-1 rounded border border-slate-700 bg-slate-900 text-[6px] text-slate-300 font-bold h-5 w-10">
            Outline
          </div>
          <div className="flex items-center justify-center p-1 rounded bg-slate-900/30 border border-white/20 text-[6px] text-slate-200 font-bold h-5 w-10">
            Glass
          </div>
        </div>
      ),
      defaults: {
        buttons: [
          { id: 'btn_1', label: 'Primary Action', variant: 'primary', actionType: 'url', url: '', trackEntity: true },
          { id: 'btn_2', label: 'Secondary Action', variant: 'secondary', actionType: 'url', url: '', trackEntity: true },
          { id: 'btn_3', label: 'Learn More', variant: 'glass', actionType: 'url', url: '', trackEntity: true }
        ]
      }
    }
  ],
  schema,
  render: (props: CtaProps, block, ctx) => {
    // Phase 3: Runtime translation and normalization of buttons array
    const getNormalizedButtons = (p: CtaProps): ButtonItemType[] => {
      if (p.buttons && p.buttons.length > 0) {
        return p.buttons.map((btn, idx) => ({
          id: btn.id || `btn_${idx}`,
          label: btn.label || 'Click Here',
          url: btn.url || '',
          variant: btn.variant || 'primary',
          actionType: btn.actionType || 'url',
          formId: btn.formId || '',
          surveyId: btn.surveyId || '',
          meetingId: btn.meetingId || '',
          qrId: btn.qrId || '',
          openInModal: btn.openInModal || false,
          surveyResultMode: btn.surveyResultMode || 'modal',
          trackEntity: btn.trackEntity ?? true,
        }));
      }

      // Legacy fallback wrapper
      return [
        {
          id: 'btn_legacy',
          label: p.label || 'Click Here',
          url: p.url || '',
          variant: p.variant || 'primary',
          actionType: p.actionType || 'url',
          formId: p.formId || '',
          surveyId: p.surveyId || '',
          meetingId: p.meetingId || '',
          qrId: p.qrId || '',
          openInModal: p.openInModal || false,
          surveyResultMode: p.surveyResultMode || 'modal',
          trackEntity: p.trackEntity ?? true,
        }
      ];
    };

    const normalizedButtons = getNormalizedButtons(props);

    // Phase 4: Button styling resolver
    const getButtonStyle = (btn: ButtonItemType) => {
      if (btn.variant === 'secondary') {
        return { borderColor: ctx.theme.colors.primary, color: ctx.theme.colors.primary, borderWidth: 2 };
      }
      if (btn.variant === 'glass') {
        return { borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(255, 255, 255, 0.04)' };
      }
      return { backgroundColor: ctx.theme.colors.primary, color: '#ffffff' };
    };

    // Helper: Appends active tracking query parameters from the window to redirect destinations
    // Cautious: Ensure URL parsing doesn't crash on invalid URLs. Fallback gracefully.
    const appendTrackingParams = (targetUrl: string, track: boolean): string => {
      if (!track) return targetUrl;
      if (typeof window === 'undefined') return targetUrl;
      const currentParams = new URLSearchParams(window.location.search);
      const entityId = currentParams.get('entityId') || currentParams.get('entity');
      if (!entityId) return targetUrl;

      try {
        const isAbsolute = targetUrl.startsWith('http://') || targetUrl.startsWith('https://');
        let urlObj: URL;
        if (isAbsolute) {
          urlObj = new URL(targetUrl);
        } else {
          urlObj = new URL(targetUrl, window.location.origin);
        }
        urlObj.searchParams.set('entityId', entityId);
        return isAbsolute ? urlObj.toString() : urlObj.pathname + urlObj.search + urlObj.hash;
      } catch (e) {
        // Fallback for custom routing schemes or malformed paths
        const separator = targetUrl.includes('?') ? '&' : '?';
        return `${targetUrl}${separator}entityId=${encodeURIComponent(entityId)}`;
      }
    };

    // Phase 4 & 5: Render buttons list wrapper with responsive layout and inline canvas edits
    return (
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center items-center py-4 w-full">
        {normalizedButtons.map((btn, idx) => {
          const style = getButtonStyle(btn);
          return (
            <button
              key={btn.id || `btn_${idx}`}
              type="button"
              className={cn(
                'h-12 px-8 rounded-xl font-bold gap-2 inline-flex items-center justify-center transition-all active:scale-[0.97] hover:scale-[1.01] duration-200 w-full sm:w-auto cursor-pointer select-none outline-none border border-transparent',
                btn.variant === 'secondary' && 'bg-transparent border border-solid',
                btn.variant === 'glass' && 'backdrop-blur-md border border-white/20 hover:bg-white/10 dark:border-zinc-800/80 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/40 text-slate-800 dark:text-white',
                btn.variant === 'glow' && 'shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]',
              )}
              style={style}
              onClick={() => {
                if (ctx.mode === 'edit') return;
                ctx.fireTrigger?.('block_click', `${block.id}_btn_${idx}`);
                
                if (btn.openInModal) {
                  const targetId = btn.actionType === 'form' ? btn.formId :
                                   btn.actionType === 'survey' ? btn.surveyId :
                                   btn.actionType === 'meeting' ? btn.meetingId :
                                   btn.actionType === 'qr' ? btn.qrId : '';
                  if (targetId) {
                    ctx.fireTrigger?.('open_modal_resource', JSON.stringify({ type: btn.actionType, targetId, resultMode: btn.surveyResultMode }));
                  }
                } else {
                  // Direct navigation / redirection
                  if (btn.actionType === 'url') {
                    if (btn.url) window.open(appendTrackingParams(btn.url, btn.trackEntity), '_blank', 'noopener,noreferrer');
                  } else if (btn.actionType === 'form' && btn.formId) {
                    window.open(appendTrackingParams(`/f/${btn.formId}`, btn.trackEntity), '_blank', 'noopener,noreferrer');
                  } else if (btn.actionType === 'survey' && btn.surveyId) {
                    window.open(appendTrackingParams(`/surveys/${btn.surveyId}`, btn.trackEntity), '_blank', 'noopener,noreferrer');
                  } else if (btn.actionType === 'meeting' && btn.meetingId) {
                    const meeting = ctx.resources.meetings?.find((m) => m.id === btn.meetingId);
                    const typeSlug = meeting?.type?.id === 'parent' ? 'parent-engagement' : (meeting?.type?.slug || 'parent-engagement');
                    const targetSlug = meeting?.slug || btn.meetingId;
                    window.open(appendTrackingParams(`/meetings/${typeSlug}/${targetSlug}`, btn.trackEntity), '_blank', 'noopener,noreferrer');
                  } else if (btn.actionType === 'qr' && btn.qrId) {
                    const qr = ctx.resources.qrCodes?.find((q) => q.id === btn.qrId);
                    const targetUrl = qr?.slug ? `/q/${qr.slug}` : (qr?.redirectUrl || '');
                    if (targetUrl) window.open(appendTrackingParams(targetUrl, btn.trackEntity), '_blank', 'noopener,noreferrer');
                  }
                }
              }}
            >
              <InlineEditable
                tagName="span"
                isEdit={ctx.mode === 'edit'}
                data-block-id={block.id}
                data-prop-key={`btn_label_${idx}`}
                data-rich="false"
                onChange={(val) => {
                  const updatedButtons = [...normalizedButtons];
                  updatedButtons[idx] = { ...updatedButtons[idx], label: val };
                  ctx.onPropChange?.({ buttons: updatedButtons });
                }}
                className="outline-none min-w-[20px] inline-block cursor-text text-center w-full"
                value={btn.label}
                html={false}
              />
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>
          );
        })}
      </div>
    );
  },
});
