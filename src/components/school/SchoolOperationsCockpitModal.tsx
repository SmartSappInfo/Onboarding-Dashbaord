'use client';

/**
 * @fileOverview Standardized School Operations & Attendance Anomaly Cockpit Modal (Phase 12 Milestone 5)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` (min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4)
 * - Zero Raw Descriptions: Guidance routed through `<CardInfoTooltip text="..." />` alongside title
 * - Accessibility: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 min-h-[56px]`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97] min-h-[44px]`
 *
 * Implements Rules 4, 7, 11, 41:
 * - Mathematical absenteeism velocity
 * - Attendance anomaly scoring & risk tiers
 * - 1-Click trigger to draft parent briefing
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type AttendanceAnomalyResult } from '@/platform/agents/school/school-operations-types';
import {
  GraduationCap,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';

export interface SchoolOperationsCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  anomalies: AttendanceAnomalyResult[];
  isLoading?: boolean;
  onDraftBrief?: (studentId: string) => void;
}

export function SchoolOperationsCockpitModal({
  isOpen,
  onClose,
  anomalies,
  isLoading,
  onDraftBrief,
}: SchoolOperationsCockpitModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl max-w-4xl p-0 overflow-hidden">
        {/* Demarcated Header (theme.md §8) */}
        <DialogHeader
          demarcated
          className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4 flex flex-row items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <GraduationCap className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              School Operations & Attendance Cockpit
            </DialogTitle>
            <CardInfoTooltip text="Monitors student absenteeism velocity, acute attendance drop anomalies, and tuition fee correlation risks." />
          </div>
          <DialogDescription className="sr-only">
            School operations attendance anomalies and tuition correlation cockpit
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
              Analyzing attendance registers and tuition arrears...
            </div>
          ) : anomalies.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="h-10 w-10 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold">No Attendance Anomalies Detected</p>
              <p className="text-xs text-muted-foreground">
                All student absenteeism velocities are within normal operating variance.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {anomalies.map((anom) => {
                const isCritical = anom.riskTier === 'CRITICAL';
                const isElevated = anom.riskTier === 'ELEVATED';

                return (
                  <div
                    key={anom.studentId}
                    className={`p-4 rounded-xl border transition-all ${
                      isCritical
                        ? 'border-destructive/40 bg-destructive/5'
                        : isElevated
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : 'border-border/70 bg-card'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{anom.studentName}</span>
                          <Badge
                            variant={isCritical ? 'destructive' : isElevated ? 'default' : 'outline'}
                            className="text-[10px] px-2 py-0 h-4"
                          >
                            {anom.riskTier} RISK
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Score: <span className="font-mono font-semibold">{anom.anomalyScore}/100</span>
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{anom.recommendation}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right text-[11px] text-muted-foreground pr-2 border-r border-border/50">
                          <div>Velocity: <span className="font-mono font-medium">{anom.absenteeismVelocity}</span></div>
                          <div>Missed: <span className="font-mono font-medium">{anom.consecutiveMissedDays}d streak</span></div>
                        </div>

                        {onDraftBrief && (
                          <Button
                            size="sm"
                            variant={isCritical ? 'default' : 'outline'}
                            onClick={() => onDraftBrief(anom.studentId)}
                            className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs gap-1.5"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Draft Brief
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Demarcated Footer (theme.md §8) */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 min-h-[56px]">
          <Button
            variant="outline"
            data-testid="school-ops-close-btn"
            onClick={onClose}
            className="rounded-xl active:scale-[0.97] min-h-[44px]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
