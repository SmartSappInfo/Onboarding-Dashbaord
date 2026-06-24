import { z } from 'zod';
import { MousePointer2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registerBlock } from '../registry';

const schema = z.object({
  label: z.string().default('Click Here'),
  url: z.string().default(''),
  variant: z.enum(['primary', 'secondary', 'glass', 'glow']).default('primary'),
});
type CtaProps = z.infer<typeof schema>;

registerBlock({
  type: 'cta',
  label: 'Button',
  category: 'content',
  icon: MousePointer2,
  fields: [
    { kind: 'text', key: 'label', label: 'Button Label' },
    { kind: 'url', key: 'url', label: 'Redirect URL' },
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
            'h-12 px-8 rounded-xl font-bold gap-2 inline-flex items-center transition-all active:scale-95',
            props.variant === 'glass' && 'backdrop-blur-md border border-white/30',
            props.variant === 'glow' && 'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
          )}
          style={style}
          onClick={() => {
            if (ctx.mode === 'edit') return;
            ctx.fireTrigger?.('block_click', block.id);
            if (props.url) window.open(props.url, '_blank', 'noopener,noreferrer');
          }}
        >
          {ctx.interpolate(props.label)}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  },
});
