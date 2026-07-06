import { z } from 'zod';
import { Grid3X3 } from 'lucide-react';
import { registerBlock } from '../registry';

const logo = z.object({
  id: z.string(),
  src: z.string().default(''),
  alt: z.string().default(''),
});
const schema = z.object({ logos: z.array(logo).default([]) });
type LogoGridProps = z.infer<typeof schema>;

registerBlock({
  type: 'logo_grid',
  label: 'Logo Grid',
  category: 'data',
  icon: Grid3X3,
  fields: [
    { kind: 'list', key: 'logos', label: 'Logos', itemFields: [
      { kind: 'image', key: 'src', label: 'Logo URL' },
      { kind: 'text', key: 'alt', label: 'Alt Text' },
    ] },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: LogoGridProps, _block, ctx) => {
    if (props.logos.length === 0) {
      if (ctx.mode !== 'edit') return <></>;
      return <p className="text-xs text-slate-400 italic text-center py-4">Add logos in the editor</p>;
    }
    return (
      <div className="flex flex-wrap items-center justify-center gap-8 py-4">
        {props.logos.filter((l) => l.src).map((l) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={l.id} src={l.src} alt={l.alt} className="h-8 w-auto object-contain opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition-all" loading="lazy" />
        ))}
      </div>
    );
  },
});
