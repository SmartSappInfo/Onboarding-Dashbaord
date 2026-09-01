'use client';

/**
 * SmartSapp Forms 2.0: Device & Environment Distribution
 * 
 * Displays device category shares (Desktop vs Mobile vs Tablet).
 */

import React from 'react';
import { Monitor, Smartphone, Tablet, Laptop } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { FormAnalyticsSummary } from '@/lib/forms/form-analytics-types';

interface DeviceEnvironmentCardProps {
  deviceBreakdown: FormAnalyticsSummary['deviceBreakdown'];
}

export default function DeviceEnvironmentCard({ deviceBreakdown }: DeviceEnvironmentCardProps) {
  const devices = [
    {
      id: 'desktop',
      label: 'Desktop / Laptop',
      count: deviceBreakdown.desktop,
      percent: deviceBreakdown.desktopPercent,
      icon: Monitor,
      color: 'text-blue-500',
      barColor: '[&>div]:bg-blue-500',
    },
    {
      id: 'mobile',
      label: 'Mobile Devices',
      count: deviceBreakdown.mobile,
      percent: deviceBreakdown.mobilePercent,
      icon: Smartphone,
      color: 'text-emerald-500',
      barColor: '[&>div]:bg-emerald-500',
    },
    {
      id: 'tablet',
      label: 'Tablet Devices',
      count: deviceBreakdown.tablet,
      percent: deviceBreakdown.tabletPercent,
      icon: Tablet,
      color: 'text-purple-500',
      barColor: '[&>div]:bg-purple-500',
    },
  ];

  return (
    <Card className="rounded-3xl border border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Laptop className="h-4 w-4 text-primary" />
              Device & Environment Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Distribution of respondents across devices and form factors.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {devices.map((d) => {
          const IconComponent = d.icon;
          return (
            <div key={d.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <IconComponent className={cn("h-4 w-4", d.color)} />
                  <span className="font-bold text-foreground">{d.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-semibold">
                    {d.count.toLocaleString()}
                  </span>
                  <span className="font-extrabold text-foreground">
                    {d.percent}%
                  </span>
                </div>
              </div>
              <Progress value={d.percent} className={cn("h-2 rounded-full bg-muted/40", d.barColor)} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
