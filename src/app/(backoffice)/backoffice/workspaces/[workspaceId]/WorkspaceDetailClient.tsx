'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Layers,
  Building2,
  Users,
  Database,
  Network,
  GitMerge,
  ToggleRight,
  ShieldCheck,
  Code
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getWorkspaceDiagnostics } from '@/lib/backoffice/backoffice-workspace-actions';

// ─────────────────────────────────────────────────
// Workspace Detail Client
// Display diagnostics, user count, entity count, and feature overrides.
// ─────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  archived: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
};

const SCOPE_COLORS: Record<string, string> = {
  institution: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  family: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  person: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/40 border border-border/40">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
        {label}
      </span>
      <span className="text-sm font-bold text-foreground ml-auto">{value}</span>
    </div>
  );
}

export default function WorkspaceDetailClient({ workspaceId }: { workspaceId: string }) {
  const [diag, setDiag] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      const result = await getWorkspaceDiagnostics(workspaceId);
      if (result.success && result.data) {
        setDiag(result.data);
      }
      setIsLoading(false);
    }
    load();
  }, [workspaceId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-accent rounded-lg animate-pulse" />
        <div className="h-64 bg-muted/50 rounded-2xl border border-border animate-pulse" />
      </div>
    );
  }

  if (!diag) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Layers className="h-12 w-12 text-slate-700 mb-4" />
        <p className="text-sm text-muted-foreground">Workspace not found or diagnostic fetch failed.</p>
        <Link href="/backoffice/workspaces">
          <Button variant="ghost" className="mt-4 text-emerald-400">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workspaces
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/backoffice/workspaces">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Back to workspaces"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Workspace Detail
              </h1>
              <Badge
                variant="outline"
                className={`text-[9px] uppercase font-bold px-2 h-5 ${STATUS_COLORS[diag.status || 'active']}`}
              >
                {diag.status || 'active'}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[9px] uppercase font-bold px-2 h-5 ${SCOPE_COLORS[diag.scope] || SCOPE_COLORS.institution}`}
              >
                {diag.scope}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">ID: {diag.workspaceId}</p>
             <Link
              href={`/backoffice/organizations/${diag.organizationId}`}
              className="text-xs text-blue-400 hover:underline flex items-center mt-2 group"
             >
               <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground group-hover:text-blue-400 transition-colors" />
               {diag.organizationName}
             </Link>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill icon={Users} label="Users" value={diag.userCount} />
        <StatPill icon={Database} label="Entities" value={diag.entityCount} />
        <StatPill icon={Network} label="Teams" value={diag.teamCount} />
        <StatPill icon={GitMerge} label="Pipelines" value={diag.pipelineCount} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border rounded-xl p-1 h-auto flex flex-wrap gap-1">
          <TabsTrigger
            value="overview"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="overrides"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            Feature Overrides
          </TabsTrigger>
           <TabsTrigger
            value="capabilities"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            Capabilities
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-2xl border border-border bg-muted/50 p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Workspace Properties
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-accent/30 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">
                  Status
                </span>
                <span className="text-foreground capitalize">{diag.status}</span>
              </div>
              <div className="p-3 rounded-lg bg-accent/30 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">
                  Scope
                </span>
                <span className="text-foreground capitalize">{diag.scope}</span>
              </div>
              <div className="p-3 rounded-lg bg-accent/30 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">
                  Created At
                </span>
                <span className="text-foreground">
                  {diag.createdAt ? new Date(diag.createdAt).toLocaleString() : '—'}
                </span>
              </div>
               <div className="p-3 rounded-lg bg-accent/30 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">
                  Organization ID
                </span>
                <span className="text-foreground/80 font-mono text-xs">{diag.organizationId}</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Feature Overrides Tab */}
        <TabsContent value="overrides" className="space-y-4">
          <div className="rounded-2xl border border-border bg-muted/50 p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <ToggleRight className="h-4 w-4 text-emerald-400" />
              Workspace Feature Overrides
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              These settings override the organization defaults locally for this workspace.
            </p>
            {Object.keys(diag.featureOverrides || {}).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(diag.featureOverrides || {}).map(([featureId, enabled]) => (
                  <div
                    key={featureId}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/30 border border-border/30"
                  >
                    <span className="text-xs text-foreground font-mono truncate mr-2" title={featureId}>
                       {featureId}
                    </span>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[8px] uppercase font-bold px-1.5 h-4 ${
                        enabled
                          ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
                          : 'text-red-400 border-red-500/20 bg-red-500/10'
                      }`}
                    >
                      {enabled ? 'ON' : 'OFF'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-accent/20 rounded-xl border border-border/30 border-dashed">
                 <p className="text-xs text-muted-foreground">No feature overrides. Relying on Organization and System defaults.</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        {/* Capabilities Tab */}
        <TabsContent value="capabilities" className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/50 p-6">
               <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Code className="h-4 w-4 text-emerald-400" />
                  Workspace Capabilities
               </h3>
                <p className="text-xs text-muted-foreground mb-4">
                   Core capabilities that dictate what data and modules this workspace can process.
                </p>
                {Object.keys(diag.capabilities || {}).length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                     {Object.entries(diag.capabilities || {}).map(([cap, enabled]) => (
                        <div key={cap} className="flex flex-col p-3 rounded-lg bg-accent/30 border border-border/30">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">
                               {cap}
                            </span>
                             <Badge
                                variant="outline"
                                className={`w-fit text-[9px] uppercase font-bold px-2 h-5 ${
                                  enabled
                                    ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
                                    : 'text-muted-foreground border-slate-500/20 bg-slate-500/10'
                                }`}
                              >
                                {enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                        </div>
                     ))}
                  </div>
                ) : (
                   <div className="text-center py-8 bg-accent/20 rounded-xl border border-border/30 border-dashed">
                      <p className="text-xs text-muted-foreground">No specific capabilities configured.</p>
                   </div>
                )}
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
