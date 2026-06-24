import { z } from 'zod';
import { Columns2 } from 'lucide-react';
import { registerBlock } from '../registry';

const schema = z.object({
  variant: z.enum(['1-1', '1-1-1', '1-2', '2-1']).default('1-1'),
  gap: z.number().min(0).max(64).default(24),
});
type ColumnsProps = z.infer<typeof schema>;

const TEMPLATE: Record<ColumnsProps['variant'], string> = {
  '1-1': '1fr 1fr',
  '1-1-1': '1fr 1fr 1fr',
  '1-2': '1fr 2fr',
  '2-1': '2fr 1fr',
};

registerBlock({
  type: 'columns',
  label: 'Columns',
  category: 'layout',
  icon: Columns2,
  allowsChildren: true,
  fields: [
    { kind: 'select', key: 'variant', label: 'Layout', options: [
      { value: '1-1', label: 'Two equal' },
      { value: '1-1-1', label: 'Three equal' },
      { value: '1-2', label: 'Narrow / Wide' },
      { value: '2-1', label: 'Wide / Narrow' },
    ] },
    { kind: 'slider', key: 'gap', label: 'Gap (px)', min: 0, max: 64, step: 4 },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: ColumnsProps, _block, ctx) => {
    const children = ctx.renderChildren?.() ?? [];
    if (children.length === 0 && ctx.mode === 'edit') {
      return (
        <div className="grid gap-3 p-4 rounded-xl border-2 border-dashed border-slate-200" style={{ gridTemplateColumns: TEMPLATE[props.variant] }}>
          <div className="text-center text-xs text-slate-400 py-8">Empty column</div>
          <div className="text-center text-xs text-slate-400 py-8">Empty column</div>
        </div>
      );
    }
    return (
      <div className="grid" style={{ gridTemplateColumns: TEMPLATE[props.variant], gap: props.gap }}>
        {children.map((node, i) => (
          <div key={i} className="min-w-0">{node}</div>
        ))}
      </div>
    );
  },
});
