import { z } from 'zod';
import { Heading } from 'lucide-react';
import { registerBlock } from '../registry';

const schema = z.object({
  preset: z.enum(['hero-title', 'section-heading', 'subtitle', 'accent-tagline']).default('section-heading'),
  title: z.string().default('Industry-leading Title Preset'),
  tagline: z.string().optional().default('Tagline'),
  subheading: z.string().optional().default('Provide context or supporting description for this section.'),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
  useGradient: z.boolean().default(false),
  gradientColor: z.string().default('#2563eb'),
}).catchall(z.unknown());

type TitleProps = z.infer<typeof schema>;

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
  render: (props: TitleProps, _block, ctx) => {
    const isEdit = ctx.mode === 'edit';
    const alignClass = props.alignment === 'left' ? 'text-left' : props.alignment === 'right' ? 'text-right' : 'text-center';
    
    // Style presets definitions
    const preset = props.preset;
    
    let titleClass = 'font-bold text-slate-900 dark:text-white';
    let taglineClass = 'text-xs uppercase tracking-widest font-semibold mb-2';
    let subClass = 'text-slate-500 dark:text-slate-400 mt-2 max-w-3xl';
    
    if (preset === 'hero-title') {
      titleClass = 'text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight';
      taglineClass = 'text-sm uppercase tracking-widest font-extrabold text-emerald-500 dark:text-emerald-400 mb-3';
      subClass = 'text-lg md:text-xl text-slate-500 dark:text-slate-400 mt-4 max-w-2xl';
    } else if (preset === 'section-heading') {
      titleClass = 'text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white';
      taglineClass = 'text-xs uppercase tracking-widest font-bold text-emerald-500 dark:text-emerald-400 mb-2';
      subClass = 'text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2 max-w-2xl';
    } else if (preset === 'subtitle') {
      titleClass = 'text-xl sm:text-2xl font-semibold tracking-normal text-slate-800 dark:text-slate-100';
      taglineClass = 'hidden';
      subClass = 'text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-xl';
    } else if (preset === 'accent-tagline') {
      titleClass = 'text-sm sm:text-base font-black uppercase tracking-widest text-emerald-500 dark:text-emerald-400';
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
