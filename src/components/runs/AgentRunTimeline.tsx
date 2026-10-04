'use client';

/**
 * @fileOverview Granular Agent Run Execution Timeline Component (Phase 8 Milestone 2)
 *
 * Implements:
 * - Rule 4: Zero `any` / zero `any[]` typing policy.
 * - Rule 7: Mobile-first touch targets >= 44px with Emil Kowalski mechanical feel.
 * - Rule 10: Inline architectural documentation and pointers.
 * - Rule 13 & 30: Untrusted reference data containerization (`<untrusted_reference_data id="...">`).
 * - Rule 27: Formal Saga & Compensation state visualization.
 * - Rule 41: Explainability Standard (WHAT, WHY, EXPECTED STATE CHANGE).
 * - Rule 64: No raw HTML/CSS leakage; structured typography.
 */

import React, { useState } from 'react';
import {
  Brain,
  Search,
  Wrench,
  ShieldCheck,
  RefreshCw,
  UserCheck,
  Undo2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type { AgentStep, AgentStepType, AgentStepStatus } from '@/platform/runtime/agent-run-types';

export interface AgentRunTimelineProps {
  steps: AgentStep[];
  className?: string;
}

/**
 * Maps step type to designated Lucide icon
 */
function getStepTypeIcon(type: AgentStepType) {
  switch (type) {
    case 'planning':
      return <Brain className="h-4 w-4" />;
    case 'context_retrieval':
      return <Search className="h-4 w-4" />;
    case 'tool_call':
      return <Wrench className="h-4 w-4" />;
    case 'verification':
      return <ShieldCheck className="h-4 w-4" />;
    case 'replanning':
      return <RefreshCw className="h-4 w-4" />;
    case 'approval_wait':
      return <UserCheck className="h-4 w-4" />;
    case 'compensation':
      return <Undo2 className="h-4 w-4" />;
    case 'reflection':
      return <Sparkles className="h-4 w-4" />;
    default:
      return <HelpCircle className="h-4 w-4" />;
  }
}

/**
 * Maps step status to color styles
 */
function getStepStatusBadge(status: AgentStepStatus) {
  switch (status) {
    case 'completed':
      return {
        label: 'Completed',
        bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        icon: <CheckCircle2 className="h-3 w-3" />,
      };
    case 'running':
      return {
        label: 'Running',
        bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 animate-pulse',
        icon: <RefreshCw className="h-3 w-3 animate-spin" />,
      };
    case 'failed':
      return {
        label: 'Failed',
        bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
        icon: <AlertCircle className="h-3 w-3" />,
      };
    case 'skipped':
      return {
        label: 'Skipped',
        bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
        icon: <HelpCircle className="h-3 w-3" />,
      };
    case 'compensated':
      return {
        label: 'Compensated',
        bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
        icon: <Undo2 className="h-3 w-3" />,
      };
    case 'pending':
    default:
      return {
        label: 'Pending',
        bg: 'bg-muted text-muted-foreground border-border/80',
        icon: <Clock className="h-3 w-3" />,
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

export function AgentRunTimeline({ steps, className = '' }: AgentRunTimelineProps) {
  const [expandedStepIds, setExpandedStepIds] = useState<Record<string, boolean>>({});

  const toggleStep = (stepId: string) => {
    setExpandedStepIds((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  if (!steps || steps.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed rounded-xl bg-card/50 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">No execution steps recorded yet.</p>
        <p className="text-xs text-muted-foreground/80 mt-1">
          Execution steps will appear here as the agent plans and acts.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 font-figtree ${className}`}>
      <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/80 space-y-4">
        {steps.map((step) => {
          const isExpanded = !!expandedStepIds[step.stepId];
          const statusBadge = getStepStatusBadge(step.status);
          const typeIcon = getStepTypeIcon(step.type);

          return (
            <div key={step.stepId} className="relative group">
              {/* Timeline Node Icon Anchor */}
              <div
                className={`absolute -left-6 sm:-left-8 top-1.5 h-6 w-6 sm:h-7 sm:w-7 rounded-full border flex items-center justify-center bg-card shadow-sm z-10 transition-transform group-hover:scale-105 ${statusBadge.bg}`}
              >
                {typeIcon}
              </div>

              {/* Step Card */}
              <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden transition-all duration-200 hover:border-primary/40">
                {/* Header Toggle (min-h-[44px] Rule 7) */}
                <button
                  type="button"
                  onClick={() => toggleStep(step.stepId)}
                  className="w-full min-h-[44px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-muted/30 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary active:scale-[0.99]"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border shrink-0">
                      #{step.stepIndex + 1}
                    </span>
                    <span className="text-sm font-semibold text-foreground truncate">
                      {step.title}
                    </span>
                    {step.capabilityId && (
                      <span className="font-mono text-xs text-primary/80 bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shrink-0 hidden sm:inline-block">
                        {step.capabilityId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {step.durationMs !== undefined && (
                      <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {step.durationMs}ms
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${statusBadge.bg}`}
                    >
                      {statusBadge.icon}
                      <span>{statusBadge.label}</span>
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded Step Body */}
                {isExpanded && (
                  <div className="px-4 py-3.5 border-t border-border/60 bg-muted/10 space-y-3.5 text-xs">
                    {/* Explainability Section (Rule 41) */}
                    {(step.what || step.why || step.expectedStateChange) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-lg bg-card border border-border/60">
                        {step.what && (
                          <div>
                            <span className="font-semibold text-muted-foreground block mb-0.5">
                              WHAT WAS DONE
                            </span>
                            <span className="text-foreground">{step.what}</span>
                          </div>
                        )}
                        {step.why && (
                          <div>
                            <span className="font-semibold text-muted-foreground block mb-0.5">
                              WHY IT WAS NEEDED
                            </span>
                            <span className="text-foreground">{step.why}</span>
                          </div>
                        )}
                        {step.expectedStateChange && (
                          <div>
                            <span className="font-semibold text-muted-foreground block mb-0.5">
                              EXPECTED CHANGE
                            </span>
                            <span className="text-foreground">{step.expectedStateChange}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step Input (Untrusted Container Rule 13 & 30) */}
                    {step.input && Object.keys(step.input).length > 0 && (
                      <div>
                        <span className="font-semibold text-muted-foreground block mb-1">
                          INPUT PARAMETERS
                        </span>
                        <UntrustedReferenceData id={`step_input_${step.stepId}`}>
                          <pre className="font-mono text-xs overflow-x-auto p-2.5 rounded-lg bg-muted/40 border border-border/60 text-foreground">
                            {JSON.stringify(step.input, null, 2)}
                          </pre>
                        </UntrustedReferenceData>
                      </div>
                    )}

                    {/* Step Output (Untrusted Container Rule 13 & 30) */}
                    {step.output && (
                      <div>
                        <span className="font-semibold text-muted-foreground block mb-1">
                          EXECUTION RESULT
                        </span>
                        <UntrustedReferenceData id={`step_output_${step.stepId}`}>
                          <pre className="font-mono text-xs overflow-x-auto p-2.5 rounded-lg bg-muted/40 border border-border/60 text-foreground">
                            {typeof step.output === 'object'
                              ? JSON.stringify(step.output, null, 2)
                              : String(step.output)}
                          </pre>
                        </UntrustedReferenceData>
                      </div>
                    )}

                    {/* Error Diagnostics (Rule 48) */}
                    {step.sanitizedError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
                        <span className="font-semibold block mb-0.5">STEP ERROR</span>
                        <p className="font-mono text-xs">{step.sanitizedError.message}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
