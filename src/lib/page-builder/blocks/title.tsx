import { z } from 'zod';
import { Heading } from 'lucide-react';
import { registerBlock } from '../registry';

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
  title: z.string().default('Industry-leading Title Preset'),
  tagline: z.string().optional().default('Tagline'),
  subheading: z.string().optional().default('Provide context or supporting description for this section.'),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
  useGradient: z.boolean().default(false),
  gradientColor: z.string().default('#2563eb'),
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
    
    const preset = props.preset;
    
    let titleClass = 'font-bold text-slate-900 dark:text-white';
    let taglineClass = 'text-xs uppercase tracking-widest font-semibold mb-2';
    let subClass = 'text-slate-500 dark:text-slate-400 mt-2 max-w-3xl';
    
    if (preset === 'hero-title') {
      titleClass = 'text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight';
      taglineClass = 'text-sm uppercase tracking-widest font-extrabold text-[#3B5FFF] dark:text-blue-400 mb-3';
      subClass = 'text-lg md:text-xl text-slate-500 dark:text-slate-400 mt-4 max-w-2xl';
    } else if (preset === 'section-heading') {
      titleClass = 'text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white';
      taglineClass = 'text-xs uppercase tracking-widest font-bold text-[#3B5FFF] dark:text-blue-400 mb-2';
      subClass = 'text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2 max-w-2xl';
    } else if (preset === 'subtitle') {
      titleClass = 'text-xl sm:text-2xl font-semibold tracking-normal text-slate-800 dark:text-slate-100';
      taglineClass = 'hidden';
      subClass = 'text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-xl';
    } else if (preset === 'accent-tagline') {
      titleClass = 'text-sm sm:text-base font-black uppercase tracking-widest text-[#3B5FFF] dark:text-blue-400';
      taglineClass = 'hidden';
      subClass = 'hidden';
    } else if (preset === 'left-accent-border') {
      titleClass = 'text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white border-l-4 border-[#3B5FFF] pl-4';
      taglineClass = 'text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-2 pl-5';
      subClass = 'text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2 max-w-2xl pl-5';
    } else if (preset === 'elegant-serif') {
      titleClass = 'text-3xl sm:text-5xl font-serif italic font-normal tracking-tight text-slate-900 dark:text-white leading-tight';
      taglineClass = 'text-xs uppercase tracking-widest font-semibold text-slate-455 dark:text-slate-500 mb-1.5';
      subClass = 'text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xl font-sans';
    } else if (preset === 'badge-capsule') {
      titleClass = 'text-[10px] sm:text-xs font-black tracking-widest uppercase text-emerald-600 dark:text-emerald-400';
      taglineClass = 'hidden';
      subClass = 'hidden';
    }

    if (props.alignment === 'center') {
      subClass += ' mx-auto';
    } else if (props.alignment === 'right') {
      subClass += ' ml-auto';
    }

    const defaultTitleColor = props.useGradient ? 'transparent' : 'inherit';
    const gradientStyles = props.useGradient
      ? {
          backgroundImage: `linear-gradient(to right, currentColor, ${props.gradientColor})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }
      : {};

    const handleTitleBlur = (e: React.FocusEvent<HTMLHeadingElement>) => {
      ctx.onPropChange?.({ title: e.currentTarget.innerText });
    };

    const handleTaglineBlur = (e: React.FocusEvent<HTMLParagraphElement>) => {
      ctx.onPropChange?.({ tagline: e.currentTarget.innerText });
    };

    const handleSubheadingBlur = (e: React.FocusEvent<HTMLParagraphElement>) => {
      ctx.onPropChange?.({ subheading: e.currentTarget.innerText });
    };

    if (preset === 'badge-capsule') {
      return (
        <div className={`py-2 w-full ${alignClass} select-none`}>
          <span 
            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold tracking-wider uppercase cursor-text"
            contentEditable={isEdit}
            suppressContentEditableWarning
            onBlur={isEdit ? handleTitleBlur : undefined}
          >
            {ctx.interpolate(props.title)}
          </span>
        </div>
      );
    }

    return (
      <div className={`py-4 w-full ${alignClass} select-none`}>
        {/* Top Tagline */}
        {props.tagline && preset !== 'subtitle' && preset !== 'accent-tagline' && (
          <p
            className={taglineClass}
            contentEditable={isEdit}
            suppressContentEditableWarning
            onBlur={isEdit ? handleTaglineBlur : undefined}
          >
            {ctx.interpolate(props.tagline)}
          </p>
        )}

        {/* Main Headline */}
        <h2
          className={`${titleClass} transition-all duration-300`}
          style={gradientStyles}
          contentEditable={isEdit}
          suppressContentEditableWarning
          onBlur={isEdit ? handleTitleBlur : undefined}
        >
          {ctx.interpolate(props.title)}
        </h2>

        {/* Supporting Subheading */}
        {props.subheading && preset !== 'accent-tagline' && (
          <p
            className={subClass}
            contentEditable={isEdit}
            suppressContentEditableWarning
            onBlur={isEdit ? handleSubheadingBlur : undefined}
          >
            {ctx.interpolate(props.subheading)}
          </p>
        )}
      </div>
    );
  },
});
