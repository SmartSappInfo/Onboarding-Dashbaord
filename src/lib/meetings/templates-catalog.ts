/**
 * @fileoverview Standard Industry Meeting Templates Catalog (PRD §99).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure static templates with zero side effects.
 * - Defaults are customizable upon deployment into event types.
 */

import type { MeetingTemplate } from './types/templates';

export const STANDARD_MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: 'tmpl_sales_demo',
    name: 'Sales Demo & Product Walkthrough',
    category: 'sales',
    purpose: 'sales',
    description: 'A 30-minute tailored walkthrough of platform features, pricing, and live Q&A for prospective buyers.',
    durationMinutes: 30,
    format: 'one_to_one',
    defaultProvider: 'google_meet',
    accentColor: '#3b82f6',
    iconName: 'Presentation',
    tags: ['sales', 'demo', 'prospect'],
    defaultQuestions: [
      { id: 'q_role', key: 'role', type: 'text', label: 'What is your current role/title?', required: true },
      { id: 'q_usecase', key: 'usecase', type: 'textarea', label: 'What is the primary challenge you want to solve?', required: true },
    ],
    confirmationMessage: 'We look forward to demonstrating how SmartSapp accelerates your team goals.',
  },
  {
    id: 'tmpl_consultation',
    name: 'Consultation & Strategic Discovery',
    category: 'education',
    purpose: 'consultation',
    description: 'An in-depth 45-minute consultation to evaluate organizational requirements, curriculum, and goals.',
    durationMinutes: 45,
    format: 'one_to_one',
    defaultProvider: 'zoom',
    accentColor: '#10b981',
    iconName: 'GraduationCap',
    tags: ['consultation', 'discovery'],
    defaultQuestions: [
      { id: 'q_org_size', key: 'org_size', type: 'select', label: 'Organization size', required: true, options: ['1-10', '11-50', '50+'] },
      { id: 'q_focus', key: 'focus', type: 'textarea', label: 'Key topics you would like to cover?', required: false },
    ],
    confirmationMessage: 'Your strategic discovery session is confirmed. Please review the attached preparation guide.',
  },
  {
    id: 'tmpl_onboarding',
    name: 'Client Onboarding & Success Kickoff',
    category: 'onboarding',
    purpose: 'training',
    description: 'A 60-minute technical setup and platform onboarding session with account administrators.',
    durationMinutes: 60,
    format: 'collective',
    defaultProvider: 'microsoft_teams',
    accentColor: '#8b5cf6',
    iconName: 'Sparkles',
    tags: ['onboarding', 'customer-success'],
    defaultQuestions: [
      { id: 'q_admin_count', key: 'admin_count', type: 'text', label: 'How many team members will join the call?', required: true },
      { id: 'q_integrations', key: 'integrations', type: 'textarea', label: 'Which third-party tools do you plan to connect?', required: false },
    ],
    confirmationMessage: 'Welcome aboard! Our customer success team is ready to guide your team through onboarding.',
  },
  {
    id: 'tmpl_webinar',
    name: 'Broadcast Webinar & Executive Masterclass',
    category: 'webinar',
    purpose: 'webinar',
    description: 'Large-scale live interactive broadcast with backstage presenter staging, audience Q&A, and hand raises.',
    durationMinutes: 60,
    format: 'group',
    defaultProvider: 'daily',
    accentColor: '#f59e0b',
    iconName: 'Radio',
    tags: ['webinar', 'broadcast', 'masterclass'],
    defaultQuestions: [
      { id: 'q_company', key: 'company', type: 'text', label: 'Company / Institution Name', required: true },
    ],
    confirmationMessage: 'You are registered for the live masterclass! Add the session to your calendar to secure your spot.',
  },
  {
    id: 'tmpl_support_dropin',
    name: 'Technical Support & Drop-In Hours',
    category: 'support',
    purpose: 'support',
    description: 'Fast 15-minute screen-share troubleshooting and instant drop-in assistance with a technical specialist.',
    durationMinutes: 15,
    format: 'round_robin',
    defaultProvider: 'google_meet',
    accentColor: '#ef4444',
    iconName: 'Wrench',
    tags: ['support', 'troubleshooting'],
    defaultQuestions: [
      { id: 'q_issue', key: 'issue', type: 'textarea', label: 'Brief description of the issue or error code:', required: true },
    ],
    confirmationMessage: 'A support specialist will meet you at the scheduled time to resolve your inquiry.',
  },
];
