import React from 'react';
import { z } from 'zod';
import { HelpCircle } from 'lucide-react';
import { registerBlock } from '../registry';
import { cn } from '@/lib/utils';

const item = z.object({
  id: z.string(),
  question: z.string().default(''),
  answer: z.string().default(''),
});

const schema = z.object({
  items: z.array(item).default([]),
  textColorMode: z.enum(['dark', 'light']).default('dark'),
  customQuestionColor: z.string().optional().default(''),
  customAnswerColor: z.string().optional().default(''),
}).catchall(z.unknown());

type FaqProps = z.infer<typeof schema>;

// Premium SVG thumbnails for Block Variant Picker
const FaqThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="15" y="15" width="70" height="12" rx="3" className="text-slate-800 fill-slate-800 stroke-slate-700" strokeWidth="0.5" />
    <circle cx="23" cy="21" r="2.5" className="text-emerald-500 fill-emerald-500" />
    <rect x="32" y="19" width="40" height="3" rx="1" className="text-white fill-white" />
    
    <rect x="15" y="32" width="70" height="12" rx="3" className="text-slate-800 fill-slate-800 stroke-slate-700" strokeWidth="0.5" />
    <circle cx="23" cy="38" r="2.5" className="text-emerald-500 fill-emerald-500" />
    <rect x="32" y="36" width="40" height="3" rx="1" className="text-white fill-white" />
    
    <rect x="15" y="49" width="70" height="12" rx="3" className="text-slate-800 fill-slate-800 stroke-slate-700" strokeWidth="0.5" />
    <circle cx="23" cy="55" r="2.5" className="text-emerald-500 fill-emerald-500" />
    <rect x="32" y="53" width="40" height="3" rx="1" className="text-white fill-white" />
  </svg>
);

registerBlock({
  type: 'faq',
  label: 'FAQ Accordion',
  category: 'data',
  icon: HelpCircle,
  fields: [
    {
      kind: 'list',
      key: 'items',
      label: 'FAQ Items',
      itemFields: [
        { kind: 'text', key: 'question', label: 'Question' },
        { kind: 'textarea', key: 'answer', label: 'Answer' },
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
    { kind: 'color', key: 'customQuestionColor', label: 'Custom Question Color' },
    { kind: 'color', key: 'customAnswerColor', label: 'Custom Answer Color' },
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    {
      id: 'faq-standard',
      label: 'FAQ Accordion List',
      thumbnail: FaqThumbnail,
      defaults: {
        items: [
          { id: '1', question: 'How secure is the automated roster validation?', answer: 'We employ state-of-the-art encrypted document vaults and automated verification checks that validate school profiles against official regional registries in under 2 minutes.' },
          { id: '2', question: 'What compliance standards does SmartSapp support?', answer: 'Our pipelines conform to federal education data privacy mandates and secure roster audits to ensure organizational safety at every level.' },
        ],
      },
    },
  ],
  render: (props: FaqProps, _block, ctx) => {
    const isLight = props.textColorMode === 'light';

    if (props.items.length === 0) {
      if (ctx.mode !== 'edit') return <></>;
      return <p className="text-xs text-slate-400 italic text-center py-4 select-none">No FAQ items configured yet</p>;
    }

    const itemBorderClass = isLight 
      ? "border-white/10 bg-white/5" 
      : "border-black/10 bg-black/[0.02]";

    const headerBorderClass = isLight
      ? "border-white/5"
      : "border-black/5";

    const questionStyle: React.CSSProperties = {
      color: props.customQuestionColor || (isLight ? '#ffffff' : '#1e293b'),
    };

    const answerStyle: React.CSSProperties = {
      color: props.customAnswerColor || (isLight ? 'rgba(255, 255, 255, 0.75)' : ctx.theme.colors.text || '#334155'),
    };

    return (
      <div className="space-y-3 max-w-2xl mx-auto select-none py-2">
        {props.items.map((it) => (
          <details key={it.id} className={cn("group rounded-xl border overflow-hidden transition-all duration-300", itemBorderClass)}>
            <summary className="flex items-center justify-between p-5 cursor-pointer select-none font-bold text-sm outline-none">
              <span style={questionStyle}>{ctx.interpolate(it.question)}</span>
              <span className={cn("ml-2 group-open:rotate-180 transition-transform duration-200", isLight ? "text-white/40" : "text-slate-400")}>▾</span>
            </summary>
            <div className={cn("px-5 pb-5 text-sm leading-relaxed border-t pt-3", headerBorderClass)} style={answerStyle}>
              {ctx.interpolate(it.answer)}
            </div>
          </details>
        ))}
      </div>
    );
  },
});
