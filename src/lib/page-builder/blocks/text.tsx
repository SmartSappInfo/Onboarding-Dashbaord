import { z } from 'zod';
import { Type } from 'lucide-react';
import { registerBlock } from '../registry';
import { sanitizeHtml } from '../sanitize';

const schema = z.object({
  content: z.string().default('<p>Start writing your content here...</p>'),
});
type TextProps = z.infer<typeof schema>;

registerBlock({
  type: 'text',
  label: 'Rich Text',
  category: 'content',
  icon: Type,
  fields: [{ kind: 'richtext', key: 'content', label: 'Content' }],
  defaults: schema.parse({}),
  schema,
  // Rich text is authored via the side-panel editor; the canvas shows the same
  // rendered output in both modes (no inline input → safe for view, R11).
  render: (props: TextProps, _block, ctx) => (
    <div
      className="prose prose-slate max-w-none"
      style={{ color: ctx.theme.colors.text, fontFamily: ctx.theme.typography.bodyFont }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(props.content)) }}
    />
  ),
});
