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

/**
 * Server Action: Fetches a flat map of all variable values for a given context.
 */
export async function getVariableValuesMapAction(
  context: DataResolutionContext
): Promise<Record<string, string>> {
  const map = await FieldsVariablesService.getVariableValuesMap(context);
  const result: Record<string, string> = {};
  map.forEach((value, key) => {
    result[key] = value !== null && value !== undefined ? String(value) : '';
  });
  return result;
}

/**
 * Server Action: Resolves entityId and recipientContact identifier based on URL search query parameters.
 */
export async function resolveEntityContextFromParamsAction(
  workspaceIds: string[],
  searchParams: Record<string, string>
): Promise<{ entityId: string | null; recipientContact: string | null }> {
  return FieldsVariablesService.resolveEntityContextFromParams(workspaceIds, searchParams);
}
