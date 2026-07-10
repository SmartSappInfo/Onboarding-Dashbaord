import { z } from 'zod';
import { MousePointer2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registerBlock } from '../registry';
import { InlineEditable } from '@/components/page-builder/InlineEditable';

const schema = z.object({
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
});
type CtaProps = z.infer<typeof schema>;

registerBlock({
  type: 'cta',
  label: 'Button',
  category: 'content',
  icon: MousePointer2,
  fields: [
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
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: CtaProps, block, ctx) => {
    const isOutline = props.variant === 'secondary';
    const style = isOutline
      ? { borderColor: ctx.theme.colors.primary, color: ctx.theme.colors.primary, borderWidth: 2 }
      : { backgroundColor: ctx.theme.colors.primary, color: '#ffffff' };

    return (
      <div className="flex justify-center py-4">
        <button
          type="button"
          className={cn(
            'h-12 px-8 rounded-xl font-bold gap-2 inline-flex items-center transition-all active:scale-95 duration-150',
            props.variant === 'glass' && 'backdrop-blur-md border border-white/30',
            props.variant === 'glow' && 'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
          )}
          style={style}
          onClick={() => {
            if (ctx.mode === 'edit') return;
            ctx.fireTrigger?.('block_click', block.id);
            
            if (props.openInModal) {
              const targetId = props.actionType === 'form' ? props.formId :
                               props.actionType === 'survey' ? props.surveyId :
                               props.actionType === 'meeting' ? props.meetingId :
                               props.actionType === 'qr' ? props.qrId : '';
              if (targetId) {
                ctx.fireTrigger?.('open_modal_resource', JSON.stringify({ type: props.actionType, targetId, resultMode: props.surveyResultMode }));
              }
            } else {
              // Direct navigation / redirection
              if (props.actionType === 'url') {
                if (props.url) window.open(props.url, '_blank', 'noopener,noreferrer');
              } else if (props.actionType === 'form' && props.formId) {
                window.open(`/f/${props.formId}`, '_blank', 'noopener,noreferrer');
              } else if (props.actionType === 'survey' && props.surveyId) {
                window.open(`/surveys/${props.surveyId}`, '_blank', 'noopener,noreferrer');
              } else if (props.actionType === 'meeting' && props.meetingId) {
                const meeting = ctx.resources.meetings?.find((m) => m.id === props.meetingId);
                const typeSlug = meeting?.type?.id === 'parent' ? 'parent-engagement' : (meeting?.type?.slug || 'parent-engagement');
                const targetSlug = meeting?.slug || props.meetingId;
                window.open(`/meetings/${typeSlug}/${targetSlug}`, '_blank', 'noopener,noreferrer');
              } else if (props.actionType === 'qr' && props.qrId) {
                const qr = ctx.resources.qrCodes?.find((q) => q.id === props.qrId);
                const targetUrl = qr?.slug ? `/q/${qr.slug}` : (qr?.redirectUrl || '');
                if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
              }
            }
          }}
        >
          <InlineEditable
            tagName="span"
            isEdit={ctx.mode === 'edit'}
            data-block-id={block.id}
            data-prop-key="label"
            data-rich="false"
            onChange={(val) => ctx.onPropChange?.({ label: val })}
            className="outline-none min-w-[20px] inline-block cursor-text"
            value={props.label}
            html={false}
          />
          <ArrowRight className="h-4 w-4 shrink-0" />
        </button>
      </div>
    );
  },
});
