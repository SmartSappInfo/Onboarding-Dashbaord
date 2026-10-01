/**
 * @fileoverview Single Source of Truth for Survey Messaging Sanitization & Terminology Replacement.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Zero HTML Tags in Copy/Textareas:
 *    - Strips all HTML tags (<br>, <strong>, <b>, <p>, <span>, <div>, <ul>, <li>, etc.) from visible copy.
 *    - Converts <br> and </p> to clean newlines (\n).
 *    - Converts <strong>/<b> to Markdown bold (**text**).
 *    - Converts <em>/<i> to Markdown italic (*text*).
 * 2. Terminology Rule ("Entity" in visible copy):
 *    - Never uses the word "Entity" or "entity" in visible text, headings, or labels unless the workspace
 *      explicitly uses "Entity" as its terminology.
 *    - Replaces "Entity" with the workspace's singular terminology (e.g. "School", "Campus", "Client").
 *    - Replaces "Entities" with the workspace's plural terminology (e.g. "Schools", "Campuses", "Clients").
 *    - CRITICAL EXCEPTION: Variable tokens (e.g. {{entity_name}}, {{entity_link}}, {{entity_console_link}})
 *      are preserved strictly intact to maintain contract integrity with FieldsVariablesService.
 * 3. Variable Token Sanitization:
 *    - Automatically migrates deprecated tokens ({{school_name}} -> {{entity_name}}, {{school_logo}} -> {{org_logo_url}}).
 *
 * TESTABILITY:
 * Covered in src/lib/surveys/__tests__/survey-messaging-sanitizer.test.ts
 */

import type { GenerateSurveyMessagingOutput, EmailBlock } from '@/ai/schemas/survey-messaging-schemas';

/**
 * Strips raw HTML tags from copy while converting formatting tags (br -> \n, strong -> **, em -> *).
 */
export function cleanRawHtmlTags(text?: string | null): string {
  if (!text) return '';
  return text
    // Convert line breaks and paragraph closings to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    // Convert strong / b to markdown bold
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**')
    // Convert em / i to markdown italic
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*')
    // Strip any remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Replaces the word "Entity" with workspace terminology in visible copy,
 * EXCEPT inside {{variable}} tokens which must retain canonical {{entity_name}}.
 */
export function replaceEntityWithTerminology(
  text?: string | null,
  terminology?: { singular?: string; plural?: string }
): string {
  if (!text) return '';
  const termSingular = terminology?.singular?.trim();
  const termPlural = terminology?.plural?.trim() || (termSingular ? `${termSingular}s` : undefined);

  // If terminology is literally "Entity" or empty, no replacement needed
  if (!termSingular || termSingular.toLowerCase() === 'entity') {
    return text;
  }

  const capSingular = termSingular.charAt(0).toUpperCase() + termSingular.slice(1);
  const lowSingular = termSingular.toLowerCase();
  const capPlural = termPlural ? termPlural.charAt(0).toUpperCase() + termPlural.slice(1) : `${capSingular}s`;
  const lowPlural = termPlural ? termPlural.toLowerCase() : `${lowSingular}s`;

  // Split by variable tokens {{...}} so we NEVER alter variables like {{entity_name}}
  const parts = text.split(/(\{\{[^{}]*\}\})/g);

  return parts
    .map((part) => {
      // If it's a double-brace variable token, keep it completely intact
      if (part.startsWith('{{') && part.endsWith('}}')) {
        return part;
      }
      // Replace in visible copy
      let replaced = part;
      // Plurals first to prevent partial match on Entities -> Schools
      replaced = replaced.replace(/\bEntities\b/g, capPlural);
      replaced = replaced.replace(/\bentities\b/g, lowPlural);
      // Singulars
      replaced = replaced.replace(/\bEntity\b/g, capSingular);
      replaced = replaced.replace(/\bentity\b/g, lowSingular);
      return replaced;
    })
    .join('');
}

/**
 * Normalizes text by removing HTML tags, replacing deprecated tokens, and applying terminology.
 */
export function sanitizeCopyText(
  text?: string | null,
  terminology?: { singular?: string; plural?: string }
): string {
  if (!text) return '';
  // 1. Convert legacy deprecated variables
  let res = text
    .replace(/\{\{\s*school_name\s*\}\}/g, '{{entity_name}}')
    .replace(/\{\{\s*school_logo\s*\}\}/g, '{{org_logo_url}}')
    .replace(/\{\{\s*school_email\s*\}\}/g, '{{org_email}}')
    .replace(/\{\{\s*school_phone\s*\}\}/g, '{{org_phone}}')
    .replace(/\{\{\s*school_address\s*\}\}/g, '{{org_address}}');

  // 2. Strip and convert HTML tags (no HTML in textareas/preview)
  res = cleanRawHtmlTags(res);

  // 3. Enforce terminology rule ("Entity" -> terminology)
  res = replaceEntityWithTerminology(res, terminology);

  return res;
}

/**
 * Deeply sanitizes the full GenerateSurveyMessagingOutput payload.
 */
export function sanitizeSurveyMessagingOutput(
  output: GenerateSurveyMessagingOutput,
  terminology?: { singular?: string; plural?: string }
): GenerateSurveyMessagingOutput {
  const sanitize = (val?: string | null): string => (val ? sanitizeCopyText(val, terminology) : '');

  return {
    ...output,
    overallSummary: output.overallSummary ? sanitize(output.overallSummary) : output.overallSummary,
    email: output.email
      ? {
          ...output.email,
          name: sanitize(output.email.name),
          subject: sanitize(output.email.subject),
          body: sanitize(output.email.body),
          explanation: output.email.explanation ? sanitize(output.email.explanation) : undefined,
          blocks: (output.email.blocks || []).map((blk: EmailBlock) => ({
            ...blk,
            title: blk.title ? sanitize(blk.title) : blk.title,
            content: blk.content ? sanitize(blk.content) : blk.content,
            items: blk.items ? blk.items.map((item) => sanitize(item)) : blk.items,
            url: blk.url
              ?.replace(/\{\{\s*school_logo\s*\}\}/g, '{{org_logo_url}}')
              ?.replace(/\{\{\s*school_name\s*\}\}/g, '{{entity_name}}'),
            link: blk.link
              ?.replace(/\{\{\s*school_name\s*\}\}/g, '{{entity_name}}'),
          })),
        }
      : undefined,
    sms: output.sms
      ? {
          ...output.sms,
          name: sanitize(output.sms.name),
          body: sanitize(output.sms.body),
          explanation: output.sms.explanation ? sanitize(output.sms.explanation) : undefined,
        }
      : undefined,
    whatsapp: output.whatsapp
      ? {
          ...output.whatsapp,
          name: output.whatsapp.name,
          header: output.whatsapp.header ? sanitize(output.whatsapp.header) : undefined,
          body: sanitize(output.whatsapp.body),
          footer: output.whatsapp.footer ? sanitize(output.whatsapp.footer) : undefined,
          bodyParams: output.whatsapp.bodyParams
            ? output.whatsapp.bodyParams.map((p) => sanitize(p))
            : [],
          explanation: output.whatsapp.explanation ? sanitize(output.whatsapp.explanation) : undefined,
        }
      : undefined,
  };
}
