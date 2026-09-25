import React from 'react';
import { z } from 'zod';
import { ListOrdered, Check, Minus, ChevronRight, Plus } from 'lucide-react';
import { registerBlock } from '../registry';
import { sanitizeHtml } from '../sanitize';
import { cn } from '@/lib/utils';
import { isColorLight } from '../resolve-theme';
import { InlineEditable } from '@/components/page-builder/InlineEditable';

export type ListPresetType =
  | 'checklist'
  | 'bullet'
  | 'numbered'
  | 'cards'
  | 'minimal-dash'
  | 'icon-pill'
  | 'stepped-gradient'
  | 'bordered-rows';

export type ListIntroAlignment = 'left' | 'center';
export type ListColumnsType = '1' | '2' | '3';
export type ListSpacingType = 'compact' | 'normal' | 'relaxed';

export const listItemSchema = z.object({
  id: z.string().default(() => `item-${Math.random().toString(36).substring(2, 9)}`),
  title: z.string().default(''),
  description: z.string().optional().default(''),
  icon: z.string().optional().default(''),
  checked: z.boolean().optional().default(false),
});

export type ListItem = z.infer<typeof listItemSchema>;

export const rawListSchema = z.object({
  title: z.string().optional().default(''), // Legacy fallback
  showIntroText: z.boolean().optional(), // Toggle to show text above list
  introTitle: z.string().optional().default(''), // Headline above intro paragraph
  introText: z.string().optional().default(''), // Paragraph before list items
  introAlignment: z.enum(['left', 'center']).default('left'),
  preset: z.enum([
    'checklist',
    'bullet',
    'numbered',
    'cards',
    'minimal-dash',
    'icon-pill',
    'stepped-gradient',
    'bordered-rows',
  ]).default('checklist'),
  columns: z.enum(['1', '2', '3']).default('1'),
  spacing: z.enum(['compact', 'normal', 'relaxed']).default('normal'),
  bulletColor: z.string().optional().default(''),
  textColor: z.string().optional().default(''),
  showDescriptions: z.boolean().default(true),
  items: z.array(listItemSchema).default([
    {
      id: '1',
      title: 'Streamlined workspace onboarding',
      description: 'Configure student rosters and administrative permissions with zero delay.',
    },
    {
      id: '2',
      title: 'Automated compliance validations',
      description: 'Run automated checks against regional databases and education registries.',
    },
    {
      id: '3',
      title: 'One-click roster synchronizations',
      description: 'Export and sync verified student data across internal databases seamlessly.',
    },
  ]),
}).catchall(z.unknown());

export const listSchema = rawListSchema.transform((data) => {
  // Backward compatibility: map legacy title if present and introTitle is empty
  const resolvedIntroTitle = data.introTitle || data.title || '';
  const resolvedShowIntro = data.showIntroText !== undefined
    ? data.showIntroText
    : Boolean(data.title || data.introTitle || data.introText);
  return {
    ...data,
    introTitle: resolvedIntroTitle,
    showIntroText: resolvedShowIntro,
  };
});

export type ListProps = z.infer<typeof listSchema>;

// Premium SVG thumbnails for Block Variant Picker
const ChecklistThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <circle cx="20" cy="20" r="4" className="text-emerald-500 fill-emerald-500" />
    <rect x="29" y="18" width="55" height="4" rx="1" className="text-slate-100 fill-slate-100" />
    <circle cx="20" cy="36" r="4" className="text-emerald-500 fill-emerald-500" />
    <rect x="29" y="34" width="55" height="4" rx="1" className="text-slate-100 fill-slate-100" />
    <circle cx="20" cy="52" r="4" className="text-emerald-500 fill-emerald-500" />
    <rect x="29" y="50" width="45" height="4" rx="1" className="text-slate-100 fill-slate-100" />
  </svg>
);

const NumberedThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <circle cx="20" cy="20" r="4.5" className="text-blue-500 fill-blue-500" />
    <rect x="29" y="18" width="55" height="4" rx="1" className="text-slate-100 fill-slate-100" />
    <circle cx="20" cy="36" r="4.5" className="text-blue-500 fill-blue-500" />
    <rect x="29" y="34" width="55" height="4" rx="1" className="text-slate-100 fill-slate-100" />
    <circle cx="20" cy="52" r="4.5" className="text-blue-500 fill-blue-500" />
    <rect x="29" y="50" width="45" height="4" rx="1" className="text-slate-100 fill-slate-100" />
  </svg>
);

const BulletThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <circle cx="20" cy="20" r="2.5" className="text-primary fill-primary" />
    <rect x="28" y="18.5" width="56" height="3.5" rx="1" className="text-slate-200 fill-slate-200" />
    <circle cx="20" cy="36" r="2.5" className="text-primary fill-primary" />
    <rect x="28" y="34.5" width="56" height="3.5" rx="1" className="text-slate-200 fill-slate-200" />
    <circle cx="20" cy="52" r="2.5" className="text-primary fill-primary" />
    <rect x="28" y="50.5" width="46" height="3.5" rx="1" className="text-slate-200 fill-slate-200" />
  </svg>
);

const CardsThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="14" y="14" width="72" height="15" rx="3" className="text-slate-800 fill-slate-800 stroke-slate-700" strokeWidth="0.5" />
    <circle cx="22" cy="21.5" r="2.5" className="text-emerald-500 fill-emerald-500" />
    <rect x="30" y="20" width="48" height="3" rx="0.75" className="text-slate-100 fill-slate-100" />
    <rect x="14" y="33" width="72" height="15" rx="3" className="text-slate-800 fill-slate-800 stroke-slate-700" strokeWidth="0.5" />
    <circle cx="22" cy="40.5" r="2.5" className="text-emerald-500 fill-emerald-500" />
    <rect x="30" y="39" width="48" height="3" rx="0.75" className="text-slate-100 fill-slate-100" />
    <rect x="14" y="52" width="72" height="15" rx="3" className="text-slate-800 fill-slate-800 stroke-slate-700" strokeWidth="0.5" />
    <circle cx="22" cy="59.5" r="2.5" className="text-emerald-500 fill-emerald-500" />
    <rect x="30" y="58" width="48" height="3" rx="0.75" className="text-slate-100 fill-slate-100" />
  </svg>
);

const SteppedGradientThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <line x1="20" y1="20" x2="20" y2="52" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="2 2" />
    <circle cx="20" cy="20" r="4.5" className="text-primary fill-primary" />
    <rect x="29" y="18" width="55" height="4" rx="1" className="text-slate-100 fill-slate-100" />
    <circle cx="20" cy="36" r="4.5" className="text-indigo-500 fill-indigo-500" />
    <rect x="29" y="34" width="55" height="4" rx="1" className="text-slate-100 fill-slate-100" />
    <circle cx="20" cy="52" r="4.5" className="text-purple-500 fill-purple-500" />
    <rect x="29" y="50" width="45" height="4" rx="1" className="text-slate-100 fill-slate-100" />
  </svg>
);

const BorderedRowsThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="12" y="12" width="76" height="15" rx="2" className="text-slate-800 fill-slate-800" />
    <circle cx="18" cy="19.5" r="2" className="text-primary fill-primary" />
    <rect x="24" y="18" width="52" height="3" rx="0.75" className="text-slate-100 fill-slate-100" />
    <line x1="12" y1="28" x2="88" y2="28" stroke="#334155" strokeWidth="0.75" />
    <rect x="12" y="30" width="76" height="15" rx="2" className="text-slate-800 fill-slate-800" />
    <circle cx="18" cy="37.5" r="2" className="text-primary fill-primary" />
    <rect x="24" y="36" width="52" height="3" rx="0.75" className="text-slate-100 fill-slate-100" />
    <line x1="12" y1="46" x2="88" y2="46" stroke="#334155" strokeWidth="0.75" />
    <rect x="12" y="48" width="76" height="15" rx="2" className="text-slate-800 fill-slate-800" />
    <circle cx="18" cy="55.5" r="2" className="text-primary fill-primary" />
    <rect x="24" y="54" width="42" height="3" rx="0.75" className="text-slate-100 fill-slate-100" />
  </svg>
);

registerBlock({
  type: 'list',
  label: 'List',
  category: 'content',
  icon: ListOrdered,
  fields: [
    {
      kind: 'select',
      key: 'preset',
      label: 'Preset Style',
      options: [
        { value: 'checklist', label: 'Checkmark Feature List' },
        { value: 'bullet', label: 'Classic Bulleted List' },
        { value: 'numbered', label: 'Numbered Steps' },
        { value: 'cards', label: 'Item Cards' },
        { value: 'minimal-dash', label: 'Minimal Dash' },
        { value: 'icon-pill', label: 'Compact Pills' },
        { value: 'stepped-gradient', label: 'Stepped Gradient Milestones' },
        { value: 'bordered-rows', label: 'Bordered Interactive Rows' },
      ],
    },
    {
      kind: 'boolean',
      key: 'showIntroText',
      label: 'Include Intro Paragraph',
    },
    {
      kind: 'text',
      key: 'introTitle',
      label: 'Intro Headline',
      placeholder: 'e.g. Course Deliverables & Perks',
    },
    {
      kind: 'textarea',
      key: 'introText',
      label: 'Intro Paragraph',
      placeholder: 'Provide context or lead-in text before the list items...',
    },
    {
      kind: 'select',
      key: 'introAlignment',
      label: 'Intro Alignment',
      options: [
        { value: 'left', label: 'Left Aligned' },
        { value: 'center', label: 'Center Aligned' },
      ],
    },
    {
      kind: 'list',
      key: 'items',
      label: 'List Items',
      itemFields: [
        { kind: 'text', key: 'title', label: 'Item Title' },
        { kind: 'textarea', key: 'description', label: 'Item Subtext / Description' },
      ],
    },
    {
      kind: 'select',
      key: 'columns',
      label: 'Layout Columns',
      options: [
        { value: '1', label: '1 Column' },
        { value: '2', label: '2 Columns' },
        { value: '3', label: '3 Columns' },
      ],
    },
    {
      kind: 'select',
      key: 'spacing',
      label: 'Item Spacing',
      options: [
        { value: 'compact', label: 'Compact (8px)' },
        { value: 'normal', label: 'Normal (14px)' },
        { value: 'relaxed', label: 'Relaxed (20px)' },
      ],
    },
    { kind: 'color', key: 'bulletColor', label: 'Accent / Bullet Color' },
    { kind: 'color', key: 'textColor', label: 'Custom Text Color' },
    { kind: 'boolean', key: 'showDescriptions', label: 'Show Subtitles & Descriptions' },
  ],
  defaults: listSchema.parse({}),
  schema: listSchema,
  variants: [
    {
      id: 'list-checklist',
      label: 'Feature Checklist',
      description: 'Checkmark badges highlighting features and perks.',
      thumbnail: ChecklistThumbnail,
      defaults: { preset: 'checklist' },
    },
    {
      id: 'list-bullet',
      label: 'Bulleted Takeaways',
      description: 'Refined bullet points for editorial summaries.',
      thumbnail: BulletThumbnail,
      defaults: { preset: 'bullet' },
    },
    {
      id: 'list-numbered',
      label: 'Numbered Sequence',
      description: 'Step-by-step numbers for instructions and guides.',
      thumbnail: NumberedThumbnail,
      defaults: { preset: 'numbered' },
    },
    {
      id: 'list-cards',
      label: 'Item Cards Grid',
      description: 'Boxed cards with subtle border and elevation.',
      thumbnail: CardsThumbnail,
      defaults: { preset: 'cards' },
    },
    {
      id: 'list-stepped-gradient',
      label: 'Stepped Milestones',
      description: 'Numbered gradient sequence with connecting trace line.',
      thumbnail: SteppedGradientThumbnail,
      defaults: { preset: 'stepped-gradient' },
    },
    {
      id: 'list-bordered-rows',
      label: 'Bordered Rows',
      description: 'Horizontal rows divided by subtle borders with chevron markers.',
      thumbnail: BorderedRowsThumbnail,
      defaults: { preset: 'bordered-rows' },
    },
  ],
  render: (props: ListProps, _block, ctx) => {
    const isEdit = ctx.mode === 'edit';
    const isDarkTheme = ctx.themeMode === 'dark';
    const effectiveIsLight = isDarkTheme;

    const handleAddFirstItem = () => {
      ctx.onPropChange?.({
        items: [
          {
            id: `item-${Date.now()}`,
            title: 'First item instruction or feature',
            description: 'Provide additional details for this list item.',
          },
        ],
      });
    };

    if (!props.items || props.items.length === 0) {
      if (!isEdit) return <></>;
      return (
        <div className="py-8 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3 animate-in fade-in duration-200">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            No list items added yet. Click below to add your first item.
          </p>
          <button
            type="button"
            onClick={handleAddFirstItem}
            className="h-9 min-h-[44px] px-4 rounded-xl text-xs font-bold text-white shadow-xs active:scale-[0.97] transition-all cursor-pointer flex items-center gap-1.5"
            style={{ backgroundColor: props.bulletColor || ctx.theme.colors.primary || '#3b82f6' }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Item</span>
          </button>
        </div>
      );
    }

    const preset = props.preset || 'checklist';
    const columns = props.columns || '1';
    const spacing = props.spacing || 'normal';
    const showDescriptions = props.showDescriptions !== false;

    // Grid column mapping with mobile-first responsiveness
    const gridColsClass = columns === '3'
      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      : columns === '2'
        ? 'grid-cols-1 md:grid-cols-2'
        : 'grid-cols-1';

    // Vertical / grid gap mapping
    const gapClass = spacing === 'compact'
      ? 'gap-2'
      : spacing === 'relaxed'
        ? 'gap-5'
        : 'gap-3.5';

    // Theme color adaptation
    const defaultTextColor = effectiveIsLight ? '#f1f5f9' : (ctx.theme.colors.text || '#1e293b');
    const finalTextColor = (isDarkTheme && props.textColor && !isColorLight(props.textColor))
      ? '#f1f5f9'
      : (props.textColor || defaultTextColor);

    const defaultSubtextColor = effectiveIsLight ? '#94a3b8' : '#64748b';

    const accentColor = props.bulletColor || ctx.theme.colors.primary || '#3b82f6';

    const titleStyle: React.CSSProperties = {
      color: finalTextColor,
      fontFamily: ctx.theme.typography.bodyFont,
    };

    const subtextStyle: React.CSSProperties = {
      color: defaultSubtextColor,
      fontFamily: ctx.theme.typography.bodyFont,
    };

    const renderIntroHeader = () => {
      if (!props.showIntroText) return null;
      const hasTitle = Boolean(props.introTitle && props.introTitle.trim());
      const hasText = Boolean(props.introText && props.introText.trim());

      if (!hasTitle && !hasText && !isEdit) return null;

      const isCenter = props.introAlignment === 'center';

      return (
        <div className={cn("w-full flex flex-col space-y-2 mb-6 animate-in fade-in duration-200", isCenter ? "text-center items-center" : "text-left items-start")}>
          {isEdit ? (
            <InlineEditable
              value={props.introTitle || ''}
              onChange={(val) => ctx.onPropChange?.({ introTitle: val })}
              placeholder="List Headline / Title"
              className={cn("text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 block w-full", isCenter && "text-center")}
              isEdit={isEdit}
            />
          ) : hasTitle ? (
            <h3
              className={cn("text-2xl font-bold tracking-tight", isCenter && "text-center")}
              style={{ color: finalTextColor, fontFamily: ctx.theme.typography.headingFont }}
            >
              {ctx.interpolate(props.introTitle || '')}
            </h3>
          ) : null}

          {isEdit ? (
            <InlineEditable
              value={props.introText || ''}
              onChange={(val) => ctx.onPropChange?.({ introText: val })}
              placeholder="Add an introductory paragraph or context before the list items..."
              className={cn("text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed block max-w-3xl w-full", isCenter && "text-center")}
              isEdit={isEdit}
            />
          ) : hasText ? (
            <p
              className={cn("text-sm font-medium leading-relaxed max-w-3xl", isCenter && "text-center")}
              style={{ color: defaultSubtextColor, fontFamily: ctx.theme.typography.bodyFont }}
            >
              {ctx.interpolate(props.introText || '')}
            </p>
          ) : null}
        </div>
      );
    };

    const headerContent = renderIntroHeader();

    return (
      <div className={cn("w-full", headerContent ? "py-2" : "py-0.5")} role="region" aria-label="List Content" data-preset={preset}>
        {headerContent}

        <ul
          role="list"
          data-preset={preset}
          className={cn(
            'grid w-full select-text',
            gridColsClass,
            gapClass
          )}
        >
          {props.items.map((item, index) => {
            const interpolatedTitle = sanitizeHtml(ctx.interpolate(item.title));
            const interpolatedDesc = item.description ? sanitizeHtml(ctx.interpolate(item.description)) : '';

            // 1. Checklist Preset
            if (preset === 'checklist') {
              return (
                <li
                  key={item.id || index}
                  data-preset="checklist"
                  className="flex items-start gap-3 p-1 text-left"
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-2xs"
                    style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-bold leading-snug"
                      style={titleStyle}
                      dangerouslySetInnerHTML={{ __html: interpolatedTitle }}
                    />
                    {showDescriptions && interpolatedDesc ? (
                      <div
                        className="text-xs leading-relaxed mt-0.5"
                        style={subtextStyle}
                        dangerouslySetInnerHTML={{ __html: interpolatedDesc }}
                      />
                    ) : null}
                  </div>
                </li>
              );
            }

            // 2. Numbered Preset
            if (preset === 'numbered') {
              return (
                <li
                  key={item.id || index}
                  data-preset="numbered"
                  className="flex items-start gap-3 p-1 text-left"
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-black shadow-2xs"
                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-bold leading-snug"
                      style={titleStyle}
                      dangerouslySetInnerHTML={{ __html: interpolatedTitle }}
                    />
                    {showDescriptions && interpolatedDesc ? (
                      <div
                        className="text-xs leading-relaxed mt-0.5"
                        style={subtextStyle}
                        dangerouslySetInnerHTML={{ __html: interpolatedDesc }}
                      />
                    ) : null}
                  </div>
                </li>
              );
            }

            // 3. Cards Preset
            if (preset === 'cards') {
              return (
                <li
                  key={item.id || index}
                  data-preset="cards"
                  className={cn(
                    "flex flex-col p-4 rounded-xl border text-left transition-all duration-200 shadow-2xs hover:shadow-xs",
                    effectiveIsLight
                      ? "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      : "bg-white/80 border-slate-200/90 hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <div
                      className="text-sm font-bold leading-snug flex-1"
                      style={titleStyle}
                      dangerouslySetInnerHTML={{ __html: interpolatedTitle }}
                    />
                  </div>
                  {showDescriptions && interpolatedDesc ? (
                    <div
                      className="text-xs leading-relaxed pl-6"
                      style={subtextStyle}
                      dangerouslySetInnerHTML={{ __html: interpolatedDesc }}
                    />
                  ) : null}
                </li>
              );
            }

            // 4. Minimal Dash Preset
            if (preset === 'minimal-dash') {
              return (
                <li
                  key={item.id || index}
                  data-preset="minimal-dash"
                  className="flex items-start gap-2.5 p-1 text-left"
                >
                  <Minus
                    className="w-4 h-4 stroke-[3] shrink-0 mt-0.5"
                    style={{ color: accentColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold leading-snug"
                      style={titleStyle}
                      dangerouslySetInnerHTML={{ __html: interpolatedTitle }}
                    />
                    {showDescriptions && interpolatedDesc ? (
                      <div
                        className="text-xs leading-relaxed mt-0.5"
                        style={subtextStyle}
                        dangerouslySetInnerHTML={{ __html: interpolatedDesc }}
                      />
                    ) : null}
                  </div>
                </li>
              );
            }

            // 5. Icon Pill Preset
            if (preset === 'icon-pill') {
              return (
                <li
                  key={item.id || index}
                  data-preset="icon-pill"
                  className={cn(
                    "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all",
                    effectiveIsLight
                      ? "bg-slate-900 border-slate-800 text-slate-200"
                      : "bg-slate-50 border-slate-200/80 text-slate-800"
                  )}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: accentColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-xs font-bold truncate block"
                      style={titleStyle}
                      dangerouslySetInnerHTML={{ __html: interpolatedTitle }}
                    />
                    {showDescriptions && interpolatedDesc ? (
                      <span
                        className="text-[11px] leading-tight block truncate mt-0.5 opacity-75"
                        style={subtextStyle}
                        dangerouslySetInnerHTML={{ __html: interpolatedDesc }}
                      />
                    ) : null}
                  </div>
                </li>
              );
            }

            // 6. Stepped Gradient Preset
            if (preset === 'stepped-gradient') {
              const isLast = index === props.items.length - 1;
              return (
                <li
                  key={item.id || index}
                  data-preset="stepped-gradient"
                  className="relative flex items-start gap-3.5 p-1 text-left"
                >
                  {!isLast && columns === '1' && (
                    <div
                      className="absolute left-[13px] top-8 bottom-0 w-0.5 pointer-events-none opacity-40"
                      style={{
                        background: `linear-gradient(to bottom, ${accentColor}, transparent)`,
                      }}
                    />
                  )}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-black shadow-xs text-white z-10"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor} 0%, #6366f1 100%)`,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div
                      className="text-sm font-bold leading-snug"
                      style={titleStyle}
                      dangerouslySetInnerHTML={{ __html: interpolatedTitle }}
                    />
                    {showDescriptions && interpolatedDesc ? (
                      <div
                        className="text-xs leading-relaxed mt-1"
                        style={subtextStyle}
                        dangerouslySetInnerHTML={{ __html: interpolatedDesc }}
                      />
                    ) : null}
                  </div>
                </li>
              );
            }

            // 7. Bordered Interactive Rows Preset
            if (preset === 'bordered-rows') {
              return (
                <li
                  key={item.id || index}
                  data-preset="bordered-rows"
                  className={cn(
                    "flex items-center justify-between gap-4 py-3.5 px-3 rounded-xl transition-colors border-b",
                    effectiveIsLight
                      ? "border-slate-800/80 hover:bg-slate-900/40"
                      : "border-slate-100 hover:bg-slate-50/80"
                  )}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0 mt-1.5 shadow-2xs"
                      style={{ backgroundColor: accentColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-semibold leading-snug"
                        style={titleStyle}
                        dangerouslySetInnerHTML={{ __html: interpolatedTitle }}
                      />
                      {showDescriptions && interpolatedDesc ? (
                        <div
                          className="text-xs leading-relaxed mt-0.5"
                          style={subtextStyle}
                          dangerouslySetInnerHTML={{ __html: interpolatedDesc }}
                        />
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0" />
                </li>
              );
            }

            // 8. Classic Bullet Preset (Default fallback)
            return (
              <li
                key={item.id || index}
                data-preset="bullet"
                className="flex items-start gap-3 p-1 text-left"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0 mt-1.5 shadow-2xs"
                  style={{ backgroundColor: accentColor }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium leading-snug"
                    style={titleStyle}
                    dangerouslySetInnerHTML={{ __html: interpolatedTitle }}
                  />
                  {showDescriptions && interpolatedDesc ? (
                    <div
                      className="text-xs leading-relaxed mt-0.5"
                      style={subtextStyle}
                      dangerouslySetInnerHTML={{ __html: interpolatedDesc }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
});
