/**
 * @fileOverview Centralised Firestore collection name constants.
 * Import from here instead of using string literals anywhere in the codebase.
 * This prevents typos and makes collection renames a single-file change.
 */

export const COLLECTIONS = {
  // Core CRM
  FORMS:            'forms',
  FORM_SUBMISSIONS: 'form_submissions',
  APP_FIELDS:       'app_fields',
  FIELD_GROUPS:     'field_groups',
  PAGE_TEMPLATES:   'page_templates',

  // Entities
  ENTITIES:         'entities',
  SCHOOLS:          'schools',
  WORKSPACES:       'workspaces',

  // Automation & Messaging
  ACTIVITIES:       'activities',
  AUTOMATIONS:      'automations',
  WEBHOOKS:         'webhooks',
  MESSAGE_LOGS:     'message_logs',

  // Users & Org
  USERS:            'users',
  ORGANIZATIONS:    'organizations',
  PIPELINES:        'pipelines',
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
