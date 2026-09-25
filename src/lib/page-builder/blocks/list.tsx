import React from 'react';
import { z } from 'zod';
import { ListOrdered, Check, Minus } from 'lucide-react';
import { registerBlock } from '../registry';
import { sanitizeHtml } from '../sanitize';
import { cn } from '@/lib/utils';
import { isColorLight } from '../resolve-theme';

export type ListPresetType = 'checklist' | 'bullet' | 'numbered' | 'cards' | 'minimal-dash' | 'icon-pill';
export type ListColumnsType = '1' | '2' | '3';
export type ListSpacingType = 'compact' | 'normal' | 'relaxed';

export const listItemSchema = z.object({
  id: z.string(),
  title: z.string().default(''),
  description: z.string().optional().default(''),
  icon: z.string().optional().default(''),
  checked: z.boolean().optional().default(false),
});

export type ListItem = z.infer<typeof listItemSchema>;

const schema = z.object({
  title: z.string().optional().default(''),
  preset: z.enum(['checklist', 'bullet', 'numbered', 'cards', 'minimal-dash', 'icon-pill']).default('checklist'),
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

export type ListProps = z.infer<typeof schema>;

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
  defaults: schema.parse({}),
  schema,
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
  ],
  render: (props: ListProps, _block, ctx) => {
    const isDarkTheme = ctx.themeMode === 'dark';
    const effectiveIsLight = isDarkTheme;

    if (!props.items || props.items.length === 0) {
      if (ctx.mode !== 'edit') return <></>;
      return (
        <div className="py-6 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl select-none">
          <p className="text-xs font-semibold text-slate-400">No list items added yet. Click + Add to start.</p>
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

    return (
      <div className="w-full py-2" role="region" aria-label="List Content">
        {props.title ? (
          <h3
            className="text-lg font-bold mb-4"
            style={{ color: finalTextColor, fontFamily: ctx.theme.typography.headingFont }}
          >
            {ctx.interpolate(props.title)}
          </h3>
        ) : null}

        <ul
          role="list"
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

            // 6. Classic Bullet Preset (Default fallback)
            return (
              <li
                key={item.id || index}
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
