'use client';

import * as React from 'react';
import { Activity, ListOrdered, Wrench, Trash2, Database, ShieldAlert } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import JobRunner from './JobRunner';
import TenantDiagnostics from './TenantDiagnostics';
import AutomationCleaner from './AutomationCleaner';
import StripAccountStatusFer from './StripAccountStatusFer';
import StripLifecycleStatusFer from './StripLifecycleStatusFer';
import FixOrgAdminPermissionsFer from './FixOrgAdminPermissionsFer';
import SeedAllWorkspacesFieldsFer from './SeedAllWorkspacesFieldsFer';

export default function OperationsDashboard() {
  return (
    <div className="flex flex-col min-h-full p-6 bg-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Wrench className="h-6 w-6 text-emerald-400" /> Let&apos;s Build: Platform Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Govern job pipelines, trigger migrations, run diagnostics, and manage automation data across the platform.
          </p>
        </div>
      </div>

      <Tabs defaultValue="jobs" className="mt-6 flex flex-col">
        <TabsList className="bg-muted/50 p-1.5 rounded-xl border border-border/40 w-full sm:w-auto flex flex-wrap h-auto gap-1 shadow-inner shrink-0">
          <TabsTrigger
            value="jobs"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            <ListOrdered className="h-3.5 w-3.5 mr-2" /> Job Run Control
          </TabsTrigger>
          <TabsTrigger
            value="diagnostics"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-indigo-500/15 data-[state=active]:text-indigo-400 cursor-pointer flex-1 sm:flex-none"
          >
            <Activity className="h-3.5 w-3.5 mr-2" /> Tenant Diagnostics
          </TabsTrigger>
          <TabsTrigger
            value="automation-cleanup"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-red-500/15 data-[state=active]:text-red-400 cursor-pointer flex-1 sm:flex-none"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Automation Cleanup
          </TabsTrigger>
          <TabsTrigger
            value="fer-account-status"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-400 cursor-pointer flex-1 sm:flex-none"
          >
            <Database className="h-3.5 w-3.5 mr-2" /> Strip accountStatus
          </TabsTrigger>
          <TabsTrigger
            value="fer-lifecycle-status"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-400 cursor-pointer flex-1 sm:flex-none"
          >
            <Database className="h-3.5 w-3.5 mr-2" /> Strip lifecycleStatus
          </TabsTrigger>
          <TabsTrigger
            value="fer-org-admin-perms"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-rose-500/15 data-[state=active]:text-rose-400 cursor-pointer flex-1 sm:flex-none"
          >
            <ShieldAlert className="h-3.5 w-3.5 mr-2" /> Org Admin Perms
          </TabsTrigger>
          <TabsTrigger
            value="fer-seed-workspace-fields"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-400 cursor-pointer flex-1 sm:flex-none"
          >
            <Database className="h-3.5 w-3.5 mr-2" /> Seed Workspace Fields
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="mt-4">
           <JobRunner />
        </TabsContent>
        
        <TabsContent value="diagnostics" className="mt-4">
           <TenantDiagnostics />
        </TabsContent>

        <TabsContent value="automation-cleanup" className="mt-4">
           <AutomationCleaner />
        </TabsContent>

        <TabsContent value="fer-account-status" className="mt-4">
           <StripAccountStatusFer />
        </TabsContent>

        <TabsContent value="fer-lifecycle-status" className="mt-4">
           <StripLifecycleStatusFer />
        </TabsContent>

        <TabsContent value="fer-org-admin-perms" className="mt-4">
           <FixOrgAdminPermissionsFer />
        </TabsContent>

        <TabsContent value="fer-seed-workspace-fields" className="mt-4">
           <SeedAllWorkspacesFieldsFer />
        </TabsContent>

      </Tabs>
    </div>
  );
}
