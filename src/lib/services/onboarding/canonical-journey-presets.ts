/**
 * @fileOverview Canonical Onboarding Journey Presets (Onboarding 2.0)
 *
 * Pre-seeded blueprints for standard employee, sales, finance, and contractor onboarding paths.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Used as the baseline templates when organizations are initialized.
 * - Zero `any` or `any[]` typing.
 */

import type { OnboardingJourney } from '@/lib/types';

export const CANONICAL_JOURNEY_PRESETS: Omit<OnboardingJourney, 'organizationId' | 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'builtin-standard-employee-onboarding',
    name: 'Standard Employee Onboarding',
    description: 'Universal 4-step induction journey for general team members and staff.',
    audience: 'employee',
    trigger: 'invitation',
    status: 'published',
    isDefault: true,
    version: 1,
    steps: [
      {
        id: 'step-profile',
        title: 'Complete Profile & Contact Info',
        description: 'Verify your display name, job title, phone number, and avatar.',
        type: 'profile',
        isRequired: true,
        order: 1,
      },
      {
        id: 'step-workspace',
        title: 'Select Primary Workspace',
        description: 'Choose your default campus location or operational workspace.',
        type: 'workspace_selection',
        isRequired: true,
        order: 2,
      },
      {
        id: 'step-policy',
        title: 'Review Organization Policies',
        description: 'Acknowledge code of conduct and workspace safety guidelines.',
        type: 'policy_acceptance',
        isRequired: true,
        order: 3,
        config: {
          policyTitle: 'Code of Conduct & Workplace Safety',
          policyUrl: '/terms',
        },
      },
      {
        id: 'step-checklist',
        title: 'Day 1 Checklist',
        description: 'Review welcome memos, communication channels, and team schedules.',
        type: 'checklist',
        isRequired: false,
        order: 4,
        config: {
          checklistItems: [
            'Join workspace WhatsApp/Slack channel',
            'Review weekly standup schedule',
            'Say hello in team general chat',
          ],
        },
      },
    ],
  },
  {
    id: 'builtin-sales-crm-onboarding',
    name: 'Sales & Admissions Onboarding',
    description: 'Specialized journey for sales reps, admissions officers, and deal owners.',
    audience: 'sales',
    trigger: 'role_assigned',
    status: 'published',
    isDefault: false,
    version: 1,
    steps: [
      {
        id: 'step-profile',
        title: 'Verify Profile Details',
        description: 'Verify your public advisor profile and direct phone line.',
        type: 'profile',
        isRequired: true,
        order: 1,
      },
      {
        id: 'step-video',
        title: 'CRM Pipeline Masterclass',
        description: 'Watch the 5-minute video guide on managing deal stages and pipeline SLAs.',
        type: 'guide_video',
        isRequired: true,
        order: 2,
        config: {
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          durationMinutes: 5,
        },
      },
      {
        id: 'step-team',
        title: 'Join Admissions Squad',
        description: 'Select your regional lead routing team.',
        type: 'team_selection',
        isRequired: true,
        order: 3,
      },
      {
        id: 'step-checklist',
        title: 'First Deal Setup',
        description: 'Create a test prospect card and advance through pipeline stages.',
        type: 'checklist',
        isRequired: true,
        order: 4,
      },
    ],
  },
  {
    id: 'builtin-financial-compliance-onboarding',
    name: 'Finance & Invoicing Compliance',
    description: 'High-security onboarding path for billing officers and financial controllers.',
    audience: 'finance',
    trigger: 'role_assigned',
    status: 'published',
    isDefault: false,
    version: 1,
    steps: [
      {
        id: 'step-profile',
        title: 'Verify Financial Officer Credentials',
        description: 'Confirm formal legal name and department contact.',
        type: 'profile',
        isRequired: true,
        order: 1,
      },
      {
        id: 'step-financial-policy',
        title: 'Financial Governance Policy',
        description: 'Read and sign the payment ledger integrity and refund policy.',
        type: 'policy_acceptance',
        isRequired: true,
        order: 2,
        config: {
          policyTitle: 'Payment Gateway Governance & Anti-Fraud Agreement',
        },
      },
      {
        id: 'step-mfa',
        title: 'Security & 2-Factor Setup',
        description: 'Configure mandatory multi-factor authentication for financial ledger access.',
        type: 'mfa_setup',
        isRequired: true,
        order: 3,
      },
      {
        id: 'step-approval',
        title: 'Executive Manager Approval',
        description: 'Wait for Finance Director approval before ledger unlock.',
        type: 'manager_approval',
        isRequired: true,
        order: 4,
      },
    ],
  },
  {
    id: 'builtin-contractor-onboarding',
    name: 'Contractor & Advisor Onboarding',
    description: 'Streamlined induction with non-disclosure agreements for external collaborators.',
    audience: 'contractor',
    trigger: 'invitation',
    status: 'published',
    isDefault: false,
    version: 1,
    steps: [
      {
        id: 'step-profile',
        title: 'Contractor Profile',
        description: 'Provide external company name and contact email.',
        type: 'profile',
        isRequired: true,
        order: 1,
      },
      {
        id: 'step-nda',
        title: 'Confidentiality & NDA Agreement',
        description: 'Review and sign mutual non-disclosure terms.',
        type: 'policy_acceptance',
        isRequired: true,
        order: 2,
      },
      {
        id: 'step-workspace',
        title: 'Confirm Project Workspace',
        description: 'Verify access to the specific assigned project workspace.',
        type: 'workspace_selection',
        isRequired: true,
        order: 3,
      },
    ],
  },
];
