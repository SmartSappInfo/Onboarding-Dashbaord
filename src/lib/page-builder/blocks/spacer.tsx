import { z } from 'zod';
import { SeparatorHorizontal } from 'lucide-react';
import { registerBlock } from '../registry';

const schema = z.object({
  height: z.number().min(0).max(400).default(48),
});
type SpacerProps = z.infer<typeof schema>;

registerBlock({
  type: 'spacer',
  label: 'Spacer',
  category: 'content',
  icon: SeparatorHorizontal,
  fields: [{ kind: 'slider', key: 'height', label: 'Height (px)', min: 8, max: 200, step: 8 }],
  defaults: schema.parse({}),
  schema,
  render: (props: SpacerProps, _block, ctx) => {
    if (ctx.mode === 'edit') {
      return (
        <div className="flex items-center justify-center" style={{ height: props.height }}>
          <div className="border-t-2 border-dashed border-slate-200 w-full relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 bg-white px-2 font-bold">
              {props.height}px
            </span>
          </div>
        </div>
      );
    }
    return <div style={{ height: props.height }} aria-hidden />;
  },
});
