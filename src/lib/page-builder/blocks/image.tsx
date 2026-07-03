import { z } from 'zod';
import { ImageIcon } from 'lucide-react';
import { registerBlock } from '../registry';

const schema = z.object({
  src: z.string().default(''),
  alt: z.string().default(''),
  caption: z.string().default(''),
});
type ImageProps = z.infer<typeof schema>;

registerBlock({
  type: 'image',
  label: 'Image',
  category: 'content',
  icon: ImageIcon,
  fields: [
    { kind: 'image', key: 'src', label: 'Image URL' },
    { kind: 'text', key: 'alt', label: 'Alt Text' },
    { kind: 'text', key: 'caption', label: 'Caption' },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: ImageProps, _block, ctx) => {
    if (!props.src) {
      // Empty state is only meaningful in the editor; published pages omit it.
      if (ctx.mode !== 'edit') return <></>;
      return (
        <div className="h-40 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
          <ImageIcon className="w-8 h-8 text-slate-300" />
          <span className="text-xs text-slate-400 font-medium">Add an image URL in the editor</span>
        </div>
      );
    }

    if (props.caption) {
      return (
        <figure className="rounded-2xl border border-slate-200/40 dark:border-zinc-800/40 bg-white dark:bg-zinc-900/80 shadow-sm overflow-hidden transition-all duration-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.src} alt={props.alt} className="w-full h-auto object-cover" loading="lazy" />
          <figcaption className="px-5 py-4 border-t border-slate-100 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/50 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center tracking-wide leading-relaxed">
            {ctx.interpolate(props.caption)}
          </figcaption>
        </figure>
      );
    }

    return (
      <figure className="rounded-2xl overflow-hidden border border-transparent">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.src} alt={props.alt} className="w-full h-auto object-cover" loading="lazy" />
      </figure>
    );
  },
});
