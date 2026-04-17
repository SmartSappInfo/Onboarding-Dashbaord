'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Layers,
  Users,
  Database,
  Settings,
  ScrollText,
  Shield,
  ToggleRight,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getOrganizationDetail, getOrganizationDiagnostics } from '@/lib/backoffice/backoffice-org-actions';
import type { Organization } from '@/lib/types';

// ─────────────────────────────────────────────────
// Organization Detail Client
// Tabbed view: Overview, Workspaces, Entitlements,
// Templates, Overrides, Support, Audit.
// ─────────────────────────────────────────────────

type OrgDetail = Organization & {
  workspaceCount: number;
  userCount: number;
  activeUsers: number;
  entityCount: number;
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  trial: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/20',
  archived: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
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

export default function OrgDetailClient({ orgId }: { orgId: string }) {
  const [org, setOrg] = React.useState<OrgDetail | null>(null);
  const [diagnostics, setDiagnostics] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      const [orgResult, diagResult] = await Promise.all([
        getOrganizationDetail(orgId),
        getOrganizationDiagnostics(orgId),
      ]);

      if (orgResult.success && orgResult.data) setOrg(orgResult.data);
      if (diagResult.success && diagResult.data) setDiagnostics(diagResult.data);
      setIsLoading(false);
    }
    load();
  }, [orgId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-accent rounded-lg animate-pulse" />
        <div className="h-64 bg-muted/50 rounded-2xl border border-border animate-pulse" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Building2 className="h-12 w-12 text-slate-700 mb-4" />
        <p className="text-sm text-muted-foreground">Organization not found.</p>
        <Link href="/backoffice/organizations">
          <Button variant="ghost" className="mt-4 text-emerald-400">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Organizations
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
          <Link href="/backoffice/organizations">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Back to organizations"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {org.name}
              </h1>
              <Badge
                variant="outline"
                className={`text-[9px] uppercase font-bold px-2 h-5 ${STATUS_COLORS[org.status || 'active']}`}
              >
                {org.status || 'active'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">{org.slug}</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill icon={Layers} label="Workspaces" value={org.workspaceCount} />
        <StatPill icon={Users} label="Users" value={`${org.activeUsers}/${org.userCount}`} />
        <StatPill icon={Database} label="Entities" value={org.entityCount} />
        <StatPill
          icon={ToggleRight}
          label="Feature Overrides"
          value={Object.keys(org.enabledFeatures || {}).length}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border rounded-xl p-1 h-auto">
          <TabsTrigger
            value="overview"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="workspaces"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer"
          >
            Workspaces
          </TabsTrigger>
          <TabsTrigger
            value="entitlements"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer"
          >
            Entitlements
          </TabsTrigger>
          <TabsTrigger
            value="diagnostics"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer"
          >
            Diagnostics
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer"
          >
            Audit History
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-2xl border border-border bg-muted/50 p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Organization Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">
                  Name
                </span>
                <span className="text-foreground">{org.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">
                  Slug
                </span>
                <span className="text-foreground font-mono">{org.slug}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">
                  Email
                </span>
                <span className="text-foreground">{org.email || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">
                  Website
                </span>
                <span className="text-foreground">{org.website || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">
                  Created
                </span>
                <span className="text-foreground">
                  {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">
                  Description
                </span>
                <span className="text-foreground">{org.description || '—'}</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Workspaces Tab */}
        <TabsContent value="workspaces" className="space-y-4">
          <div className="rounded-2xl border border-border bg-muted/50 p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Workspaces ({org.workspaceCount})
            </h3>
            {diagnostics?.workspaces?.length > 0 ? (
              <div className="space-y-2">
                {diagnostics.workspaces.map((ws: any) => (
                  <div
                    key={ws.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-accent/30 border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground font-semibold">{ws.name}</span>
                      <Badge
                        variant="outline"
                        className="text-[8px] uppercase font-bold px-1.5 h-4 text-muted-foreground border-slate-600"
                      >
                        {ws.scope}
                      </Badge>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[8px] uppercase font-bold px-1.5 h-4 ${STATUS_COLORS[ws.status || 'active']}`}
                    >
                      {ws.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">No workspaces found.</p>
            )}
          </div>
        </TabsContent>

        {/* Entitlements Tab */}
        <TabsContent value="entitlements" className="space-y-4">
          <div className="rounded-2xl border border-border bg-muted/50 p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Feature Overrides</h3>
            {Object.keys(org.enabledFeatures || {}).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(org.enabledFeatures || {}).map(([featureId, enabled]) => (
                  <div
                    key={featureId}
                    className="flex items-center justify-between p-2 rounded-lg bg-accent/30 border border-border/30"
                  >
                    <span className="text-xs text-foreground/80 font-mono">{featureId}</span>
                    <Badge
                      variant="outline"
                      className={`text-[8px] uppercase font-bold px-1.5 h-4 ${
                        enabled
                          ? 'text-emerald-400 border-emerald-500/20'
                          : 'text-red-400 border-red-500/20'
                      }`}
                    >
                      {enabled ? 'ON' : 'OFF'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                No feature overrides. Using system defaults.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Diagnostics Tab */}
        <TabsContent value="diagnostics" className="space-y-4">
          <div className="rounded-2xl border border-border bg-muted/50 p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-400" />
              Tenant Diagnostics
            </h3>
            {diagnostics ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-2 rounded-lg bg-accent/20">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] uppercase font-bold ${STATUS_COLORS[diagnostics.status]}`}
                  >
                    {diagnostics.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-accent/20">
                  <span className="text-muted-foreground">Workspaces</span>
                  <span className="text-foreground font-semibold">{diagnostics.workspaces?.length}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-accent/20">
                  <span className="text-muted-foreground">Users</span>
                  <span className="text-foreground font-semibold">{diagnostics.userCount}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-accent/20">
                  <span className="text-muted-foreground">Entities</span>
                  <span className="text-foreground font-semibold">{diagnostics.entityCount}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-accent/20">
                  <span className="text-muted-foreground">Custom Roles</span>
                  <span className="text-foreground font-semibold">
                    {diagnostics.hasCustomRoles ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">Loading diagnostics...</p>
            )}
          </div>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit" className="space-y-4">
          <div className="rounded-2xl border border-border bg-muted/50 p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-muted-foreground" />
              Audit History
            </h3>
            <p className="text-xs text-slate-600">
              Organization-scoped audit logs will be connected in Phase 7.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
