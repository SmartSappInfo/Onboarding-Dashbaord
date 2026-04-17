'use client';

import * as React from 'react';
import { Network, Activity, ListOrdered, Wrench } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import JobRunner from './JobRunner';
import TenantDiagnostics from './TenantDiagnostics';

export default function OperationsDashboard() {
  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6 text-emerald-400" /> Let&apos;s Build: Platform Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Govern job pipelines, trigger migrations, and run isolated diagnostic checks across tenants.
          </p>
        </div>
      </div>

      <Tabs defaultValue="jobs" className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-muted/50 border border-border rounded-xl p-1 h-auto flex flex-wrap gap-1 shrink-0">
          <TabsTrigger
            value="jobs"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            <ListOrdered className="h-3.5 w-3.5 mr-2" /> Global Job Queue
          </TabsTrigger>
          <TabsTrigger
            value="diagnostics"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            <Activity className="h-3.5 w-3.5 mr-2" /> Tenant Diagnostics
          </TabsTrigger>
          <TabsTrigger
            value="api"
            disabled
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            <Network className="h-3.5 w-3.5 mr-2" /> Webhooks & Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="flex-1 mt-4 overflow-hidden flex flex-col">
           <JobRunner />
        </TabsContent>

        <TabsContent value="diagnostics" className="flex-1 mt-4 overflow-hidden flex flex-col">
           <TenantDiagnostics />
        </TabsContent>
        
      </Tabs>
    </div>
  );
}
