'use client';

/**
 * @fileOverview Panel 5: Models & Budgets Configuration (Phase 8 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 23: Resource ceilings (tokens <= 100k, tool calls <= 30).
 * - Rule 58: Tiered model routing (Flash / Pro) with automatic fallback.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  type ModelsBudgetsConfig,
  type ModelTier,
  type FallbackModelTier,
} from '@/platform/ui/builder/agent-builder-types';
import { Zap, Sparkles, Coins, Clock, Wrench, Database } from 'lucide-react';

export interface ModelsBudgetsPanelProps {
  value: ModelsBudgetsConfig;
  onChange: (value: ModelsBudgetsConfig) => void;
  isBuiltIn?: boolean;
}

export function ModelsBudgetsPanel({
  value,
  onChange,
  isBuiltIn = false,
}: ModelsBudgetsPanelProps) {
  const handlePrimaryModelChange = (tier: ModelTier) => {
    if (isBuiltIn) return;
    onChange({
      ...value,
      primaryModelTier: tier,
    });
  };

  const handleFallbackModelChange = (tier: FallbackModelTier) => {
    if (isBuiltIn) return;
    onChange({
      ...value,
      fallbackModelTier: tier,
    });
  };

  const handleBudgetChange = <K extends keyof ModelsBudgetsConfig['budgets']>(
    field: K,
    val: ModelsBudgetsConfig['budgets'][K]
  ) => {
    if (isBuiltIn) return;
    onChange({
      ...value,
      budgets: {
        ...value.budgets,
        [field]: val,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Model Tier Selection (Rule 58) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Primary Model Tier */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
            Primary Model Tier (Rule 58)
          </label>
          <div className="flex gap-2">
            {(['flash', 'pro'] as const).map((tier) => {
              const isSelected = value.primaryModelTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  disabled={isBuiltIn}
                  onClick={() => handlePrimaryModelChange(tier)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border p-3 min-h-[44px] text-xs font-medium capitalize transition-all active:scale-[0.97] ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border/70 bg-card hover:bg-muted/30 text-muted-foreground'
                  }`}
                >
                  {tier === 'flash' ? (
                    <Zap className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-purple-500" />
                  )}
                  <span>{tier === 'flash' ? 'Gemini 2.5 Flash' : 'Gemini 2.5 Pro'}</span>
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Flash provides high-speed sub-500ms execution. Pro provides deep strategic reasoning.
          </span>
        </div>

        {/* Fallback Model Tier */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
            Degradation Fallback Tier (Rule 24 & 58)
          </label>
          <div className="flex gap-2">
            {(['flash', 'none'] as const).map((tier) => {
              const isSelected = value.fallbackModelTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  disabled={isBuiltIn}
                  onClick={() => handleFallbackModelChange(tier)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border p-3 min-h-[44px] text-xs font-medium capitalize transition-all active:scale-[0.97] ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border/70 bg-card hover:bg-muted/30 text-muted-foreground'
                  }`}
                >
                  <span>{tier === 'flash' ? 'Flash Fallback' : 'Fail Closed'}</span>
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Automatic downgrade when primary tier circuit breaker trips.
          </span>
        </div>
      </div>

      {/* 2. Resource Budget Ceilings (Rule 23) */}
      <div className="border-t border-border/60 pt-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Execution Resource Budget Ceilings (Rule 23)
          </label>
          <Badge variant="outline" className="text-[10px]">
            Hard Ceilings Enforced
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Max Tokens */}
          <div>
            <div className="flex items-center gap-1.5 mb-1 text-xs font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Max Tokens / Run (≤ 100k)</span>
            </div>
            <Input
              type="number"
              min={1000}
              max={100000}
              step={1000}
              disabled={isBuiltIn}
              value={value.budgets.maxTokens}
              onChange={(e) =>
                handleBudgetChange(
                  'maxTokens',
                  Math.max(1000, Math.min(100000, parseInt(e.target.value, 10) || 50000))
                )
              }
              className="rounded-xl min-h-[44px] text-xs font-mono"
            />
          </div>

          {/* Max Tool Calls */}
          <div>
            <div className="flex items-center gap-1.5 mb-1 text-xs font-medium text-muted-foreground">
              <Wrench className="h-3.5 w-3.5 text-blue-500" />
              <span>Max Tool Calls / Run (≤ 30)</span>
            </div>
            <Input
              type="number"
              min={1}
              max={30}
              step={1}
              disabled={isBuiltIn}
              value={value.budgets.maxToolCalls}
              onChange={(e) =>
                handleBudgetChange(
                  'maxToolCalls',
                  Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 15))
                )
              }
              className="rounded-xl min-h-[44px] text-xs font-mono"
            />
          </div>

          {/* Max Duration */}
          <div>
            <div className="flex items-center gap-1.5 mb-1 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-purple-500" />
              <span>Max Duration ms (≤ 300s)</span>
            </div>
            <Input
              type="number"
              min={1000}
              max={300000}
              step={5000}
              disabled={isBuiltIn}
              value={value.budgets.maxDurationMs}
              onChange={(e) =>
                handleBudgetChange(
                  'maxDurationMs',
                  Math.max(1000, Math.min(300000, parseInt(e.target.value, 10) || 120000))
                )
              }
              className="rounded-xl min-h-[44px] text-xs font-mono"
            />
          </div>

          {/* Max Records Mutated */}
          <div>
            <div className="flex items-center gap-1.5 mb-1 text-xs font-medium text-muted-foreground">
              <Database className="h-3.5 w-3.5 text-emerald-500" />
              <span>Max Records Mutated (≤ 100)</span>
            </div>
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              disabled={isBuiltIn}
              value={value.budgets.maxRecordsMutated}
              onChange={(e) =>
                handleBudgetChange(
                  'maxRecordsMutated',
                  Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 25))
                )
              }
              className="rounded-xl min-h-[44px] text-xs font-mono"
            />
          </div>

          {/* Cost Budget USD */}
          <div>
            <div className="flex items-center gap-1.5 mb-1 text-xs font-medium text-muted-foreground">
              <Coins className="h-3.5 w-3.5 text-rose-500" />
              <span>Max Cost USD / Run (≤ $100)</span>
            </div>
            <Input
              type="number"
              min={0.01}
              max={100.0}
              step={0.5}
              disabled={isBuiltIn}
              value={value.budgets.costBudgetUsd}
              onChange={(e) =>
                handleBudgetChange(
                  'costBudgetUsd',
                  Math.max(0.01, Math.min(100.0, parseFloat(e.target.value) || 5.0))
                )
              }
              className="rounded-xl min-h-[44px] text-xs font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
