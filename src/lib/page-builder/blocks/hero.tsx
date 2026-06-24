import { z } from 'zod';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registerBlock } from '../registry';

const schema = z.object({
  title: z.string().default('New Hero'),
  subtitle: z.string().default('Describe your campaign here.'),
  imageUrl: z.string().default(''),
  align: z.enum(['left', 'center', 'right']).default('center'),
});
type HeroProps = z.infer<typeof schema>;

const ALIGN: Record<HeroProps['align'], string> = {
  left: 'text-left items-start',
  center: 'text-center items-center',
  right: 'text-right items-end',
};

registerBlock({
  type: 'hero',
  label: 'Hero',
  category: 'content',
  icon: Zap,
  fields: [
    { kind: 'text', key: 'title', label: 'Headline' },
    { kind: 'textarea', key: 'subtitle', label: 'Subtitle' },
    { kind: 'image', key: 'imageUrl', label: 'Background Image URL' },
    { kind: 'select', key: 'align', label: 'Alignment', options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
    ] },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: HeroProps, _block, ctx) => {
    if (ctx.mode === 'edit') {
      return (
        <div className={cn('flex flex-col gap-3 py-8 px-4', ALIGN[props.align])}>
          <input
            className="w-full text-4xl font-bold tracking-tight bg-transparent border-none outline-none focus:ring-0 placeholder:opacity-30"
            style={{ color: ctx.theme.colors.text, fontFamily: ctx.theme.typography.headingFont, textAlign: props.align }}
            value={props.title}
            placeholder="Hero Title"
            onChange={(e) => ctx.onPropChange?.({ title: e.target.value })}
          />
          <textarea
            className="w-full text-lg bg-transparent border-none outline-none focus:ring-0 resize-none placeholder:opacity-30"
            style={{ color: ctx.theme.colors.text, textAlign: props.align, opacity: 0.7 }}
            value={props.subtitle}
            placeholder="Hero subtitle text"
            rows={2}
            onChange={(e) => ctx.onPropChange?.({ subtitle: e.target.value })}
          />
        </div>
      );
    }

    return (
      <section
        className={cn('relative flex flex-col gap-4 py-16 px-6 rounded-2xl overflow-hidden', ALIGN[props.align])}
        style={props.imageUrl ? { backgroundImage: `url(${props.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {props.imageUrl ? <div className="absolute inset-0 bg-black/40" aria-hidden /> : null}
        <h1
          className="relative text-4xl md:text-5xl font-black tracking-tight leading-tight"
          style={{ color: props.imageUrl ? '#ffffff' : ctx.theme.colors.text, fontFamily: ctx.theme.typography.headingFont }}
        >
          {ctx.interpolate(props.title)}
        </h1>
        {props.subtitle ? (
          <p
            className="relative text-lg max-w-2xl font-medium leading-relaxed"
            style={{ color: props.imageUrl ? '#e5e7eb' : ctx.theme.colors.text, opacity: props.imageUrl ? 1 : 0.7 }}
          >
            {ctx.interpolate(props.subtitle)}
          </p>
        ) : null}
      </section>
    );
  },
});
