import { z } from 'zod';
import { Quote } from 'lucide-react';
import { registerBlock } from '../registry';

const schema = z.object({
  quote: z.string().default(''),
  author: z.string().default(''),
  role: z.string().default(''),
  avatarUrl: z.string().default(''),
});
type TestimonialProps = z.infer<typeof schema>;

registerBlock({
  type: 'testimonial',
  label: 'Testimonial',
  category: 'data',
  icon: Quote,
  fields: [
    { kind: 'textarea', key: 'quote', label: 'Quote' },
    { kind: 'text', key: 'author', label: 'Author Name' },
    { kind: 'text', key: 'role', label: 'Role / Company' },
    { kind: 'image', key: 'avatarUrl', label: 'Avatar URL' },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: TestimonialProps, _block, ctx) => (
    <figure className="max-w-lg mx-auto p-8 rounded-2xl border border-black/10 bg-black/[0.02] text-center space-y-4">
      <Quote className="w-8 h-8 mx-auto" style={{ color: ctx.theme.colors.accent }} />
      <blockquote className="text-base italic leading-relaxed font-medium" style={{ color: ctx.theme.colors.text, opacity: 0.85 }}>
        {ctx.interpolate(props.quote) || 'Add a testimonial quote...'}
      </blockquote>
      <figcaption className="flex items-center justify-center gap-3 pt-2">
        {props.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.avatarUrl} alt={props.author} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
        ) : null}
        <div className="text-left">
          <p className="text-sm font-bold" style={{ color: ctx.theme.colors.text }}>{props.author || 'Author'}</p>
          {props.role ? <p className="text-xs" style={{ color: ctx.theme.colors.text, opacity: 0.6 }}>{props.role}</p> : null}
        </div>
      </figcaption>
    </figure>
  ),
});
