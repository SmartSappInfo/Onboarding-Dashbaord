import { z } from 'zod';
import { BarChart3 } from 'lucide-react';
import { registerBlock } from '../registry';

const item = z.object({
  id: z.string(),
  value: z.string().default('0'),
  label: z.string().default('Stat'),
});
const schema = z.object({ items: z.array(item).default([]) });
type StatsProps = z.infer<typeof schema>;

// Static class strings so Tailwind's JIT keeps them (dynamic `grid-cols-${n}`
// would be purged from the production bundle).
const GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
};

registerBlock({
  type: 'stats',
  label: 'Stats',
  category: 'data',
  icon: BarChart3,
  fields: [
    { kind: 'list', key: 'items', label: 'Stat Items', itemFields: [
      { kind: 'text', key: 'value', label: 'Value' },
      { kind: 'text', key: 'label', label: 'Label' },
    ] },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: StatsProps, _block, ctx) => {
    if (props.items.length === 0) {
      if (ctx.mode !== 'edit') return <></>;
      return (
        <div className="text-center py-4">
          <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400 italic">Add stat items in the editor</p>
        </div>
      );
    }
    const cols = GRID[props.items.length] ?? 'grid-cols-2 md:grid-cols-4';
    return (
      <div className={`grid gap-6 text-center ${cols}`}>
        {props.items.map((it) => (
          <div key={it.id} className="p-6 rounded-2xl border border-black/10 bg-black/[0.02]">
            <p className="text-3xl font-black tracking-tight" style={{ color: ctx.theme.colors.primary }}>{it.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider mt-2" style={{ color: ctx.theme.colors.text, opacity: 0.6 }}>
              {ctx.interpolate(it.label)}
            </p>
          </div>
        ))}
      </div>
    );
  },
});
