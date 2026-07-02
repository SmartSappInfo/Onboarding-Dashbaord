'use client';

import React from 'react';
import { z } from 'zod';
import { Grid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registerBlock } from '../registry';

const cardSchema = z.object({
  id:          z.string(),
  badgeText:   z.string().default(''),
  title:       z.string().default(''),
  description: z.string().default(''),
  imageUrl:    z.string().default(''),
  gradient:    z.string().default('from-emerald-500 to-teal-600'),
  ctaText:     z.string().default('Select Option'),
  ctaHref:     z.string().default(''),
  openInModal: z.boolean().default(false),
});

const schema = z.object({
  heading: z.string().default('Choose Your Onboarding Track'),
  cards:   z.array(cardSchema).default([]),
  columns: z.enum(['2', '3', '4']).default('2'),
});
type ChoiceCardsProps = z.infer<typeof schema>;

// Module-level static SVGs for variants (rerender-no-inline-components)
const Split2Thumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="5" y="15" width="42" height="45" rx="3.5" className="text-slate-800" />
    <rect x="53" y="15" width="42" height="45" rx="3.5" className="text-slate-800" />
    <rect x="12" y="44" width="28" height="4" rx="1" className="text-emerald-500" />
    <rect x="60" y="44" width="28" height="4" rx="1" className="text-emerald-500" />
  </svg>
);

const Grid3Thumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="4" y="15" width="28" height="45" rx="2.5" className="text-slate-800" />
    <rect x="36" y="15" width="28" height="45" rx="2.5" className="text-slate-800" />
    <rect x="68" y="15" width="28" height="45" rx="2.5" className="text-slate-800" />
  </svg>
);

registerBlock({
  type: 'choice_cards',
  label: 'Choice Cards',
  category: 'content',
  icon: Grid,
  fields: [
    { kind: 'text', key: 'heading', label: 'Main Section Title' },
    { kind: 'select', key: 'columns', label: 'Columns Layout', options: [
      { value: '2', label: '2 Columns' },
      { value: '3', label: '3 Columns' },
      { value: '4', label: '4 Columns' },
    ] },
    { kind: 'list', key: 'cards', label: 'Persona / Feature Cards', itemFields: [
      { kind: 'text', key: 'badgeText', label: 'Card Badge Text (e.g. FOR SCHOOLS)' },
      { kind: 'text', key: 'title', label: 'Card Title' },
      { kind: 'textarea', key: 'description', label: 'Card Short Description' },
      { kind: 'image', key: 'imageUrl', label: 'Background Image URL' },
      { kind: 'text', key: 'gradient', label: 'Tailwind gradient overlay (e.g. from-blue-600/80 to-indigo-700/80)' },
      { kind: 'text', key: 'ctaText', label: 'Card Button Label' },
      { kind: 'url', key: 'ctaHref', label: 'Card Button Link' },
      { kind: 'boolean', key: 'openInModal', label: 'Open form link in popup dialog' },
    ] },
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    { id: 'ccards-2col', label: '2-Col Persona Selector', thumbnail: Split2Thumbnail, defaults: { columns: '2' } },
    { id: 'ccards-3col', label: '3-Col Grid Selector', thumbnail: Grid3Thumbnail, defaults: { columns: '3' } },
  ],
  render: (props: ChoiceCardsProps, _block, ctx) => {
    const isEdit = ctx.mode === 'edit';
    const colsClass = {
      '2': 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto',
      '3': 'grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto',
      '4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 w-full',
    }[props.columns];

    const displayCards = props.cards.length > 0 ? props.cards : [
      { id: 'c1', badgeText: 'FOR MANAGEMENT', title: 'District Administrator', description: 'Access centralized dashboards, track cross-school metrics, and manage permissions.', imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40', gradient: 'from-emerald-950/80 to-slate-900/90', ctaText: 'Select Admin Track', ctaHref: '#admin', openInModal: false },
      { id: 'c2', badgeText: 'FOR STUDENTS', title: 'Student & Self-Sign', description: 'Register user profiles, complete onboarding agreements, and access module items.', imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1', gradient: 'from-blue-950/80 to-slate-900/90', ctaText: 'Select Student Track', ctaHref: '#student', openInModal: false },
    ];

    return (
      <section className="w-full py-8 flex flex-col gap-8">
        {props.heading ? (
          <h2
            className="text-2xl md:text-3xl font-black tracking-tight text-center"
            style={{ color: ctx.theme.colors.text, fontFamily: ctx.theme.typography.headingFont }}
          >
            {ctx.interpolate(props.heading)}
          </h2>
        ) : null}

        <div className={cn('grid gap-6', colsClass)}>
          {displayCards.map((card, idx) => {
            const handleCardClick = (e: React.MouseEvent) => {
              if (isEdit) return;
              ctx.fireTrigger?.('card_selected', _block.id);
              if (card.openInModal && card.ctaHref.startsWith('#modal-')) {
                e.preventDefault();
                const triggerId = card.ctaHref.replace('#modal-', '');
                ctx.fireTrigger?.('open_modal', triggerId);
              }
            };

            return (
              <div
                key={card.id || idx}
                onClick={handleCardClick}
                className="group relative h-[320px] rounded-2xl overflow-hidden border border-slate-800 flex flex-col justify-end p-6 cursor-pointer hover:border-emerald-500/50 hover:shadow-2xl transition-all duration-300 active:scale-[0.98]"
              >
                {/* Background Image */}
                {card.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.imageUrl}
                    alt={card.title}
                    className="absolute inset-0 w-full h-full object-cover z-0 group-hover:scale-105 transition-transform duration-500 ease-out"
                  />
                ) : null}

                {/* Dark Gradient Overlay */}
                <div className={cn('absolute inset-0 bg-gradient-to-t z-10', card.gradient || 'from-slate-950/90 to-slate-900/20')} />

                {/* Content details */}
                <div className="relative z-20 flex flex-col gap-2.5">
                  {card.badgeText ? (
                    <span className="self-start text-[8px] font-black tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {ctx.interpolate(card.badgeText)}
                    </span>
                  ) : null}
                  <h3 className="text-lg font-black text-white leading-tight">
                    {ctx.interpolate(card.title || 'Untitled Option')}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-300 leading-relaxed line-clamp-3">
                    {ctx.interpolate(card.description)}
                  </p>
                  
                  {/* Button trigger */}
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                      <span>{ctx.interpolate(card.ctaText || 'Get Started')}</span>
                      <svg className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  },
});
