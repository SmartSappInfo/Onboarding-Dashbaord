import { z } from 'zod';
import { Code2 } from 'lucide-react';
import { registerBlock } from '../registry';
import { sanitizeHtml, sanitizeCss } from '../sanitize';

const schema = z.object({
  html: z.string().default(''),
  css: z.string().default(''),
});
type HtmlProps = z.infer<typeof schema>;

registerBlock({
  type: 'html',
  label: 'Raw Code',
  category: 'embed',
  icon: Code2,
  fields: [
    { kind: 'textarea', key: 'html', label: 'Raw HTML' },
    { kind: 'textarea', key: 'css', label: 'Custom CSS' },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: HtmlProps, _block, ctx) => {
    // Custom code is gated by page settings; never render it on a published page
    // when scripts are disallowed.
    if (ctx.mode === 'view' && ctx.allowScripts === false) return <></>;
    if (!props.html) {
      if (ctx.mode !== 'edit') return <></>;
      return <p className="text-xs text-slate-400 italic text-center py-4">Add custom HTML in the editor</p>;
    }
    return (
      <div className="relative">
        {ctx.mode === 'edit' ? (
          <span className="absolute top-1 right-1 z-10 bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-[8px] font-bold">CUSTOM CODE</span>
        ) : null}
        {props.css ? <style dangerouslySetInnerHTML={{ __html: sanitizeCss(props.css) }} /> : null}
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(props.html) }} />
      </div>
    );
  },
});
