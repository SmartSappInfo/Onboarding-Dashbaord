import type { PageTemplate } from '@/lib/types';
import { blk, sec } from './helpers';

/**
 * Marketing templates — bold, high-contrast layouts for campaigns and lead-gen.
 */
export const MARKETING_TEMPLATES: PageTemplate[] = [
  {
    id: 'mkt-lead-gen',
    name: 'Lead-Gen Landing Page',
    description: 'Benefit-driven hero, proof stats, testimonial, and a contact form.',
    goal: 'lead_capture',
    isGlobal: true,
    structureJson: {
      sections: [
        sec('mkt-lg-hero', [
          blk('mkt-lg-hero-1', 'hero', {
            title: 'Grow your pipeline with {{offer}}',
            subtitle: 'Download the free guide and start converting more leads today.',
            align: 'center',
          }),
        ]),
        sec('mkt-lg-stats', [
          blk('mkt-lg-stats-1', 'stats', {
            items: [
              { id: 'a', value: '3x', label: 'More leads' },
              { id: 'b', value: '+48%', label: 'Conversion' },
              { id: 'c', value: '5 min', label: 'To set up' },
            ],
          }),
        ]),
        sec('mkt-lg-quote', [
          blk('mkt-lg-quote-1', 'testimonial', {
            quote: 'This was the single highest-ROI campaign we ran all year.',
            author: 'Sam Rivera',
            role: 'Growth Lead, Brightside',
          }),
        ]),
        sec('mkt-lg-form', [blk('mkt-lg-form-1', 'form', { formId: '' })], { heading: 'Get the free guide' }),
      ],
    },
  },
  {
    id: 'mkt-webinar',
    name: 'Webinar Registration',
    description: 'Event hero, speaker highlights, agenda, and a registration form.',
    goal: 'registration',
    isGlobal: true,
    structureJson: {
      sections: [
        sec('mkt-web-hero', [
          blk('mkt-web-hero-1', 'hero', {
            title: 'Live Webinar: {{topic}}',
            subtitle: 'Save your seat for an actionable, 45-minute session.',
            align: 'left',
          }),
        ]),
        sec('mkt-web-agenda', [
          blk('mkt-web-cols', 'columns', { variant: '1-1' }, [
            blk('mkt-web-agenda-text', 'text', { content: '<h3>What you’ll learn</h3><ul><li>The 3-step framework</li><li>Live teardown</li><li>Q&amp;A</li></ul>' }),
            blk('mkt-web-form', 'form', { formId: '' }),
          ]),
        ], { heading: 'Reserve your seat' }),
      ],
    },
  },
  {
    id: 'mkt-thank-you',
    name: 'Thank You / Confirmation',
    description: 'A clean confirmation page with next steps and a share CTA.',
    goal: 'thank_you',
    isGlobal: true,
    structureJson: {
      sections: [
        sec('mkt-ty-hero', [
          blk('mkt-ty-hero-1', 'hero', {
            title: 'You’re all set! 🎉',
            subtitle: 'Check your inbox for a confirmation and next steps.',
            align: 'center',
          }),
        ]),
        sec('mkt-ty-next', [
          blk('mkt-ty-text', 'text', { content: '<h3>What happens next</h3><p>We’ll be in touch within one business day. In the meantime, explore our resources.</p>' }),
          blk('mkt-ty-cta', 'cta', { label: 'Explore resources', url: '', variant: 'primary' }),
        ]),
      ],
    },
  },
];
