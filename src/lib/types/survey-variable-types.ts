/**
 * @fileOverview Strict TypeScript types for the unified survey variable resolution system.
 * All variable resolution across the survey lifecycle (form → lead capture → result) must
 * use these types. The `any` type is strictly prohibited per workspace AGENTS.md rules.
 */

/**
 * A flat map of resolved variable keys to their string values.
 * Keys follow snake_case convention (e.g. contact_name, entity_name, score).
 * Empty string values are valid — used for graceful degradation on anonymous visits.
 * Raw `{{token}}` text must never be shown to end users.
 */
export type VariableValuesMap = Record<string, string>;

/**
 * Channel through which the survey was accessed, detected from the tracking ref or ?ch= param.
 */
export type SurveyAccessChannel = 'email' | 'sms' | 'whatsapp' | 'direct';

/**
 * The resolved identity of the survey respondent, derived from the tracking ref (?ref=) or URL params.
 * Stored in SurveyVariableContext and optionally persisted to sessionStorage.
 */
export interface ResolvedSurveyIdentity {
  /** The respondent's workspace entity ID (different from the survey's own entityId). */
  respondentEntityId: string | null;
  /** The respondent's contact identifier — email or phone, used for variable resolution. */
  recipientContact: string | null;
  /** The raw tracking ref token from the URL (?ref=), preserved for result page fallback. */
  trackingRef: string | null;
  /** The channel detected at entry (email link, SMS, WhatsApp, or direct visit). */
  channel: SurveyAccessChannel;
  /** Pre-resolved variable values map for this respondent at survey entry time. */
  variableMap: VariableValuesMap;
}

/**
 * The React context value exposed by SurveyVariableProvider.
 * Provides the resolved identity and convenience access to the variable map.
 */
export interface SurveyVariableContextValue {
  identity: ResolvedSurveyIdentity;
  /** Shortcut to identity.variableMap for consumers that only need variable resolution. */
  variableMap: VariableValuesMap;
  setIdentity: (identity: ResolvedSurveyIdentity) => void;
}

/**
 * Full variable context passed to FieldsVariablesService for server-side resolution.
 * Extends the base DataResolutionContext with respondent-specific fields and score data.
 */
export interface SurveyVarContext {
  workspaceId: string;
  surveyId: string;
  submissionId?: string;
  /** The survey's linked entity (the institution the survey belongs to). */
  entityId?: string;
  /** The respondent's resolved entity — may differ from the survey's entityId. */
  respondentEntityId?: string;
  /** The respondent's email or phone number for contact-scoped variable resolution. */
  recipientContact?: string;
  /** The respondent's final score for score-variable injection ({{score}}, {{survey_score}}). */
  score?: number;
  /** The maximum possible score for {{max_score}} resolution. */
  maxScore?: number;
  /** The survey title for {{survey_title}} resolution. */
  surveyTitle?: string;
}

/**
 * Enriched variable map that includes both entity/contact variables and score variables.
 * Built server-side in the result page RSC and passed to ResultRenderer as props.
 */
export interface FullSurveyVariableMap extends VariableValuesMap {
  score: string;
  survey_score: string;
  max_score: string;
  survey_title: string;
  submission_id: string;
  submission_date: string;
}

/**
 * The fields added to Firestore survey response documents to store respondent identity.
 * These are additive — existing responses without these fields default gracefully to null.
 */
export interface SurveyResponseIdentityFields {
  /** The respondent's email or phone, resolved from the tracking token at submission time. */
  contactEmail: string | null;
  /** The respondent's workspace entity ID, resolved from the tracking token. */
  respondentEntityId: string | null;
  /** The access channel detected at survey entry. */
  channel: SurveyAccessChannel;
}
