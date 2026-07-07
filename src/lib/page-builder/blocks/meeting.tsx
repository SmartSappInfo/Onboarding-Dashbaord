import React from 'react';
import { z } from 'zod';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { EmbeddedMeeting } from '@/components/page-builder/embeds/EmbeddedMeeting';
import { cn } from '@/lib/utils';
import { registerBlock } from '../registry';

const schema = z.object({
  meetingId: z.string().default(''),
  displayMode: z.enum(['inline', 'button']).default('inline'),
  showIcon: z.boolean().default(true),
  showHeader: z.boolean().default(true),
  showDescription: z.boolean().default(true),
  buttonText: z.string().default('Book Session'),
  buttonStyle: z.enum(['primary', 'secondary', 'glass', 'glow']).default('primary')
}).catchall(z.unknown());

type MeetingBlockProps = z.infer<typeof schema>;

registerBlock({
  type: 'meeting',
  label: 'Meeting',
  category: 'embed',
  icon: Calendar,
  fields: [
    { kind: 'resource', key: 'meetingId', label: 'Meeting', resource: 'meeting' },
    {
      kind: 'select',
      key: 'displayMode',
      label: 'Display Mode',
      options: [
        { value: 'inline', label: 'Embedded Calendar' },
        { value: 'button', label: 'Book Button' }
      ]
    },
    { kind: 'boolean', key: 'showIcon', label: 'Show Icon' },
    { kind: 'boolean', key: 'showHeader', label: 'Show Header' },
    { kind: 'boolean', key: 'showDescription', label: 'Show Description' },
    { kind: 'text', key: 'buttonText', label: 'Button Label' },
    { 
      kind: 'select', 
      key: 'buttonStyle', 
      label: 'Button Style', 
      options: [
        { value: 'primary', label: 'Primary (Solid)' },
        { value: 'secondary', label: 'Secondary (Outline)' },
        { value: 'glass', label: 'Glassmorphism' },
        { value: 'glow', label: 'Glow Pulse' }
      ]
    }
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: MeetingBlockProps, _block, ctx) => {
    if (ctx.mode === 'view') {
      if (props.meetingId) {
        return (
          <EmbeddedMeeting 
            meetingId={props.meetingId} 
            pageId={ctx.page?.id} 
            displayMode={props.displayMode} 
            showIcon={props.showIcon}
            showHeader={props.showHeader}
            showDescription={props.showDescription}
            buttonText={props.buttonText}
            buttonStyle={props.buttonStyle}
            primaryColor={ctx.theme.colors.primary}
          />
        );
      }
      return <></>;
    }

    const meeting = ctx.resources.meetings?.find((m) => m.id === props.meetingId);

    if (props.displayMode === 'button') {
      const isOutline = props.buttonStyle === 'secondary';
      const buttonBg = ctx.theme.colors.primary || '#3B5FFF';
      const style = isOutline
        ? { borderColor: buttonBg, color: buttonBg, borderWidth: 2, backgroundColor: 'transparent' }
        : { backgroundColor: buttonBg, color: '#ffffff' };

      return (
        <div className="text-center p-12 space-y-6 max-w-md mx-auto bg-white/5 rounded-3xl border border-slate-100/10 shadow-sm select-none">
          {props.showIcon && (
            <div className="h-16 w-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto text-blue-400">
              <Calendar className="h-8 w-8" />
            </div>
          )}
          {(props.showHeader || props.showDescription) && (
            <div className="space-y-2">
              {props.showHeader && <h2 className="text-2xl font-bold text-slate-100">{meeting?.title || 'Book a Session'}</h2>}
              {props.showDescription && (
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm font-medium">
                  <Clock className="w-4 h-4" />
                  <span>Scheduled Session Time</span>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className={cn(
              "w-full h-14 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 cursor-default select-none opacity-90 transition-all duration-200",
              props.buttonStyle === 'glass' && 'backdrop-blur-md border border-white/30',
              props.buttonStyle === 'glow' && 'shadow-[0_0_20px_rgba(59,95,255,0.3)]',
            )}
            style={style}
          >
            {props.buttonText}
            <ArrowRight className="w-5 h-5" />
          </button>
          {meeting && (
            <div className="text-[10px] text-slate-500 uppercase tracking-widest pt-2">
              Connected to: {meeting.title}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto p-10 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm text-center space-y-3">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/30 rounded-2xl flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
          <Calendar className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">Embedded Meeting</h3>
        {meeting ? (
          <div className="space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{meeting.title}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Mode: {props.displayMode === 'inline' ? 'Calendar Iframe' : 'Booking Button'}</p>
          </div>
        ) : (
          <p className="text-xs text-amber-500 font-medium italic">No active meeting selected</p>
        )}
      </div>
    );
  },
});
