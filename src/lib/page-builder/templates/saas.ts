import type { PageTemplate } from '@/lib/types';
import { blk, sec } from './helpers';

/**
 * SaaS templates — refined, conversion-focused layouts for software products.
 */
export const SAAS_TEMPLATES: PageTemplate[] = [
  {
    id: 'saas-waitlist',
    name: 'Product Launch — Waitlist',
    description: 'Hero, social proof, feature stats, and an email-capture form to build a launch waitlist.',
    goal: 'lead_capture',
    isGlobal: true,
    structureJson: {
      sections: [
        sec('saas-wl-hero', [
          blk('saas-wl-hero-1', 'hero', {
            title: 'The future of {{product}} is almost here',
            subtitle: 'Join the waitlist and be first in line when we launch.',
            align: 'center',
          }),
        ]),
        sec('saas-wl-logos', [blk('saas-wl-logos-1', 'logo_grid', { logos: [] })], { heading: 'Trusted by teams at' }),
        sec('saas-wl-stats', [
          blk('saas-wl-stats-1', 'stats', {
            items: [
              { id: 'a', value: '10k+', label: 'On the waitlist' },
              { id: 'b', value: '4.9/5', label: 'Beta rating' },
              { id: 'c', value: '99.9%', label: 'Uptime' },
            ],
          }),
        ]),
        sec('saas-wl-form', [
          blk('saas-wl-form-text', 'text', { content: '<p>No spam — just a heads-up the moment we go live.</p>' }),
          blk('saas-wl-form-1', 'form', { formId: '' }),
        ], { heading: 'Reserve your spot' }),
      ],
    },
  },
  {
    id: 'saas-free-trial',
    name: 'Free Trial Signup',
    description: 'Split hero with benefits and an inline signup form, plus a testimonial and FAQ.',
    goal: 'registration',
    isGlobal: true,
    structureJson: {
      sections: [
        sec('saas-ft-hero', [
          blk('saas-ft-cols', 'columns', { variant: '1-1' }, [
            blk('saas-ft-copy', 'text', {
              content: '<h1>Start your 14-day free trial</h1><p>No credit card required. Cancel anytime.</p><ul><li>Unlimited projects</li><li>Priority support</li><li>Full feature access</li></ul>',
            }),
            blk('saas-ft-form', 'form', { formId: '' }),
          ]),
        ]),
        sec('saas-ft-quote', [
          blk('saas-ft-quote-1', 'testimonial', {
            quote: 'We were up and running in a single afternoon. It paid for itself in the first week.',
            author: 'Jordan Lee',
            role: 'Head of Ops, Northwind',
          }),
        ]),
        sec('saas-ft-faq', [
          blk('saas-ft-faq-1', 'faq', {
            items: [
              { id: 'q1', question: 'Do I need a credit card?', answer: 'No — the trial is completely free with no card required.' },
              { id: 'q2', question: 'What happens when the trial ends?', answer: 'You can pick a plan or your account simply pauses. Nothing is charged automatically.' },
            ],
          }),
        ], { heading: 'Common questions' }),
      ],
    },
  },
  {
    id: 'saas-demo-request',
    name: 'Request a Demo',
    description: 'Value props, proof stats, and a demo-request form for sales-led products.',
    goal: 'lead_capture',
    isGlobal: true,
    structureJson: {
      sections: [
        sec('saas-demo-hero', [
          blk('saas-demo-hero-1', 'hero', {
            title: 'See {{product}} in action',
            subtitle: 'Book a personalized walkthrough with our team.',
            align: 'left',
          }),
        ]),
        sec('saas-demo-stats', [
          blk('saas-demo-stats-1', 'stats', {
            items: [
              { id: 'a', value: '30 min', label: 'Tailored demo' },
              { id: 'b', value: '2x', label: 'Faster onboarding' },
              { id: 'c', value: '24/7', label: 'Support' },
            ],
          }),
        ]),
        sec('saas-demo-form', [blk('saas-demo-form-1', 'form', { formId: '' })], { heading: 'Tell us about your team' }),
      ],
    },
  },
];
