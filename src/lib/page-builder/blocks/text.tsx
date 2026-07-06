import React from 'react';
import { z } from 'zod';
import { Type } from 'lucide-react';
import { registerBlock } from '../registry';
import { sanitizeHtml } from '../sanitize';
import { cn } from '@/lib/utils';

const schema = z.object({
  content: z.string().default('<p>Start writing your content here…</p>'),
  preset: z.enum(['paragraph', 'lead', 'disclaimer', 'quote', 'two-columns', 'checklist']).default('paragraph'),
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

const TwoColumnsThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="15" y="20" width="25" height="30" rx="2" className="text-slate-800 fill-slate-800" />
    <rect x="18" y="25" width="19" height="3" rx="0.5" className="text-blue-500 fill-blue-500" />
    <rect x="18" y="32" width="12" height="2" rx="0.5" className="text-slate-500 fill-slate-500" />
    <rect x="48" y="20" width="37" height="3" rx="0.5" className="text-slate-200 fill-slate-200" />
    <rect x="48" y="27" width="37" height="3" rx="0.5" className="text-slate-200 fill-slate-200" />
    <rect x="48" y="34" width="37" height="3" rx="0.5" className="text-slate-200 fill-slate-200" />
    <rect x="48" y="41" width="22" height="3" rx="0.5" className="text-slate-200 fill-slate-200" />
  </svg>
);

const ChecklistThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <circle cx="20" cy="25" r="3" className="text-emerald-500 fill-emerald-500" />
    <rect x="30" y="23" width="55" height="3.5" rx="1" className="text-slate-200 fill-slate-200" />
    <circle cx="20" cy="37" r="3" className="text-emerald-500 fill-emerald-500" />
    <rect x="30" y="35" width="55" height="3.5" rx="1" className="text-slate-200 fill-slate-200" />
    <circle cx="20" cy="49" r="3" className="text-emerald-500 fill-emerald-500" />
    <rect x="30" y="47" width="40" height="3.5" rx="1" className="text-slate-200 fill-slate-200" />
  </svg>
);

const CalloutThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="15" y="16" width="70" height="43" rx="4" className="text-slate-850 fill-slate-850" />
    <rect x="18" y="20" width="2" height="35" rx="0.5" className="text-blue-500 fill-blue-500" />
    <rect x="24" y="24" width="40" height="3" rx="0.5" className="text-blue-400 fill-blue-400" />
    <rect x="24" y="32" width="55" height="2" rx="0.5" className="text-slate-350 fill-slate-350" />
    <rect x="24" y="38" width="55" height="2" rx="0.5" className="text-slate-350 fill-slate-350" />
    <rect x="24" y="44" width="35" height="2" rx="0.5" className="text-slate-350 fill-slate-350" />
  </svg>
);

const StatementThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="20" y="22" width="60" height="4" rx="1.5" className="text-white fill-white" />
    <rect x="25" y="32" width="50" height="4" rx="1.5" className="text-white fill-white" />
    <rect x="35" y="42" width="30" height="3" rx="1" className="text-slate-400 fill-slate-400" />
    <rect x="42" y="52" width="16" height="2" rx="0.5" className="text-slate-500 fill-slate-500" />
  </svg>
);

const StepThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="15" y="20" width="22" height="9" rx="2" className="text-blue-500 fill-blue-500" />
    <rect x="42" y="23" width="43" height="4" rx="1" className="text-slate-200 fill-slate-200" />
    <rect x="15" y="38" width="70" height="3" rx="1" className="text-slate-500 fill-slate-500" />
    <rect x="15" y="46" width="50" height="3" rx="1" className="text-slate-500 fill-slate-500" />
  </svg>
);

const BulletsThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <path d="M 18,22 L 21,25 L 25,19" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="30" y="20" width="55" height="3" rx="0.5" className="text-slate-200 fill-slate-200" />
    <path d="M 18,34 L 21,37 L 25,31" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="30" y="32" width="55" height="3" rx="0.5" className="text-slate-200 fill-slate-200" />
    <path d="M 18,46 L 21,49 L 25,43" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="30" y="44" width="45" height="3" rx="0.5" className="text-slate-200 fill-slate-200" />
  </svg>
);

interface TextBlockEditorProps {
  blockId: string;
  isEdit: boolean;
  content: string;
  onBlur?: (html: string) => void;
  quoteContainerClass: string;
  cssStyles: string;
  interpolate: (text: string) => string;
}

const TextBlockEditor = ({
  blockId,
  isEdit,
  content,
  onBlur,
  quoteContainerClass,
  cssStyles,
  interpolate,
}: TextBlockEditorProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const lastContentRef = React.useRef<string>('');
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  // Sync content only if the prop actually changes from the last value we wrote/received
  React.useEffect(() => {
    if (hasMounted && containerRef.current) {
      const interpolated = interpolate(content);
      const sanitized = sanitizeHtml(interpolated);
      // We only update if the external content prop is different from our last known content
      if (content !== lastContentRef.current) {
        const currentHTML = containerRef.current.innerHTML;
        if (currentHTML !== sanitized) {
          containerRef.current.innerHTML = sanitized;
        }
        lastContentRef.current = content;
      }
    }
  }, [content, hasMounted, interpolate]);

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const newHtml = e.currentTarget.innerHTML;
    lastContentRef.current = newHtml;
    if (onBlur) {
      onBlur(newHtml);
    }
  };

  return (
    <div className={cn("w-full py-2", isEdit ? "select-text" : "select-none")}>
      <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
      <div className={quoteContainerClass}>
        <div
          ref={containerRef}
          id={`text-block-${blockId}`}
          className={cn(
            "prose prose-slate max-w-none p-1 rounded transition-all select-text cursor-text",
            isEdit
              ? "outline-none focus:outline-none focus-visible:outline-none border-0 focus:border-0"
              : "focus:outline-none"
          )}
          contentEditable={isEdit}
          suppressContentEditableWarning
          onBlur={isEdit ? handleBlur : undefined}
          dangerouslySetInnerHTML={!hasMounted ? { __html: sanitizeHtml(interpolate(content)) } : undefined}
        />
      </div>
    </div>
  );
};

registerBlock({
  type: 'text',
  label: 'Rich Text',
  category: 'content',
  icon: Type,
  fields: [
    {
      kind: 'select',
      key: 'preset',
      label: 'Preset Style',
      options: [
        { value: 'paragraph', label: 'Standard Paragraph' },
        { value: 'lead', label: 'Feature Lead Intro' },
        { value: 'disclaimer', label: 'Small Legal / Disclaimer' },
        { value: 'quote', label: 'Premium Blockquote' },
        { value: 'two-columns', label: 'Two-Column Details' },
        { value: 'checklist', label: 'Interactive Checklist' },
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
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    { id: 'text-paragraph', label: 'Standard Article', description: 'Headline, sub-lead paragraph and list details.', thumbnail: ParagraphThumbnail, defaults: { preset: 'paragraph', content: '<h3><b>Our Mission & Vision</b></h3><p>We are dedicated to building robust digital systems that automate roster management, onboarding tracking, and class roster integrations. Empowering educational institutions is at the core of our platform.</p>' } },
    { id: 'text-lead', label: 'Feature Lead Intro', description: 'Bold intro text layout for high impact conversions.', thumbnail: LeadThumbnail, defaults: { preset: 'lead', content: '<p><b>Roster Onboarding, Automated to Perfection.</b> Experience the future of student intelligence. Register compliance logs, classroom cohorts, and verification tags instantly with zero manual delay.</p>' } },
    { id: 'text-two-columns', label: 'Two-Column Layout', description: 'Comparison grid layout split into columns.', thumbnail: TwoColumnsThumbnail, defaults: { preset: 'two-columns', content: '<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 24px;"><div><h4 style="margin: 0; color: #3B5FFF;"><b>Platform Perks</b></h4></div><div><p style="margin: 0;">Our platform reduces roster processing lag by 94%, ensuring that compliance officers, teachers, and administrators stay in sync without exchanging spreadsheets or manual verification emails.</p></div></div>' } },
    { id: 'text-quote', label: 'Blockquote Style', description: 'Indented quotation layout with testimonial author details.', thumbnail: QuoteThumbnail, defaults: { preset: 'quote', content: '<p><i>“This onboarding system streamlined our operations, allowing us to manage over 10,000 active students and rosters while maintaining perfect security and compliance.”</i></p><p style="margin-top: 8px; font-size: 11px; color: #64748b;">— <b>Dr. Sarah Jenkins</b>, Academic Compliance Director</p>' } },
    { id: 'text-checklist', label: 'Interactive Checklist', description: 'Interactive checkmark bullets list layout.', thumbnail: ChecklistThumbnail, defaults: { preset: 'checklist', content: '<h4><b>Getting Started Checklist</b></h4><p>Complete these initial steps to fully integrate your campus rosters:</p><p>✅ <b>1. Sync Workspace Database:</b> Hook up your tenant parameters.</p><p>✅ <b>2. Invite Administrators:</b> Set up backoffice roles and permissions.</p><p>✅ <b>3. Publish Campaign Pages:</b> Generate public URLs for registrations.</p>' } },
    { id: 'text-disclaimer', label: 'Small Disclaimer', description: 'Dense, small legal context layout.', thumbnail: DisclaimerThumbnail, defaults: { preset: 'disclaimer', textAlign: 'center', content: '<p>© 2026 SmartSapp. All rights reserved. Roster submissions are subject to validation checks under local administrative rules. Terms of Service apply.</p>' } },
    { id: 'text-callout', label: 'Callout Box', description: 'Subtle left-bordered callout container layout.', thumbnail: CalloutThumbnail, defaults: { preset: 'paragraph', content: '<div style="background-color: rgba(59, 95, 255, 0.08); border-left: 4px solid #3B5FFF; padding: 18px 20px; border-radius: 4px; color: inherit;"><h4 style="margin: 0 0 6px 0; color: #3B5FFF; font-size: 15px;"><b>Key Information</b></h4><p style="margin: 0; font-size: 13.5px; opacity: 0.9;">Please note that all student records must be validated before you can submit the final roster report. Compliance reviews take 2-3 business days.</p></div>' } },
    { id: 'text-statement', label: 'Elegant Statement', description: 'Centred large italic statement block.', thumbnail: StatementThumbnail, defaults: { preset: 'lead', textAlign: 'center', content: '<div style="text-align: center; padding: 12px 0;"><h3 style="font-family: Georgia, serif; font-style: italic; font-weight: normal; font-size: 20px; line-height: 1.6; margin-bottom: 8px;">“Education is not preparation for life; education is life itself.”</h3><p style="margin: 0; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.15em;">— John Dewey</p></div>' } },
    { id: 'text-step', label: 'Instruction Step', description: 'Numbered action badge layout.', thumbnail: StepThumbnail, defaults: { preset: 'paragraph', content: '<div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px;"><span style="background-color: #3B5FFF; color: #fff; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1; margin-top: 2px;">STEP 1</span><div style="flex: 1;"><h4 style="margin: 0 0 4px 0; font-size: 15px;"><b>Configure Campaign Settings</b></h4><p style="margin: 0; font-size: 13.5px; opacity: 0.85;">Navigate to the Campaign Settings panel and hook up your target database connection credentials before initiating student invites.</p></div></div>' } },
    { id: 'text-bullets', label: 'Highlight Bullets', description: 'Bullet list layout with custom checkmarks.', thumbnail: BulletsThumbnail, defaults: { preset: 'paragraph', content: '<h4><b>What is included:</b></h4><ul style="list-style-type: none; padding-left: 0; margin-top: 10px; display: flex; flex-direction: column; gap: 8px;"><li style="display: flex; gap: 8px; align-items: center;"><span style="color: #10B981; font-size: 14px;">✔</span> <span style="font-size: 13.5px;">Premium onboarding dashboards & tracking tool</span></li><li style="display: flex; gap: 8px; align-items: center;"><span style="color: #10B981; font-size: 14px;">✔</span> <span style="font-size: 13.5px;">Auto sync options with CSV export</span></li><li style="display: flex; gap: 8px; align-items: center;"><span style="color: #10B981; font-size: 14px;">✔</span> <span style="font-size: 13.5px;">Unlimited campaign page layouts & design tools</span></li></ul>' } },
  ],
  render: (props: TextProps, _block, ctx) => {
    const isEdit = ctx.mode === 'edit';
    const preset = props.preset || 'paragraph';
    const isLight = props.textColorMode === 'light';
    const blockId = _block.id;

    const handleBlur = (newHtml: string) => {
      ctx.onPropChange?.({ content: newHtml });
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
      <TextBlockEditor
        blockId={blockId}
        isEdit={isEdit}
        content={props.content as string}
        onBlur={handleBlur}
        quoteContainerClass={quoteContainerClass}
        cssStyles={cssStyles}
        interpolate={ctx.interpolate}
      />
    );
  },
});
