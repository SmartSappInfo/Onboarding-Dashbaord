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
    industry: 'Marketing',
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
    industry: 'Marketing',
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
    id: 'mkt-heros-journey',
    name: "The Hero's Journey Sales Page",
    description: "Multi-section storytelling framework page: Hook, Pain Point, Solution, Social Proof, FAQ and CTA Form.",
    goal: 'lead_capture',
    isGlobal: true,
    industry: 'Marketing',
    structureJson: {
      sections: [
        sec('hj-hero', [
          blk('hj-hero-1', 'hero', {
            title: 'Your Manual Onboarding Nightmare Ends Today',
            subtitle: 'Automate nominal logs, secure student approvals, and launch compliance forms without code.',
            align: 'center',
          }),
        ]),
        sec('hj-problem', [
          blk('hj-problem-text', 'text', {
            content: '<h2>The Onboarding Struggle is Real</h2><p>Administrators spend over 20 hours per week manually registering students, chasing parents for signatures, and validating Mobile Money receipts. It is slow, insecure, and prone to compliance leaks.</p>',
          }),
        ], { heading: 'The Problem' }),
        sec('hj-solution', [
          blk('hj-solution-grid', 'stats', {
            items: [
              { id: 'hjs1', value: '4.8x', label: 'Faster enrollment cycle' },
              { id: 'hjs2', value: '100%', label: 'Cryptographic compliance audit' },
              { id: 'hjs3', value: 'MTN/Telecel', label: 'Mobile Money integrated collections' },
            ],
          }),
        ], { heading: 'Our Solution Framework' }),
        sec('hj-testimonials', [
          blk('hj-testimonials-grid', 'testimonial_grid', {
            heading: 'What Teams Say About Us',
            subheading: 'Listen to operational directors detailing their onboarding speed metrics.',
            columns: '2',
            cardStyle: 'video-quote',
            items: [
              {
                id: 'hjt1',
                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                quote: 'Using the automated campaign templates cut our student registration drop-off rate by half.',
                author: 'Ama K. Mensah',
                role: 'Admissions Director',
              },
              {
                id: 'hjt2',
                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                quote: 'The Mobile Money billing triggers saved us 40 hours of manual receipt checking during term start.',
                author: 'Kofi Aidoo',
                role: 'Registrar, Tech Academy',
              }
            ]
          }),
        ]),
        sec('hj-faq', [
          blk('hj-faq-list', 'faq', {
            items: [
              { id: 'hjq1', question: 'How secure is our database?', answer: 'All data is stored inside AES-256 encrypted Firestore nodes with strict role-based access schemas.' },
              { id: 'hjq2', question: 'Can we migrate existing nominal lists?', answer: 'Yes. Our smart CSV parsing importer normalizes custom files automatically in seconds.' }
            ],
          }),
        ], { heading: 'Frequently Asked Questions' }),
        sec('hj-form', [
          blk('hj-form-1', 'form', { formId: '' }),
        ], { heading: 'Start Your Automatic Onboarding Journey' }),
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
