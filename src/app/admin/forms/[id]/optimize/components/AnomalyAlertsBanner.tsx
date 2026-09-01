'use client';

/**
 * SmartSapp Forms 2.0: Automated Anomaly Detection Banner
 * 
 * Alerts staff to conversion drops, mobile bounce spikes, and submission starvation.
 */

import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { FormAnomalyAlert } from '@/lib/forms/form-optimization-types';

interface AnomalyAlertsBannerProps {
  anomalies: FormAnomalyAlert[];
}

export default function AnomalyAlertsBanner({ anomalies }: AnomalyAlertsBannerProps) {
  if (anomalies.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3">
        <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <h4 className="text-xs font-bold text-foreground">Operational Baseline Healthy</h4>
          <p className="text-[11px] text-muted-foreground">
            No conversion drops, mobile drop-off anomalies, or validation surges detected in the last 30 days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {anomalies.map((anom) => (
        <div
          key={anom.id}
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
            anom.severity === 'critical'
              ? 'bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-400'
              : anom.severity === 'warning'
              ? 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400'
              : 'bg-primary/5 border-primary/20 text-primary'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 shrink-0">
              {anom.severity === 'critical' && <AlertCircle className="h-4 w-4 text-rose-500" />}
              {anom.severity === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              {anom.severity === 'info' && <Info className="h-4 w-4 text-primary" />}
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-foreground">{anom.title}</h4>
                <Badge
                  variant="outline"
                  className={`text-[9px] uppercase font-bold px-1.5 py-0 ${
                    anom.severity === 'critical'
                      ? 'border-rose-500/30 text-rose-500'
                      : 'border-amber-500/30 text-amber-500'
                  }`}
                >
                  {anom.severity}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{anom.description}</p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-black text-foreground block">
              {anom.detectedValue} vs {anom.baselineValue}
            </span>
            <span className="text-[10px] font-bold text-rose-500 flex items-center justify-end gap-0.5">
              <TrendingDown className="h-3 w-3" /> {anom.percentageDelta}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
