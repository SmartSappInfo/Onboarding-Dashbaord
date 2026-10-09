/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Normalizes URL query parameter joins to prevent double question marks (e.g. `https://foo.com?a=1?ref=xyz` -> `https://foo.com?a=1&ref=xyz`).
 * Ensures safe concatenation when tracked tokens (`?ref={{encrypted_recipient_token}}`) are appended to URLs with existing query strings.
 *
 * TESTABILITY: Tested in fields-variables-service.test.ts and link-picker-button.test.ts.
 * RELATED SURFACES: FieldsVariablesService, messaging-utils.ts, messaging-engine.ts.
 */
export function normalizeUrlQueryJoins(text: string): string {
  if (!text || !text.includes('?')) return text;
  // Match URLs with multiple ? delimiters: replace any subsequent ? with & in the query string
  return text.replace(/(https?:\/\/[^\s<"'>]+)/gi, (url) => {
    const firstQ = url.indexOf('?');
    if (firstQ === -1) return url;
    const baseAndFirstQuery = url.slice(0, firstQ + 1);
    const rest = url.slice(firstQ + 1).replace(/\?/g, '&');
    return baseAndFirstQuery + rest;
  });
}

/**
 * PURE, client-safe utility to substitute double-brace variables in template strings.
 * Extracted to avoid client/server dependency leakage during UI builds.
 */
export function resolveTextWithMap(
  templateText: string,
  valuesMap: Map<string, unknown>,
  keepMissing = true
): string {
  if (!templateText) return '';
  const resolved = templateText.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const parts = key.split(/\|\||\|/);
    const cleanKey = parts[0].trim();
    const userFallback = parts.length > 1 ? parts.slice(1).join('|').trim() : undefined;

    // Build alias key list (e.g. entity.name <-> entity_name <-> entityName)
    const possibleKeys: string[] = [
      cleanKey,
      cleanKey.replace(/\./g, '_'),
      cleanKey.replace(/_/g, '.'),
    ];
    if (cleanKey === 'entity.name' || cleanKey === 'entity_name' || cleanKey === 'school.name' || cleanKey === 'school_name' || cleanKey === 'schoolName') {
      possibleKeys.push('entity_name', 'entity.name', 'entityName', 'displayName', 'organization_name', 'company', 'school_name', 'schoolName');
    }
    if (cleanKey === 'contact.name' || cleanKey === 'contact_name' || cleanKey === 'contactName' || cleanKey === 'recipient_name') {
      possibleKeys.push('contact_name', 'contactName', 'name', 'recipient_name');
    }
    if (cleanKey === 'first_name' || cleanKey === 'recipient_first_name') {
      possibleKeys.push('first_name', 'recipient_first_name', 'firstName');
    }
    if (cleanKey === 'contact.email' || cleanKey === 'contact_email' || cleanKey === 'contactEmail' || cleanKey === 'email' || cleanKey === 'recipient_email') {
      possibleKeys.push('contact_email', 'contactEmail', 'email', 'recipient_email');
    }
    if (cleanKey === 'contact.phone' || cleanKey === 'contact_phone' || cleanKey === 'contactPhone' || cleanKey === 'phone' || cleanKey === 'recipient_phone') {
      possibleKeys.push('contact_phone', 'contactPhone', 'phone', 'recipient_phone');
    }
    if (cleanKey === 'contact_role' || cleanKey === 'recipient_role') {
      possibleKeys.push('contact_role', 'recipient_role', 'contactRole');
    }
    if (cleanKey === 'assigned_to' || cleanKey === 'assignee_name' || cleanKey === 'assignedTo' || cleanKey === 'assignee') {
      possibleKeys.push('assigned_to', 'assignee_name', 'assignedTo', 'assignee', 'user_name', 'name');
    }
    if (cleanKey === 'assigner_name' || cleanKey === 'assigned_by' || cleanKey === 'assigner' || cleanKey === 'assignerName') {
      possibleKeys.push('assigner_name', 'assignerName', 'assigned_by', 'assignedBy', 'actor_name', 'actorName');
    }
    if (cleanKey === 'deal_name' || cleanKey === 'deal_title' || cleanKey === 'dealName') {
      possibleKeys.push('deal_name', 'deal_title', 'dealName', 'entity_name', 'entityName', 'school_name', 'schoolName');
    }
    if (cleanKey === 'deal_link' || cleanKey === 'deal_url' || cleanKey === 'dealLink' || cleanKey === 'dealUrl') {
      possibleKeys.push('deal_link', 'deal_url', 'dealLink', 'action_url', 'entity_link');
    }
    if (cleanKey === 'deal_stage' || cleanKey === 'deal_stage_name' || cleanKey === 'stage_name') {
      possibleKeys.push('deal_stage', 'deal_stage_name', 'stage_name', 'stage');
    }

    // 1. Try to resolve variable value from Map
    let foundVal: unknown = undefined;
    for (const k of possibleKeys) {
      const val = valuesMap.get(k);
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        foundVal = val;
        break;
      }
    }

    if (foundVal !== undefined && foundVal !== null && String(foundVal).trim() !== '') {
      return String(foundVal);
    }

    // 2. User-defined inline fallback (e.g. {{entity.name|SmartSapp}}) takes priority over static defaults
    if (userFallback !== undefined && userFallback !== null && userFallback.trim() !== '') {
      return userFallback;
    }

    // 3. Pre-defined system fallback (__fallback__key)
    for (const k of possibleKeys) {
      const preFallback = valuesMap.get(`__fallback__${k}`);
      if (preFallback !== undefined && preFallback !== null && String(preFallback).trim() !== '') {
        return String(preFallback);
      }
    }

    return keepMissing ? match : '';
  });

  return normalizeUrlQueryJoins(resolved);
}

/**
 * PURE Single Source of Truth (SSOT) utility to extract unique variable token keys
 * from template strings, stripping double braces and inline fallbacks (e.g. `{{name|there}}` -> `name`).
 */
export function extractTemplateTokens(templateText: string): string[] {
  if (!templateText) return [];
  const matches = templateText.match(/\{\{(.*?)\}\}/g);
  if (!matches) return [];
  const tokens = matches.map((match) => {
    const raw = match.replace(/\{\{|\}\}/g, '').trim();
    const parts = raw.split(/\|\||\|/);
    return parts[0].trim();
  }).filter(Boolean);
  return Array.from(new Set(tokens));
}

