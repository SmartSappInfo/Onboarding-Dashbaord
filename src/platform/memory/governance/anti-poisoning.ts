/**
 * @fileOverview Knowledge Poisoning & Prompt Injection Defense Engine
 *
 * ARCHITECTURAL MANDATE (Rules 13 & 30):
 * 1. Retrieved memory documents are treated strictly as UNTRUSTED DATA, never as executable instructions.
 * 2. Pre-retrieval scanner detects instruction overrides, jailbreaks, and delimiter evasions.
 * 3. Sanitizer redacts hostile directives while preserving underlying domain entities and facts.
 * 4. All retrieved external text is wrapped in canonical XML isolation container:
 *    `<untrusted_reference_data source="..." id="..." sensitivity="...">\n...\n</untrusted_reference_data>`
 *
 * @testability Covered in `src/platform/__tests__/memory/anti-poisoning.test.ts`.
 */

import { SensitivityLevel } from '../contracts/memory-types';

export interface InjectionPattern {
  id: string;
  regex: RegExp;
  weight: number;
}

const INJECTION_PATTERNS: InjectionPattern[] = [
  {
    id: 'ignore_previous_instructions',
    regex: /ignore\s+(all\s+)?(previous|prior)\s+(instructions|directions|prompts|rules)/i,
    weight: 0.8,
  },
  {
    id: 'disregard_prior_rules',
    regex: /disregard\s+(all\s+)?(prior|previous|existing)\s+(rules|guidelines|context|directions|instructions|prompts)/i,
    weight: 0.8,
  },
  {
    id: 'system_prompt_declaration',
    regex: /(system\s*prompt\s*:|<\s*system\s*>|\[\s*system\s*\])/i,
    weight: 0.9,
  },
  {
    id: 'developer_mode_override',
    regex: /(you\s+are\s+now\s+in\s+developer\s+mode|dan\s+mode|jailbreak|bypass\s+safety)/i,
    weight: 0.95,
  },
  {
    id: 'reveal_hidden_prompt',
    regex: /(reveal|print|output|display)\s+(your\s+)?(system\s+prompt|initial\s+instructions)/i,
    weight: 0.7,
  },
  {
    id: 'script_markup_injection',
    regex: /<\s*(script|iframe|object|embed)[^>]*>/i,
    weight: 0.9,
  },
];

export interface MemoryRiskAssessment {
  isSafe: boolean;
  riskScore: number;
  detectedPatterns: string[];
  sanitized: string;
}

export function evaluateMemoryContentRisk(content: string): MemoryRiskAssessment {
  if (!content || typeof content !== 'string') {
    return { isSafe: true, riskScore: 0, detectedPatterns: [], sanitized: '' };
  }

  const detected: string[] = [];
  let totalScore = 0;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.regex.test(content)) {
      detected.push(pattern.id);
      totalScore = Math.max(totalScore, pattern.weight);
    }
  }

  const sanitized = sanitizeMemoryContent(content);
  return {
    isSafe: detected.length === 0,
    riskScore: totalScore,
    detectedPatterns: detected,
    sanitized,
  };
}

export function sanitizeMemoryContent(content: string): string {
  let cleaned = content;
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(new RegExp(pattern.regex, 'gi'), '[REDACTED_INSTRUCTION]');
  }
  return cleaned;
}

export interface UntrustedReferenceOptions {
  content: string;
  sourceType: string;
  sourceId: string;
  sensitivity?: SensitivityLevel;
}

export function wrapUntrustedReference(options: UntrustedReferenceOptions): string {
  const { content, sourceType, sourceId, sensitivity = 'internal' } = options;
  const sanitized = sanitizeMemoryContent(content);
  return `<untrusted_reference_data source="${sourceType}" id="${sourceId}" sensitivity="${sensitivity}">\n${sanitized}\n</untrusted_reference_data>`;
}
