import type { PageTemplate } from '@/lib/types';
import { blk, sec } from './helpers';

/**
 * School templates — warm, trustworthy layouts for admissions, events, and fees.
 */
export const SCHOOL_TEMPLATES: PageTemplate[] = [
  {
    id: 'school-admissions',
    name: 'Admissions / Enrollment',
    description: 'Hero, key dates, program highlights, and a registration form for admissions drives.',
    goal: 'registration',
    isGlobal: true,
    structureJson: {
      sections: [
        sec('school-adm-hero', [
          blk('school-adm-hero-1', 'hero', {
            title: 'Enrollment is now open for {{year}}',
            subtitle: 'Give your child a head start. Apply in minutes.',
            align: 'center',
          }),
        ]),
        sec('school-adm-stats', [
          blk('school-adm-stats-1', 'stats', {
            items: [
              { id: 'a', value: '1:12', label: 'Teacher ratio' },
              { id: 'b', value: '40+', label: 'Programs' },
              { id: 'c', value: '95%', label: 'Graduate rate' },
            ],
          }),
        ], { heading: 'Why families choose us' }),
        sec('school-adm-info', [
          blk('school-adm-info-1', 'text', {
            content: '<h3>Key dates</h3><p>Applications close on the 30th. Interviews begin the following week.</p>',
          }),
        ]),
        sec('school-adm-form', [blk('school-adm-form-1', 'form', { formId: '' })], { heading: 'Start your application' }),
      ],
    },
  },
  {
    id: 'school-open-day',
    name: 'Open Day RSVP',
    description: 'Event hero, agenda, and an RSVP form for campus open days.',
    goal: 'registration',
    isGlobal: true,
    structureJson: {
      sections: [
        sec('school-od-hero', [
          blk('school-od-hero-1', 'hero', {
            title: 'Join us for Open Day',
            subtitle: 'Tour the campus, meet our teachers, and see classrooms in action.',
            align: 'center',
          }),
        ]),
        sec('school-od-agenda', [
          blk('school-od-agenda-1', 'text', {
            content: '<h3>What to expect</h3><ul><li>Campus tour</li><li>Meet the faculty</li><li>Q&amp;A with the principal</li></ul>',
          }),
        ], { heading: 'Agenda' }),
        sec('school-od-form', [blk('school-od-form-1', 'form', { formId: '' })], { heading: 'Reserve your place' }),
      ],
    },
  },
  {
    id: 'school-fee-payment',
    name: 'Fee Payment Guide',
    description: 'Bank details and a step-by-step payment procedure for school fees.',
    goal: 'payment',
    isGlobal: true,
    structureJson: {
      sections: [
        sec('school-fee-hero', [
          blk('school-fee-hero-1', 'hero', {
            title: 'How to pay your fees',
            subtitle: 'Follow the steps below to complete your payment securely.',
            align: 'center',
          }),
        ]),
        sec('school-fee-methods', [
          blk('school-fee-methods-1', 'payment_methods', {
            methods: [
              { name: 'Bank Transfer', details: [{ label: 'Account Name', value: 'Your School Ltd' }, { label: 'Account Number', value: '0000000000' }] },
            ],
          }),
        ], { heading: 'Bank Details' }),
        sec('school-fee-procedure', [
          blk('school-fee-procedure-1', 'procedure_list', {
            title: 'Payment steps',
            steps: ['Transfer the exact amount to the account above.', 'Use your student ID as the reference.', 'Keep your receipt for confirmation.'],
          }),
        ], { heading: 'Payment Procedure' }),
      ],
    },
  },
];
