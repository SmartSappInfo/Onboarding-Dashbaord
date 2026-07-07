'use server';

import { FieldsVariablesService } from './fields-variables-service-impl';
import type { GetVariablesParams, UnifiedVariable, DataResolutionContext } from '../types/variables';

/**
 * Server Action: Returns all normalized variables available for a specific context.
 * Accessible by both client and server components.
 */
export async function getVariablesAction(params: GetVariablesParams): Promise<UnifiedVariable[]> {
  return FieldsVariablesService.getVariables(params);
}

/**
 * Server Action: Replaces all {{tag}} tokens in template text.
 * Returns a plain string.
 */
export async function resolveTemplateVariablesAction(
  templateText: string,
  context: DataResolutionContext
): Promise<string> {
  return FieldsVariablesService.resolveTemplateVariables(templateText, context);
}
