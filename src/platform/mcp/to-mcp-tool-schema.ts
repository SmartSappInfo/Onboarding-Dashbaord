/**
 * @fileOverview Zod v4 / SchemaParser → MCP SDK v2 tool-schema adapter (Phase 0 / Phase 5)
 *
 * MCP SDK v2 `registerTool` accepts a Standard Schema that also implements
 * `~standard.jsonSchema` (StandardJSONSchemaV1). Zod added that in 4.2.0; this repo's
 * `zod@3.25` ships the v4 API under `zod/v4` without it. This adapter supplies the JSON Schema
 * converter via `z.toJSONSchema`, so we pass WHOLE schema objects (not deprecated raw shapes)
 * with no casts (Rule 4).
 *
 * For bridged legacy tools implementing `SchemaParser`, this adapter provides a fallback StandardSchema
 * that invokes `.safeParse()`.
 *
 * CAUTION: delete this adapter once the app upgrades to zod >= 4.2 — the schemas then satisfy
 * `StandardSchemaWithJSON` natively.
 */

import type { StandardSchemaWithJSON } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import type { SchemaParser } from '../capabilities/contracts/capability-definition';

type JsonSchemaTarget = 'draft-2020-12' | 'draft-07' | 'openapi-3.0' | (object & string);

/** zod 3.25 supports draft-7 and draft-2020-12; anything else falls back to 2020-12. */
function toZodTarget(target: JsonSchemaTarget): 'draft-7' | 'draft-2020-12' {
  return target === 'draft-07' ? 'draft-7' : 'draft-2020-12';
}

export function toMcpToolSchema<Output, Input>(
  schema: z.ZodType<Output, Input> | SchemaParser<Output>
): StandardSchemaWithJSON<Input, Output> {
  if (
    '~standard' in schema &&
    schema['~standard'] !== null &&
    typeof schema['~standard'] === 'object'
  ) {
    const zSchema = schema as z.ZodType<Output, Input>;
    const standard = zSchema['~standard'];
    return {
      '~standard': {
        version: standard.version,
        vendor: standard.vendor,
        validate: standard.validate,
        jsonSchema: {
          input: ({ target }) => ({ ...z.toJSONSchema(zSchema, { target: toZodTarget(target), io: 'input' }) }),
          output: ({ target }) => ({ ...z.toJSONSchema(zSchema, { target: toZodTarget(target), io: 'output' }) }),
        },
      },
    };
  }

  // Fallback for bridged legacy tool schemas implementing SchemaParser
  return {
    '~standard': {
      version: 1,
      vendor: 'smartsapp-legacy-parser',
      validate: (value: unknown) => {
        const result = schema.safeParse(value);
        if (result.success) {
          return { value: result.data as Output };
        }
        return {
          issues: result.error?.issues.map((i) => ({
            message: i.message,
            path: i.path,
          })) || [{ message: 'Validation failed' }],
        };
      },
      jsonSchema: {
        input: () => ({ type: 'object' }),
        output: () => ({ type: 'object' }),
      },
    },
  };
}
