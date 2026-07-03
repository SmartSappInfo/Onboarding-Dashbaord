import { z } from 'zod';
import { ImageIcon } from 'lucide-react';
import { registerBlock } from '../registry';

const schema = z.object({
  src: z.string().default(''),
  alt: z.string().default(''),
  caption: z.string().default(''),
  captionColor: z.string().default('#475569'),
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
    { kind: 'color', key: 'captionColor', label: 'Caption Text Color' },
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
        <figure className="rounded-2xl border border-slate-200/40 dark:border-zinc-800/40 bg-white shadow-sm overflow-hidden transition-all duration-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.src} alt={props.alt} className="w-full h-auto object-cover" loading="lazy" />
          <figcaption 
            className="px-5 py-4 border-t border-slate-100 bg-white text-xs font-semibold text-center tracking-wide leading-relaxed"
            style={{ color: props.captionColor }}
          >
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
