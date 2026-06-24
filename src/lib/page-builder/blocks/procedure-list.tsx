import { z } from 'zod';
import { ListChecks } from 'lucide-react';
import { registerBlock } from '../registry';
import { sanitizeHtml } from '../sanitize';

const schema = z.object({
  title: z.string().default(''),
  imageUrl: z.string().default(''),
  steps: z.array(z.string()).default([]),
});
type ProcedureListProps = z.infer<typeof schema>;

registerBlock({
  type: 'procedure_list',
  label: 'Procedure',
  category: 'data',
  icon: ListChecks,
  fields: [{ kind: 'text', key: 'title', label: 'Title' }, { kind: 'image', key: 'imageUrl', label: 'Image URL' }],
  defaults: schema.parse({}),
  schema,
  render: (props: ProcedureListProps, _block, ctx) => {
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
            <li key={si} className="flex items-start gap-4 p-5 rounded-xl bg-black/[0.02] border border-black/10">
              <span className="mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: `${ctx.theme.colors.primary}1a`, color: ctx.theme.colors.primary }}>
                {si + 1}
              </span>
              <span className="text-base font-medium leading-relaxed" style={{ color: ctx.theme.colors.text, opacity: 0.85 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(step)) }} />
            </li>
          ))}
        </ol>
      </div>
    );
  },
});
