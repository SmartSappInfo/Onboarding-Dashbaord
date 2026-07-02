'use client';

import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registerBlock, type BlockRenderContext } from '../registry';
import type { PageBlock } from '@/lib/types';

const schema = z.object({
  targetDate:  z.string().default('2026-12-31T23:59:59Z'),
  heading:     z.string().default('Event Begins In'),
  subtext:     z.string().default('Onboarding slots are filling up quickly.'),
  showDays:    z.boolean().default(true),
  showHours:   z.boolean().default(true),
  showMinutes: z.boolean().default(true),
  showSeconds: z.boolean().default(true),
  theme:       z.enum(['dark', 'light', 'accent']).default('dark'),
  expiredText: z.string().default('Registration is now closed!'),
});
type CountdownProps = z.infer<typeof schema>;

// Module-level static SVGs for variants (rerender-no-inline-components)
const ClockThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="5" y="25" width="20" height="25" rx="3" className="text-slate-800" />
    <rect x="28" y="25" width="20" height="25" rx="3" className="text-slate-800" />
    <rect x="51" y="25" width="20" height="25" rx="3" className="text-slate-800" />
    <rect x="74" y="25" width="20" height="25" rx="3" className="text-slate-800" />
    <rect x="25" y="10" width="50" height="5" rx="1" />
  </svg>
);

registerBlock({
  type: 'countdown',
  label: 'Countdown Timer',
  category: 'data',
  icon: Clock,
  fields: [
    { kind: 'text', key: 'targetDate', label: 'Target Date-Time (ISO format: YYYY-MM-DDTHH:MM:SSZ)' },
    { kind: 'text', key: 'heading', label: 'Timer Heading' },
    { kind: 'textarea', key: 'subtext', label: 'Timer Subtext' },
    { kind: 'boolean', key: 'showDays', label: 'Display Days Grid' },
    { kind: 'boolean', key: 'showHours', label: 'Display Hours Grid' },
    { kind: 'boolean', key: 'showMinutes', label: 'Display Minutes Grid' },
    { kind: 'boolean', key: 'showSeconds', label: 'Display Seconds Grid' },
    { kind: 'select', key: 'theme', label: 'Timer Card Theme', options: [
      { value: 'dark', label: 'Dark Slate' },
      { value: 'light', label: 'Off-White Card' },
      { value: 'accent', label: 'Theme Emerald / Accent Color' },
    ] },
    { kind: 'text', key: 'expiredText', label: 'Timer Expired Message Text' },
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    { id: 'count-standard', label: 'Standard Timer Card', thumbnail: ClockThumbnail, defaults: { theme: 'dark' } },
  ],
  render: (props: CountdownProps, block, ctx) => (
    <CountdownBlock props={props} block={block} ctx={ctx} />
  ),
});

interface CountdownBlockProps {
  props: CountdownProps;
  block: PageBlock;
  ctx: BlockRenderContext;
}

const CountdownBlock = ({ props, block, ctx }: CountdownBlockProps) => {
  const isEdit = ctx.mode === 'edit';
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    setMounted(true);
    const calculateTime = () => {
      const target = new Date(props.targetDate).getTime();
      const now = new Date().getTime();
      const difference = target - now;

      if (isNaN(target) || difference <= 0) {
        setIsExpired(true);
        ctx.fireTrigger?.('countdown_expired', block.id);
        return;
      }

      setIsExpired(false);
      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [props.targetDate, ctx, block.id]);

  const themeClass = {
    dark: 'bg-slate-950 border-slate-800 text-slate-100',
    light: 'bg-slate-50 border-slate-200 text-slate-800',
    accent: 'bg-emerald-950/20 border-emerald-500/20 text-emerald-100',
  }[props.theme];

  const digitTheme = {
    dark: 'bg-slate-900 border-slate-800 text-slate-100',
    light: 'bg-slate-200 border-slate-300 text-slate-900',
    accent: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  }[props.theme];

  if (!mounted) {
    return (
      <div className={cn('p-6 rounded-2xl border flex flex-col items-center gap-4 text-center max-w-xl mx-auto', themeClass)}>
        {props.heading ? <h3 className="text-sm font-bold uppercase tracking-wider">{ctx.interpolate(props.heading)}</h3> : null}
        <div className="flex gap-3 pt-2 opacity-50">
          <span className="text-xl font-black">00 : 00 : 00 : 00</span>
        </div>
      </div>
    );
  }

  if (isExpired && !isEdit) {
    return (
      <div className={cn('p-6 rounded-2xl border text-center font-bold text-sm max-w-xl mx-auto', themeClass)}>
        {ctx.interpolate(props.expiredText)}
      </div>
    );
  }

  const renderSegment = (val: number, label: string) => {
    const formatted = val.toString().padStart(2, '0');
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className={cn('w-12 h-14 rounded-xl border flex items-center justify-center font-black text-xl select-none', digitTheme)}>
          {formatted}
        </div>
        <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">{label}</span>
      </div>
    );
  };

  return (
    <div className={cn('p-6 rounded-2xl border flex flex-col items-center gap-4 text-center max-w-xl mx-auto shadow-2xl', themeClass)}>
      {(props.heading || props.subtext) ? (
        <div className="flex flex-col gap-1">
          {props.heading ? (
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">
              {ctx.interpolate(props.heading)}
            </h3>
          ) : null}
          {props.subtext ? (
            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
              {ctx.interpolate(props.subtext)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3 pt-2">
        {props.showDays ? renderSegment(timeLeft.days, 'Days') : null}
        {props.showDays && (props.showHours || props.showMinutes || props.showSeconds) ? <span className="text-slate-600 font-bold -mt-4">:</span> : null}
        {props.showHours ? renderSegment(timeLeft.hours, 'Hours') : null}
        {props.showHours && (props.showMinutes || props.showSeconds) ? <span className="text-slate-600 font-bold -mt-4">:</span> : null}
        {props.showMinutes ? renderSegment(timeLeft.minutes, 'Mins') : null}
        {props.showMinutes && props.showSeconds ? <span className="text-slate-600 font-bold -mt-4">:</span> : null}
        {props.showSeconds ? renderSegment(timeLeft.seconds, 'Secs') : null}
      </div>
    </div>
  );
};
