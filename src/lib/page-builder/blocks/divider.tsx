import { z } from 'zod';
import { Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registerBlock } from '../registry';

const schema = z.object({
  style: z.enum(['solid', 'dashed', 'dotted', 'gradient']).default('solid'),
  color: z.string().default('#e2e8f0'),
});
type DividerProps = z.infer<typeof schema>;

registerBlock({
  type: 'divider',
  label: 'Divider',
  category: 'content',
  icon: Minus,
  fields: [
    { kind: 'select', key: 'style', label: 'Style', options: [
      { value: 'solid', label: 'Solid' },
      { value: 'dashed', label: 'Dashed' },
      { value: 'dotted', label: 'Dotted' },
      { value: 'gradient', label: 'Gradient' },
    ] },
    { kind: 'color', key: 'color', label: 'Color' },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: DividerProps) => (
    <div className="py-4">
      {props.style === 'gradient' ? (
        <div className="h-0.5 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
      ) : (
        <hr
          className={cn(
            'border-t-2',
            props.style === 'dashed' && 'border-dashed',
            props.style === 'dotted' && 'border-dotted',
          )}
          style={{ borderColor: props.color }}
        />
      )}
    </div>
  ),
});
