import { z } from 'zod';
import { HelpCircle } from 'lucide-react';
import { registerBlock } from '../registry';

const item = z.object({
  id: z.string(),
  question: z.string().default(''),
  answer: z.string().default(''),
});
const schema = z.object({ items: z.array(item).default([]) });
type FaqProps = z.infer<typeof schema>;

registerBlock({
  type: 'faq',
  label: 'FAQ',
  category: 'data',
  icon: HelpCircle,
  fields: [
    { kind: 'list', key: 'items', label: 'FAQ Items', itemFields: [
      { kind: 'text', key: 'question', label: 'Question' },
      { kind: 'textarea', key: 'answer', label: 'Answer' },
    ] },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: FaqProps, _block, ctx) => {
    if (props.items.length === 0) {
      if (ctx.mode !== 'edit') return <></>;
      return <p className="text-xs text-slate-400 italic text-center py-4">No FAQ items yet</p>;
    }
    return (
      <div className="space-y-3 max-w-2xl mx-auto">
        {props.items.map((it) => (
          <details key={it.id} className="group rounded-xl border border-black/10 bg-black/[0.02] overflow-hidden">
            <summary className="flex items-center justify-between p-5 cursor-pointer select-none font-bold text-sm">
              {ctx.interpolate(it.question)}
              <span className="ml-2 text-slate-400 group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="px-5 pb-5 text-sm leading-relaxed border-t border-black/5 pt-3" style={{ color: ctx.theme.colors.text, opacity: 0.75 }}>
              {ctx.interpolate(it.answer)}
            </div>
          </details>
        ))}
      </div>
    );
  },
});
