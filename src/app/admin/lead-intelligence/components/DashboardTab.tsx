'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Activity, Building2, History, Sparkles } from 'lucide-react';
import type { Prospect } from '@/lib/lead-intelligence/types';

interface DashboardTabProps {
  recentProspects: Prospect[];
}

export default function DashboardTab({ recentProspects }: DashboardTabProps) {
  return (
    <div className="space-y-6">
      {/* Stats cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-md">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prospects Discovered</CardTitle>
              <div className="text-3xl font-extrabold mt-1 text-emerald-400">1,248</div>
            </div>
            <Globe className="h-8 w-8 text-emerald-500/50" />
          </CardHeader>
        </Card>
        <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-md">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Direct Audits</CardTitle>
              <div className="text-3xl font-extrabold mt-1 text-teal-400">382</div>
            </div>
            <Activity className="h-8 w-8 text-teal-500/50" />
          </CardHeader>
        </Card>
        <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-md">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Synced to CRM</CardTitle>
              <div className="text-3xl font-extrabold mt-1 text-emerald-400">89 Leads</div>
            </div>
            <Building2 className="h-8 w-8 text-emerald-500/50" />
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Card */}
        <Card className="bg-card/35 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <History className="h-4 w-4 text-emerald-400" />
              Recent Discovery Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentProspects.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">No recent prospect scans recorded in this workspace.</div>
            ) : (
              recentProspects.map((p) => (
                <div key={p.id} className="flex justify-between items-center border-b border-border/30 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="font-bold text-xs">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{p.domain} • {p.industry}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10 text-[9px] font-bold">Score: {p.scoring.overallScore}%</Badge>
                    {p.syncStatus === 'synced' ? (
                      <Badge className="bg-emerald-500 text-black hover:bg-emerald-500 text-[8px] uppercase font-bold">Synced</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[8px] uppercase font-bold opacity-60">Scan Only</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick-Notes & Tips */}
        <Card className="bg-card/35 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              AI Opportunities Stethoscope
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
              <span className="font-bold text-emerald-400">Pro Tip: </span>
              Always scan prospects with the Chrome Extension first. It extracts details dynamically without using Places searches or BuiltWith limits.
            </div>
            <div className="p-3 bg-muted/20 border border-border/40 rounded-lg">
              <span className="font-bold">Sync workflow: </span>
              Synced leads will immediately have an Entity record created, allowing you to add deals, link meetings, and enroll in scheduled Campaigns.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
