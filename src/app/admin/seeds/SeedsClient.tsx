'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { migrateContractsToEntities, rollbackContractsMigration } from '@/lib/entity-migrations';
import { restoreAllEntitiesToActiveAction } from '@/lib/entity-status-migration';
import { Loader2, Zap, RotateCcw, FileCheck, TriangleAlert, MailCheck, Database, CheckCircle2, AlertCircle, Globe, MapPin, Workflow, ShieldAlert, ShieldCheck, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';
import { migrateAllPermissions } from '@/lib/permissions-migration';
import { seedGlobalTemplatesAction } from '@/app/actions/seed-global-templates-action';
import { seedMaintenanceAction } from '@/app/actions/seed-maintenance-action';
import { executeDealMigration } from '@/app/actions/deal-migration-actions';
import { executeMeetingFerAction } from '@/app/actions/meeting-fer-action';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';

export default function SeedsClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();

  const [migrationStatus, setMigrationStatus] = useState<SeedingState>('idle');
  const [rollbackStatus, setRollbackStatus] = useState<SeedingState>('idle');
  const [permissionsStatus, setPermissionsStatus] = useState<SeedingState>('idle');
  const [globalTemplatesStatus, setGlobalTemplatesStatus] = useState<SeedingState>('idle');
  const [maintenanceStatus, setMaintenanceStatus] = useState<SeedingState>('idle');

  // FER-03 Restoration States
  const [entityRestorationStatus, setEntityRestorationStatus] = useState<SeedingState>('idle');

  // Deal Migration States
  const [dealMigrationStatus, setDealMigrationStatus] = useState<SeedingState>('idle');
  const [dealMigrationMessage, setDealMigrationMessage] = useState<string>('');

  // Meeting FER States
  const [meetingFerStatus, setMeetingFerStatus] = useState<SeedingState>('idle');
  const [meetingFerMessage, setMeetingFerMessage] = useState<string>('');

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

  const handleDealMigration = async () => {
    setDealMigrationStatus('seeding');
    try {
      const orgId = activeOrganizationId || 'smartsapp-hq';
      const result = await executeDealMigration(activeWorkspaceId!, orgId);
      
      if (result.success) {
        setDealMigrationStatus('success');
        setDealMigrationMessage(`Migrated ${result.migratedCount} deals`);
        toast({ title: 'Deals Migrated', description: `Successfully decoupled ${result.migratedCount} deals from entities.` });
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (e: any) {
      setDealMigrationStatus('error');
      setDealMigrationMessage(e.message);
      toast({ variant: 'destructive', title: 'Migration Failed', description: e.message });
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

  const handleSeedMaintenance = async () => {
    setMaintenanceStatus('seeding');
    try {
      const result = await seedMaintenanceAction();
      if (result.success) {
        toast({ title: 'Maintenance Template Seeded!', description: 'The SMS alert for maintenance windows is now active.' });
        setMaintenanceStatus('success');
      } else {
        throw new Error(result.error || 'Failed to seed');
      }
    } catch (error: any) {
      setMaintenanceStatus('error');
      toast({ variant: 'destructive', title: 'Seed Failed', description: error.message });
    } finally {
      setTimeout(() => setMaintenanceStatus('idle'), 2500);
    }
  };

  const handleMeetingFer = async () => {
    setMeetingFerStatus('seeding');
    try {
      const result = await executeMeetingFerAction();
      if (result.success) {
        setMeetingFerStatus('success');
        setMeetingFerMessage(`Enriched ${result.enriched} of ${result.totalMeetings} meetings`);
        toast({ title: 'Meeting FER Complete!', description: `Enriched ${result.enriched} meetings. ${result.skipped} already up to date.` });
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (e: any) {
      setMeetingFerStatus('error');
      setMeetingFerMessage(e.message);
      toast({ variant: 'destructive', title: 'Meeting FER Failed', description: e.message });
    }
  };

  const handleEntityRestoration = async () => {
    setEntityRestorationStatus('seeding');
    try {
      const result = await restoreAllEntitiesToActiveAction(
        'system-admin',
        'System Administrator',
        'admin@smartsapp.com'
      );
      if (result.success) {
        toast({ 
            title: 'FER-03: Entities Restored!', 
            description: result.message 
        });
        setEntityRestorationStatus('success');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      setEntityRestorationStatus('error');
      toast({ variant: 'destructive', title: 'Restoration Failed', description: error.message });
    } finally {
      setTimeout(() => setEntityRestorationStatus('idle'), 2500);
    }
  };

    return (

        <div className="h-full overflow-y-auto w-full">
            <div className="space-y-12 pb-32 w-full">
            
            {/* Header */}
            <div className="flex flex-col items-start text-left">
                <Badge variant="outline" className="mb-4 bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-widest text-[9px] px-3 py-1 ring-1 ring-primary/20">System Governance</Badge>
                <h1 className="text-3xl font-bold mb-2 text-foreground">Infrastructure Seeding</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Execute core schema enrichments and cross-workspace mappings
                </p>
            </div>

            {/* FER Protocol Banner */}
            <div className="bg-blue-50/50 border border-blue-200 p-4 rounded-xl flex items-start gap-3 mt-6">
                <ShieldAlert className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                    <h4 className="text-sm font-bold text-blue-900">FER Protocol Active (Fetch, Enrich, Restore)</h4>
                    <p className="text-xs text-blue-800/80 mt-1 leading-relaxed">
                        All major migrations on this page utilize the transactional FER protocol to guarantee data integrity. Data is **Fetched**, safely **Enriched** in-memory, and **Restored** (committed) via atomic write-batches. Full **Rollback** capability is maintained for all structural migrations.
                    </p>
                </div>
            </div>

            {/* Reference Data — Decouple Entity Deals */}
            <section className="space-y-8">
                <div className="flex flex-col gap-1 items-start">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">Reference Data</h3>
                    <p className="text-muted-foreground font-medium">Seed shared reference data used across the platform.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SimpleMigrationCard
                        title="💼 Decouple Entity Deals"
                        description="Execute the transactional migration of legacy 1:1 entity-pipeline relationships into the new 1:Many Deals collection. This removes stage and pipeline IDs from entities and auto-generates linked deals."
                        onSync={handleDealMigration}
                        status={dealMigrationStatus}
                        icon={Workflow}
                        syncLabel={dealMigrationStatus === 'success' ? (dealMigrationMessage || 'Done') : 'Execute Deal Migration'}
                    />

                    <SimpleMigrationCard
                        title="🛠️ Seed Maintenance Alert"
                        description="Seeds the specialized SMS maintenance template: 'Please note: SmartSapp maintenance runs Sat 9AM–Mon 5AM...'. Essential for system reliability communication."
                        onSync={handleSeedMaintenance}
                        status={maintenanceStatus}
                        icon={TriangleAlert}
                        syncLabel="Seed Maintenance Template"
                        buttonClassName="bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20 ring-2 ring-amber-500 ring-offset-2 ring-offset-background"
                    />
                </div>
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
                        buttonClassName="bg-red-600 hover:bg-red-700 text-white shadow-red-500/20 ring-2 ring-red-500 ring-offset-2 ring-offset-background"
                    />
                </div>
            </section>

            {/* Data Restoration (FER-03) */}
            <section className="space-y-8">
                <div className="flex flex-col gap-1 items-start">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground text-left">Entity Status Restoration (FER-03)</h3>
                    <p className="text-muted-foreground font-medium text-left">Modernize the platform by restoring all entities to "active" status by default.</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <SimpleMigrationCard
                        title="❤️ Restore Entities Hub"
                        description="Fetches all universal identity records (entities) and operational links (workspace_entities) and restores them to status: 'active'. This ensures full visibility in the modernized hub."
                        onSync={handleEntityRestoration}
                        status={entityRestorationStatus}
                        icon={Heart}
                        syncLabel="Restore Active Hub"
                        buttonClassName="bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20 ring-2 ring-rose-500 ring-offset-2 ring-offset-background"
                    />
                </div>
            </section>

            {/* Meeting Infrastructure (FER) */}
            <section className="space-y-8">
                <div className="flex flex-col gap-1 items-start">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground text-left">Meeting Infrastructure (FER)</h3>
                    <p className="text-muted-foreground font-medium text-left">Modernize meeting protocols: enrich slugs, registration defaults, and migrate registrant URLs to the new Waiting Room architecture.</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <SimpleMigrationCard
                        title="🚀 Modernize Meeting Protocols"
                        description="Fetches all meetings and enriches them with V3 defaults (meetingSlug, heroLayout, bannerType, brandingEnabled). Also migrates all registrant personalizedMeetingUrl values to the new /join waiting room route. Safe to re-run."
                        onSync={handleMeetingFer}
                        status={meetingFerStatus}
                        icon={Globe}
                        syncLabel={meetingFerStatus === 'success' ? (meetingFerMessage || 'Done') : 'Execute Meeting FER'}
                        buttonClassName="bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 ring-2 ring-indigo-500 ring-offset-2 ring-offset-background"
                    />
                </div>
            </section>

        </div>
    </div>
  );
}

// Simple migration card for basic seed operations
function SimpleMigrationCard({ title, description, onSync, onRollback, status, icon: Icon, syncLabel = "Map Agreements", buttonClassName }: {
  title: string;
  description: string;
  onSync: () => void;
  onRollback?: () => void;
  status: SeedingState;
  icon: any;
  syncLabel?: string;
  buttonClassName?: string;
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
                    <Button onClick={onSync} disabled={status === 'seeding'} className={cn("rounded-xl font-bold h-12 px-8 shadow-lg transform active:scale-95 transition-all", buttonClassName || "bg-primary hover:bg-primary/90 text-primary-foreground")}>
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
