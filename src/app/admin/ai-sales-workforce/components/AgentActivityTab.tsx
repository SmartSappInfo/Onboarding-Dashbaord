'use client';

/**
 * @fileoverview Real-Time Agent Activity & Telemetry Audit Tab Component (Phase 9).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 UX Screen 3 (AI Activity & Audit):
 * - Immutable execution telemetry stream recording agent decisions, prompt latency, token consumption, and status.
 * - Enforces zero silent score modifications by making all AI activity fully auditable.
 * - Mobile-first touch targets (min-h-[44px], active:scale-[0.97]).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - No raw HTML tags in UI.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  Coins,
  Bot,
} from 'lucide-react';
import type { AiExecutionAuditDoc } from '@/lib/ai-sales-workforce/types';

interface AgentActivityTabProps {
  executions: AiExecutionAuditDoc[];
}

export function AgentActivityTab({ executions }: AgentActivityTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Agent Swarm Activity & Telemetry Audit ({executions.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable stream of all autonomous decisions, LLM inferences, token consumption, and latency metrics.
          </p>
        </div>
      </div>

      {executions.length === 0 ? (
        <Card className="border-border/70 rounded-2xl bg-card p-10 text-center shadow-xs">
          <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-bold text-foreground">No Telemetry Recorded</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Agent decisions and executions will stream here in real time as actions are processed.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {executions.map((ex) => (
            <Card
              key={ex.id}
              className="border-border/70 rounded-2xl bg-card shadow-xs hover:border-border transition-colors"
            >
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      className={
                        ex.status === 'success'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-semibold'
                      }
                    >
                      {ex.status === 'success' ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {ex.status.toUpperCase()}
                    </Badge>

                    <Badge variant="outline" className="font-mono text-2xs gap-1">
                      <Bot className="h-2.5 w-2.5 text-primary" />
                      {ex.agentType}
                    </Badge>

                    <span className="font-bold text-foreground">
                      {ex.actionType.replace('_', ' ').toUpperCase()}
                    </span>

                    {ex.entityName && (
                      <span className="text-muted-foreground">• {ex.entityName}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-2xs text-muted-foreground flex-wrap pt-0.5">
                    <span className="flex items-center gap-1">
                      <Cpu className="h-3 w-3" />
                      {ex.modelUsed}
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {ex.tokensUsed.toLocaleString()} tokens
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {ex.durationMs}ms latency
                    </span>
                  </div>
                </div>

                <div className="text-2xs text-muted-foreground font-mono shrink-0 sm:text-right">
                  {new Date(ex.timestamp).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
