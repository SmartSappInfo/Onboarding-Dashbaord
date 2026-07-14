import type { Entity, Workspace } from '../types';

export interface UnifiedVariable {
  key: string;            // E.g. "entity_name", "contact_name", "meeting_title", "form_fields.my_field"
  label: string;          // Dynamic display label translated with active terminology (e.g., "Campus Name")
  category: 'core' | 'custom' | 'industry' | 'feature' | 'contact_specific';
  dataType: 'string' | 'number' | 'date' | 'url' | 'boolean' | 'html';
  description?: string;   // Tooltip info for developers and users
  source: 'static' | 'custom_field' | 'contact_role' | 'feature_system' | 'dynamic_form';
  path?: string;          // Path to resolve on target documents (e.g. "entityContacts[isPrimary].email")
  isDeprecated?: boolean;
  featureContext?: 'common' | 'meeting' | 'form' | 'survey' | 'agreement' | 'campaign';
  exampleValue?: string;  // For sandbox previews
  fallbackValue?: string; // Predefined fallback value
}

export interface GetVariablesParams {
  workspaceId: string;
  organizationId?: string;
  featureContext?: 'all' | 'common' | 'meeting' | 'form' | 'survey' | 'agreement' | 'campaign';
  sourceId?: string; // formId or surveyId
  terminology?: { singular: string; plural: string }; // Client-side terminology overrides
}

export interface DataResolutionContext {
  workspaceId: string;
  entityId?: string;
  recipientContact?: string; // Target email or phone to resolve generic contact_* tags
  meetingId?: string;
  formId?: string;
  surveyId?: string;
  agreementId?: string;
  submissionId?: string;
  responseId?: string;
  userId?: string;
  extraVars?: Record<string, unknown>; // Caller-supplied overrides
  preloadedEntity?: Partial<Entity>; // Pre-loaded Entity to avoid Firestore round-trip
  preloadedWorkspace?: Partial<Workspace>; // Pre-loaded Workspace to avoid Firestore round-trip
}
