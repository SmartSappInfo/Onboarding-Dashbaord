import { z } from 'zod';
import { Type } from 'lucide-react';
import { registerBlock } from '../registry';
import { sanitizeHtml } from '../sanitize';
import { cn } from '@/lib/utils';

const schema = z.object({
  content: z.string().default('<p>Start writing your content here…</p>'),
  preset: z.enum(['paragraph', 'lead', 'disclaimer', 'quote']).default('paragraph'),
  textColorMode: z.enum(['dark', 'light']).default('dark'),
  fontSize: z.string().optional().default('default'),
  textColor: z.string().optional().default(''),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).default('left'),
}).catchall(z.unknown());

type TextProps = z.infer<typeof schema>;

// Premium SVG thumbnails for Block Variant Picker
const ParagraphThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="15" y="20" width="70" height="3.5" rx="1" className="text-slate-200 fill-slate-200" />
    <rect x="15" y="28" width="70" height="3.5" rx="1" className="text-slate-200 fill-slate-200" />
    <rect x="15" y="36" width="55" height="3.5" rx="1" className="text-slate-200 fill-slate-200" />
    <rect x="15" y="48" width="70" height="3.5" rx="1" className="text-slate-500 fill-slate-500" />
    <rect x="15" y="56" width="40" height="3.5" rx="1" className="text-slate-500 fill-slate-500" />
  </svg>
);

const LeadThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="15" y="20" width="70" height="5.5" rx="1.5" className="text-white fill-white" />
    <rect x="15" y="30" width="70" height="5.5" rx="1.5" className="text-white fill-white" />
    <rect x="15" y="40" width="50" height="5.5" rx="1.5" className="text-slate-400 fill-slate-400" />
  </svg>
);

const DisclaimerThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="25" y="25" width="50" height="2" rx="0.5" className="text-slate-500 fill-slate-500" />
    <rect x="20" y="31" width="60" height="2" rx="0.5" className="text-slate-500 fill-slate-500" />
    <rect x="30" y="37" width="40" height="2" rx="0.5" className="text-slate-500 fill-slate-500" />
    <rect x="25" y="49" width="50" height="2" rx="0.5" className="text-slate-500 fill-slate-500" />
  </svg>
);

const QuoteThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="15" y="20" width="2" height="35" rx="1" className="text-blue-500 fill-blue-500" />
    <rect x="22" y="24" width="60" height="3.5" rx="1" className="text-white fill-white" />
    <rect x="22" y="32" width="50" height="3.5" rx="1" className="text-white fill-white" />
    <rect x="22" y="40" width="55" height="3.5" rx="1" className="text-slate-400 fill-slate-400" />
  </svg>
);

registerBlock({
  type: 'text',
  label: 'Rich Text',
  category: 'content',
  icon: Type,
  fields: [
    { kind: 'richtext', key: 'content', label: 'Content Editor' },
    {
      kind: 'select',
      key: 'preset',
      label: 'Preset Style',
      options: [
        { value: 'paragraph', label: 'Standard Paragraph' },
        { value: 'lead', label: 'Feature Lead Intro' },
        { value: 'disclaimer', label: 'Small Legal / Disclaimer' },
        { value: 'quote', label: 'Premium Blockquote' },
      ],
    },
    {
      kind: 'select',
      key: 'textColorMode',
      label: 'Text Color Theme',
      options: [
        { value: 'dark', label: 'Dark Text (For Light Backgrounds)' },
        { value: 'light', label: 'Light Text (For Dark/Hero Backgrounds)' },
      ],
    },
    {
      kind: 'select',
      key: 'fontSize',
      label: 'Font Size Override',
      options: [
        { value: 'default', label: 'Default Preset Size' },
        { value: 'text-xs', label: 'Micro (xs)' },
        { value: 'text-sm', label: 'Small (sm)' },
        { value: 'text-base', label: 'Medium (base)' },
        { value: 'text-lg', label: 'Large (lg)' },
        { value: 'text-xl', label: 'Extra Large (xl)' },
        { value: 'text-2xl', label: '2XL Headline (2xl)' },
      ],
    },
    { kind: 'color', key: 'textColor', label: 'Custom Text Color' },
    {
      kind: 'select',
      key: 'textAlign',
      label: 'Alignment',
      options: [
        { value: 'left', label: 'Left Aligned' },
        { value: 'center', label: 'Centered' },
        { value: 'right', label: 'Right Aligned' },
        { value: 'justify', label: 'Justified' },
      ],
    },
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    { id: 'text-paragraph', label: 'Standard Paragraph', thumbnail: ParagraphThumbnail, defaults: { preset: 'paragraph', content: '<p>Start writing your content here. Build rich layouts, customize alignments, and link resources seamlessly.</p>' } },
    { id: 'text-lead', label: 'Feature Lead Intro', thumbnail: LeadThumbnail, defaults: { preset: 'lead', content: '<p>Experience onboarding automated to perfection. Register class rosters and compliance documents instantly.</p>' } },
    { id: 'text-disclaimer', label: 'Small Disclaimer', thumbnail: DisclaimerThumbnail, defaults: { preset: 'disclaimer', textAlign: 'center', content: '<p>© 2026 SmartSapp Inc. All rights reserved. Submissions are subject to nominal roster verification protocols.</p>' } },
    { id: 'text-quote', label: 'Blockquote Style', thumbnail: QuoteThumbnail, defaults: { preset: 'quote', content: '<p>“This system automated our compliance workflows, cutting class roster approvals from weeks to minutes.”</p>' } },
  ],
  render: (props: TextProps, _block, ctx) => {
    const isEdit = ctx.mode === 'edit';
    const preset = props.preset || 'paragraph';
    const isLight = props.textColorMode === 'light';
    const blockId = _block.id;

    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
      ctx.onPropChange?.({ content: e.currentTarget.innerHTML });
    };

    const resolveFont = (family: string | undefined) => {
      if (family === 'heading') return ctx.theme.typography.headingFont;
      if (family === 'body') return ctx.theme.typography.bodyFont;
      if (family === 'sans') return 'system-ui, sans-serif';
      if (family === 'serif') return 'Georgia, serif';
      return family || ctx.theme.typography.bodyFont;
    };

    const defaultFont = resolveFont(props.fontFamily as string | undefined);
    
    // Theme and Preset based text colors
    const defaultColor = props.textColor || (isLight
      ? (preset === 'disclaimer' ? '#94a3b8' : preset === 'quote' ? '#cbd5e1' : '#f1f5f9')
      : (preset === 'disclaimer' ? '#64748b' : preset === 'quote' ? '#475569' : ctx.theme.colors.text || '#334155'));

    const defaultAlign = props.textAlign || 'left';

    // Map Tailwind font size classes to actual CSS values for the style injector if needed
    const defaultSize = props.fontSize && props.fontSize !== 'default'
      ? (props.fontSize === 'text-xs' ? '0.75rem' 
       : props.fontSize === 'text-sm' ? '0.875rem' 
       : props.fontSize === 'text-base' ? '1rem' 
       : props.fontSize === 'text-lg' ? '1.125rem' 
       : props.fontSize === 'text-xl' ? '1.25rem' 
       : props.fontSize === 'text-2xl' ? '1.5rem' : props.fontSize)
      : (preset === 'lead' ? '1.25rem' : preset === 'disclaimer' ? '0.75rem' : preset === 'quote' ? '1.125rem' : '1rem');

    const cssStyles = `
      #text-block-${blockId} {
        color: ${defaultColor} !important;
        font-family: ${defaultFont} !important;
        text-align: ${defaultAlign} !important;
        font-size: ${defaultSize} !important;
      }
      #text-block-${blockId} a {
        color: ${isLight ? '#60a5fa' : '#2563eb'} !important;
        text-decoration: underline !important;
      }
    `;

    const quoteContainerClass = preset === 'quote' 
      ? isLight 
        ? "border-l-4 pl-4 border-blue-400 italic py-1.5 bg-slate-500/5 rounded-r" 
        : "border-l-4 pl-4 border-[#3B5FFF] italic py-1.5 bg-slate-500/5 rounded-r"
      : "";

    return (
      <div className="w-full select-none py-2">
        <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
        <div className={quoteContainerClass}>
          <div
            id={`text-block-${blockId}`}
            className={cn(
              "prose prose-slate max-w-none p-1 rounded transition-all",
              isEdit
                ? "focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 outline-none"
                : "focus:outline-none"
            )}
            contentEditable={isEdit}
            suppressContentEditableWarning
            onBlur={isEdit ? handleBlur : undefined}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.interpolate(props.content as string)) }}
          />
        </div>
      </div>
    );
  },
});
