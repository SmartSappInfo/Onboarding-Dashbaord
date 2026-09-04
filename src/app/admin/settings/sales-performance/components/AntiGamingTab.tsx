'use client';

/**
 * @fileoverview Anti-Gaming Safeguards Tab for Performance Policy Studio (Phase 4).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 22 Anti-Gaming safeguards:
 * 1. Tiered Daily Volume Caps: Full points up to Tier 1, 50% up to Tier 2, 0% beyond.
 * 2. Rapid Repetition Cooldown: Prevents spamming touchpoints on the same contact.
 * 3. Minimum Call Duration Hurdle: Zero effort points for calls under threshold.
 * 4. Execution Standards: Mandatory notes and automated machine exclusions.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Controls enforce >= 44px touch envelopes.
 * - Micro-interactions use active:scale-[0.97].
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  Clock,
  ZapOff,
  Flame,
  FileCheck,
  Bot,
  Info,
} from 'lucide-react';
import type { AntiGamingPolicy, TieredDailyCap } from '@/lib/policy-studio/types';

interface AntiGamingTabProps {
  antiGaming: AntiGamingPolicy;
  onChange: (updated: AntiGamingPolicy) => void;
}

export function AntiGamingTab({ antiGaming, onChange }: AntiGamingTabProps) {
  const callCap = antiGaming.tieredDailyCaps.find((c) => c.eventType === 'phone_call_completed') || {
    eventType: 'phone_call_completed',
    tier1Limit: 40,
    tier1Rate: 1.0,
    tier2Limit: 70,
    tier2Rate: 0.5,
    tier3Rate: 0.0,
  };

  const handleUpdateCallCap = (updates: Partial<TieredDailyCap>) => {
    const updatedCap: TieredDailyCap = { ...callCap, ...updates };
    const otherCaps = antiGaming.tieredDailyCaps.filter((c) => c.eventType !== 'phone_call_completed');
    onChange({
      ...antiGaming,
      tieredDailyCaps: [...otherCaps, updatedCap],
    });
  };

  return (
    <div className="space-y-6 max-w-4xl text-left">
      {/* Informational Banner */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-foreground">
            Preserve Performance Integrity
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Anti-gaming rules protect your commission structure and leaderboard credibility by capping spammy repetitive actions, ensuring meaningful conversation length, and excluding automated machine scripts.
          </p>
        </div>
      </div>

      {/* 1. Tiered Daily Call Caps */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-5 space-y-4">
        <CardHeader className="p-0 space-y-1">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base font-bold">Tiered Daily Call Caps</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Dampens effort points for representatives executing abnormally high volumes of outbound calls in a single working day.
          </CardDescription>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Tier 1 */}
          <div className="p-4 rounded-xl border bg-background space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Tier 1 Limit</span>
              <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                100% Value
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="10"
                max="200"
                value={callCap.tier1Limit}
                onChange={(e) =>
                  handleUpdateCallCap({ tier1Limit: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
                className="h-10 text-xs font-bold font-mono text-center w-24"
              />
              <span className="text-xs font-medium text-muted-foreground">calls / day</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Calls up to this volume receive full effort currency.
            </p>
          </div>

          {/* Tier 2 */}
          <div className="p-4 rounded-xl border bg-background space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Tier 2 Limit</span>
              <Badge variant="outline" className="text-[10px] font-bold text-amber-600 bg-amber-500/10 border-amber-500/20">
                50% Value
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="20"
                max="300"
                value={callCap.tier2Limit}
                onChange={(e) =>
                  handleUpdateCallCap({ tier2Limit: Math.max(callCap.tier1Limit + 1, parseInt(e.target.value, 10) || 1) })
                }
                className="h-10 text-xs font-bold font-mono text-center w-24"
              />
              <span className="text-xs font-medium text-muted-foreground">calls / day</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Calls beyond Tier 1 earn half points to discourage rapid dialing.
            </p>
          </div>

          {/* Tier 3 */}
          <div className="p-4 rounded-xl border bg-background space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Tier 3 Ceiling</span>
              <Badge variant="outline" className="text-[10px] font-bold text-rose-600 bg-rose-500/10 border-rose-500/20">
                0% Value
              </Badge>
            </div>
            <div className="h-10 flex items-center">
              <span className="text-xs font-bold text-muted-foreground font-mono">
                &gt; {callCap.tier2Limit} calls
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Calls beyond Tier 2 receive zero additional effort points.
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Cooldown & Duration Hurdles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Rapid Repetition Cooldown */}
        <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-sky-500" />
            <h3 className="text-sm font-bold text-foreground">Repetition Cooldown</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Minimum required interval before logging a second touchpoint on the same contact or lead.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Input
              type="number"
              min="0"
              max="1800"
              step="30"
              value={antiGaming.repetitionCooldownSeconds}
              onChange={(e) =>
                onChange({
                  ...antiGaming,
                  repetitionCooldownSeconds: Math.max(0, parseInt(e.target.value, 10) || 0),
                })
              }
              className="h-10 text-xs font-bold font-mono text-center w-28"
            />
            <span className="text-xs font-semibold text-muted-foreground">seconds (3 mins recommended)</span>
          </div>
        </Card>

        {/* Minimum Call Duration Hurdle */}
        <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ZapOff className="h-5 w-5 text-purple-500" />
            <h3 className="text-sm font-bold text-foreground">Minimum Call Duration</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Calls below this length receive zero effort points to prevent unanswered drops from claiming rewards.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Input
              type="number"
              min="0"
              max="300"
              step="5"
              value={antiGaming.minCallDurationSeconds}
              onChange={(e) =>
                onChange({
                  ...antiGaming,
                  minCallDurationSeconds: Math.max(0, parseInt(e.target.value, 10) || 0),
                })
              }
              className="h-10 text-xs font-bold font-mono text-center w-28"
            />
            <span className="text-xs font-semibold text-muted-foreground">seconds (45s recommended)</span>
          </div>
        </Card>
      </div>

      {/* 3. Execution Hygiene & Machine Guard */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Hygiene & Machine Activity Safeguards</h3>

        <div className="space-y-4 divide-y divide-border/40">
          {/* Require Notes */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-bold text-foreground">Require Meeting & Task Notes</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tasks or meetings concluded without summary notes will receive 0 quality points on scorecards.
              </p>
            </div>
            <Switch
              checked={antiGaming.requireNotesForCompletion}
              onCheckedChange={(checked) =>
                onChange({ ...antiGaming, requireNotesForCompletion: checked })
              }
              className="data-[state=checked]:bg-emerald-500 shrink-0"
            />
          </div>

          {/* Exclude Machine Effort */}
          <div className="flex items-center justify-between gap-4 pt-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-sky-500" />
                <span className="text-xs font-bold text-foreground">Strict Human Effort Isolation</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Events executed by backend automations, webhooks, or system triggers are strictly excluded from human rep scorecards.
              </p>
            </div>
            <Switch
              checked={antiGaming.excludeMachineEffort}
              onCheckedChange={(checked) =>
                onChange({ ...antiGaming, excludeMachineEffort: checked })
              }
              className="data-[state=checked]:bg-emerald-500 shrink-0"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
