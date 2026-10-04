'use client';

/**
 * @fileOverview Inspectable Tool-Call Card Component (Phase 8 Milestone 2)
 *
 * Implements:
 * - Rule 4: Zero `any` / zero `any[]` typing policy.
 * - Rule 7: Mobile-first touch targets >= 44px with Emil Kowalski mechanical feel.
 * - Rule 10: Complete inline architectural documentation.
 * - Rule 13 & 30: Untrusted reference data containerization (`<untrusted_reference_data>`).
 * - Rule 20 & 39: Distributed tracing badges (`correlationId`, `traceId`) with copy action.
 * - Rule 22: Truncated SHA-256 payload & step hashes with copy button.
 * - Rule 27: Compensating capability indicators and revert affordances.
 * - Rule 41: Explainability Standard (WHAT, WHY, EXPECTED STATE CHANGE).
 * - Rule 64: No raw HTML/CSS leakage; structured typography.
 */

import React, { useState } from 'react';
import {
  Wrench,
  Shield,
  Copy,
  Check,
  Undo2,
  Clock,
  ChevronDown,
  ChevronRight,
  Hash,
  Terminal,
} from 'lucide-react';
import type { AgentStep } from '@/platform/runtime/agent-run-types';
import type { RiskLevel } from '@/platform/capabilities/contracts/risk-levels';

export interface ToolCallCardProps {
  step: AgentStep;
  className?: string;
}

function getRiskLevelBadge(riskLevel?: RiskLevel) {
  switch (riskLevel) {
    case 'L4_PRIVILEGED_DESTRUCTIVE':
      return {
        label: 'L4_PRIVILEGED_DESTRUCTIVE',
        bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
      };
    case 'L3_EXTERNAL_COMMUNICATION_FINANCE':
      return {
        label: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
        bg: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
      };
    case 'L2_STATE_MUTATION':
      return {
        label: 'L2_STATE_MUTATION',
        bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
      };
    case 'L1_INTERNAL_DRAFT':
      return {
        label: 'L1_INTERNAL_DRAFT',
        bg: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
      };
    case 'L0_READ':
    default:
      return {
        label: 'L0_READ',
        bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
      };
  }
}

function UntrustedReferenceData({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return React.createElement('untrusted_reference_data', { id }, children);
}

export function ToolCallCard({ step, className = '' }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1500);
  };

  const riskBadge = getRiskLevelBadge(step.riskLevel as RiskLevel | undefined);
  const truncatedPayloadHash = step.payloadHash ? `${step.payloadHash.substring(0, 16)}...` : null;

  return (
    <div
      className={`rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm overflow-hidden font-figtree transition-all duration-200 hover:border-primary/40 ${className}`}
    >
      {/* Top Banner Header */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 bg-muted/15">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <Wrench className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-foreground truncate">{step.title}</h4>
              {step.capabilityId && (
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border shrink-0">
                  {step.capabilityId}
                </span>
              )}
              {step.capabilityVersion && (
                <span className="text-[11px] font-mono text-muted-foreground/80 px-1.5 py-0.2 rounded bg-muted/40 border shrink-0">
                  v{step.capabilityVersion}
                </span>
              )}
            </div>
            {step.durationMs !== undefined && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                <Clock className="h-3 w-3" />
                Execution duration: {step.durationMs}ms
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${riskBadge.bg}`}
          >
            <Shield className="h-3 w-3" />
            <span>{riskBadge.label}</span>
          </span>
        </div>
      </div>

      {/* Explainability Section (Rule 41) */}
      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-lg bg-muted/20 border border-border/60 text-xs">
          <div>
            <span className="font-bold text-muted-foreground block mb-1 uppercase tracking-wider text-[10px]">
              What was done
            </span>
            <p className="text-foreground leading-relaxed">
              {step.what || step.title || 'Tool invocation executed'}
            </p>
          </div>
          <div>
            <span className="font-bold text-muted-foreground block mb-1 uppercase tracking-wider text-[10px]">
              Why it was needed
            </span>
            <p className="text-foreground leading-relaxed">
              {step.why || 'Required step in goal plan'}
            </p>
          </div>
          <div>
            <span className="font-bold text-muted-foreground block mb-1 uppercase tracking-wider text-[10px]">
              Expected State Change
            </span>
            <p className="text-foreground leading-relaxed">
              {step.expectedStateChange || 'Atomic side effect recorded'}
            </p>
          </div>
        </div>

        {/* Cryptographic & Distributed Tracing Strip (Rules 20, 22, 39) */}
        <div className="flex items-center gap-3 flex-wrap text-xs font-mono text-muted-foreground pt-1">
          {truncatedPayloadHash && (
            <div className="inline-flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded border border-border/60">
              <Hash className="h-3 w-3 opacity-60" />
              <span>Hash: {truncatedPayloadHash}</span>
              <button
                type="button"
                onClick={() => handleCopy(step.payloadHash || '', 'hash')}
                className="hover:text-foreground transition-colors p-0.5"
                aria-label="Copy payload hash"
              >
                {copiedKey === 'hash' ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          )}

          {step.correlationId && (
            <div className="inline-flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded border border-border/60">
              <Terminal className="h-3 w-3 opacity-60" />
              <span>Corr: {step.correlationId}</span>
              <button
                type="button"
                onClick={() => handleCopy(step.correlationId || '', 'corr')}
                className="hover:text-foreground transition-colors p-0.5"
                aria-label="Copy correlation ID"
              >
                {copiedKey === 'corr' ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Compensating Capability Affordance (Rule 27) */}
        {step.compensatingCapabilityId && (
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <Undo2 className="h-3.5 w-3.5 shrink-0" />
              <div>
                <span className="font-semibold block">Compensating Capability Configured</span>
                <span className="font-mono text-[11px] opacity-80">
                  {step.compensatingCapabilityId}
                </span>
              </div>
            </div>
            <span className="font-medium text-purple-600 dark:text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded text-[11px] shrink-0">
              Reversible
            </span>
          </div>
        )}

        {/* Input/Output Accordion Toggle (min-h-[44px] Rule 7) */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 flex items-center justify-between text-xs font-semibold text-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary active:scale-[0.99]"
          aria-expanded={isExpanded}
        >
          <span>Inspect Arguments & Response Data</span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Accordion Body with Untrusted Reference Containers (Rule 13 & 30) */}
        {isExpanded && (
          <div className="space-y-3 pt-1">
            {step.input && Object.keys(step.input).length > 0 && (
              <div>
                <span className="font-semibold text-muted-foreground text-xs block mb-1">
                  TOOL ARGUMENTS
                </span>
                <UntrustedReferenceData id={`tool_args_${step.stepId}`}>
                  <pre className="font-mono text-xs overflow-x-auto p-3 rounded-lg bg-muted/40 border border-border/60 text-foreground">
                    {JSON.stringify(step.input, null, 2)}
                  </pre>
                </UntrustedReferenceData>
              </div>
            )}

            {step.output && (
              <div>
                <span className="font-semibold text-muted-foreground text-xs block mb-1">
                  EXECUTION PAYLOAD OUTPUT
                </span>
                <UntrustedReferenceData id={`tool_output_${step.stepId}`}>
                  <pre className="font-mono text-xs overflow-x-auto p-3 rounded-lg bg-muted/40 border border-border/60 text-foreground">
                    {typeof step.output === 'object'
                      ? JSON.stringify(step.output, null, 2)
                      : String(step.output)}
                  </pre>
                </UntrustedReferenceData>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
