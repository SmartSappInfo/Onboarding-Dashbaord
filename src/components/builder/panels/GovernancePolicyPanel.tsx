'use client';

/**
 * @fileOverview Panel 4: Governance & Policies Configuration (Phase 8 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 21: Mandatory human approval risk thresholds.
 * - Rule 23: Hard delegation depth ceilings (depth <= 4).
 * - Rule 60: Dead-man switch emergency pause awareness.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  RISK_LEVELS,
  type RiskLevel,
} from '@/platform/capabilities/contracts/risk-levels';
import type { GovernancePolicyConfig } from '@/platform/ui/builder/agent-builder-types';
import { Lock } from 'lucide-react';

export interface GovernancePolicyPanelProps {
  value: GovernancePolicyConfig;
  onChange: (value: GovernancePolicyConfig) => void;
  isBuiltIn?: boolean;
}

export function GovernancePolicyPanel({
  value,
  onChange,
  isBuiltIn = false,
}: GovernancePolicyPanelProps) {
  const toggleApprovalRisk = (risk: RiskLevel) => {
    if (isBuiltIn) return;
    const exists = value.mandatoryApprovalRiskLevels.includes(risk);
    let updated: RiskLevel[];
    if (exists) {
      updated = value.mandatoryApprovalRiskLevels.filter((r) => r !== risk);
    } else {
      updated = [...value.mandatoryApprovalRiskLevels, risk];
    }
    onChange({
      ...value,
      mandatoryApprovalRiskLevels: updated,
    });
  };

  const toggleEnvironment = (env: 'development' | 'staging' | 'production') => {
    if (isBuiltIn) return;
    const exists = value.allowedEnvironments.includes(env);
    let updated: Array<'development' | 'staging' | 'production'>;
    if (exists) {
      if (value.allowedEnvironments.length <= 1) return;
      updated = value.allowedEnvironments.filter((e) => e !== env);
    } else {
      updated = [...value.allowedEnvironments, env];
    }
    onChange({
      ...value,
      allowedEnvironments: updated,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Mandatory Approval Risk Gates (Rule 21) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mandatory Human Approval Risk Thresholds (Rule 21 Two-Phase Approval)
          </label>
          <Badge variant="outline" className="text-[10px]">
            {value.mandatoryApprovalRiskLevels.length} Intercepted
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {RISK_LEVELS.map((risk) => {
            const isChecked = value.mandatoryApprovalRiskLevels.includes(risk);
            return (
              <button
                key={risk}
                type="button"
                disabled={isBuiltIn}
                onClick={() => toggleApprovalRisk(risk)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 min-h-[44px] text-left transition-all active:scale-[0.97] ${
                  isChecked
                    ? 'border-purple-500/60 bg-purple-500/10 text-foreground font-medium'
                    : 'border-border/60 bg-card/60 hover:bg-muted/20 text-muted-foreground'
                }`}
              >
                <div
                  className={`flex h-4 w-4 shrink-0 rounded border mt-0.5 items-center justify-center ${
                    isChecked
                      ? 'border-purple-500 bg-purple-500 text-white'
                      : 'border-muted-foreground/40'
                  }`}
                >
                  {isChecked && <span className="text-[10px] leading-none">✓</span>}
                </div>
                <div>
                  <div className="text-xs font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                    {risk}
                    {isChecked && <Lock className="h-3 w-3 text-purple-500" />}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {risk === 'L3_EXTERNAL_COMMUNICATION_FINANCE' && 'Required for all outbound emails/payments'}
                    {risk === 'L4_PRIVILEGED_DESTRUCTIVE' && 'Required for deletions or permission alterations'}
                    {risk === 'L2_STATE_MUTATION' && 'Pauses on standard database record edits'}
                    {risk === 'L1_INTERNAL_DRAFT' && 'Pauses even for internal draft creation'}
                    {risk === 'L0_READ' && 'Pauses on search and queries'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Delegation Depth Ceiling (Rule 23) */}
      <div className="border-t border-border/60 pt-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Delegation Depth Ceiling (Rule 23)
              </label>
              <Badge variant="outline" className="font-mono text-xs">
                depth ≤ {value.delegationDepthCeiling}
              </Badge>
            </div>
            <Input
              type="number"
              min={1}
              max={4}
              step={1}
              disabled={isBuiltIn}
              value={value.delegationDepthCeiling}
              onChange={(e) =>
                onChange({
                  ...value,
                  delegationDepthCeiling: Math.max(1, Math.min(4, parseInt(e.target.value, 10) || 2)),
                })
              }
              className="rounded-xl min-h-[44px] text-xs font-mono"
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Hard platform constraint: Maximum allowed subagent delegation depth is 4 levels.
            </span>
          </div>

          {/* Allowed Environments */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
              Target Execution Environments
            </label>
            <div className="flex gap-2">
              {(['development', 'staging', 'production'] as const).map((env) => {
                const isSelected = value.allowedEnvironments.includes(env);
                return (
                  <button
                    key={env}
                    type="button"
                    disabled={isBuiltIn}
                    onClick={() => toggleEnvironment(env)}
                    className={`flex-1 rounded-xl border p-2.5 min-h-[44px] text-xs font-medium capitalize transition-all active:scale-[0.97] ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/70 bg-card hover:bg-muted/30 text-muted-foreground'
                    }`}
                  >
                    {env}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Environments where this agent persona is authorized to run.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
