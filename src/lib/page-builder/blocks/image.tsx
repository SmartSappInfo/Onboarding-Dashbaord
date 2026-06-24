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

    return (
      <figure className="rounded-xl overflow-hidden">
        {/*
          Author images are arbitrary remote URLs with unknown intrinsic
          dimensions, so `next/image` (which needs width/height or a configured
          loader) is not applicable here — documented exception in the spec.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.src} alt={props.alt} className="w-full h-auto" loading="lazy" />
        {props.caption ? (
          <figcaption className="text-xs text-center py-2 italic" style={{ color: ctx.theme.colors.text, opacity: 0.6 }}>
            {ctx.interpolate(props.caption)}
          </figcaption>
        ) : null}
      </figure>
    );
  },
});
