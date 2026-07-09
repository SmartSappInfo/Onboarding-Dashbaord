import React from 'react';
import { z } from 'zod';
import { Heading } from 'lucide-react';
import { registerBlock } from '../registry';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '../sanitize';

const schema = z.object({
  preset: z.enum([
    'hero-title', 
    'section-heading', 
    'subtitle', 
    'accent-tagline', 
    'left-accent-border', 
    'elegant-serif', 
    'badge-capsule'
  ]).default('section-heading'),
  textColorMode: z.enum(['dark', 'light']).default('dark'),
  title: z.string().default('Industry-leading Title Preset'),
  tagline: z.string().optional().default('Tagline'),
  subheading: z.string().optional().default('Provide context or supporting description for this section.'),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
  useGradient: z.boolean().default(false),
  gradientColor: z.string().default('#2563eb'),
  
  // Custom Color overrides (Optional)
  customTitleColor: z.string().optional().default(''),
  customTaglineColor: z.string().optional().default(''),
  customSubheadingColor: z.string().optional().default(''),
  
  // Custom Size overrides (Optional)
  customTitleSize: z.string().optional().default('default'),
  customTaglineSize: z.string().optional().default('default'),
  customSubheadingSize: z.string().optional().default('default'),
}).catchall(z.unknown());

type TitleProps = z.infer<typeof schema>;

// Premium SVG thumbnails for Block Variant Picker
const HeroHeadlineThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="25" y="15" width="50" height="3" rx="1" className="text-emerald-500 fill-emerald-500" />
    <rect x="15" y="25" width="70" height="8" rx="2" className="text-white fill-white" />
    <rect x="20" y="37" width="60" height="8" rx="2" className="text-white fill-white" />
    <rect x="30" y="52" width="40" height="4" rx="1.5" className="text-slate-500 fill-slate-500" />
  </svg>
);

const SectionHeadingThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="35" y="20" width="30" height="3" rx="1" className="text-emerald-500 fill-emerald-500" />
    <rect x="20" y="28" width="60" height="6" rx="1.5" className="text-white fill-white" />
    <rect x="25" y="42" width="50" height="4" rx="1.5" className="text-slate-500 fill-slate-500" />
    <rect x="30" y="50" width="40" height="4" rx="1.5" className="text-slate-500 fill-slate-500" />
  </svg>
);

const LeftAccentBorderThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="15" y="20" width="30" height="3" rx="1" className="text-slate-500 fill-slate-500" />
    <rect x="15" y="28" width="2" height="24" rx="1" className="text-blue-500 fill-blue-500" />
    <rect x="22" y="28" width="60" height="6" rx="1.5" className="text-white fill-white" />
    <rect x="22" y="38" width="50" height="6" rx="1.5" className="text-white fill-white" />
    <rect x="22" y="48" width="40" height="4" rx="1" className="text-slate-500 fill-slate-500" />
  </svg>
);

const ElegantSerifThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="25" y="20" width="50" height="3" rx="1" className="text-slate-500 fill-slate-500" />
    <path d="M20 32 C30 28, 70 28, 80 32 C80 32, 60 42, 40 42 Z" className="text-white fill-white" />
    <rect x="30" y="48" width="40" height="4" rx="1.5" className="text-slate-500 fill-slate-500" />
  </svg>
);

const BadgeCapsuleThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="30" y="30" width="40" height="15" rx="7.5" className="text-emerald-500/20 fill-emerald-500/20 stroke-emerald-500/30" />
    <rect x="40" y="36" width="20" height="3" rx="1" className="text-emerald-400 fill-emerald-400" />
  </svg>
);

registerBlock({
  type: 'title',
  label: 'Title Block',
  category: 'content',
  icon: Heading,
  fields: [
    {
      kind: 'select',
      key: 'preset',
      label: 'Preset Style',
      options: [
        { value: 'hero-title', label: 'Hero Headline' },
        { value: 'section-heading', label: 'Section Heading' },
        { value: 'subtitle', label: 'Standard Subtitle' },
        { value: 'accent-tagline', label: 'Accent Tagline Only' },
        { value: 'left-accent-border', label: 'Left Border Accent' },
        { value: 'elegant-serif', label: 'Elegant Editorial Serif' },
        { value: 'badge-capsule', label: 'Micro-Capsule Badge' },
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
    { kind: 'text', key: 'title', label: 'Headline Text' },
    { kind: 'text', key: 'tagline', label: 'Top Tagline (Optional)' },
    { kind: 'textarea', key: 'subheading', label: 'Subheading/Description (Optional)' },
    {
      kind: 'select',
      key: 'alignment',
      label: 'Alignment',
      options: [
        { value: 'left', label: 'Left Aligned' },
        { value: 'center', label: 'Centered' },
        { value: 'right', label: 'Right Aligned' },
      ],
    },
    { kind: 'boolean', key: 'useGradient', label: 'Enable Headline Gradient' },
    { kind: 'color', key: 'gradientColor', label: 'Gradient Accent Color' },
    
    // Custom Color Overrides
    { kind: 'color', key: 'customTitleColor', label: 'Custom Headline Color' },
    { kind: 'color', key: 'customTaglineColor', label: 'Custom Tagline Color' },
    { kind: 'color', key: 'customSubheadingColor', label: 'Custom Subheading Color' },
    
    // Custom Size Overrides
    {
      kind: 'select',
      key: 'customTitleSize',
      label: 'Custom Headline Size',
      options: [
        { value: 'default', label: 'Default Preset Size' },
        { value: 'text-lg', label: 'Small (lg)' },
        { value: 'text-xl', label: 'Medium (xl)' },
        { value: 'text-2xl', label: 'Large (2xl)' },
        { value: 'text-3xl', label: 'Extra Large (3xl)' },
        { value: 'text-4xl', label: 'Super (4xl)' },
        { value: 'text-5xl', label: 'Mega (5xl)' },
        { value: 'text-6xl', label: 'Ultra (6xl)' },
        { value: 'text-7xl', label: 'Giant (7xl)' },
      ],
    },
    {
      kind: 'select',
      key: 'customTaglineSize',
      label: 'Custom Tagline Size',
      options: [
        { value: 'default', label: 'Default Preset Size' },
        { value: 'text-[9px]', label: 'Micro (9px)' },
        { value: 'text-[10px]', label: 'Mini (10px)' },
        { value: 'text-xs', label: 'Small (xs)' },
        { value: 'text-sm', label: 'Medium (sm)' },
        { value: 'text-base', label: 'Large (base)' },
      ],
    },
    {
      kind: 'select',
      key: 'customSubheadingSize',
      label: 'Custom Subheading Size',
      options: [
        { value: 'default', label: 'Default Preset Size' },
        { value: 'text-[11px]', label: 'Micro (11px)' },
        { value: 'text-xs', label: 'Mini (xs)' },
        { value: 'text-sm', label: 'Small (sm)' },
        { value: 'text-base', label: 'Medium (base)' },
        { value: 'text-lg', label: 'Large (lg)' },
      ],
    },
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    { id: 'title-hero', label: 'Hero Headline', thumbnail: HeroHeadlineThumbnail, defaults: { preset: 'hero-title', alignment: 'center', tagline: 'GET STARTED', title: 'Streamlined Team Onboarding', subheading: 'Register profiles, collect agreements, and launch automated workflows in minutes.' } },
    { id: 'title-section', label: 'Section Heading', thumbnail: SectionHeadingThumbnail, defaults: { preset: 'section-heading', alignment: 'center', tagline: 'FEATURES', title: 'Why Choose SmartSapp', subheading: 'Explore our modular onboarding workflow architecture.' } },
    { id: 'title-border', label: 'Left Border Accent', thumbnail: LeftAccentBorderThumbnail, defaults: { preset: 'left-accent-border', alignment: 'left', tagline: 'IN DEPTH', title: 'Nominal Roster Verification', subheading: 'Verify teacher certifications and class roster approvals instantly with automated OCR.' } },
    { id: 'title-serif', label: 'Editorial Serif Style', thumbnail: ElegantSerifThumbnail, defaults: { preset: 'elegant-serif', alignment: 'center', tagline: 'ESTABLISHED 2026', title: 'Crafting premium compliance rosters', subheading: 'High-fidelity document and contract vaults engineered for security-first organizations.' } },
    { id: 'title-badge', label: 'Micro-Capsule Badge', thumbnail: BadgeCapsuleThumbnail, defaults: { preset: 'badge-capsule', alignment: 'center', title: 'Compliance Passed' } },
  ],
  render: (props: TitleProps, _block, ctx) => {
    const isEdit = ctx.mode === 'edit';
    const alignClass = props.alignment === 'left' ? 'text-left' : props.alignment === 'right' ? 'text-right' : 'text-center';
    const focusRingClass = isEdit ? "focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 outline-none rounded p-0.5 transition-all" : "";
    
    const preset = props.preset;
    const isLight = props.textColorMode === 'light';

    const titleSize = props.customTitleSize && props.customTitleSize !== 'default' ? props.customTitleSize : null;
    const taglineSize = props.customTaglineSize && props.customTaglineSize !== 'default' ? props.customTaglineSize : null;
    const subheadingSize = props.customSubheadingSize && props.customSubheadingSize !== 'default' ? props.customSubheadingSize : null;
    
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const titleRef = React.useRef<HTMLHeadingElement | HTMLSpanElement>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const taglineRef = React.useRef<HTMLParagraphElement>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const subheadingRef = React.useRef<HTMLParagraphElement>(null);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const lastTitleRef = React.useRef<string>('');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const lastTaglineRef = React.useRef<string>('');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const lastSubheadingRef = React.useRef<string>('');

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [hasMounted, setHasMounted] = React.useState(false);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useEffect(() => {
      setHasMounted(true);
    }, []);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useEffect(() => {
      if (hasMounted) {
        if (titleRef.current) {
          const expected = isEdit ? props.title : sanitizeHtml(ctx.interpolate(props.title));
          if (expected !== titleRef.current.innerHTML) {
            titleRef.current.innerHTML = expected;
          }
          lastTitleRef.current = props.title;
        }
        if (taglineRef.current) {
          const expected = isEdit ? props.tagline : sanitizeHtml(ctx.interpolate(props.tagline));
          if (expected !== taglineRef.current.innerHTML) {
            taglineRef.current.innerHTML = expected;
          }
          lastTaglineRef.current = props.tagline;
        }
        if (subheadingRef.current) {
          const expected = isEdit ? props.subheading : sanitizeHtml(ctx.interpolate(props.subheading));
          if (expected !== subheadingRef.current.innerHTML) {
            subheadingRef.current.innerHTML = expected;
          }
          lastSubheadingRef.current = props.subheading;
        }
      }
    }, [props.title, props.tagline, props.subheading, isEdit, hasMounted, ctx]);

    let titleClass = isLight ? 'text-white' : 'text-slate-900 dark:text-white';
    let taglineClass = isLight ? 'text-blue-400' : 'text-[#3B5FFF] dark:text-blue-400';
    let subClass = isLight ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400';
    
    if (preset === 'hero-title') {
      titleClass = cn(
        isLight ? 'text-white' : 'text-slate-900 dark:text-white',
        titleSize || 'text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight'
      );
      taglineClass = cn(
        isLight ? 'text-blue-400' : 'text-[#3B5FFF] dark:text-blue-400',
        taglineSize || 'text-sm uppercase tracking-widest font-extrabold mb-3'
      );
      subClass = cn(
        isLight ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400',
        subheadingSize || 'text-lg md:text-xl mt-4 max-w-2xl'
      );
    } else if (preset === 'section-heading') {
      titleClass = cn(
        isLight ? 'text-white' : 'text-slate-900 dark:text-white',
        titleSize || 'text-3xl sm:text-4xl font-extrabold tracking-tight mb-3'
      );
      taglineClass = cn(
        isLight ? 'text-blue-450' : 'text-[#3B5FFF] dark:text-blue-450',
        taglineSize || 'text-xs uppercase tracking-widest font-black mb-2'
      );
      subClass = cn(
        isLight ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400',
        subheadingSize || 'text-sm sm:text-base mt-3 max-w-2xl'
      );
    } else if (preset === 'subtitle') {
      titleClass = cn(
        isLight ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400',
        titleSize || 'text-base sm:text-lg font-medium leading-relaxed max-w-xl'
      );
      taglineClass = 'hidden';
      subClass = 'hidden';
    } else if (preset === 'accent-tagline') {
      titleClass = cn(
        isLight ? 'text-blue-400' : 'text-[#3B5FFF] dark:text-blue-400',
        titleSize || 'text-xs uppercase tracking-widest font-black'
      );
      taglineClass = 'hidden';
      subClass = 'hidden';
    } else if (preset === 'left-accent-border') {
      titleClass = cn(
        isLight ? 'text-white' : 'text-slate-900 dark:text-white',
        titleSize || 'text-2xl sm:text-3xl font-extrabold tracking-tight'
      );
      taglineClass = cn(
        isLight ? 'text-blue-400' : 'text-[#3B5FFF] dark:text-blue-400',
        taglineSize || 'text-[10px] uppercase tracking-widest font-black mb-1.5'
      );
      subClass = cn(
        isLight ? 'text-slate-350' : 'text-slate-500 dark:text-slate-400',
        subheadingSize || 'text-sm sm:text-base mt-2 max-w-2xl pl-5'
      );
    } else if (preset === 'elegant-serif') {
      titleClass = cn(
        isLight ? 'text-white' : 'text-slate-900 dark:text-white',
        titleSize || 'text-3xl sm:text-5xl font-serif italic font-normal tracking-tight leading-tight'
      );
      taglineClass = cn(
        isLight ? 'text-slate-300' : 'text-slate-450 dark:text-slate-550',
        taglineSize || 'text-xs uppercase tracking-widest font-semibold mb-1.5'
      );
      subClass = cn(
        isLight ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400',
        subheadingSize || 'text-xs sm:text-sm mt-2 max-w-xl font-sans'
      );
    } else if (preset === 'badge-capsule') {
      titleClass = cn(
        isLight ? 'text-emerald-400' : 'text-emerald-600 dark:text-emerald-400',
        titleSize || 'text-[10px] sm:text-xs font-black tracking-widest uppercase'
      );
      taglineClass = 'hidden';
      subClass = 'hidden';
    }

    if (props.alignment === 'center') {
      subClass += ' mx-auto';
    } else if (props.alignment === 'right') {
      subClass += ' ml-auto';
    }

    // Custom overrides styles
    const gradientStyles = props.useGradient && !props.customTitleColor
      ? {
          backgroundImage: `linear-gradient(to right, currentColor, ${props.gradientColor})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }
      : {};

    const titleStyles: React.CSSProperties = {
      ...gradientStyles,
      ...(props.customTitleColor ? { color: props.customTitleColor, WebkitTextFillColor: props.customTitleColor } : {}),
    };

    const taglineStyles: React.CSSProperties = {
      ...(props.customTaglineColor ? { color: props.customTaglineColor } : {}),
    };

    const subheadingStyles: React.CSSProperties = {
      ...(props.customSubheadingColor ? { color: props.customSubheadingColor } : {}),
    };

    const handleTitleBlur = (e: React.FocusEvent<HTMLHeadingElement | HTMLSpanElement>) => {
      ctx.onPropChange?.({ title: e.currentTarget.innerHTML });
    };

    const handleTaglineBlur = (e: React.FocusEvent<HTMLParagraphElement>) => {
      ctx.onPropChange?.({ tagline: e.currentTarget.innerHTML });
    };

    const handleSubheadingBlur = (e: React.FocusEvent<HTMLParagraphElement>) => {
      ctx.onPropChange?.({ subheading: e.currentTarget.innerHTML });
    };

    if (preset === 'badge-capsule') {
      const capsuleBgClass = isLight 
        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";
      return (
        <div className={cn("py-2 w-full", alignClass, isEdit ? "select-text" : "select-none")}>
          <span 
            ref={titleRef as React.RefObject<HTMLSpanElement>}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border text-xs font-bold tracking-wider uppercase cursor-text outline-none",
              capsuleBgClass,
              focusRingClass
            )}
            style={titleStyles}
            contentEditable={isEdit}
            suppressContentEditableWarning
            data-block-id={_block.id}
            data-prop-key="title"
            data-rich="true"
            onBlur={isEdit ? handleTitleBlur : undefined}
            dangerouslySetInnerHTML={!hasMounted ? { __html: isEdit ? props.title : sanitizeHtml(ctx.interpolate(props.title)) } : undefined}
          />
        </div>
      );
    }

    return (
      <div className={cn("py-4 w-full", alignClass, isEdit ? "select-text" : "select-none")}>
        {/* Top Tagline */}
        {props.tagline && preset !== 'subtitle' && preset !== 'accent-tagline' && (
          <p
            ref={taglineRef}
            className={cn(taglineClass, focusRingClass, "outline-none")}
            style={taglineStyles}
            contentEditable={isEdit}
            suppressContentEditableWarning
            data-block-id={_block.id}
            data-prop-key="tagline"
            data-rich="true"
            onBlur={isEdit ? handleTaglineBlur : undefined}
            dangerouslySetInnerHTML={!hasMounted ? { __html: isEdit ? props.tagline : sanitizeHtml(ctx.interpolate(props.tagline)) } : undefined}
          />
        )}

        {/* Main Headline */}
        <h2
          ref={titleRef as React.RefObject<HTMLHeadingElement>}
          className={cn(titleClass, "transition-all duration-300 outline-none", focusRingClass)}
          style={titleStyles}
          contentEditable={isEdit}
          suppressContentEditableWarning
          data-block-id={_block.id}
          data-prop-key="title"
          data-rich="true"
          onBlur={isEdit ? handleTitleBlur : undefined}
          dangerouslySetInnerHTML={!hasMounted ? { __html: isEdit ? props.title : sanitizeHtml(ctx.interpolate(props.title)) } : undefined}
        />

        {/* Supporting Subheading */}
        {props.subheading && preset !== 'accent-tagline' && (
          <p
            ref={subheadingRef}
            className={cn(subClass, focusRingClass, "outline-none")}
            style={subheadingStyles}
            contentEditable={isEdit}
            suppressContentEditableWarning
            data-block-id={_block.id}
            data-prop-key="subheading"
            data-rich="true"
            onBlur={isEdit ? handleSubheadingBlur : undefined}
            dangerouslySetInnerHTML={!hasMounted ? { __html: isEdit ? props.subheading : sanitizeHtml(ctx.interpolate(props.subheading)) } : undefined}
          />
        )}
      </div>
    );
  },
});
