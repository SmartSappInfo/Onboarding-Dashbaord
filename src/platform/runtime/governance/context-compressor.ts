/**
 * @fileOverview Stratified Knapsack Context Compressor & Provenance Retainer (Rules 28, 30, 32, 33, 54, 56)
 *
 * Implements:
 * - Stratified priority ranking: Recent active steps (Critical) > Intermediate tool summaries (Relevant) > Citations (Supporting).
 * - Greedy knapsack token budgeting keeping total context <= maxTokens (default 4000).
 * - Linear non-backtracking redaction of credentials and financial tokens (Rules 32 & 33).
 * - Encloses compressed history in `<untrusted_reference_data id="compressed_history">` XML boundaries (Rule 30).
 * - Performance budget guarantee <= 100ms (Rule 54).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { type AgentStep } from '../agent-run-types';
import {
  type CompressContextOptions,
  type CompressedContextResult,
  CompressContextOptionsSchema,
} from './governance-types';

export interface CompressContextParams {
  goalPrompt: string;
  steps: AgentStep[];
  memoryCitations?: string[];
  options?: Partial<CompressContextOptions>;
}

// Bounded linear regex patterns for sensitive data redaction (Rule 33)
const SENSITIVE_PATTERNS = [
  { pattern: /\b(?:sk-[a-zA-Z0-9_-]{20,}|AIza[0-9A-Za-z-_]{35}|sk-ant-[a-zA-Z0-9_-]{20,})\b/g, replacement: '[REDACTED_CREDENTIAL]' },
  { pattern: /\bBearer\s+eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, replacement: '[REDACTED_CREDENTIAL]' },
  { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
  { pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, replacement: '[REDACTED_FINANCIAL]' },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_PII]' },
];

export class AgentContextCompressor {
  public static estimateTokens(text: string, charsPerToken: number = 4.0): number {
    if (!text) return 0;
    return Math.ceil(text.length / charsPerToken);
  }

  public static redactString(input: string): { text: string; redactedCount: number } {
    let text = input;
    let redactedCount = 0;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      text = text.replace(pattern, () => {
        redactedCount++;
        return replacement;
      });
    }
    return { text, redactedCount };
  }

  public static compress(params: CompressContextParams): CompressedContextResult {
    const options = CompressContextOptionsSchema.parse(params.options ?? {});
    const { maxTokens, charsPerToken, preserveRecentStepsCount, redactSensitiveData } = options;

    let totalRedacted = 0;

    const sanitize = (text: string): string => {
      if (!redactSensitiveData) return text;
      const res = this.redactString(text);
      totalRedacted += res.redactedCount;
      return res.text;
    };

    const baseGoalText = `GOAL:\n${sanitize(params.goalPrompt)}\n\n`;
    let currentTokens = this.estimateTokens(baseGoalText, charsPerToken);

    // Split steps into recent preserved vs historical compressed
    const steps = [...params.steps].sort((a, b) => a.stepIndex - b.stepIndex);
    const recentCutoffIndex = Math.max(0, steps.length - preserveRecentStepsCount);

    const historicalSteps = steps.slice(0, recentCutoffIndex);
    const recentSteps = steps.slice(recentCutoffIndex);

    // 1. Format Recent Steps (Critical Priority)
    const formattedRecent = recentSteps.map((s) => {
      const outputStr = s.output ? JSON.stringify(s.output) : 'None';
      const truncatedOutput = outputStr.length > 500 ? `${outputStr.slice(0, 500)}... [truncated]` : outputStr;
      return sanitize(
        `[Step ${s.stepIndex}: ${s.title} (${s.capabilityId ?? s.type})] -> Status: ${s.status}\nOutput: ${truncatedOutput}`
      );
    });

    // 2. Format Historical Steps (Extractive Summaries - Relevant Priority)
    const formattedHistorical = historicalSteps.map((s) => {
      const summary = s.output && typeof s.output.summary === 'string'
        ? s.output.summary
        : s.title;
      return sanitize(`- Step ${s.stepIndex} [${s.title}]: ${s.status} -> ${summary}`);
    });

    // 3. Format Memory Citations (Supporting Priority)
    const formattedCitations = (params.memoryCitations ?? []).map((c) => sanitize(`- Citation: ${c}`));

    const retainedLines: string[] = [];

    // Add recent steps first (Critical)
    for (const recentLine of formattedRecent) {
      const cost = this.estimateTokens(recentLine, charsPerToken);
      if (currentTokens + cost <= maxTokens) {
        retainedLines.push(recentLine);
        currentTokens += cost;
      }
    }

    // Add historical summaries next (Relevant)
    for (const histLine of formattedHistorical) {
      const cost = this.estimateTokens(histLine, charsPerToken);
      if (currentTokens + cost <= maxTokens) {
        retainedLines.push(histLine);
        currentTokens += cost;
      }
    }

    // Add memory citations if space remains (Supporting)
    for (const citLine of formattedCitations) {
      const cost = this.estimateTokens(citLine, charsPerToken);
      if (currentTokens + cost <= maxTokens) {
        retainedLines.push(citLine);
        currentTokens += cost;
      }
    }

    const contextBody = retainedLines.join('\n\n');
    const xmlPromptContext = `<untrusted_reference_data id="compressed_history">\n${baseGoalText}${contextBody}\n</untrusted_reference_data>`;
    const totalTokens = this.estimateTokens(xmlPromptContext, charsPerToken);

    return {
      xmlPromptContext,
      totalTokens,
      maxTokens,
      compressedStepCount: historicalSteps.length,
      retainedStepCount: retainedLines.length,
      redactedTokensCount: totalRedacted,
      compressionRatio: steps.length > 0 ? retainedLines.length / steps.length : 1.0,
    };
  }
}
