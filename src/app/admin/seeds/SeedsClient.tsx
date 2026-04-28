'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { migrateContractsToEntities, rollbackContractsMigration } from '@/lib/entity-migrations';
import { Loader2, Zap, RotateCcw, FileCheck, TriangleAlert, MailCheck, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';
import { migrateAllPermissions } from '@/lib/permissions-migration';
import { ShieldAlert } from 'lucide-react';
import { seedGlobalTemplatesAction } from '@/app/actions/seed-global-templates-action';
import {
  fetchEntitiesForSchemaRestructure,
  enrichEntitiesWithNewSchema,
  restoreEntitySchemaRestructure,
  rollbackEntitySchemaRestructure,
  type MigrationResult as EntitySchemaMigrationResult
} from '@/app/actions/entity-schema-restructure-actions';
import {
  fetchSchoolsForSaaSMigration,
  enrichSchoolsWithSaaSIndustry,
  restoreSaaSMigration,
  rollbackSaaSMigration,
  type IndustryMigrationResult,
} from '@/app/actions/industry-migration-actions';
import {
  fetchWorkspacesForIndustryMigration,
  enrichWorkspacesWithIndustry,
  restoreWorkspaceIndustryMigration,
  rollbackWorkspaceIndustryMigration,
  type WorkspaceMigrationResult,
} from '@/app/actions/workspace-industry-migration-actions';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';

export default function SeedsClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeWorkspaceId } = useTenant();
  
  const [migrationStatus, setMigrationStatus] = useState<SeedingState>('idle');
  const [rollbackStatus, setRollbackStatus] = useState<SeedingState>('idle');
  const [permissionsStatus, setPermissionsStatus] = useState<SeedingState>('idle');
  const [globalTemplatesStatus, setGlobalTemplatesStatus] = useState<SeedingState>('idle');
  
  // Entity Schema Restructure States
  const [schemaFetchStatus, setSchemaFetchStatus] = useState<SeedingState>('idle');
  const [schemaEnrichStatus, setSchemaEnrichStatus] = useState<SeedingState>('idle');
  const [schemaRestoreStatus, setSchemaRestoreStatus] = useState<SeedingState>('idle');
  const [schemaRollbackStatus, setSchemaRollbackStatus] = useState<SeedingState>('idle');
  const [schemaMigrationStats, setSchemaMigrationStats] = useState<any | null>(null);

  // SaaS Industry Migration States
  const [saasFetchStatus, setSaasFetchStatus] = useState<SeedingState>('idle');
  const [saasEnrichStatus, setSaasEnrichStatus] = useState<SeedingState>('idle');
  const [saasRestoreStatus, setSaasRestoreStatus] = useState<SeedingState>('idle');
  const [saasRollbackStatus, setSaasRollbackStatus] = useState<SeedingState>('idle');
  const [saasMigrationStats, setSaasMigrationStats] = useState<IndustryMigrationResult | null>(null);

  // Workspace Industry Migration States
  const [workspaceFetchStatus, setWorkspaceFetchStatus] = useState<SeedingState>('idle');
  const [workspaceEnrichStatus, setWorkspaceEnrichStatus] = useState<SeedingState>('idle');
  const [workspaceRestoreStatus, setWorkspaceRestoreStatus] = useState<SeedingState>('idle');
  const [workspaceRollbackStatus, setWorkspaceRollbackStatus] = useState<SeedingState>('idle');
  const [workspaceMigrationStats, setWorkspaceMigrationStats] = useState<WorkspaceMigrationResult | null>(null);

  const handleMigration = async () => {
    if (!firestore) return;
    setMigrationStatus('seeding');
    try {
      await migrateContractsToEntities(firestore);
      toast({ title: 'Agreements Name-Mapped Successfully!' });
      setMigrationStatus('success');
    } catch (error: any) {
      setMigrationStatus('error');
      toast({ variant: 'destructive', title: 'Migration Failed', description: error.message });
    } finally {
      setTimeout(() => setMigrationStatus('idle'), 2500);
    }
  };

  const handleRollback = async () => {
    if (!firestore) return;
    setRollbackStatus('seeding');
    try {
      await rollbackContractsMigration(firestore);
      toast({ title: 'Rollback Completed', description: 'Restored contracts to legacy format.' });
      setRollbackStatus('success');
    } catch (error: any) {
      setRollbackStatus('error');
      toast({ variant: 'destructive', title: 'Rollback Failed', description: error.message });
    } finally {
      setTimeout(() => setRollbackStatus('idle'), 2500);
    }
  };

  const handlePermissionsMigration = async () => {
    if (!firestore || !activeWorkspaceId) return;
    setPermissionsStatus('seeding');
    try {
      // For seeding purposes, we use smarsapp-hq as default if active org is not available
      const orgId = 'smartsapp-hq'; 
      const result = await migrateAllPermissions(firestore, orgId);
      toast({ 
        title: 'Permissions Migrated!', 
        description: `Updated ${result.rolesUpdated} roles and ${result.usersUpdated} users.` 
      });
      setPermissionsStatus('success');
    } catch (error: any) {
      setPermissionsStatus('error');
      toast({ variant: 'destructive', title: 'Migration Failed', description: error.message });
    } finally {
      setTimeout(() => setPermissionsStatus('idle'), 2500);
    }
  };

  const handleSeedGlobalTemplates = async () => {
    setGlobalTemplatesStatus('seeding');
    try {
      const result = await seedGlobalTemplatesAction();
      if (result.failed > 0) {
        toast({
          variant: 'destructive',
          title: 'Seed partially failed',
          description: `Created ${result.created}, skipped ${result.skipped}, failed ${result.failed}.`,
        });
        setGlobalTemplatesStatus('error');
      } else {
        toast({
          title: 'Global templates seeded!',
          description: result.created === 0
            ? `All ${result.skipped} templates already exist — nothing to do.`
            : `Created ${result.created} template(s). Skipped ${result.skipped} existing.`,
        });
        setGlobalTemplatesStatus('success');
      }
    } catch (error: any) {
      setGlobalTemplatesStatus('error');
      toast({ variant: 'destructive', title: 'Seed Failed', description: error.message });
    } finally {
      setTimeout(() => setGlobalTemplatesStatus('idle'), 2500);
    }
  };


  // Entity Schema Restructure Handlers
  const orgIdToUse = 'smartsapp-hq'; // Hardcoded for global admin seeding ops, adjust if needed

  const handleSchemaFetch = async () => {
    setSchemaFetchStatus('seeding');
    try {
      const result = await fetchEntitiesForSchemaRestructure(orgIdToUse);
      if (result.success && result.data) {
        setSchemaMigrationStats(result.data);
        toast({ title: 'Fetch Complete', description: `Found ${result.data.needingMigration} entities needing migration out of ${result.data.total} total.` });
        setSchemaFetchStatus('success');
      } else throw new Error(result.error);
    } catch (error: any) {
      setSchemaFetchStatus('error');
      toast({ variant: 'destructive', title: 'Fetch Failed', description: error.message });
    } finally {
      setTimeout(() => setSchemaFetchStatus('idle'), 2500);
    }
  };

  const handleSchemaEnrich = async () => {
    setSchemaEnrichStatus('seeding');
    try {
      const result = await enrichEntitiesWithNewSchema(orgIdToUse);
      if (result.success && result.data) {
        setSchemaMigrationStats(result.data);
        if (result.data.failed > 0) {
          toast({ variant: 'destructive', title: 'Enrichment Partially Failed', description: `Succeeded: ${result.data.succeeded}, Failed: ${result.data.failed}` });
          setSchemaEnrichStatus('error');
        } else {
          toast({ title: 'Enrichment Complete', description: `Successfully restructured ${result.data.succeeded} entities.` });
          setSchemaEnrichStatus('success');
        }
      } else throw new Error(result.error);
    } catch (error: any) {
      setSchemaEnrichStatus('error');
      toast({ variant: 'destructive', title: 'Enrichment Failed', description: error.message });
    } finally {
      setTimeout(() => setSchemaEnrichStatus('idle'), 2500);
    }
  };

  const handleSchemaRestore = async () => {
    setSchemaRestoreStatus('seeding');
    try {
      const result = await restoreEntitySchemaRestructure(orgIdToUse);
      if (result.success && result.data) {
        setSchemaMigrationStats(result.data);
        if (result.data.invalid > 0) {
          toast({ variant: 'destructive', title: 'Restore Failed Validation', description: `${result.data.invalid} entities have schema issues.` });
          setSchemaRestoreStatus('error');
        } else {
          toast({ title: 'Restore Complete', description: `All ${result.data.valid} entities validated successfully.` });
          setSchemaRestoreStatus('success');
        }
      } else throw new Error(result.error);
    } catch (error: any) {
      setSchemaRestoreStatus('error');
      toast({ variant: 'destructive', title: 'Restore Failed', description: error.message });
    } finally {
      setTimeout(() => setSchemaRestoreStatus('idle'), 2500);
    }
  };

  const handleSchemaRollback = async () => {
    setSchemaRollbackStatus('seeding');
    try {
      const result = await rollbackEntitySchemaRestructure(orgIdToUse);
      if (result.success && result.data) {
        setSchemaMigrationStats(result.data);
        toast({ title: 'Rollback Complete', description: `Reverted ${result.data.succeeded} entities to legacy schema.` });
        setSchemaRollbackStatus('success');
      } else throw new Error(result.error);
    } catch (error: any) {
      setSchemaRollbackStatus('error');
      toast({ variant: 'destructive', title: 'Rollback Failed', description: error.message });
    } finally {
      setTimeout(() => setSchemaRollbackStatus('idle'), 2500);
    }
  };

  // SaaS Industry Migration Handlers
  const handleSaasFetch = async () => {
    setSaasFetchStatus('seeding');
    try {
      const result = await fetchSchoolsForSaaSMigration();
      setSaasMigrationStats(result);
      toast({
        title: 'Fetch Complete',
        description: `Found ${result.succeeded} schools needing migration, ${result.skipped} already migrated.`,
      });
      setSaasFetchStatus('success');
    } catch (error: any) {
      setSaasFetchStatus('error');
      toast({ variant: 'destructive', title: 'Fetch Failed', description: error.message });
    } finally {
      setTimeout(() => setSaasFetchStatus('idle'), 2500);
    }
  };

  const handleSaasEnrich = async () => {
    setSaasEnrichStatus('seeding');
    try {
      const result = await enrichSchoolsWithSaaSIndustry();
      setSaasMigrationStats(result);
      
      if (result.failed > 0) {
        toast({
          variant: 'destructive',
          title: 'Enrichment Partially Failed',
          description: `Succeeded: ${result.succeeded}, Failed: ${result.failed}, Skipped: ${result.skipped}`,
        });
        setSaasEnrichStatus('error');
      } else {
        toast({
          title: 'Enrichment Complete!',
          description: `Successfully enriched ${result.succeeded} schools with SaaS industry data.`,
        });
        setSaasEnrichStatus('success');
      }
    } catch (error: any) {
      setSaasEnrichStatus('error');
      toast({ variant: 'destructive', title: 'Enrichment Failed', description: error.message });
    } finally {
      setTimeout(() => setSaasEnrichStatus('idle'), 2500);
    }
  };

  const handleSaasRestore = async () => {
    setSaasRestoreStatus('seeding');
    try {
      const result = await restoreSaaSMigration();
      setSaasMigrationStats(result);
      
      if (result.failed > 0) {
        toast({
          variant: 'destructive',
          title: 'Restore Partially Failed',
          description: `Validated: ${result.succeeded}, Failed: ${result.failed}`,
        });
        setSaasRestoreStatus('error');
      } else {
        toast({
          title: 'Restore Complete!',
          description: `Successfully validated and finalized ${result.succeeded} schools.`,
        });
        setSaasRestoreStatus('success');
      }
    } catch (error: any) {
      setSaasRestoreStatus('error');
      toast({ variant: 'destructive', title: 'Restore Failed', description: error.message });
    } finally {
      setTimeout(() => setSaasRestoreStatus('idle'), 2500);
    }
  };

  const handleSaasRollback = async () => {
    setSaasRollbackStatus('seeding');
    try {
      const result = await rollbackSaaSMigration();
      setSaasMigrationStats(result);
      toast({
        title: 'Rollback Complete',
        description: `Reverted ${result.succeeded} schools to legacy format.`,
      });
      setSaasRollbackStatus('success');
    } catch (error: any) {
      setSaasRollbackStatus('error');
      toast({ variant: 'destructive', title: 'Rollback Failed', description: error.message });
    } finally {
      setTimeout(() => setSaasRollbackStatus('idle'), 2500);
    }
  };

  // Workspace Industry Migration Handlers
  const handleWorkspaceFetch = async () => {
    setWorkspaceFetchStatus('seeding');
    try {
      const result = await fetchWorkspacesForIndustryMigration();
      setWorkspaceMigrationStats(result);
      toast({
        title: 'Fetch Complete',
        description: `Found ${result.succeeded} workspaces needing migration, ${result.skipped} already migrated.`,
      });
      setWorkspaceFetchStatus('success');
    } catch (error: any) {
      setWorkspaceFetchStatus('error');
      toast({ variant: 'destructive', title: 'Fetch Failed', description: error.message });
    } finally {
      setTimeout(() => setWorkspaceFetchStatus('idle'), 2500);
    }
  };

  const handleWorkspaceEnrich = async () => {
    setWorkspaceEnrichStatus('seeding');
    try {
      const result = await enrichWorkspacesWithIndustry();
      setWorkspaceMigrationStats(result);
      
      if (result.failed > 0) {
        toast({
          variant: 'destructive',
          title: 'Enrichment Partially Failed',
          description: `Succeeded: ${result.succeeded}, Failed: ${result.failed}, Skipped: ${result.skipped}`,
        });
        setWorkspaceEnrichStatus('error');
      } else {
        toast({
          title: 'Enrichment Complete!',
          description: `Successfully enriched ${result.succeeded} workspaces with industry data.`,
        });
        setWorkspaceEnrichStatus('success');
      }
    } catch (error: any) {
      setWorkspaceEnrichStatus('error');
      toast({ variant: 'destructive', title: 'Enrichment Failed', description: error.message });
    } finally {
      setTimeout(() => setWorkspaceEnrichStatus('idle'), 2500);
    }
  };

  const handleWorkspaceRestore = async () => {
    setWorkspaceRestoreStatus('seeding');
    try {
      const result = await restoreWorkspaceIndustryMigration();
      setWorkspaceMigrationStats(result);
      
      if (result.failed > 0) {
        toast({
          variant: 'destructive',
          title: 'Restore Partially Failed',
          description: `Validated: ${result.succeeded}, Failed: ${result.failed}`,
        });
        setWorkspaceRestoreStatus('error');
      } else {
        toast({
          title: 'Restore Complete!',
          description: `Successfully validated and finalized ${result.succeeded} workspaces.`,
        });
        setWorkspaceRestoreStatus('success');
      }
    } catch (error: any) {
      setWorkspaceRestoreStatus('error');
      toast({ variant: 'destructive', title: 'Restore Failed', description: error.message });
    } finally {
      setTimeout(() => setWorkspaceRestoreStatus('idle'), 2500);
    }
  };

  const handleWorkspaceRollback = async () => {
    setWorkspaceRollbackStatus('seeding');
    try {
      const result = await rollbackWorkspaceIndustryMigration();
      setWorkspaceMigrationStats(result);
      toast({
        title: 'Rollback Complete',
        description: `Reverted ${result.succeeded} workspaces to legacy format.`,
      });
      setWorkspaceRollbackStatus('success');
    } catch (error: any) {
      setWorkspaceRollbackStatus('error');
      toast({ variant: 'destructive', title: 'Rollback Failed', description: error.message });
    } finally {
      setTimeout(() => setWorkspaceRollbackStatus('idle'), 2500);
    }
  };

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-12 pb-32">
            
            {/* Header */}
            <div className="flex flex-col items-start text-left">
                <Badge variant="outline" className="mb-4 bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-widest text-[9px] px-3 py-1 ring-1 ring-primary/20">System Governance</Badge>
                <h1 className="text-4xl font-black tracking-tighter mb-2 text-foreground">Infrastructure Seeding</h1>
                <p className="text-muted-foreground font-medium text-lg mt-1">
                    Execute core schema enrichments and cross-workspace mappings
                </p>
            </div>

            
            {/* Entity Schema Restructure Section */}
            <section className="space-y-8">
                <div className="flex flex-col gap-1 items-start">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">Entity Schema Restructure</h3>
                    <p className="text-muted-foreground font-medium">Consolidate institutionData into Entity root and standard FinanceData.</p>
                </div>

                <Card className="border-2 border-purple-200 bg-purple-50/50 shadow-lg rounded-2xl overflow-hidden">
                    <CardContent className="p-8 space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="p-4 bg-purple-100 rounded-2xl w-fit text-purple-700 ring-2 ring-purple-300">
                                <Database className="h-7 w-7" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xl font-bold tracking-tight text-foreground mb-2">InstitutionData Phase-Out</h4>
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    Transforms entities by removing <code className="px-1.5 py-0.5 bg-muted rounded text-xs">institutionData</code>, 
                                    creating standard <code className="px-1.5 py-0.5 bg-muted rounded text-xs">financeData</code>, and moving 
                                    core properties like <code className="px-1.5 py-0.5 bg-muted rounded text-xs">initials</code>, <code className="px-1.5 py-0.5 bg-muted rounded text-xs">logoUrl</code> to the root. Cleans up <code className="px-1.5 py-0.5 bg-muted rounded text-xs">industryData</code>.
                                </p>
                                
                                {schemaMigrationStats && (
                                    <div className="mt-4 p-4 bg-background rounded-xl border border-border">
                                        <div className="grid grid-cols-4 gap-4 text-center">
                                            <div>
                                                <div className="text-2xl font-bold text-foreground">{schemaMigrationStats.total !== undefined ? schemaMigrationStats.total : '-'}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Total</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-green-600">{schemaMigrationStats.succeeded ?? schemaMigrationStats.valid ?? schemaMigrationStats.needingMigration ?? '-'}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Succeeded/Valid/Needed</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-amber-600">{schemaMigrationStats.skipped ?? '-'}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Skipped</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-red-600">{schemaMigrationStats.failed ?? schemaMigrationStats.invalid ?? '-'}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Failed/Invalid</div>
                                            </div>
                                        </div>
                                        {schemaMigrationStats.errors && schemaMigrationStats.errors.length > 0 && (
                                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <div className="flex items-center gap-2 text-red-800 font-semibold text-sm mb-2">
                                                    <AlertCircle className="h-4 w-4" />
                                                    Errors ({schemaMigrationStats.errors.length})
                                                </div>
                                                <div className="text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                                                    {schemaMigrationStats.errors.slice(0, 5).map((error: string, idx: number) => (
                                                        <div key={idx} className="font-mono">{error}</div>
                                                    ))}
                                                    {schemaMigrationStats.errors.length > 5 && (
                                                        <div className="text-red-600 font-semibold">
                                                            ... and {schemaMigrationStats.errors.length - 5} more errors
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 mt-4 border-t border-border/50">
                            <Button 
                                onClick={handleSchemaFetch} 
                                disabled={schemaFetchStatus === 'seeding'}
                                variant="outline"
                                className="rounded-xl font-bold h-12 px-6 border-2 hover:bg-purple-50 hover:border-purple-300 transition-all"
                            >
                                {schemaFetchStatus === 'seeding' ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Database className="h-5 w-5 mr-2" />}
                                Fetch
                            </Button>

                            <Button 
                                onClick={handleSchemaEnrich} 
                                disabled={schemaEnrichStatus === 'seeding'}
                                className="rounded-xl font-bold h-12 px-6 bg-purple-600 hover:bg-purple-700 text-white shadow-lg transform active:scale-95 transition-all"
                            >
                                {schemaEnrichStatus === 'seeding' ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Zap className="h-5 w-5 mr-2" />}
                                Enrich
                            </Button>

                            <Button 
                                onClick={handleSchemaRestore} 
                                disabled={schemaRestoreStatus === 'seeding'}
                                variant="outline"
                                className="rounded-xl font-bold h-12 px-6 border-2 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 transition-all"
                            >
                                {schemaRestoreStatus === 'seeding' ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                                Restore
                            </Button>
                        </div>

                        <div className="pt-2">
                            <Button 
                                onClick={handleSchemaRollback} 
                                disabled={schemaRollbackStatus === 'seeding'}
                                variant="ghost" 
                                className="w-full rounded-xl font-bold border-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 h-12 px-6 shadow-sm active:scale-95 transition-all ring-1 ring-rose-200/50"
                            >
                                {schemaRollbackStatus === 'seeding' ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <TriangleAlert className="h-5 w-5 mr-2" />}
                                Rollback Schema Migration
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Workspace Industry Migration Section */}
            <section className="space-y-8">
                <div className="flex flex-col gap-1 items-start">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">Workspace Industry Migration</h3>
                    <p className="text-muted-foreground font-medium">Assign correct industry verticals to workspaces and lock their scope.</p>
                </div>

                <Card className="border-2 border-blue-200 bg-blue-50/50 shadow-lg rounded-2xl overflow-hidden">
                    <CardContent className="p-8 space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="p-4 bg-blue-100 rounded-2xl w-fit text-blue-700 ring-2 ring-blue-300">
                                <Database className="h-7 w-7" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xl font-bold tracking-tight text-foreground mb-2">Workspace Industry Assignment</h4>
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    Assigns correct industry verticals to workspaces based on their names and locks their industry scope. 
                                    This migration sets <code className="px-1.5 py-0.5 bg-muted rounded text-xs">industry</code>, 
                                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">industryScopeLocked</code>, and 
                                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">industryScopeLockedAt</code> fields.
                                </p>
                                
                                {workspaceMigrationStats && (
                                    <div className="mt-4 p-4 bg-background rounded-xl border border-border">
                                        <div className="grid grid-cols-4 gap-4 text-center">
                                            <div>
                                                <div className="text-2xl font-bold text-foreground">{workspaceMigrationStats.total}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Total</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-green-600">{workspaceMigrationStats.succeeded}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Succeeded</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-amber-600">{workspaceMigrationStats.skipped}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Skipped</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-red-600">{workspaceMigrationStats.failed}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Failed</div>
                                            </div>
                                        </div>
                                        
                                        {/* Workspace Details Table */}
                                        {workspaceMigrationStats.workspaceDetails && workspaceMigrationStats.workspaceDetails.length > 0 && (
                                            <div className="mt-4 overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/50 border-b border-border">
                                                        <tr>
                                                            <th className="text-left p-2 font-semibold">Workspace Name</th>
                                                            <th className="text-left p-2 font-semibold">Current Industry</th>
                                                            <th className="text-left p-2 font-semibold">Target Industry</th>
                                                            <th className="text-left p-2 font-semibold">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {workspaceMigrationStats.workspaceDetails.map((ws, idx) => (
                                                            <tr key={idx} className="border-b border-border/50">
                                                                <td className="p-2 font-medium">{ws.name}</td>
                                                                <td className="p-2 text-muted-foreground">{ws.currentIndustry || 'undefined'}</td>
                                                                <td className="p-2 font-semibold text-blue-700">{ws.targetIndustry}</td>
                                                                <td className="p-2">
                                                                    <Badge variant={ws.status === 'success' ? 'default' : ws.status === 'failed' ? 'destructive' : 'secondary'}>
                                                                        {ws.status}
                                                                    </Badge>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                        
                                        {workspaceMigrationStats.errors.length > 0 && (
                                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <div className="flex items-center gap-2 text-red-800 font-semibold text-sm mb-2">
                                                    <AlertCircle className="h-4 w-4" />
                                                    Errors ({workspaceMigrationStats.errors.length})
                                                </div>
                                                <div className="text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                                                    {workspaceMigrationStats.errors.slice(0, 5).map((error, idx) => (
                                                        <div key={idx} className="font-mono">{error}</div>
                                                    ))}
                                                    {workspaceMigrationStats.errors.length > 5 && (
                                                        <div className="text-red-600 font-semibold">
                                                            ... and {workspaceMigrationStats.errors.length - 5} more errors
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 mt-4 border-t border-border/50">
                            {/* Fetch Button */}
                            <Button 
                                onClick={handleWorkspaceFetch} 
                                disabled={workspaceFetchStatus === 'seeding'}
                                variant="outline"
                                className="rounded-xl font-bold h-12 px-6 border-2 hover:bg-blue-50 hover:border-blue-300 transition-all"
                            >
                                {workspaceFetchStatus === 'seeding' ? (
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                ) : (
                                    <Database className="h-5 w-5 mr-2" />
                                )}
                                Fetch
                            </Button>

                            {/* Enrich Button */}
                            <Button 
                                onClick={handleWorkspaceEnrich} 
                                disabled={workspaceEnrichStatus === 'seeding'}
                                className="rounded-xl font-bold h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-lg transform active:scale-95 transition-all"
                            >
                                {workspaceEnrichStatus === 'seeding' ? (
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                ) : (
                                    <Zap className="h-5 w-5 mr-2" />
                                )}
                                Enrich
                            </Button>

                            {/* Restore Button */}
                            <Button 
                                onClick={handleWorkspaceRestore} 
                                disabled={workspaceRestoreStatus === 'seeding'}
                                variant="outline"
                                className="rounded-xl font-bold h-12 px-6 border-2 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 transition-all"
                            >
                                {workspaceRestoreStatus === 'seeding' ? (
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                ) : (
                                    <CheckCircle2 className="h-5 w-5 mr-2" />
                                )}
                                Restore
                            </Button>
                        </div>

                        {/* Rollback Button (Full Width) */}
                        <div className="pt-2">
                            <Button 
                                onClick={handleWorkspaceRollback} 
                                disabled={workspaceRollbackStatus === 'seeding'}
                                variant="ghost" 
                                className="w-full rounded-xl font-bold border-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 h-12 px-6 shadow-sm active:scale-95 transition-all ring-1 ring-rose-200/50"
                            >
                                {workspaceRollbackStatus === 'seeding' ? (
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                ) : (
                                    <TriangleAlert className="h-5 w-5 mr-2" />
                                )}
                                Rollback Workspace Migration
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* SaaS Industry Migration Section */}
            <section className="space-y-8">
                <div className="flex flex-col gap-1 items-start">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">SaaS Industry Migration</h3>
                    <p className="text-muted-foreground font-medium">Migrate existing schools to SaaS industry vertical with proper industryData structure.</p>
                </div>

                <Card className="border-2 border-primary/20 bg-primary/5 shadow-lg rounded-2xl overflow-hidden">
                    <CardContent className="p-8 space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="p-4 bg-primary/10 rounded-2xl w-fit text-primary ring-2 ring-primary/30">
                                <Database className="h-7 w-7" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xl font-bold tracking-tight text-foreground mb-2">Industry-Scoped Entity Expansion</h4>
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    Transform existing schools into SaaS industry entities with proper <code className="px-1.5 py-0.5 bg-muted rounded text-xs">industryData</code> structure. 
                                    This migration maps legacy fields (<code className="px-1.5 py-0.5 bg-muted rounded text-xs">nominalRoll</code> → <code className="px-1.5 py-0.5 bg-muted rounded text-xs">companySize</code>, 
                                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">subscriptionPackage</code> → <code className="px-1.5 py-0.5 bg-muted rounded text-xs">planType</code>) 
                                    and creates unified entity architecture.
                                </p>
                                
                                {saasMigrationStats && (
                                    <div className="mt-4 p-4 bg-background rounded-xl border border-border">
                                        <div className="grid grid-cols-4 gap-4 text-center">
                                            <div>
                                                <div className="text-2xl font-bold text-foreground">{saasMigrationStats.total}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Total</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-green-600">{saasMigrationStats.succeeded}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Succeeded</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-amber-600">{saasMigrationStats.skipped}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Skipped</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-red-600">{saasMigrationStats.failed}</div>
                                                <div className="text-xs text-muted-foreground font-medium">Failed</div>
                                            </div>
                                        </div>
                                        {saasMigrationStats.errors.length > 0 && (
                                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <div className="flex items-center gap-2 text-red-800 font-semibold text-sm mb-2">
                                                    <AlertCircle className="h-4 w-4" />
                                                    Errors ({saasMigrationStats.errors.length})
                                                </div>
                                                <div className="text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                                                    {saasMigrationStats.errors.slice(0, 5).map((error, idx) => (
                                                        <div key={idx} className="font-mono">{error}</div>
                                                    ))}
                                                    {saasMigrationStats.errors.length > 5 && (
                                                        <div className="text-red-600 font-semibold">
                                                            ... and {saasMigrationStats.errors.length - 5} more errors
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 mt-4 border-t border-border/50">
                            {/* Fetch Button */}
                            <Button 
                                onClick={handleSaasFetch} 
                                disabled={saasFetchStatus === 'seeding'}
                                variant="outline"
                                className="rounded-xl font-bold h-12 px-6 border-2 hover:bg-primary/5 hover:border-primary/30 transition-all"
                            >
                                {saasFetchStatus === 'seeding' ? (
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                ) : (
                                    <Database className="h-5 w-5 mr-2" />
                                )}
                                Fetch
                            </Button>

                            {/* Enrich Button */}
                            <Button 
                                onClick={handleSaasEnrich} 
                                disabled={saasEnrichStatus === 'seeding'}
                                className="rounded-xl font-bold h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transform active:scale-95 transition-all"
                            >
                                {saasEnrichStatus === 'seeding' ? (
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                ) : (
                                    <Zap className="h-5 w-5 mr-2" />
                                )}
                                Enrich
                            </Button>

                            {/* Restore Button */}
                            <Button 
                                onClick={handleSaasRestore} 
                                disabled={saasRestoreStatus === 'seeding'}
                                variant="outline"
                                className="rounded-xl font-bold h-12 px-6 border-2 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 transition-all"
                            >
                                {saasRestoreStatus === 'seeding' ? (
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                ) : (
                                    <CheckCircle2 className="h-5 w-5 mr-2" />
                                )}
                                Restore
                            </Button>
                        </div>

                        {/* Rollback Button (Full Width) */}
                        <div className="pt-2">
                            <Button 
                                onClick={handleSaasRollback} 
                                disabled={saasRollbackStatus === 'seeding'}
                                variant="ghost" 
                                className="w-full rounded-xl font-bold border-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 h-12 px-6 shadow-sm active:scale-95 transition-all ring-1 ring-rose-200/50"
                            >
                                {saasRollbackStatus === 'seeding' ? (
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                ) : (
                                    <TriangleAlert className="h-5 w-5 mr-2" />
                                )}
                                Rollback SaaS Migration
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Core Migrations */}
            <section className="space-y-8">
                <div className="flex flex-col gap-1 items-start">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">Active Protocols</h3>
                    <p className="text-muted-foreground font-medium">Currently active Fetch, Enrich, and Restore (FER) streams.</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <SimpleMigrationCard 
                        title="Agreements Name Mapping (FER)"
                        description="Fetches all global contracts, maps them to their respective Unified Entities by comparing 'schoolName', and restores the corrected 'entityId' and 'entityName' properties. Resolves missing Agreements views."
                        icon={FileCheck}
                        status={migrationStatus}
                        onSync={handleMigration}
                        onRollback={handleRollback}
                    />
                    <SimpleMigrationCard 
                        title="Hierarchical RBAC Migration (Permissions Expansion)"
                        description="Core Protocol: Converts legacy flat permission arrays into the new nested PermissionsSchema (Section -> Feature -> Action). Updates both Roles and User profiles to ensure enterprise-grade authorization."
                        icon={ShieldAlert}
                        status={permissionsStatus}
                        onSync={handlePermissionsMigration}
                        syncLabel="Migrate Permissions"
                    />
                    <SimpleMigrationCard
                        title="Seed Global Message Templates"
                        description="Creates the full set of global default message templates across all categories: Meetings, Meeting Reminders, Forms, Surveys, Agreements, and General. All templates are seeded as approved and active. Safe to re-run — existing templates are skipped."
                        icon={MailCheck}
                        status={globalTemplatesStatus}
                        onSync={handleSeedGlobalTemplates}
                        syncLabel="Seed Templates"
                    />
                </div>
            </section>
        </div>
    </div>
  );
}

// Simple migration card for basic seed operations
function SimpleMigrationCard({ title, description, onSync, onRollback, status, icon: Icon, syncLabel = "Map Agreements" }: {
  title: string;
  description: string;
  onSync: () => void;
  onRollback?: () => void;
  status: SeedingState;
  icon: any;
  syncLabel?: string;
}) {
    return (
        <Card className="border border-border bg-transparent shadow-sm rounded-2xl ring-1 ring-border overflow-hidden text-left group">
            <CardContent className="p-8 space-y-6">
                <div className="flex items-start justify-between gap-6">
                    <div className="space-y-4">
                        <div className="p-4 bg-primary/10 rounded-2xl w-fit text-primary ring-1 ring-primary/20 group-hover:scale-110 transition-transform"><Icon className="h-6 w-6" /></div>
                        <div>
                            <h4 className="text-xl font-bold tracking-tight text-foreground">{title}</h4>
                            <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-2xl mt-2">{description}</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4 pt-6 mt-4 border-t border-border/50">
                    <Button onClick={onSync} disabled={status === 'seeding'} className="rounded-xl font-bold h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transform active:scale-95 transition-all">
                        {status === 'seeding' ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Zap className="h-5 w-5 mr-2" />} {syncLabel}
                    </Button>
                    {onRollback && (
                        <Button variant="ghost" onClick={onRollback} className="rounded-xl font-bold border-rose-200 text-rose-600 hover:bg-rose-50 h-12 px-6 shadow-sm active:scale-95 transition-all ring-1 ring-rose-200/50">
                            <TriangleAlert className="h-5 w-5 mr-2" /> Rollback
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
