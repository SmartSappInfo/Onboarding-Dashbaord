'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { MessageTemplate } from '@/lib/types';
import { getWorkspaceVariablesAction } from '@/lib/fields-actions';
import { validateTemplateVariables, ValidationError } from '@/lib/template-validator';
import { getAllSystemVariables } from '@/lib/system-variable-definitions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TemplateDiagnosticsPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();
  
  const [workspaceVariables, setWorkspaceVariables] = React.useState<any[]>([]);
  const [isLoadingVars, setIsLoadingVars] = React.useState(true);
  const [filterTab, setFilterTab] = React.useState<'all' | 'errors' | 'warnings' | 'healthy'>('all');

  // Query org-scoped templates
  const { data: orgTemplates, isLoading: loadingOrg } = useCollection<MessageTemplate>(
    useMemoFirebase(() => {
      if (!firestore || !activeOrganizationId) return null;
      return query(
        collection(firestore, 'message_templates'),
        where('scope', '==', 'organization'),
        where('organizationId', '==', activeOrganizationId)
      );
    }, [firestore, activeOrganizationId])
  );

  // Query global blueprints
  const { data: globalTemplates, isLoading: loadingGlobal } = useCollection<MessageTemplate>(
    useMemoFirebase(() => {
      if (!firestore) return null;
      return query(
        collection(firestore, 'message_templates'),
        where('scope', '==', 'global')
      );
    }, [firestore])
  );

  // Load variables list from the workspace configuration action
  React.useEffect(() => {
    async function loadWorkspaceVars() {
      if (!activeWorkspaceId) return;
      setIsLoadingVars(true);
      try {
        const res = await getWorkspaceVariablesAction(activeWorkspaceId);
        if (res.success && res.variables) {
          setWorkspaceVariables(res.variables);
        }
      } catch (e) {
        console.error('Failed to load workspace variables', e);
      } finally {
        setIsLoadingVars(false);
      }
    }
    loadWorkspaceVars();
  }, [activeWorkspaceId]);

  // Merge and deduplicate templates (Org-specific overrides hide global defaults)
  const templates = React.useMemo(() => {
    if (!orgTemplates || !globalTemplates || !activeWorkspaceId) return [];

    // Filter templates visible in this workspace
    const wsOrgTemplates = orgTemplates.filter((t: MessageTemplate) => t.workspaceIds?.includes(activeWorkspaceId));

    // Deduplicate overridden templates
    const overriddenGlobalIds = new Set(
      wsOrgTemplates
        .map((t: MessageTemplate) => t.globalTemplateId)
        .filter(Boolean)
    );

    const activeGlobals = globalTemplates.filter((t: MessageTemplate) => !overriddenGlobalIds.has(t.id));
    return [...wsOrgTemplates, ...activeGlobals];
  }, [orgTemplates, globalTemplates, activeWorkspaceId]);

  // Run validation checker against all templates
  const diagnostics = React.useMemo(() => {
    if (!templates.length || isLoadingVars) return [];

    const systemVars = getAllSystemVariables();

    return templates.map((template) => {
      // Filter workspace variables matching this template's category
      const filteredVars = workspaceVariables.filter(v => 
        template.category === 'general'
          ? (v.category === 'general' || v.category === 'common')
          : (v.category === 'general' || v.category === 'common' || v.category === template.category)
      );

      const allValidForTemplate = [...filteredVars, ...systemVars];
      const errors = validateTemplateVariables(template, allValidForTemplate);
      
      const errorCount = errors.filter(e => e.type === 'error').length;
      const warningCount = errors.filter(e => e.type === 'warning').length;

      return {
        template,
        errors,
        errorCount,
        warningCount,
        status: errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'healthy',
      };
    });
  }, [templates, workspaceVariables, isLoadingVars]);

  // Bento Scorecard Metrics
  const metrics = React.useMemo(() => {
    const total = diagnostics.length;
    const errors = diagnostics.filter(d => d.status === 'error').length;
    const warnings = diagnostics.filter(d => d.status === 'warning').length;
    const healthy = diagnostics.filter(d => d.status === 'healthy').length;

    return { total, errors, warnings, healthy };
  }, [diagnostics]);

  // Filter template listing
  const filteredDiagnostics = React.useMemo(() => {
    return diagnostics.filter(d => {
      if (filterTab === 'errors') return d.status === 'error';
      if (filterTab === 'warnings') return d.status === 'warning';
      if (filterTab === 'healthy') return d.status === 'healthy';
      return true;
    });
  }, [diagnostics, filterTab]);

  const isLoading = loadingOrg || loadingGlobal || isLoadingVars;

  if (isLoading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-8 text-left">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl w-full" />)}
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 text-left pb-32">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 border-border/60">
        <div className="flex items-start gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 rounded-xl bg-background border hover:bg-muted"
            onClick={() => router.push('/admin/settings/fields')}
          >
            <LucideIcons.ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <LucideIcons.ShieldAlert className="h-6 w-6 text-emerald-500" />
              Template Variable Diagnostics
            </h1>
            <p className="text-muted-foreground font-medium text-sm mt-1">
              Deep scans client template body copy, blocks, and parameters for broken placeholder tokens and typo variables.
            </p>
          </div>
        </div>
        <Button 
          variant="outline"
          className="rounded-xl border-emerald-500/20 text-emerald-600 hover:bg-emerald-50/50 gap-2 h-10 font-bold self-start md:self-auto"
          onClick={() => window.location.reload()}
        >
          <LucideIcons.RefreshCw className="h-4 w-4" /> Re-Scan Workspace
        </Button>
      </div>

      {/* Bento Scorecard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><LucideIcons.FileText className="h-16 w-16" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">Templates Audited</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-extrabold tracking-tight">{metrics.total}</span>
            <p className="text-[10px] text-muted-foreground mt-1">Workspace active blueprints & customized copies</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-emerald-100 bg-emerald-50/[0.04] shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-emerald-500/10"><LucideIcons.CheckCircle2 className="h-12 w-12" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Healthy / Ready</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">{metrics.healthy}</span>
            <p className="text-[10px] text-muted-foreground mt-1">100% valid tokens matched within scope</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-red-100 bg-red-50/[0.04] shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-red-500/10"><LucideIcons.XCircle className="h-12 w-12" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Typo Errors</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-extrabold text-red-600 dark:text-red-400 tracking-tight">{metrics.errors}</span>
            <p className="text-[10px] text-muted-foreground mt-1">Contains invalid variables (saves will prompt warnings)</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-amber-100 bg-amber-50/[0.04] shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-amber-500/10"><LucideIcons.AlertTriangle className="h-12 w-12" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Scope Warnings</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">{metrics.warnings}</span>
            <p className="text-[10px] text-muted-foreground mt-1">Variable exists but belongs to a different context</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Quick Indicators */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/30 p-2.5 rounded-2xl border">
        <div className="flex flex-wrap gap-1 w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Templates', count: metrics.total },
            { id: 'errors', label: 'Errors Only', count: metrics.errors, color: 'text-red-600 bg-red-500/5 hover:bg-red-500/10 border-red-200' },
            { id: 'warnings', label: 'Warnings Only', count: metrics.warnings, color: 'text-amber-600 bg-amber-500/5 hover:bg-amber-500/10 border-amber-200' },
            { id: 'healthy', label: 'Healthy Only', count: metrics.healthy, color: 'text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-200' }
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={filterTab === tab.id ? 'default' : 'ghost'}
              className={cn(
                "rounded-xl text-xs font-bold px-4 h-9 shadow-none gap-2",
                filterTab === tab.id ? "" : tab.color
              )}
              onClick={() => setFilterTab(tab.id as any)}
            >
              {tab.label}
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-[9px] h-4.5 px-1.5 font-extrabold rounded-md shrink-0",
                  filterTab === tab.id ? "bg-background text-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count}
              </Badge>
            </Button>
          ))}
        </div>
        <div className="text-[10px] font-bold text-muted-foreground/70 flex items-center gap-1.5 px-2.5">
          <LucideIcons.Activity className="h-4 w-4 text-emerald-500" />
          <span>Scanner Active: {workspaceVariables.length} workspace variables registered</span>
        </div>
      </div>

      {/* Templates Diagnostic List */}
      <div className="space-y-4">
        {filteredDiagnostics.length === 0 ? (
          <div className="border border-dashed rounded-3xl p-20 text-center space-y-4 bg-muted/5 border-border/80">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <LucideIcons.Check className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-base">No matching diagnostic records</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                All template variable configurations match the selected filter category correctly.
              </p>
            </div>
          </div>
        ) : (
          filteredDiagnostics.map(({ template, errors, errorCount, warningCount, status }) => (
            <Card 
              key={template.id} 
              className={cn(
                "rounded-2xl border transition-all duration-200 overflow-hidden group shadow-sm hover:shadow-md",
                status === 'error' ? "border-red-100 bg-red-500/[0.01]" :
                status === 'warning' ? "border-amber-100 bg-amber-500/[0.01]" :
                "border-border bg-card"
              )}
            >
              {/* Header Info Banner */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-sm text-foreground truncate max-w-[280px]">
                      {template.name}
                    </h3>
                    <Badge variant="outline" className="text-[8px] h-4 font-bold uppercase tracking-wider border-primary/20 text-primary bg-primary/5">
                      {template.category}
                    </Badge>
                    <Badge variant="secondary" className="text-[8px] h-4 font-semibold uppercase shrink-0">
                      {template.channel}
                    </Badge>
                    {template.scope === 'global' && (
                      <Badge variant="outline" className="text-[8px] h-4 font-bold text-indigo-600 bg-indigo-50 border-indigo-200 shrink-0">
                        System Default
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono leading-none">
                    Slug Key: {template.templateType || 'none'} • ID: {template.id}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {status === 'error' && (
                    <Badge className="bg-red-500 text-white hover:bg-red-600 gap-1 rounded-lg text-[9px] font-bold h-7 px-2">
                      <LucideIcons.XCircle className="h-3.5 w-3.5" /> {errorCount} Typo Error{errorCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {status === 'warning' && (
                    <Badge className="bg-amber-500 text-white hover:bg-amber-600 gap-1 rounded-lg text-[9px] font-bold h-7 px-2">
                      <LucideIcons.AlertTriangle className="h-3.5 w-3.5" /> {warningCount} Mismatch Warning{warningCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {status === 'healthy' && (
                    <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 gap-1 rounded-lg text-[9px] font-bold h-7 px-2">
                      <LucideIcons.CheckCircle2 className="h-3.5 w-3.5" /> Healthy
                    </Badge>
                  )}
                  
                  <Button
                    onClick={() => router.push(`/admin/messaging/templates?edit=${template.id}`)}
                    size="sm"
                    className="rounded-lg font-bold gap-1 text-[10px] bg-blue-600 hover:bg-blue-700 text-white h-7.5 px-3.5 shrink-0 transition-all active:scale-95 shadow-sm"
                  >
                    Fix Template <LucideIcons.ArrowUpRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Diagnostic Issues Details Panel */}
              {(errorCount > 0 || warningCount > 0) && (
                <CardContent className="p-5 bg-muted/10 border-t border-border/30">
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">
                      Audit Log Findings
                    </p>
                    <div className="grid grid-cols-1 gap-2.5">
                      {errors.map((err, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "p-3 rounded-xl border flex items-start gap-3",
                            err.type === 'error' ? "bg-red-50/20 border-red-100" : "bg-amber-50/20 border-amber-100"
                          )}
                        >
                          <div className={cn(
                            "p-1.5 rounded-lg shrink-0 mt-0.5",
                            err.type === 'error' ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"
                          )}>
                            {err.type === 'error' ? (
                              <LucideIcons.XCircle className="h-4 w-4" />
                            ) : (
                              <LucideIcons.AlertTriangle className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-foreground">
                                {`{{${err.variable}}}`}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[8px] h-3.5 font-bold uppercase",
                                  err.type === 'error' ? "border-red-200 text-red-600 bg-red-500/[0.03]" : "border-amber-200 text-amber-600 bg-amber-500/[0.03]"
                                )}
                              >
                                {err.type === 'error' ? 'Typo / Unrecognized' : 'Context Mismatch'}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-relaxed font-semibold mt-1">
                              {err.message}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
