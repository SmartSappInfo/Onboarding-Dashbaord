import { z } from 'zod';
import { Type } from 'lucide-react';
import { registerBlock } from '../registry';
import { sanitizeHtml } from '../sanitize';

const schema = z.object({
  content: z.string().default('<p>Start writing your content here...</p>'),
}).catchall(z.unknown());
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

    const blockId = _block.id;
    const resolveFont = (family: string | undefined) => {
      if (family === 'heading') return ctx.theme.typography.headingFont;
      if (family === 'body') return ctx.theme.typography.bodyFont;
      if (family === 'sans') return 'system-ui, sans-serif';
      if (family === 'serif') return 'Georgia, serif';
      return family || ctx.theme.typography.bodyFont;
    };

    const defaultFont = resolveFont(props.fontFamily as string | undefined);
    const hoverFont = resolveFont((props.hover_fontFamily || props.fontFamily) as string | undefined);
    const focusFont = resolveFont((props.focus_fontFamily || props.fontFamily) as string | undefined);

    const defaultColor = (props.textColor as string | undefined) || ctx.theme.colors.text;
    const hoverColor = (props.hover_textColor as string | undefined) || defaultColor;
    const focusColor = (props.focus_textColor as string | undefined) || defaultColor;

    const defaultAlign = (props.textAlign as string | undefined) || 'left';
    const hoverAlign = (props.hover_textAlign as string | undefined) || defaultAlign;
    const focusAlign = (props.focus_textAlign as string | undefined) || defaultAlign;

    const defaultSize = (props.fontSize as string | undefined) || 'inherit';
    const hoverSize = (props.hover_fontSize as string | undefined) || defaultSize;
    const focusSize = (props.focus_fontSize as string | undefined) || defaultSize;

    const hasGradient = props.textGradient === true;
    const gradientColor1 = defaultColor;
    const gradientColor2 = (props.textGradientColor as string | undefined) || '#60a5fa';

    const hoverHasGradient = props.hover_textGradient === true || hasGradient;
    const hoverGradientColor1 = hoverColor;
    const hoverGradientColor2 = (props.hover_textGradientColor as string | undefined) || (props.textGradientColor as string | undefined) || '#60a5fa';

    const focusHasGradient = props.focus_textGradient === true || hasGradient;
    const focusGradientColor1 = focusColor;
    const focusGradientColor2 = (props.focus_textGradientColor as string | undefined) || (props.textGradientColor as string | undefined) || '#60a5fa';

    const cssStyles = `
      #text-block-${blockId}, #text-block-${blockId} * {
        color: ${hasGradient ? 'transparent' : defaultColor} !important;
        font-family: ${defaultFont} !important;
        text-align: ${defaultAlign} !important;
        font-size: ${defaultSize} !important;
        ${hasGradient ? `
          background-image: linear-gradient(to right, ${gradientColor1}, ${gradientColor2}) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
        ` : 'background-image: none !important; -webkit-background-clip: border-box !important; -webkit-text-fill-color: currentcolor !important;'}
      }
      #text-block-${blockId}:hover, #text-block-${blockId}:hover * {
        color: ${hoverHasGradient ? 'transparent' : hoverColor} !important;
        font-family: ${hoverFont} !important;
        text-align: ${hoverAlign} !important;
        font-size: ${hoverSize} !important;
        ${hoverHasGradient ? `
          background-image: linear-gradient(to right, ${hoverGradientColor1}, ${hoverGradientColor2}) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
        ` : 'background-image: none !important; -webkit-background-clip: border-box !important; -webkit-text-fill-color: currentcolor !important;'}
      }
      #text-block-${blockId}:focus, #text-block-${blockId}:focus * {
        color: ${focusHasGradient ? 'transparent' : focusColor} !important;
        font-family: ${focusFont} !important;
        text-align: ${focusAlign} !important;
        font-size: ${focusSize} !important;
        outline: none !important;
        ${focusHasGradient ? `
          background-image: linear-gradient(to right, ${focusGradientColor1}, ${focusGradientColor2}) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
        ` : 'background-image: none !important; -webkit-background-clip: border-box !important; -webkit-text-fill-color: currentcolor !important;'}
      }
    `;

    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
        <div
          id={`text-block-${blockId}`}
          className="prose prose-slate max-w-none focus:outline-emerald-500/50 focus:outline focus:outline-2 p-1 rounded transition-all"
          contentEditable={isEdit}
          suppressContentEditableWarning
          onBlur={isEdit ? handleBlur : undefined}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(props.content as string)) }}
        />
      </>
    );
  },});
