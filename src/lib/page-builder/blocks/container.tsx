import { z } from 'zod';
import { Square } from 'lucide-react';
import { registerBlock } from '../registry';

const schema = z.object({
  maxWidth: z.enum(['sm', 'md', 'lg', 'full']).default('lg'),
  padding: z.number().min(0).max(96).default(24),
  background: z.string().default('transparent'),
});
type ContainerProps = z.infer<typeof schema>;

const MAX_WIDTH: Record<ContainerProps['maxWidth'], string> = {
  sm: '32rem',
  md: '48rem',
  lg: '64rem',
  full: '100%',
};

registerBlock({
  type: 'container',
  label: 'Container',
  category: 'layout',
  icon: Square,
  allowsChildren: true,
  fields: [
    { kind: 'select', key: 'maxWidth', label: 'Max Width', options: [
      { value: 'sm', label: 'Small' },
      { value: 'md', label: 'Medium' },
      { value: 'lg', label: 'Large' },
      { value: 'full', label: 'Full' },
    ] },
    { kind: 'slider', key: 'padding', label: 'Padding (px)', min: 0, max: 96, step: 4 },
    { kind: 'color', key: 'background', label: 'Background' },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: ContainerProps, _block, ctx) => {
    const children = ctx.renderChildren?.() ?? [];
    return (
      <div
        className="mx-auto w-full space-y-6"
        style={{ maxWidth: MAX_WIDTH[props.maxWidth], padding: props.padding, background: props.background }}
      >
        {children.length > 0 ? (
          children
        ) : ctx.mode === 'edit' ? (
          <div className="text-center text-xs text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-xl">
            Empty container — add blocks
          </div>
        ) : null}
      </div>
    );
  },
});
