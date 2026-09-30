/**
 * @fileoverview Multi-Audience Message Composer Types & Contracts.
 *
 * Provides strictly typed discriminated unions and interfaces for:
 * 1. Mode-Exclusive Audience selection ('entities' | 'team' | 'adhoc').
 * 2. Ad-hoc contact tokenization and spreadsheet mapping.
 * 3. Internal team member recipient representations.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Rule 4 strictly enforced: Zero `any` or `any[]`.
 * - All variable bindings must route through FieldsVariablesService.
 */

/**
 * Three distinct audience modes supported by the Message Composer.
 * - 'entities': Active CRM workspace entities and entity contacts.
 * - 'team': Internal workspace users/staff.
 * - 'adhoc': Direct delimited text pills and spreadsheet uploads.
 */
export type ComposerAudienceMode = 'entities' | 'team' | 'adhoc';

/**
 * Represents a single parsed, normalized contact entry from ad-hoc text or spreadsheet input.
 */
export interface AdHocContactItem {
  /** Unique client identifier (e.g. UUID or nanoid format) */
  id: string;
  /** Raw textual input before sanitization and normalization */
  rawInput: string;
  /** Normalized contact destination: E.164 phone (+233...) or lowercase email */
  target: string;
  /** Optional extracted contact name or label (from angle brackets or colon format) */
  displayName?: string;
  /** Whether the contact passed channel-specific format validation */
  isValid: boolean;
  /** Specific validation failure explanation if isValid is false */
  validationError?: string;
  /** Dynamic custom variables mapped from spreadsheet columns or prompt inputs */
  customVars?: Record<string, string>;
}

/**
 * Result returned by the contact tokenizer utility.
 */
export interface TokenizeResult {
  /** Deduplicated list of parsed contact items */
  items: AdHocContactItem[];
  /** Total count of duplicate occurrences detected and omitted */
  duplicateCount: number;
  /** Total count of items that passed channel validation */
  validCount: number;
  /** Total count of items that failed channel validation */
  invalidCount: number;
}

/**
 * Represents an internal workspace user eligible for receiving internal broadcast dispatches.
 */
export interface InternalUserRecipient {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  department?: string;
  /** Whether the user possesses valid contact info for the currently selected channel */
  isEligibleForChannel: boolean;
}

/**
 * Discriminated union of composer recipients across all three modes.
 */
export type ComposerRecipient =
  | { mode: 'entities'; entityId: string; entityName: string; contactDetail: string; contactName?: string }
  | { mode: 'team'; user: InternalUserRecipient; contactDetail: string }
  | { mode: 'adhoc'; contact: AdHocContactItem; contactDetail: string };
