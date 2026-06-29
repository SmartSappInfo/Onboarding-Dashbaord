import { z } from 'zod';
import { Calendar } from 'lucide-react';
import { EmbeddedMeeting } from '@/components/page-builder/embeds/EmbeddedMeeting';
import { registerBlock } from '../registry';

const schema = z.object({
  meetingId: z.string().default(''),
  displayMode: z.enum(['inline', 'button']).default('inline')
});
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
    }
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: MeetingBlockProps, _block, ctx) => {
    if (ctx.mode === 'view') {
      if (props.meetingId) return <EmbeddedMeeting meetingId={props.meetingId} pageId={ctx.page?.id} displayMode={props.displayMode} />;
      return <></>;
    }
    const meeting = ctx.resources.meetings?.find((m) => m.id === props.meetingId);
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
