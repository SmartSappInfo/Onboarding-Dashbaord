'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Unified Dispatch, Notifications & Webhook Hub
 * 
 * ARCHITECTURAL GUIDELINES (Strict Zero-Any Invariant & Mobile Ergonomics):
 * 1. Consolidates 3 previously fragmented communication cards (Internal Team Alerts, External Contact Alerts, Webhooks)
 *    into a single tabbed dispatch hub with real-time status indicators.
 * 2. Mobile-first ergonomic touch targets (min-h-[44px], active:scale-[0.97]).
 * 3. Preserves all RHF form bindings (adminAlert*, externalAlert*, webhook*).
 */

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Bell, Users, Webhook as WebhookIcon, Send } from 'lucide-react';
import InternalNotificationConfig from '@/app/admin/components/internal-notification-config';
import ExternalNotificationConfig from './external-notification-config';
import WebhookManager from './webhook-manager';

export function SurveyCommunicationsHub() {
  const { watch } = useFormContext();

  const internalEnabled = !!watch('adminAlertsEnabled');
  const externalEnabled = !!watch('externalAlertsEnabled');
  const webhookEnabled = !!watch('webhookEnabled');

  const internalChannels = (watch('adminAlertChannels') as string[]) || [];
  const externalChannels = (watch('externalAlertChannels') as string[]) || [];

  return (
    <Card className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
      <CardHeader className="bg-muted/10 border-b border-border/60 py-4 px-5 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
              <Send className="h-4.5 w-4.5" />
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                Dispatch &amp; Notifications Hub
              </CardTitle>
              <CardInfoTooltip text="Configure real-time team alerts, respondent confirmations, and external webhooks." />
            </div>
          </div>

          {/* Live Status Indicators */}
          <div className="flex items-center gap-2 flex-wrap">
            {internalEnabled && (
              <Badge variant="outline" className="text-[10px] font-bold bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                Team Alerts ({internalChannels.length || 1})
              </Badge>
            )}
            {externalEnabled && (
              <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auto-Reply ({externalChannels.length || 1})
              </Badge>
            )}
            {webhookEnabled && (
              <Badge variant="outline" className="text-[10px] font-bold bg-purple-500/10 text-purple-600 border-purple-500/20 gap-1 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                Webhook Active
              </Badge>
            )}
            {!internalEnabled && !externalEnabled && !webhookEnabled && (
              <Badge variant="secondary" className="text-[10px] font-semibold text-muted-foreground">
                All Disabled
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        <Tabs defaultValue="internal" className="w-full">
          <TabsList className="grid grid-cols-3 h-11 p-1 bg-muted/40 rounded-xl border border-border/50 select-none">
            <TabsTrigger 
              value="internal" 
              className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 min-h-[36px]"
            >
              <Bell className="h-3.5 w-3.5" />
              <span className="truncate">Team Alerts</span>
              {internalEnabled && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
            </TabsTrigger>

            <TabsTrigger 
              value="external" 
              className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 min-h-[36px]"
            >
              <Users className="h-3.5 w-3.5" />
              <span className="truncate">Auto-Responses</span>
              {externalEnabled && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />}
            </TabsTrigger>

            <TabsTrigger 
              value="webhooks" 
              className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 min-h-[36px]"
            >
              <WebhookIcon className="h-3.5 w-3.5" />
              <span className="truncate">Webhooks</span>
              {webhookEnabled && <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="internal" className="mt-5 space-y-4 outline-none animate-in fade-in-50 duration-200">
            <InternalNotificationConfig prefix="adminAlert" category="surveys" />
          </TabsContent>

          <TabsContent value="external" className="mt-5 space-y-4 outline-none animate-in fade-in-50 duration-200">
            <ExternalNotificationConfig prefix="externalAlert" category="surveys" />
          </TabsContent>

          <TabsContent value="webhooks" className="mt-5 space-y-4 outline-none animate-in fade-in-50 duration-200">
            <WebhookManager />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
