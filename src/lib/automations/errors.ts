/**
 * Typed automation errors — map to safe client messages (operational vs unexpected).
 */

export type AutomationErrorCode =
  | 'AUTOMATION_VALIDATION'
  | 'AUTOMATION_PERMISSION'
  | 'AUTOMATION_NOT_FOUND'
  | 'AUTOMATION_UNAUTHORIZED'
  | 'AUTOMATION_INTERNAL';

export class AutomationError extends Error {
  readonly code: AutomationErrorCode;
  readonly isOperational: boolean;

  constructor(code: AutomationErrorCode, message: string, isOperational = true) {
    super(message);
    this.name = 'AutomationError';
    this.code = code;
    this.isOperational = isOperational;
  }
}

export class AutomationValidationError extends AutomationError {
  constructor(message: string) {
    super('AUTOMATION_VALIDATION', message);
    this.name = 'AutomationValidationError';
  }
}

export class AutomationPermissionError extends AutomationError {
  constructor(message: string) {
    super('AUTOMATION_PERMISSION', message);
  }
}

export class AutomationNotFoundError extends AutomationError {
  constructor(message = 'Automation not found.') {
    super('AUTOMATION_NOT_FOUND', message);
    this.name = 'AutomationNotFoundError';
  }
}

const GENERIC_MESSAGE = 'Something went wrong while saving the automation. Please try again.';

/**
 * Maps errors to messages safe to return to the admin UI with detailed resolutions.
 */
export function toAutomationClientError(error: unknown): string {
  let rawMessage = 'An unknown database or network error occurred.';
  let isOperational = false;
  let code = '';
  
  if (error && typeof error === 'object') {
    const err = error as any;
    rawMessage = err.message || rawMessage;
    code = err.code || '';
    if (
      err.name === 'AutomationValidationError' ||
      err.name === 'AutomationError' ||
      err.isOperational === true ||
      code === 'AUTOMATION_VALIDATION'
    ) {
      isOperational = true;
    }
  } else if (typeof error === 'string') {
    rawMessage = error;
    isOperational = true;
  }
  
  const msgLower = rawMessage.toLowerCase();
  
  // 1. Check for database/Firestore permission rules blockages
  if (msgLower.includes('permission') || msgLower.includes('insufficient permissions')) {
    return 'Missing or insufficient database permissions.\n\nResolution: You do not have permission to modify automations or read workspace resources (e.g. templates, fields) in this workspace. Please contact your workspace administrator to grant you edit permissions.';
  }
  
  // 2. Check for missing trigger node
  if (msgLower.includes('must include a trigger node')) {
    return `${rawMessage}\n\nResolution: Drag a trigger step (e.g. 'School Created' or 'Form Submitted') from the library onto the canvas to serve as the entry point of your flow.`;
  }
  
  // 3. Check for condition node missing properties
  if (msgLower.includes('requires a payload field and operator')) {
    return `${rawMessage}\n\nResolution: Select the Evaluate Logic node on the canvas, and select both a variable field and a comparison operator in the inspector panel.`;
  }
  
  // 4. Check for wait/delay node properties
  if (msgLower.includes('requires a wait amount') || msgLower.includes('requires a time unit')) {
    return `${rawMessage}\n\nResolution: Select the Wait Period node on the canvas and input a valid numeric duration (at least 1) and select its time unit in the inspector panel.`;
  }
  
  // 5. Check for tag action configurations
  if (msgLower.includes('tag action') && (msgLower.includes('requires add or remove mode') || msgLower.includes('requires at least one tag'))) {
    return `${rawMessage}\n\nResolution: Select the Tag Action node on the canvas and choose either "Add" or "Remove" mode, then select one or more tags in the inspector panel.`;
  }
  
  // 6. Check for tag condition configurations
  if (msgLower.includes('tag condition') && (msgLower.includes('requires a logic mode') || msgLower.includes('requires at least one tag'))) {
    return `${rawMessage}\n\nResolution: Select the Tag Split node on the canvas and choose the evaluation criteria (e.g. "Has Tag") and select at least one tag in the inspector panel.`;
  }
  
  // 7. Check for message template configurations
  if (msgLower.includes('must specify templateid') || msgLower.includes('template') && msgLower.includes('not found')) {
    return `${rawMessage}\n\nResolution: Select the Send Message node on the canvas and pick an active messaging blueprint template in the inspector panel.`;
  }
  
  // 8. Check for template deactivation
  if (msgLower.includes('is not active in node')) {
    return `${rawMessage}\n\nResolution: The messaging template you selected is currently set to inactive. Pick a different active template, or go to the Messaging Templates page and activate this template.`;
  }
  
  // 9. Check for sub-automation triggers
  if (msgLower.includes('requires a target automation id')) {
    return `${rawMessage}\n\nResolution: Select the Run Automation node on the canvas and select an active workspace automation to run in the inspector panel.`;
  }
  
  // 10. Check for webhook actions
  if (msgLower.includes('requires a webhook id') || msgLower.includes('webhook') && msgLower.includes('not found')) {
    return `${rawMessage}\n\nResolution: Select the Outbound Webhook node on the canvas and select a configured Webhook integration in the inspector panel.`;
  }
  
  // 11. Check for entity update configurations
  if (msgLower.includes('requires at least one field to change')) {
    return `${rawMessage}\n\nResolution: Select the Update Entity node on the canvas and choose at least one field or custom field to update in the inspector panel.`;
  }
  
  // 12. If it is operational or standard error, return it with direct resolution instructions
  if (isOperational || msgLower.includes('must include') || msgLower.includes('requires') || msgLower.includes('not found')) {
    return `${rawMessage}\n\nResolution: Please review the node settings and complete all mandatory configuration properties in the logic inspector.`;
  }
  
  // 13. Fallback for server / db system errors: return the specific system message so developers can debug
  return `${rawMessage}\n\nResolution: A server-side or database exception occurred. Please check the logic definitions, verify your network status, or reload the page and try again.`;
}

export function assertAutomationUserId(userId: string | undefined | null): asserts userId is string {
  if (!userId?.trim()) {
    throw new AutomationError('AUTOMATION_UNAUTHORIZED', 'Authentication required.', true);
  }
}
