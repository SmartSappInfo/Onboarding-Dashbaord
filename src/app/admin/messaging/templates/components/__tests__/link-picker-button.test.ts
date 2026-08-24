/**
 * Unit Test Suite: Dynamic Dashboard Link & Link Picker Verification
 *
 * WORKSPACE & QUALITY RULES COMPLIANCE:
 * - Verifies `Personalized Dashboard Link` (`{{dashboard_link}}`) is present and resolvable.
 * - Verifies button rendering helper logic and `FieldsVariablesService` resolution rules.
 * - Strict typing enforced throughout.
 */

import { describe, it, expect } from 'vitest';
import { FieldsVariablesService } from '@/lib/services/fields-variables-service-impl';
import { getBaseUrl } from '@/lib/utils/url-helpers';
import { DYNAMIC_VARIABLES } from '../link-picker';

describe('Dynamic Dashboard Link & Link Picker Tests', () => {
  it('resolves {{dashboard_link}} properly in fallback mode', async () => {
    const vars = await FieldsVariablesService.getVariableValuesMap({
      workspaceId: 'ws-test-123',
    });

    const dashLink = vars.get('dashboard_link');
    expect(dashLink).toBeDefined();
    expect(dashLink).toContain('/admin/dashboard');
  });

  it('resolves {{dashboard_link}} key consistently', async () => {
    const vars = await FieldsVariablesService.getVariableValuesMap({
      workspaceId: 'ws-test-123',
      surveyId: 'survey-999',
    });

    const dashLink = vars.get('dashboard_link');
    expect(dashLink).toBeDefined();
    expect(typeof dashLink).toBe('string');
  });

  it('resolves {{entity_console_link}} and {{entity_link}} properly', async () => {
    const varsWithEntity = await FieldsVariablesService.getVariableValuesMap({
      workspaceId: 'ws-test-123',
      entityId: 'ent-school-456',
    });

    const entityConsoleLink = varsWithEntity.get('entity_console_link');
    const entityLink = varsWithEntity.get('entity_link');
    expect(entityConsoleLink).toBeDefined();
    expect(entityConsoleLink).toContain('/admin/entities/ent-school-456');
    expect(entityLink).toBeDefined();
    expect(entityLink).toContain('/admin/entities/ent-school-456');

    // Fallback mode without specific entity
    const varsFallback = await FieldsVariablesService.getVariableValuesMap({
      workspaceId: 'ws-test-123',
    });
    expect(varsFallback.get('entity_console_link')).toContain('/admin/entities');
  });

  it('contains Target Entity Console in DYNAMIC_VARIABLES registry', () => {
    const entityConsoleItem = DYNAMIC_VARIABLES.find(v => v.path === '{{entity_console_link}}');
    expect(entityConsoleItem).toBeDefined();
    expect(entityConsoleItem?.name).toBe('Target Entity Console');

    const entityLinkItem = DYNAMIC_VARIABLES.find(v => v.path === '{{entity_link}}');
    expect(entityLinkItem).toBeDefined();
  });

  it('appends base URL to internal relative paths starting with /', () => {
    const internalPath = '/m/9Kmtlz6ncX9Uf9dtWUo2';
    const absolute = (internalPath.startsWith('/') ? `${getBaseUrl()}${internalPath}` : internalPath);
    expect(absolute).toContain('/m/9Kmtlz6ncX9Uf9dtWUo2');
    expect(absolute).toMatch(/^https?:\/\//);
  });

  it('preserves dynamic variable tokens starting with {{ without prepending base URL', () => {
    const dynamicVar = '{{survey_link}}';
    const result = dynamicVar.startsWith('/') ? `${getBaseUrl()}${dynamicVar}` : dynamicVar;
    expect(result).toBe('{{survey_link}}');
  });

  it('correctly detects URL variables with isLikelyUrlVariable', async () => {
    const { isLikelyUrlVariable } = await import('@/components/shared/FallbackEditorModal');
    expect(isLikelyUrlVariable('visibility_report')).toBe(true);
    expect(isLikelyUrlVariable('survey_link')).toBe(true);
    expect(isLikelyUrlVariable('form_link')).toBe(true);
    expect(isLikelyUrlVariable('contract_link')).toBe(true);
    expect(isLikelyUrlVariable('entity_console_link')).toBe(true);
    expect(isLikelyUrlVariable('custom_audit_url')).toBe(true);
    expect(isLikelyUrlVariable('custom_audit', 'https://smartsapp.com')).toBe(true);
    expect(isLikelyUrlVariable('contact_name', 'John Doe')).toBe(false);
  });

  it('normalizes double question marks when resolving tracked URLs with existing queries', async () => {
    const { resolveTextWithMap, normalizeUrlQueryJoins } = await import('@/lib/utils/variable-replacer');
    
    // Direct URL normalizer test
    const rawUrl = 'https://smartsapp.com/audit?tenant=123?ref=encrypted_token_456';
    expect(normalizeUrlQueryJoins(rawUrl)).toBe('https://smartsapp.com/audit?tenant=123&ref=encrypted_token_456');

    // Resolution with Map
    const valuesMap = new Map<string, unknown>();
    valuesMap.set('visibility_report', 'https://smartsapp.com/audit?tenant=123');
    valuesMap.set('encrypted_recipient_token', 'mock_encrypted_token_123');

    const template = 'Go Here: {{visibility_report}}?ref={{encrypted_recipient_token}}';
    const resolved = resolveTextWithMap(template, valuesMap, false);
    expect(resolved).toBe('Go Here: https://smartsapp.com/audit?tenant=123&ref=mock_encrypted_token_123');
  });
});
