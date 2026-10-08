/**
 * @fileOverview Platform Auto-Documentation Generator (Phase 15 Milestone 4)
 *
 * Implements Rules 1, 4, 11, 25, 32, 33, 48, 67, 68, 69, and Roadmap §25.
 * Deterministically compiles runtime canonical `CapabilityDefinition` objects into:
 * 1. OpenAPI 3.1.0 specifications
 * 2. MCP 2026-07-28 tool manifests
 * 3. Markdown developer documentation & operator reference dossiers with FMEA strategies
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  canonicalCapabilityRegistryStore,
  type CapabilityRegistryStore,
} from '../../capabilities/registry/capability-registry';
import { type AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import { REGISTRY_FAILURE_MATRIX } from '../contracts/registry-types';

/** Regex patterns for scrubbing exposed credentials or internal secrets (Rules 32 & 33) */
const SECRET_REDACTION_PATTERNS: readonly RegExp[] = [
  /(?:sk|pk|api|token|secret)[-_][a-zA-Z0-9_-]{10,}/gi,
  /(?:bearer\s*:\s*)[a-zA-Z0-9._-]{10,}/gi,
  /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{20,}/gi,
];

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  paths: Record<
    string,
    {
      post: {
        summary: string;
        description: string;
        tags: string[];
        requestBody?: {
          required: boolean;
          content: Record<string, { schema: Record<string, unknown> }>;
        };
        responses: Record<string, { description: string; content?: Record<string, { schema: Record<string, unknown> }> }>;
        security: Array<Record<string, string[]>>;
      };
    }
  >;
  components: {
    securitySchemes: Record<string, Record<string, unknown>>;
  };
}

export interface McpToolManifest {
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
}

export interface DocGenerationFilterOptions {
  domain?: string;
  capabilityId?: string;
}

export class PlatformDocGenerator {
  private readonly store: CapabilityRegistryStore;

  constructor(store: CapabilityRegistryStore = canonicalCapabilityRegistryStore) {
    this.store = store;
  }

  /**
   * Linear non-backtracking credential redaction (Rules 32 & 33).
   */
  private redactSecrets(text: string): string {
    let sanitized = text;
    for (const pattern of SECRET_REDACTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
    }
    return sanitized;
  }

  /**
   * Converts Zod or arbitrary schema into standard JSON Schema object without external deps.
   */
  private schemaToJsonSchema(schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== 'object') {
      return { type: 'object', properties: {} };
    }

    const zodDef = (schema as { _def?: { typeName?: string; shape?: () => Record<string, unknown> } })._def;
    if (!zodDef) {
      return { type: 'object', properties: {} };
    }

    if (zodDef.typeName === 'ZodObject' && typeof zodDef.shape === 'function') {
      const shape = zodDef.shape();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const valDef = (value as { _def?: { typeName?: string; description?: string } })._def;
        const typeName = valDef?.typeName || 'ZodUnknown';
        const description = valDef?.description;

        let propType = 'string';
        if (typeName === 'ZodNumber') propType = 'number';
        if (typeName === 'ZodBoolean') propType = 'boolean';
        if (typeName === 'ZodArray') propType = 'array';
        if (typeName === 'ZodObject') propType = 'object';

        properties[key] = {
          type: propType,
          ...(description ? { description } : {}),
        };

        if (typeName !== 'ZodOptional' && typeName !== 'ZodNullable') {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
    }

    return { type: 'object', properties: {} };
  }

  /**
   * Compiles registered capabilities into an OpenAPI 3.1.0 specification (Roadmap §25).
   */
  public generateOpenApiSpec(options: DocGenerationFilterOptions = {}): OpenApiSpec {
    const capabilities = this.store.list();
    const paths: OpenApiSpec['paths'] = {};

    for (const cap of capabilities) {
      if (options.domain && cap.domain !== options.domain) {
        continue;
      }
      if (options.capabilityId && cap.id !== options.capabilityId) {
        continue;
      }

      const pathKey = `/api/v1/capabilities/${cap.id}`;
      const description = this.redactSecrets(cap.description || 'No description');
      const inputSchema = this.schemaToJsonSchema(cap.inputSchema);
      const outputSchema = this.schemaToJsonSchema(cap.outputSchema);

      paths[pathKey] = {
        post: {
          summary: cap.id,
          description: `${description} [Risk: ${cap.risk.level}${cap.risk.requiresHumanApproval ? ', Requires Approval' : ''}]`,
          tags: [cap.domain || 'general'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: inputSchema,
              },
            },
          },
          responses: {
            '200': {
              description: 'Successful capability execution',
              content: {
                'application/json': {
                  schema: outputSchema,
                },
              },
            },
            '400': { description: 'Bad Request / Schema Validation Failed' },
            '401': { description: 'Unauthorized / Missing Authentication Token' },
            '403': { description: 'Forbidden / Anti-IDOR or Policy Violation' },
            '500': { description: 'Internal Server Error' },
            '503': { description: 'Service Paused / Emergency Dead-Man Tripped' },
          },
          security: [{ BearerAuth: [] }],
        },
      };
    }

    return {
      openapi: '3.1.0',
      info: {
        title: 'SmartSapp Autonomous Platform API',
        version: '1.0.0',
        description:
          'Canonical OpenAPI 3.1.0 specification auto-generated from runtime CapabilityRegistry (Phase 15 Milestone 4 & Roadmap §25).',
      },
      paths,
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Clerk session JWT or delegated subagent authority token',
          },
        },
      },
    };
  }

  /**
   * Compiles registered capabilities into an MCP 2026-07-28 compliant tool manifest (Roadmap §25 & Rule 11).
   */
  public generateMcpManifest(options: DocGenerationFilterOptions = {}): McpToolManifest {
    const capabilities = this.store.list();
    const tools: McpToolManifest['tools'] = [];

    for (const cap of capabilities) {
      if (options.domain && cap.domain !== options.domain) {
        continue;
      }
      if (options.capabilityId && cap.id !== options.capabilityId) {
        continue;
      }

      tools.push({
        name: cap.id,
        description: this.redactSecrets(cap.description || ''),
        inputSchema: this.schemaToJsonSchema(cap.inputSchema),
      });
    }

    return { tools };
  }

  /**
   * Compiles a domain or single capability into a Markdown reference guide with FMEA strategies.
   */
  public generateDomainMarkdown(domain: string): string {
    const capabilities = this.store.list().filter((c) => (c.domain || 'general') === domain);
    const domainTitle = domain
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const lines: string[] = [
      `# ${domainTitle} Domain Capabilities`,
      '',
      '## Overview',
      `Auto-generated architectural reference guide for domain \`${domain}\`.`,
      `Contains ${capabilities.length} registered canonical capabilities.`,
      '',
      '## Capability Inventory',
      '',
      '| Capability ID | Version | Risk Level | Approval Required | Permissions |',
      '| :--- | :---: | :---: | :---: | :--- |',
    ];

    for (const cap of capabilities) {
      const perms = (cap.permissions || []).join(', ') || 'None';
      const approval = cap.risk.requiresHumanApproval ? 'Yes' : 'No';
      lines.push(`| \`${cap.id}\` | ${cap.version || '1.0.0'} | \`${cap.risk.level}\` | ${approval} | ${perms} |`);
    }

    lines.push('', '---', '', '## Capability Deep-Dives');

    for (const cap of capabilities) {
      const sanitizedDesc = this.redactSecrets(cap.description || 'No description provided');
      lines.push(
        '',
        `### \`${cap.id}\``,
        '',
        `**Description:** ${sanitizedDesc}`,
        '',
        `- **Risk Tier:** \`${cap.risk.level}\``,
        `- **Requires Human Approval:** ${cap.risk.requiresHumanApproval ? 'Yes' : 'No'}`,
        `- **Idempotency Required:** ${cap.policies?.requiresIdempotencyKey ? 'Yes' : 'No'}`,
        `- **Audit Trail Required:** ${cap.policies?.auditRequired ? 'Yes' : 'No'}`,
        `- **Required Scopes:** ${cap.permissions?.map((p) => `\`${p}\``).join(', ') || 'None'}`,
        '',
        '#### FMEA Recovery Strategy',
        `- **On Failure:** \`${REGISTRY_FAILURE_MATRIX.REGISTRY_CAPABILITY_NOT_FOUND.recoveryStrategy}\``,
        `- **HTTP Status:** \`${REGISTRY_FAILURE_MATRIX.REGISTRY_CAPABILITY_NOT_FOUND.httpStatus}\``
      );
    }

    return lines.join('\n');
  }
}

// Global Singleton Store with HMR Preservation (Rule 69)
declare global {
  // eslint-disable-next-line no-var
  var __smartsappPlatformDocGenerator: PlatformDocGenerator | undefined;
}

export function getPlatformDocGenerator(): PlatformDocGenerator {
  if (!globalThis.__smartsappPlatformDocGenerator) {
    globalThis.__smartsappPlatformDocGenerator = new PlatformDocGenerator();
  }
  return globalThis.__smartsappPlatformDocGenerator;
}
