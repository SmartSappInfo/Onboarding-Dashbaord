/**
 * @fileoverview Messaging Delivery Funnel Radar Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Displays cross-channel dispatch volume, delivery rates, open rates, and bounce rates.
 * - Mobile responsive grid and visual progress meters.
 */

'use client';

import * as React from 'react';
import { Mail, MessageSquare, Smartphone, Bell, TrendingUp, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DeliveryMetrics } from '@/lib/backoffice/backoffice-types';

interface DeliveryFunnelRadarProps {
  readonly metrics: DeliveryMetrics;
}

export default function DeliveryFunnelRadar({ metrics }: DeliveryFunnelRadarProps) {
  const channelCards = [
    {
      name: 'Email (Resend)',
      icon: Mail,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      progressColor: 'bg-blue-500',
      data: metrics.channels.email,
    },
    {
      name: 'SMS (mNotify)',
      icon: Smartphone,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      progressColor: 'bg-amber-500',
      data: metrics.channels.sms,
    },
    {
      name: 'WhatsApp (Meta Cloud API)',
      icon: MessageSquare,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      progressColor: 'bg-emerald-500',
      data: metrics.channels.whatsapp,
    },
    {
      name: 'Push (OneSignal)',
      icon: Bell,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
      progressColor: 'bg-purple-500',
      data: metrics.channels.push,
    },
  ];

  return (
    <div className="space-y-4">
      {/* 4 Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {channelCards.map((channel) => (
          <Card key={channel.name} className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center border ${channel.color}`}>
                  <channel.icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-foreground">{channel.name}</span>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                {channel.data.deliveryRate.toFixed(1)}%
              </Badge>
            </div>

            {/* Total Sent */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Volume Sent</span>
                <span className="font-mono font-bold text-foreground">{channel.data.totalSent.toLocaleString()}</span>
              </div>
              <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                <div className={`${channel.progressColor} h-full rounded-full`} style={{ width: `${Math.min(channel.data.deliveryRate, 100)}%` }} />
              </div>
            </div>

            {/* Funnel Metrics */}
            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border/50 text-[11px]">
              <div className="space-y-0.5">
                <span className="text-muted-foreground block text-[10px]">Delivered</span>
                <span className="font-bold text-foreground">{channel.data.deliveredCount}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-muted-foreground block text-[10px]">Opened</span>
                <span className="font-bold text-foreground">{channel.data.openedCount}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-muted-foreground block text-[10px]">Bounce</span>
                <span className={`font-bold ${channel.data.bounceRate > 2 ? 'text-rose-500' : 'text-foreground'}`}>
                  {channel.data.bounceRate.toFixed(2)}%
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
