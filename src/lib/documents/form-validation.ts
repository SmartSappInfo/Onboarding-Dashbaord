/**
 * PURPOSE: Single Source of Truth (SSOT) for PDF Form runtime validation.
 * ARCHITECTURAL CONTEXT:
 * Extracted from PdfFormRenderer to unify runtime validation across client-side
 * interactive forms, server action validation gates, and automated test suites.
 * 
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Modifying field validation constraints here directly impacts public signers
 *   and test suites simultaneously.
 * - Static text ('static-text') and dynamic variable tokens ('variable') MUST NEVER
 *   be required from the user; they are rendered purely as document overlays.
 * - Conforms strictly to Rule 4 (Zero any/any[]).
 */

import { z } from 'zod';
import type { PDFFormField } from '@/lib/types';

/**
 * Builds a dynamic Zod schema based on the configured fields of a PDF Form.
 * 
 * @param fields - Array of PDFFormField objects defined on the template
 * @returns ZodObject schema enforcing validation rules per field
 */
export function generateValidationSchema(
  fields: PDFFormField[]
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const schemaObject = fields.reduce<Record<string, z.ZodTypeAny>>((acc, field) => {
    // Non-input display overlays do not accept user input
    if (field.type === 'static-text' || field.type === 'variable') {
      return acc;
    }

    let fieldSchema: z.ZodTypeAny = z.string().optional().nullable().or(z.literal(''));

    if (field.type === 'email') {
      const emailSchema = z.string().email({ message: 'Please enter a valid email address.' });
      fieldSchema = field.required
        ? emailSchema
        : emailSchema.optional().nullable().or(z.literal(''));
    } else if (field.type === 'phone') {
      const phoneSchema = z.string().min(10, { message: 'Phone number must have at least 10 digits.' });
      fieldSchema = field.required
        ? phoneSchema
        : phoneSchema.optional().nullable().or(z.literal(''));
    } else if (field.required) {
      fieldSchema = z
        .string({ required_error: `${field.label || 'This field'} is required.` })
        .min(1, { message: `${field.label || 'This field'} is required.` });
    }

    acc[field.id] = fieldSchema;
    return acc;
  }, {});

  return z.object(schemaObject);
}
