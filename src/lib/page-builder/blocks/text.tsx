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
  render: (props: TextProps, _block, ctx) => {
    const isEdit = ctx.mode === 'edit';
    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
      ctx.onPropChange?.({ content: e.currentTarget.innerHTML });
    };
    return (
      <div
        className="prose prose-slate max-w-none focus:outline-emerald-500/50 focus:outline focus:outline-2 p-1 rounded transition-all"
        style={{ color: ctx.theme.colors.text, fontFamily: ctx.theme.typography.bodyFont }}
        contentEditable={isEdit}
        suppressContentEditableWarning
        onBlur={isEdit ? handleBlur : undefined}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(props.content)) }}
      />
    );
  },});
