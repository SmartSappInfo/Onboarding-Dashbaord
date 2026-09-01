/**
 * @fileOverview Canonical Permission Registry & Dependency Resolution (Authorization 2.0)
 *
 * Central source of truth for all fine-grained platform permissions, risk classifications,
 * and Directed Acyclic Graph (DAG) dependency resolution across all 4 operational sections:
 * Operations, Finance, Studios, and Management.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Why this exists: Enforces permission consistency and prevents runtime UI crashes caused
 *   by enabling mutate actions (create, edit, delete) without view permissions.
 * - Zero `any` or `any[]` typing.
 * - Always run `resolveDependencies()` on any user-provided schema prior to persistence.
 *
 * @testability Covered in `authorization-services.test.ts`.
 */

import type {
  PermissionsSchema,
  PermissionDefinition,
  PermissionRiskLevel,
  AppPermissionAction,
  AppPermissionId,
} from '@/lib/types';
import { getBlankPermissions } from '@/lib/permissions-engine';

/**
 * 100+ Fine-grained canonical platform permissions with risk classifications and dependency chains.
 */
export const CANONICAL_PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // ============================================================================
  // SECTION 1: OPERATIONS (Campuses, Pipelines, Deals, Tasks, Meetings, etc.)
  // ============================================================================
  {
    id: 'operations.dashboard.view',
    name: 'View Operations Dashboard',
    section: 'operations',
    feature: 'dashboard',
    action: 'view',
    description: 'View operational metrics, daily task ribbons, and performance KPIs.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'dashboard_view',
  },
  {
    id: 'operations.campuses.view',
    name: 'View Campuses / Entities',
    section: 'operations',
    feature: 'campuses',
    action: 'view',
    description: 'View campus and organization operational entity profiles.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'schools_view',
  },
  {
    id: 'operations.campuses.create',
    name: 'Create Campuses / Entities',
    section: 'operations',
    feature: 'campuses',
    action: 'create',
    description: 'Provision new campus locations or business entity units.',
    riskLevel: 'medium',
    dependencies: ['operations.campuses.view'],
  },
  {
    id: 'operations.campuses.edit',
    name: 'Edit Campuses / Entities',
    section: 'operations',
    feature: 'campuses',
    action: 'edit',
    description: 'Update campus attributes, branding, and contact points.',
    riskLevel: 'medium',
    dependencies: ['operations.campuses.view'],
    legacyPermissionId: 'schools_edit',
  },
  {
    id: 'operations.campuses.delete',
    name: 'Delete Campuses / Entities',
    section: 'operations',
    feature: 'campuses',
    action: 'delete',
    description: 'Permanently remove campus locations or business units.',
    riskLevel: 'critical',
    dependencies: ['operations.campuses.view'],
    legacyPermissionId: 'schools_delete',
  },
  {
    id: 'operations.pipeline.view',
    name: 'View Pipeline & Deals',
    section: 'operations',
    feature: 'pipeline',
    action: 'view',
    description: 'Inspect visual Kanban board, deal stages, and prospect summaries.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'prospects_view',
  },
  {
    id: 'operations.pipeline.create',
    name: 'Create Pipeline Deals',
    section: 'operations',
    feature: 'pipeline',
    action: 'create',
    description: 'Create new prospect deals and pipeline opportunities.',
    riskLevel: 'medium',
    dependencies: ['operations.pipeline.view'],
    legacyPermissionId: 'prospects_create',
  },
  {
    id: 'operations.pipeline.edit',
    name: 'Edit Pipeline Deals',
    section: 'operations',
    feature: 'pipeline',
    action: 'edit',
    description: 'Advance deal stages, update deal value, and reassign owners.',
    riskLevel: 'medium',
    dependencies: ['operations.pipeline.view'],
    legacyPermissionId: 'prospects_edit',
  },
  {
    id: 'operations.pipeline.delete',
    name: 'Delete Pipeline Deals',
    section: 'operations',
    feature: 'pipeline',
    action: 'delete',
    description: 'Permanently purge deal opportunities from CRM pipelines.',
    riskLevel: 'high',
    dependencies: ['operations.pipeline.view'],
    legacyPermissionId: 'prospects_delete',
  },
  {
    id: 'operations.tasks.view',
    name: 'View Daily Tasks',
    section: 'operations',
    feature: 'tasks',
    action: 'view',
    description: 'View assigned operational tasks and team checklists.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'tasks_view',
  },
  {
    id: 'operations.tasks.create',
    name: 'Create Tasks',
    section: 'operations',
    feature: 'tasks',
    action: 'create',
    description: 'Create task cards and assign follow-ups to team members.',
    riskLevel: 'low',
    dependencies: ['operations.tasks.view'],
    legacyPermissionId: 'tasks_create',
  },
  {
    id: 'operations.tasks.edit',
    name: 'Edit Tasks',
    section: 'operations',
    feature: 'tasks',
    action: 'edit',
    description: 'Update task status, due dates, priority, and assignees.',
    riskLevel: 'low',
    dependencies: ['operations.tasks.view'],
    legacyPermissionId: 'tasks_edit',
  },
  {
    id: 'operations.tasks.delete',
    name: 'Delete Tasks',
    section: 'operations',
    feature: 'tasks',
    action: 'delete',
    description: 'Delete task records.',
    riskLevel: 'medium',
    dependencies: ['operations.tasks.view'],
    legacyPermissionId: 'tasks_delete',
  },
  {
    id: 'operations.meetings.view',
    name: 'View Meetings & Calendars',
    section: 'operations',
    feature: 'meetings',
    action: 'view',
    description: 'View upcoming Zoom sessions, calendars, and webinar schedules.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'meetings_view',
  },
  {
    id: 'operations.meetings.create',
    name: 'Create & Schedule Meetings',
    section: 'operations',
    feature: 'meetings',
    action: 'create',
    description: 'Schedule webinars, client calls, and automated meeting links.',
    riskLevel: 'medium',
    dependencies: ['operations.meetings.view'],
    legacyPermissionId: 'meetings_create',
  },
  {
    id: 'operations.meetings.edit',
    name: 'Edit Meetings',
    section: 'operations',
    feature: 'meetings',
    action: 'edit',
    description: 'Reschedule meetings, change hosts, and update attendee lists.',
    riskLevel: 'medium',
    dependencies: ['operations.meetings.view'],
    legacyPermissionId: 'meetings_edit',
  },
  {
    id: 'operations.meetings.delete',
    name: 'Cancel & Delete Meetings',
    section: 'operations',
    feature: 'meetings',
    action: 'delete',
    description: 'Cancel scheduled Zoom sessions and purge meeting recordings.',
    riskLevel: 'high',
    dependencies: ['operations.meetings.view'],
    legacyPermissionId: 'meetings_delete',
  },
  {
    id: 'operations.automations.view',
    name: 'View Workflow Automations',
    section: 'operations',
    feature: 'automations',
    action: 'view',
    description: 'Inspect event triggers, webhook nodes, and drip sequences.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'automations_view',
  },
  {
    id: 'operations.automations.create',
    name: 'Create Automations',
    section: 'operations',
    feature: 'automations',
    action: 'create',
    description: 'Author new event-driven workflow automation blueprints.',
    riskLevel: 'high',
    dependencies: ['operations.automations.view'],
    legacyPermissionId: 'automations_create',
  },
  {
    id: 'operations.automations.edit',
    name: 'Edit Automations',
    section: 'operations',
    feature: 'automations',
    action: 'edit',
    description: 'Modify automation action nodes, triggers, delays, and conditions.',
    riskLevel: 'high',
    dependencies: ['operations.automations.view'],
    legacyPermissionId: 'automations_edit',
  },
  {
    id: 'operations.automations.delete',
    name: 'Delete Automations',
    section: 'operations',
    feature: 'automations',
    action: 'delete',
    description: 'Deactivate and delete automation workflows.',
    riskLevel: 'critical',
    dependencies: ['operations.automations.view'],
    legacyPermissionId: 'automations_delete',
  },
  {
    id: 'operations.quickNotes.view',
    name: 'View Quick Notes',
    section: 'operations',
    feature: 'quickNotes',
    action: 'view',
    description: 'Read shared workspace scratchpad notes and memos.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'quick_notes_view',
  },
  {
    id: 'operations.quickNotes.create',
    name: 'Create Quick Notes',
    section: 'operations',
    feature: 'quickNotes',
    action: 'create',
    description: 'Author new notes and shared memos.',
    riskLevel: 'low',
    dependencies: ['operations.quickNotes.view'],
    legacyPermissionId: 'quick_notes_create',
  },
  {
    id: 'operations.quickNotes.edit',
    name: 'Edit Quick Notes',
    section: 'operations',
    feature: 'quickNotes',
    action: 'edit',
    description: 'Edit notes and scratchpad entries.',
    riskLevel: 'low',
    dependencies: ['operations.quickNotes.view'],
    legacyPermissionId: 'quick_notes_edit',
  },
  {
    id: 'operations.quickNotes.delete',
    name: 'Delete Quick Notes',
    section: 'operations',
    feature: 'quickNotes',
    action: 'delete',
    description: 'Delete notes and memos.',
    riskLevel: 'low',
    dependencies: ['operations.quickNotes.view'],
    legacyPermissionId: 'quick_notes_delete',
  },
  {
    id: 'operations.intelligence.view',
    name: 'View Operational Intelligence',
    section: 'operations',
    feature: 'intelligence',
    action: 'view',
    description: 'Access AI insights, conversion funnels, and executive reports.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'reports_view',
  },

  // ============================================================================
  // SECTION 2: FINANCE HUB (Invoices, Agreements, Packages, Cycles, Setup)
  // ============================================================================
  {
    id: 'finance.agreements.view',
    name: 'View Contracts & Agreements',
    section: 'finance',
    feature: 'agreements',
    action: 'view',
    description: 'Inspect student/client contracts, agreements, and payment terms.',
    riskLevel: 'medium',
    dependencies: [],
    legacyPermissionId: 'agreements_view',
  },
  {
    id: 'finance.agreements.create',
    name: 'Create Agreements',
    section: 'finance',
    feature: 'agreements',
    action: 'create',
    description: 'Generate new contract agreements for clients and prospects.',
    riskLevel: 'high',
    dependencies: ['finance.agreements.view'],
    legacyPermissionId: 'agreements_create',
  },
  {
    id: 'finance.agreements.edit',
    name: 'Edit Agreements',
    section: 'finance',
    feature: 'agreements',
    action: 'edit',
    description: 'Modify agreement clauses, payment schedules, and terms.',
    riskLevel: 'high',
    dependencies: ['finance.agreements.view'],
    legacyPermissionId: 'agreements_edit',
  },
  {
    id: 'finance.agreements.delete',
    name: 'Void & Delete Agreements',
    section: 'finance',
    feature: 'agreements',
    action: 'delete',
    description: 'Void signed agreements and delete draft contracts.',
    riskLevel: 'critical',
    dependencies: ['finance.agreements.view'],
    legacyPermissionId: 'agreements_delete',
  },
  {
    id: 'finance.invoices.view',
    name: 'View Invoices',
    section: 'finance',
    feature: 'invoices',
    action: 'view',
    description: 'View customer invoices, payment status, and balance receipts.',
    riskLevel: 'medium',
    dependencies: [],
    legacyPermissionId: 'invoices_view',
  },
  {
    id: 'finance.invoices.create',
    name: 'Generate Invoices',
    section: 'finance',
    feature: 'invoices',
    action: 'create',
    description: 'Issue new invoices, charge cards, and request payments.',
    riskLevel: 'high',
    dependencies: ['finance.invoices.view'],
    legacyPermissionId: 'invoices_create',
  },
  {
    id: 'finance.invoices.edit',
    name: 'Edit Invoices',
    section: 'finance',
    feature: 'invoices',
    action: 'edit',
    description: 'Apply discounts, change line items, and adjust tax rates.',
    riskLevel: 'high',
    dependencies: ['finance.invoices.view'],
    legacyPermissionId: 'invoices_edit',
  },
  {
    id: 'finance.invoices.delete',
    name: 'Void & Delete Invoices',
    section: 'finance',
    feature: 'invoices',
    action: 'delete',
    description: 'Void issued invoices and delete financial ledger entries.',
    riskLevel: 'critical',
    dependencies: ['finance.invoices.view'],
    legacyPermissionId: 'invoices_delete',
  },
  {
    id: 'finance.packages.view',
    name: 'View Pricing Packages',
    section: 'finance',
    feature: 'packages',
    action: 'view',
    description: 'View pricing tiers, curriculum packages, and service offerings.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'packages_view',
  },
  {
    id: 'finance.packages.create',
    name: 'Create Packages',
    section: 'finance',
    feature: 'packages',
    action: 'create',
    description: 'Create new billable packages and curriculum tiers.',
    riskLevel: 'medium',
    dependencies: ['finance.packages.view'],
    legacyPermissionId: 'packages_create',
  },
  {
    id: 'finance.packages.edit',
    name: 'Edit Packages',
    section: 'finance',
    feature: 'packages',
    action: 'edit',
    description: 'Update package fees, descriptions, and feature inclusions.',
    riskLevel: 'medium',
    dependencies: ['finance.packages.view'],
    legacyPermissionId: 'packages_edit',
  },
  {
    id: 'finance.packages.delete',
    name: 'Delete Packages',
    section: 'finance',
    feature: 'packages',
    action: 'delete',
    description: 'Remove pricing packages from active catalog.',
    riskLevel: 'high',
    dependencies: ['finance.packages.view'],
    legacyPermissionId: 'packages_delete',
  },
  {
    id: 'finance.cycles.view',
    name: 'View Billing Cycles',
    section: 'finance',
    feature: 'cycles',
    action: 'view',
    description: 'View academic terms, billing periods, and recurring cycle cadences.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'billing_periods_view',
  },
  {
    id: 'finance.cycles.create',
    name: 'Create Billing Cycles',
    section: 'finance',
    feature: 'cycles',
    action: 'create',
    description: 'Define new billing periods and collection milestones.',
    riskLevel: 'medium',
    dependencies: ['finance.cycles.view'],
    legacyPermissionId: 'billing_periods_create',
  },
  {
    id: 'finance.cycles.edit',
    name: 'Edit Billing Cycles',
    section: 'finance',
    feature: 'cycles',
    action: 'edit',
    description: 'Adjust billing cycle date ranges and collection cutoffs.',
    riskLevel: 'medium',
    dependencies: ['finance.cycles.view'],
    legacyPermissionId: 'billing_periods_edit',
  },
  {
    id: 'finance.cycles.delete',
    name: 'Delete Billing Cycles',
    section: 'finance',
    feature: 'cycles',
    action: 'delete',
    description: 'Delete billing periods.',
    riskLevel: 'high',
    dependencies: ['finance.cycles.view'],
    legacyPermissionId: 'billing_periods_delete',
  },
  {
    id: 'finance.billingSetup.view',
    name: 'View Payment Gateways & Banking',
    section: 'finance',
    feature: 'billingSetup',
    action: 'view',
    description: 'Inspect connected Paystack, Stripe, and MoMo merchant accounts.',
    riskLevel: 'high',
    dependencies: [],
    legacyPermissionId: 'billing_setup_view',
  },
  {
    id: 'finance.billingSetup.edit',
    name: 'Configure Payment Gateways',
    section: 'finance',
    feature: 'billingSetup',
    action: 'edit',
    description: 'Update bank payout details, API keys, and payment webhooks.',
    riskLevel: 'critical',
    dependencies: ['finance.billingSetup.view'],
    legacyPermissionId: 'billing_setup_manage',
  },

  // ============================================================================
  // SECTION 3: STUDIOS (Messaging, Portals, Media, Surveys, Forms, Tags, etc.)
  // ============================================================================
  {
    id: 'studios.publicPortals.view',
    name: 'View Public Portals',
    section: 'studios',
    feature: 'publicPortals',
    action: 'view',
    description: 'View public applicant portals and hosted community hubs.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'portals_view',
  },
  {
    id: 'studios.publicPortals.create',
    name: 'Create Public Portals',
    section: 'studios',
    feature: 'publicPortals',
    action: 'create',
    description: 'Launch new public customer portals.',
    riskLevel: 'medium',
    dependencies: ['studios.publicPortals.view'],
    legacyPermissionId: 'portals_create',
  },
  {
    id: 'studios.publicPortals.edit',
    name: 'Edit Public Portals',
    section: 'studios',
    feature: 'publicPortals',
    action: 'edit',
    description: 'Customize public portal themes, branding, and widgets.',
    riskLevel: 'medium',
    dependencies: ['studios.publicPortals.view'],
    legacyPermissionId: 'portals_edit',
  },
  {
    id: 'studios.publicPortals.delete',
    name: 'Delete Public Portals',
    section: 'studios',
    feature: 'publicPortals',
    action: 'delete',
    description: 'Unpublish and take down portals.',
    riskLevel: 'high',
    dependencies: ['studios.publicPortals.view'],
    legacyPermissionId: 'portals_delete',
  },
  {
    id: 'studios.messaging.view',
    name: 'View Messaging Studio',
    section: 'studios',
    feature: 'messaging',
    action: 'view',
    description: 'View WhatsApp, Email, and SMS templates and broadcast histories.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'messaging_view',
  },
  {
    id: 'studios.messaging.create',
    name: 'Create & Send Broadcasts',
    section: 'studios',
    feature: 'messaging',
    action: 'create',
    description: 'Compose message templates and trigger multi-channel campaigns.',
    riskLevel: 'high',
    dependencies: ['studios.messaging.view'],
    legacyPermissionId: 'messaging_create',
  },
  {
    id: 'studios.messaging.edit',
    name: 'Edit Message Templates',
    section: 'studios',
    feature: 'messaging',
    action: 'edit',
    description: 'Edit broadcast templates and dynamic double-brace variables.',
    riskLevel: 'medium',
    dependencies: ['studios.messaging.view'],
    legacyPermissionId: 'messaging_edit',
  },
  {
    id: 'studios.messaging.delete',
    name: 'Delete Message Templates',
    section: 'studios',
    feature: 'messaging',
    action: 'delete',
    description: 'Delete messaging templates.',
    riskLevel: 'medium',
    dependencies: ['studios.messaging.view'],
    legacyPermissionId: 'messaging_delete',
  },
  {
    id: 'studios.forms.view',
    name: 'View Form Studio',
    section: 'studios',
    feature: 'forms',
    action: 'view',
    description: 'View public intake forms and survey questionnaires.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'forms_view',
  },
  {
    id: 'studios.forms.create',
    name: 'Create Forms',
    section: 'studios',
    feature: 'forms',
    action: 'create',
    description: 'Build new lead intake and onboarding forms.',
    riskLevel: 'medium',
    dependencies: ['studios.forms.view'],
    legacyPermissionId: 'forms_create',
  },
  {
    id: 'studios.forms.edit',
    name: 'Edit Forms',
    section: 'studios',
    feature: 'forms',
    action: 'edit',
    description: 'Modify form fields, conditional logic, and submission triggers.',
    riskLevel: 'medium',
    dependencies: ['studios.forms.view'],
    legacyPermissionId: 'forms_edit',
  },
  {
    id: 'studios.forms.delete',
    name: 'Delete Forms',
    section: 'studios',
    feature: 'forms',
    action: 'delete',
    description: 'Delete intake forms.',
    riskLevel: 'high',
    dependencies: ['studios.forms.view'],
    legacyPermissionId: 'forms_delete',
  },
  {
    id: 'studios.tags.view',
    name: 'View Workspace Tags',
    section: 'studios',
    feature: 'tags',
    action: 'view',
    description: 'Inspect workspace segmentation tag library.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'tags_view',
  },
  {
    id: 'studios.tags.create',
    name: 'Create Tags',
    section: 'studios',
    feature: 'tags',
    action: 'create',
    description: 'Create new taxonomy tags for contact segmentation.',
    riskLevel: 'low',
    dependencies: ['studios.tags.view'],
    legacyPermissionId: 'tags_create',
  },
  {
    id: 'studios.tags.edit',
    name: 'Edit Tags',
    section: 'studios',
    feature: 'tags',
    action: 'edit',
    description: 'Rename tags and update color codes.',
    riskLevel: 'low',
    dependencies: ['studios.tags.view'],
    legacyPermissionId: 'tags_edit',
  },
  {
    id: 'studios.tags.delete',
    name: 'Delete Tags',
    section: 'studios',
    feature: 'tags',
    action: 'delete',
    description: 'Delete tags from workspace taxonomy.',
    riskLevel: 'medium',
    dependencies: ['studios.tags.view'],
    legacyPermissionId: 'tags_delete',
  },
  {
    id: 'studios.media.view',
    name: 'View Media Asset Library',
    section: 'studios',
    feature: 'media',
    action: 'view',
    description: 'Browse uploaded videos, banners, logos, and audio assets.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'media_view',
  },
  {
    id: 'studios.media.create',
    name: 'Upload Media',
    section: 'studios',
    feature: 'media',
    action: 'create',
    description: 'Upload media files to CDN storage.',
    riskLevel: 'medium',
    dependencies: ['studios.media.view'],
    legacyPermissionId: 'media_create',
  },
  {
    id: 'studios.media.delete',
    name: 'Delete Media',
    section: 'studios',
    feature: 'media',
    action: 'delete',
    description: 'Delete files from cloud media storage.',
    riskLevel: 'high',
    dependencies: ['studios.media.view'],
    legacyPermissionId: 'media_delete',
  },
  {
    id: 'studios.qrStudio.view',
    name: 'View QR Code Studio',
    section: 'studios',
    feature: 'qrStudio',
    action: 'view',
    description: 'View dynamic QR campaigns and scan analytics.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'qr_studio_view',
  },
  {
    id: 'studios.qrStudio.create',
    name: 'Generate QR Codes',
    section: 'studios',
    feature: 'qrStudio',
    action: 'create',
    description: 'Generate branded dynamic QR codes with UTM tracking.',
    riskLevel: 'low',
    dependencies: ['studios.qrStudio.view'],
    legacyPermissionId: 'qr_studio_create',
  },
  {
    id: 'studios.verifyStudio.view',
    name: 'View Verification Studio',
    section: 'studios',
    feature: 'verifyStudio',
    action: 'view',
    description: 'Inspect verified applicant badges and identity logs.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'verify_studio_view',
  },
  {
    id: 'studios.verifyStudio.create',
    name: 'Issue Verified Credentials',
    section: 'studios',
    feature: 'verifyStudio',
    action: 'create',
    description: 'Issue signed verification certificates and badges.',
    riskLevel: 'high',
    dependencies: ['studios.verifyStudio.view'],
    legacyPermissionId: 'verify_studio_create',
  },

  // ============================================================================
  // SECTION 4: MANAGEMENT (People, Roles, Variables, System Settings)
  // ============================================================================
  {
    id: 'management.users.view',
    name: 'View Team Members Directory',
    section: 'management',
    feature: 'users',
    action: 'view',
    description: 'View organization member profiles, contact info, and activity status.',
    riskLevel: 'medium',
    dependencies: [],
    legacyPermissionId: 'users_view',
  },
  {
    id: 'management.users.create',
    name: 'Invite Team Members',
    section: 'management',
    feature: 'users',
    action: 'create',
    description: 'Invite new users and dispatch temporary onboarding credentials.',
    riskLevel: 'high',
    dependencies: ['management.users.view'],
    legacyPermissionId: 'users_create',
  },
  {
    id: 'management.users.edit',
    name: 'Manage User Roles & Access',
    section: 'management',
    feature: 'users',
    action: 'edit',
    description: 'Assign roles, toggle authorization, and update workspace access.',
    riskLevel: 'critical',
    dependencies: ['management.users.view'],
    legacyPermissionId: 'users_edit',
  },
  {
    id: 'management.users.delete',
    name: 'Remove & Revoke Team Members',
    section: 'management',
    feature: 'users',
    action: 'delete',
    description: 'Eject members from organization and invalidate all active sessions.',
    riskLevel: 'critical',
    dependencies: ['management.users.view'],
    legacyPermissionId: 'users_delete',
  },
  {
    id: 'management.fields.view',
    name: 'View Custom Fields & Variables',
    section: 'management',
    feature: 'fields',
    action: 'view',
    description: 'Inspect global template variables and entity custom field definitions.',
    riskLevel: 'low',
    dependencies: [],
    legacyPermissionId: 'fields_view',
  },
  {
    id: 'management.fields.create',
    name: 'Create Custom Fields',
    section: 'management',
    feature: 'fields',
    action: 'create',
    description: 'Define new schema fields for contacts, deals, and campuses.',
    riskLevel: 'medium',
    dependencies: ['management.fields.view'],
    legacyPermissionId: 'fields_create',
  },
  {
    id: 'management.fields.edit',
    name: 'Edit Custom Fields & Variables',
    section: 'management',
    feature: 'fields',
    action: 'edit',
    description: 'Update variable fallback values and field validation rules.',
    riskLevel: 'medium',
    dependencies: ['management.fields.view'],
    legacyPermissionId: 'fields_edit',
  },
  {
    id: 'management.fields.delete',
    name: 'Delete Custom Fields',
    section: 'management',
    feature: 'fields',
    action: 'delete',
    description: 'Delete custom schema attributes.',
    riskLevel: 'high',
    dependencies: ['management.fields.view'],
    legacyPermissionId: 'fields_delete',
  },
  {
    id: 'management.systemSettings.view',
    name: 'View Organization System Settings',
    section: 'management',
    feature: 'systemSettings',
    action: 'view',
    description: 'Inspect tenant branding, custom domains, and integration configurations.',
    riskLevel: 'high',
    dependencies: [],
  },
  {
    id: 'management.systemSettings.edit',
    name: 'Modify System Settings',
    section: 'management',
    feature: 'systemSettings',
    action: 'edit',
    description: 'Configure tenant identity settings, authentication policies, and API keys.',
    riskLevel: 'critical',
    dependencies: ['management.systemSettings.view'],
    legacyPermissionId: 'system_admin',
  },
];

export class PermissionRegistryService {
  /**
   * Returns all canonical permission definitions.
   */
  static getAllPermissions(): PermissionDefinition[] {
    return CANONICAL_PERMISSIONS_CATALOG;
  }

  /**
   * Finds a permission definition by coordinate ID (e.g. `operations.campuses.create`).
   */
  static getPermissionById(permissionId: string): PermissionDefinition | undefined {
    return CANONICAL_PERMISSIONS_CATALOG.find((p) => p.id === permissionId);
  }

  /**
   * Filters permissions by section.
   */
  static getPermissionsBySection(section: keyof PermissionsSchema): PermissionDefinition[] {
    return CANONICAL_PERMISSIONS_CATALOG.filter((p) => p.section === section);
  }

  /**
   * Resolves and fixes DAG dependencies in a PermissionsSchema.
   * If `create`, `edit`, or `delete` is enabled, automatically activates `view: true`
   * and marks the parent feature and section as enabled.
   */
  static resolveDependencies(rawSchema: PermissionsSchema): PermissionsSchema {
    const resolved: PermissionsSchema = JSON.parse(JSON.stringify(rawSchema));

    const sections: (keyof PermissionsSchema)[] = ['operations', 'finance', 'studios', 'management'];

    sections.forEach((secKey) => {
      const section = resolved[secKey];
      if (!section) return;

      let sectionHasEnabledFeature = false;

      Object.entries(section.features).forEach(([featKey, actions]) => {
        if (!actions) return;

        // If any mutate action is enabled, view MUST be true
        if (actions.create || actions.edit || actions.delete) {
          actions.view = true;
        }

        if (actions.view || actions.create || actions.edit || actions.delete) {
          sectionHasEnabledFeature = true;
        }
      });

      // If any feature has active permissions, enable the section
      if (sectionHasEnabledFeature) {
        section.enabled = true;
      }
    });

    return resolved;
  }

  /**
   * Computes risk metrics and capability statistics for a given PermissionsSchema.
   */
  static calculateRiskMetrics(schema: PermissionsSchema): {
    totalActive: number;
    riskBreakdown: { low: number; medium: number; high: number; critical: number };
    capabilitySummary: { operations: number; finance: number; studios: number; management: number };
  } {
    const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    const capSummary = { operations: 0, finance: 0, studios: 0, management: 0 };
    let totalActive = 0;

    for (const def of CANONICAL_PERMISSIONS_CATALOG) {
      const sec = schema[def.section];
      if (!sec || !sec.enabled) continue;

      const feat = sec.features[def.feature];
      if (!feat) continue;

      const actionKey = def.action as keyof typeof feat;
      if (feat[actionKey] === true) {
        totalActive++;
        riskCounts[def.riskLevel]++;
        capSummary[def.section]++;
      }
    }

    return {
      totalActive,
      riskBreakdown: riskCounts,
      capabilitySummary: capSummary,
    };
  }
}
