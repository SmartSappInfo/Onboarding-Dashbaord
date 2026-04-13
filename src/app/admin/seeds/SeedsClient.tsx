'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { 
    enrichOperationalData,
    syncOperationalArchitecture,
    enrichTasksWithWorkspace,
    enrichActivitiesWithWorkspace,
    enrichRolesWithWorkspaces,
    enrichUsers,
    seedWorkspaces,
    seedBillingData,
    rollbackSchoolsMigration,
    rollbackTasksMigration,
    rollbackActivitiesMigration,
    seedPageTemplates
} from '@/lib/seed';
import {
    migrateSchoolsToEntities,
    rollbackEntitiesMigration,
    verifyEntitiesMigration,
    migrateContractsToEntities,
    rollbackContractsMigration,
    migrateSubmissionsToEntities,
    rollbackSubmissionsMigration
} from '@/lib/entity-migrations';
import { migrateGlobalSettingsToAllOrgsAction } from '@/lib/settings-migrations';
import { MigrationCard } from '@/components/seeds/MigrationCard';
import { createMigrationEngine } from '@/lib/migration-engine';
import type { MigrationStatusType } from '@/lib/migration-types';
import { 
    Loader2, 
    Database, 
    ShieldCheck, 
    ArrowRightLeft, 
    RotateCcw,
    Zap,
    Workflow,
    Building,
    Banknote,
    Lock,
    Key,
    ArrowRight,
    Layout,
    History,
    FileText,
    ClipboardList,
    Smartphone,
    Globe,
    CheckSquare,
    Layers,
    Users,
    TriangleAlert,
    FileCheck
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmartSappLogo } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';

export default function SeedsClient() {
  const firestore = useFirestore();
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [seedingStatus, setSeedingStatus] = useState<Record<string, SeedingState>>({
    enrich_op: 'idle',
    sync_arch: 'idle',
    tasks: 'idle',
    activities: 'idle',
    roles: 'idle',
    users: 'idle',
    workspaces: 'idle',
    billing: 'idle',
    rollback_schools: 'idle',
    migrate_entities: 'idle',
    rollback_entities: 'idle',
    verify_entities: 'idle',
    migrate_all_features: 'idle',
    migrate_settings: 'idle',
    templates: 'idle'
  });

  // Feature migration state
  const [featureMigrationStatus, setFeatureMigrationStatus] = useState<Record<string, {
    status: MigrationStatusType;
    totalRecords: number;
    migratedRecords: number;
    unmigratedRecords: number;
    failedRecords: number;
  }>>({
    tasks: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    activities: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    forms: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    invoices: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    meetings: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    surveys: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    message_logs: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    pdfs: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    automation_logs: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    form_submissions: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    survey_responses: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    signups: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    profiles: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 },
    settings: { status: 'not_started', totalRecords: 0, migratedRecords: 0, unmigratedRecords: 0, failedRecords: 0 }
  });

  const [migrationLog, setMigrationLog] = useState<string[]>([]);

  // Debug: Log when component mounts
  React.useEffect(() => {
    console.log('SeedsClient mounted');
    console.log('Feature migration status:', featureMigrationStatus);
    console.log('Is unlocked:', isUnlocked);
  }, [isUnlocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'mijay2123') {
        setIsUnlocked(true);
        toast({ title: 'Access Granted' });
    } else {
        toast({ variant: 'destructive', title: 'Invalid Password' });
        setPassword('');
    }
  };

  const handleAction = async (key: string, fn: Function) => {
    if (!firestore) return;
    setSeedingStatus(prev => ({ ...prev, [key]: 'seeding' }));
    try {
      await fn(firestore);
      toast({ title: 'Protocol Executed Successfully' });
      setSeedingStatus(prev => ({ ...prev, [key]: 'success' }));
    } catch (error: any) {
      setSeedingStatus(prev => ({ ...prev, [key]: 'error' }));
      toast({ variant: 'destructive', title: 'Action Failed', description: error.message });
    } finally {
      setTimeout(() => setSeedingStatus(prev => ({ ...prev, [key]: 'idle' })), 2000);
    }
  };

  // Feature migration handlers
  const createFeatureMigrationHandlers = (collectionName: string) => {
    if (!firestore) {
      throw new Error('Firestore not initialized');
    }
    
    const engine = createMigrationEngine(firestore);
    
    return {
      onFetch: async () => {
        const result = await engine.fetch(collectionName);
        setFeatureMigrationStatus(prev => ({
          ...prev,
          [collectionName]: {
            ...prev[collectionName],
            totalRecords: result.totalRecords,
            unmigratedRecords: result.recordsToMigrate
          }
        }));
        return result;
      },
      onEnrichAndRestore: async () => {
        setFeatureMigrationStatus(prev => ({
          ...prev,
          [collectionName]: { ...prev[collectionName], status: 'in_progress' }
        }));
        
        const fetchResult = await engine.fetch(collectionName);
        if (fetchResult.recordsToMigrate === 0) {
          setFeatureMigrationStatus(prev => ({
            ...prev,
            [collectionName]: { ...prev[collectionName], status: 'completed' }
          }));
          return { total: 0, succeeded: 0, failed: 0, skipped: fetchResult.totalRecords, errors: [] };
        }

        // Get all unmigrated records
        const allRecords = await getAllUnmigratedRecords(firestore, collectionName);
        const batches = chunkArray(allRecords, 450);

        const aggregatedResult = {
          total: allRecords.length,
          succeeded: 0,
          failed: 0,
          skipped: 0,
          errors: [] as Array<{ id: string; error: string }>
        };

        for (let i = 0; i < batches.length; i++) {
          const batch = {
            collection: collectionName,
            records: batches[i],
            batchSize: 450,
            totalBatches: batches.length,
            currentBatch: i + 1
          };

          try {
            const enrichedBatch = await engine.enrich(batch);
            const batchResult = await engine.restore(enrichedBatch);

            aggregatedResult.succeeded += batchResult.succeeded;
            aggregatedResult.failed += batchResult.failed;
            aggregatedResult.skipped += batchResult.skipped;
            aggregatedResult.errors.push(...batchResult.errors);
          } catch (error) {
            aggregatedResult.failed += batch.records.length;
            for (const record of batch.records) {
              aggregatedResult.errors.push({
                id: record.id,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
        }

        setFeatureMigrationStatus(prev => ({
          ...prev,
          [collectionName]: {
            status: aggregatedResult.failed > 0 ? 'failed' : 'completed',
            totalRecords: fetchResult.totalRecords,
            migratedRecords: aggregatedResult.succeeded,
            unmigratedRecords: aggregatedResult.failed,
            failedRecords: aggregatedResult.failed
          }
        }));

        return aggregatedResult;
      },
      onVerify: async () => {
        const result = await engine.verify(collectionName);
        setFeatureMigrationStatus(prev => ({
          ...prev,
          [collectionName]: {
            ...prev[collectionName],
            totalRecords: result.totalRecords,
            migratedRecords: result.migratedRecords,
            unmigratedRecords: result.unmigratedRecords,
            failedRecords: result.orphanedRecords
          }
        }));
        return result;
      },
      onRollback: async () => {
        const result = await engine.rollback(collectionName);
        setFeatureMigrationStatus(prev => ({
          ...prev,
          [collectionName]: {
            status: 'not_started',
            totalRecords: prev[collectionName].totalRecords,
            migratedRecords: 0,
            unmigratedRecords: prev[collectionName].totalRecords,
            failedRecords: 0
          }
        }));
        return result;
      }
    };
  };

  // Migrate all features sequentially
  const handleMigrateAllFeatures = async () => {
    if (!firestore) return;
    
    setSeedingStatus(prev => ({ ...prev, migrate_all_features: 'seeding' }));
    setMigrationLog(['Starting sequential migration of all features...']);
    
    const collections = Object.keys(featureMigrationStatus);
    
    for (const collection of collections) {
      try {
        setMigrationLog(prev => [...prev, `\nMigrating ${collection}...`]);
        const handlers = createFeatureMigrationHandlers(collection);
        const result = await handlers.onEnrichAndRestore();
        setMigrationLog(prev => [
          ...prev,
          `✓ ${collection}: ${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped`
        ]);
      } catch (error) {
        setMigrationLog(prev => [
          ...prev,
          `✗ ${collection}: ${error instanceof Error ? error.message : String(error)}`
        ]);
      }
    }
    
    setMigrationLog(prev => [...prev, '\nMigration complete!']);
    setSeedingStatus(prev => ({ ...prev, migrate_all_features: 'success' }));
    toast({ title: 'All Features Migrated' });
    
    setTimeout(() => setSeedingStatus(prev => ({ ...prev, migrate_all_features: 'idle' })), 2000);
  };

  // Helper functions
  async function getAllUnmigratedRecords(firestore: any, collectionName: string) {
    const { collection, getDocs } = await import('firebase/firestore');
    const collectionRef = collection(firestore, collectionName);
    const snapshot = await getDocs(collectionRef);

    const unmigratedRecords: any[] = [];
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (data.schoolId && !data.entityId) {
        unmigratedRecords.push({ id: docSnapshot.id, ...data });
      }
    });

    return unmigratedRecords;
  }

  function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  if (!isUnlocked) {
    return (
 <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
 <div className="mb-12 text-center space-y-4">
 <SmartSappLogo variant="white" className="h-10 mx-auto" />
 <h1 className="text-white text-3xl font-semibold tracking-tighter">System Seeding Hub</h1>
            </div>
 <Card className="w-full max-w-md rounded-[2.5rem] glass-card overflow-hidden">
 <CardHeader className="bg-background p-8 border-b text-center">
 <div className="mx-auto bg-primary/10 w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-4">
 <Lock className="h-8 w-8 text-primary" />
                    </div>
 <CardTitle className="text-xl font-semibold ">Protected Area</CardTitle>
 <CardDescription className="text-xs font-bold text-muted-foreground">Authorized development access only</CardDescription>
                </CardHeader>
                <form onSubmit={handleUnlock}>
 <CardContent className="p-8 space-y-6">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1 text-left block">Master Key</Label>
 <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-semibold text-xl" autoFocus />
                        </div>
                    </CardContent>
 <CardFooter className="p-6 bg-muted/30 border-t">
 <Button type="submit" className="w-full h-12 rounded-xl font-semibold gap-2 shadow-xl active:scale-95 transition-all">Unlock Engine <ArrowRight size={16} /></Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
  }

  return (
 <div className="min-h-screen bg-background pb-32 text-left">
 <header className="bg-card/50 backdrop-blur-md border-b h-20 flex items-center px-8 shadow-sm">
 <div className=" w-full flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="p-2 bg-primary/10 rounded-xl"><Database className="h-6 w-6 text-primary" /></div>
                    <div>
 <h1 className="text-xl font-semibold tracking-tight">Institutional Sync Console</h1>
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[8px] h-4 uppercase font-semibold px-1.5">Active Session</Badge>
                    </div>
                </div>
 <div className="flex items-center gap-3">
 <Button variant="ghost" onClick={() => setIsUnlocked(false)} className="rounded-xl font-bold gap-2"><Lock size={16} /> Lock</Button>
 <Button variant="outline" onClick={() => router.push('/admin')} className="rounded-xl font-bold border-primary/20 text-primary">Dashboard</Button>
                </div>
            </div>
        </header>

 <main className=" p-8 space-y-12">
            {/* Operational Integrity Section */}
 <section className="space-y-6">
 <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-background font-semibold text-[10px] uppercase  px-3 py-1 border-primary/20 text-primary">Architectural Restoration</Badge>
 <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                </div>
 <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-card">
 <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <SimpleMigrationCard 
                            title="Blueprint Reconstruction" 
                            description="Harvests pipeline and stage snapshots from schools to rebuild missing operational logic."
                            onSync={() => handleAction('sync_arch', syncOperationalArchitecture)}
                            status={seedingStatus.sync_arch}
                            icon={Workflow}
                        />
                        <SimpleMigrationCard 
                            title="Shared Registry Sync" 
                            description="Migrates Schools, Meetings, Surveys, and PDFs to shared workspace arrays."
                            onSync={() => handleAction('enrich_op', enrichOperationalData)}
                            status={seedingStatus.enrich_op}
                            icon={Layers}
                        />
                        <SimpleMigrationCard 
                            title="Timeline Binding" 
                            description="Strictly binds activities and audit logs to their respective operational tracks."
                            onSync={() => handleAction('activities', enrichActivitiesWithWorkspace)}
                            onRollback={() => handleAction('rollback_activities', rollbackActivitiesMigration)}
                            status={seedingStatus.activities}
                            icon={History}
                        />
                    </CardContent>
                </Card>
            </section>

            {/* FER Protocol / Institutional Sync Section */}
 <section className="space-y-6">
 <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-indigo-50 font-semibold text-[10px] uppercase  px-3 py-1 border-indigo-200 text-indigo-600">FER Protocol / Institutional Sync</Badge>
 <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent" />
                </div>
 <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-indigo-100 overflow-hidden bg-gradient-to-br from-indigo-50/50 to-white">
 <CardHeader className="p-8 pb-4">
 <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2 text-indigo-900">
 <Zap className="h-5 w-5 text-indigo-600" />
                            Settings Isolation & Provisioning
                        </CardTitle>
 <CardDescription className="text-[10px] font-medium tracking-tighter text-indigo-700/60">
                            Migrate global settings to organization-specific buckets and provision mandatory defaults.
                        </CardDescription>
                    </CardHeader>
 <CardContent className="p-8 pt-0 space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="p-6 rounded-3xl bg-card border border-indigo-100 shadow-sm space-y-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600"><RotateCcw size={18} /></div>
 <h4 className="text-xs font-semibold tracking-tight">Legacy Settings Migration</h4>
                                </div>
 <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">
                                    Clones all existing global Roles, Modules, and Zones into every current organization for immediate isolation.
                                </p>
                                <Button 
                                    onClick={() => handleAction('migrate_settings', migrateGlobalSettingsToAllOrgsAction)}
                                    disabled={seedingStatus.migrate_settings === 'seeding'}
 className="w-full h-10 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] gap-2"
                                >
 {seedingStatus.migrate_settings === 'seeding' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                    Initialize Isolation Protocol
                                </Button>
                            </div>

 <div className="p-6 rounded-3xl bg-indigo-900 text-white shadow-xl space-y-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-indigo-800 rounded-xl"><ShieldCheck size={18} /></div>
 <h4 className="text-xs font-semibold tracking-tight">FER Provisioning Logic</h4>
                                </div>
 <p className="text-[9px] font-medium text-indigo-200 leading-relaxed">
                                    Verifies that the new organization provisioning logic is active. Administrator, Supervisor, and Finance Officer roles will be created.
                                </p>
 <div className="flex items-center gap-2 pt-2">
                                    <Badge className="bg-indigo-800 text-indigo-300 border-none text-[8px] font-semibold  px-2 py-0.5 uppercase">Status: Operational</Badge>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Entity Architecture Migration Section - NEW */}
 <section className="space-y-6">
 <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-emerald-50 font-semibold text-[10px] uppercase  px-3 py-1 border-emerald-200 text-emerald-600">Entity Architecture Migration</Badge>
 <div className="h-px flex-1 bg-gradient-to-r from-emerald-200 to-transparent" />
                </div>
 <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-emerald-100 overflow-hidden bg-gradient-to-br from-emerald-50/50 to-white">
 <CardHeader className="p-8 pb-4">
 <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
 <Database className="h-5 w-5 text-emerald-600" />
                            Schools → Entities + Workspace_Entities
                        </CardTitle>
 <CardDescription className="text-[10px] font-medium tracking-tighter text-muted-foreground">
                            Core migration to multi-scope entity architecture. Creates entities collection and workspace_entities link collection.
                        </CardDescription>
                    </CardHeader>
 <CardContent className="p-8 pt-0 space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Button 
                                onClick={() => handleAction('migrate_entities', migrateSchoolsToEntities)} 
                                disabled={seedingStatus.migrate_entities === 'seeding'}
 className="h-14 rounded-xl font-semibold shadow-lg text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-between px-6"
                            >
 <div className="flex items-center gap-3">
                                    {seedingStatus.migrate_entities === 'seeding' ? (
 <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
 <ArrowRightLeft className="h-5 w-5" />
                                    )}
                                    <span>Migrate All Schools</span>
                                </div>
 <ArrowRight className="h-4 w-4 opacity-50" />
                            </Button>
                            
                            <Button 
                                onClick={() => handleAction('verify_entities', verifyEntitiesMigration)} 
                                disabled={seedingStatus.verify_entities === 'seeding'}
                                variant="outline"
 className="h-14 rounded-xl font-semibold border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[10px] flex items-center justify-between px-6"
                            >
 <div className="flex items-center gap-3">
                                    {seedingStatus.verify_entities === 'seeding' ? (
 <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
 <ShieldCheck className="h-5 w-5" />
                                    )}
                                    <span>Verify Migration</span>
                                </div>
                            </Button>
                            
                            <Button 
                                onClick={() => handleAction('rollback_entities', rollbackEntitiesMigration)} 
                                disabled={seedingStatus.rollback_entities === 'seeding'}
                                variant="outline"
 className="h-14 rounded-xl font-semibold border-2 border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] flex items-center justify-between px-6"
                            >
 <div className="flex items-center gap-3">
                                    {seedingStatus.rollback_entities === 'seeding' ? (
 <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
 <RotateCcw className="h-5 w-5" />
                                    )}
                                    <span>Rollback Migration</span>
                                </div>
                            </Button>
                        </div>
                        
 <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-6 space-y-3">
 <div className="flex items-start gap-3">
 <div className="p-2 bg-emerald-100 rounded-lg">
 <Database className="h-4 w-4 text-emerald-600" />
                                </div>
 <div className="flex-1 space-y-2">
 <h4 className="text-[10px] font-semibold text-emerald-900">Migration Details</h4>
 <ul className="text-[9px] font-medium text-emerald-700 space-y-1 tracking-tighter">
                                        <li>• Creates entity documents with entityType: institution</li>
                                        <li>• Creates workspace_entities for each workspace link</li>
                                        <li>• Migrates tags to globalTags and workspaceTags</li>
                                        <li>• Sets migrationStatus: "migrated" on schools</li>
                                        <li>• Fully idempotent - safe to run multiple times</li>
                                        <li>• Creates backup_entities_migration for rollback</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Dedicated Survey Migration Section - Highly Visible */}
 <section className="space-y-6" id="survey-migration">
 <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-amber-50 font-semibold text-[10px] uppercase  px-3 py-1 border-amber-200 text-amber-600">Dedicated Survey Migration</Badge>
 <div className="h-px flex-1 bg-gradient-to-r from-amber-200 to-transparent" />
                </div>
                
 <Card className="rounded-[2.5rem] border-none shadow-sm ring-2 ring-amber-400 overflow-hidden bg-gradient-to-br from-amber-50/80 to-white">
 <CardHeader className="p-8 pb-4">
 <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2 text-amber-700">
 <CheckSquare className="h-6 w-6 text-amber-600" />
                            Migrate Surveys & Responses
                        </CardTitle>
 <CardDescription className="text-[10px] font-medium text-amber-900/60 tracking-tighter">
                            Mandatory data migration for all Survey architecture. Binds forms to the new Workspace Entities.
                        </CardDescription>
                    </CardHeader>
 <CardContent className="p-8 pt-0">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-card p-6 rounded-2xl border border-amber-100 shadow-inner">
                            <MigrationCard
                                featureName="Surveys Configuration"
                                collectionName="surveys"
                                description="Migrate survey records to use entityId for contact references"
                                status={featureMigrationStatus.surveys.status}
                                totalRecords={featureMigrationStatus.surveys.totalRecords}
                                migratedRecords={featureMigrationStatus.surveys.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.surveys.unmigratedRecords}
                                failedRecords={featureMigrationStatus.surveys.failedRecords}
                                {...createFeatureMigrationHandlers('surveys')}
                            />
                            
                            <MigrationCard
                                featureName="Survey Responses"
                                collectionName="survey_responses"
                                description="Migrate survey response records to use entityId for contact references"
                                status={featureMigrationStatus.survey_responses.status}
                                totalRecords={featureMigrationStatus.survey_responses.totalRecords}
                                migratedRecords={featureMigrationStatus.survey_responses.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.survey_responses.unmigratedRecords}
                                failedRecords={featureMigrationStatus.survey_responses.failedRecords}
                                {...createFeatureMigrationHandlers('survey_responses')}
                            />
                        </div>
                    </CardContent>
                </Card>
            </section>
            
            {/* Legal & Document Sync Section - NEW */}
 <section className="space-y-6">
 <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-indigo-50 font-semibold text-[10px] uppercase  px-3 py-1 border-indigo-200 text-indigo-600">Legal & Document Sync</Badge>
 <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent" />
                </div>
                
 <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-indigo-200 overflow-hidden bg-gradient-to-br from-indigo-50/50 to-white">
 <CardHeader className="p-8 pb-4">
 <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2 text-indigo-900">
 <FileCheck className="h-5 w-5 text-indigo-600" />
                            Agreement Context Alignment
                        </CardTitle>
 <CardDescription className="text-[10px] font-medium text-indigo-700/60 tracking-tighter">
                            Migrate top-level contracts and nested PDF submissions to the Unified Entity Architecture.
                        </CardDescription>
                    </CardHeader>
 <CardContent className="p-8 pt-0 space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Agreement Migration Card */}
 <div className="p-6 rounded-3xl bg-card border border-indigo-100 shadow-sm space-y-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600"><FileText size={18} /></div>
 <h4 className="text-xs font-semibold tracking-tight">Agreements Migration</h4>
                                </div>
 <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">
                                    Binds all documents in the 'contracts' collection to their new unified Entity IDs.
                                </p>
 <div className="flex gap-2">
                                    <Button 
                                        onClick={() => handleAction('migrate_contracts', migrateContractsToEntities)}
                                        disabled={seedingStatus.migrate_contracts === 'seeding'}
 className="flex-1 h-10 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] gap-2"
                                    >
 {seedingStatus.migrate_contracts === 'seeding' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                        Sync Contracts
                                    </Button>
                                    <Button 
                                        onClick={() => handleAction('rollback_contracts', rollbackContractsMigration)}
                                        disabled={seedingStatus.rollback_contracts === 'seeding'}
                                        variant="outline"
 className="w-12 h-10 rounded-xl border-rose-100 text-rose-500 hover:bg-rose-50 p-0"
                                        title="Rollback"
                                    >
                                        <RotateCcw size={16} />
                                    </Button>
                                </div>
                            </div>

                            {/* Submissions Migration Card */}
 <div className="p-6 rounded-3xl bg-card border border-indigo-100 shadow-sm space-y-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600"><Layers size={18} /></div>
 <h4 className="text-xs font-semibold tracking-tight">Submission Reference Mapping</h4>
                                </div>
 <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">
                                    Recursively updates nested 'submissions' within PDF templates to reference unified entities.
                                </p>
 <div className="flex gap-2">
                                    <Button 
                                        onClick={() => handleAction('migrate_submissions', migrateSubmissionsToEntities)}
                                        disabled={seedingStatus.migrate_submissions === 'seeding'}
 className="flex-1 h-10 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] gap-2"
                                    >
 {seedingStatus.migrate_submissions === 'seeding' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                        Sync Submissions
                                    </Button>
                                    <Button 
                                        onClick={() => handleAction('rollback_submissions', rollbackSubmissionsMigration)}
                                        disabled={seedingStatus.rollback_submissions === 'seeding'}
                                        variant="outline"
 className="w-12 h-10 rounded-xl border-rose-100 text-rose-500 hover:bg-rose-50 p-0"
                                        title="Rollback"
                                    >
                                        <RotateCcw size={16} />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Feature Data Migration Section - NEW */}
 <section className="space-y-6" id="feature-migration">
 <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-blue-50 font-semibold text-[10px] uppercase  px-3 py-1 border-blue-200 text-blue-600">Feature Data Migration</Badge>
 <div className="h-px flex-1 bg-gradient-to-r from-blue-200 to-transparent" />
                </div>
                
                {/* Debug Info */}
 <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
 <p className="text-xs font-bold text-yellow-900">
                        DEBUG: Feature Migration Section Loaded - {Object.keys(featureMigrationStatus).length} features configured
                    </p>
                </div>
                
 <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-blue-100 overflow-hidden bg-gradient-to-br from-blue-50/50 to-white">
 <CardHeader className="p-8 pb-4">
 <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
 <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                            SchoolId → EntityId Migration
                        </CardTitle>
 <CardDescription className="text-[10px] font-medium tracking-tighter text-muted-foreground">
                            Migrate feature collections from entityId to entityId references. Supports dual-write pattern with full rollback capability.
                        </CardDescription>
                    </CardHeader>
 <CardContent className="p-8 pt-0 space-y-6">
                        {/* Migrate All Button */}
 <div className="flex gap-4">
                            <Button 
                                onClick={handleMigrateAllFeatures} 
                                disabled={seedingStatus.migrate_all_features === 'seeding'}
 className="h-14 rounded-xl font-semibold shadow-lg text-[10px] bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-between px-6 flex-1"
                            >
 <div className="flex items-center gap-3">
                                    {seedingStatus.migrate_all_features === 'seeding' ? (
 <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
 <Zap className="h-5 w-5" />
                                    )}
                                    <span>Migrate All Features</span>
                                </div>
 <ArrowRight className="h-4 w-4 opacity-50" />
                            </Button>
                        </div>

                        {/* Migration Log Panel */}
                        {migrationLog.length > 0 && (
 <div className="bg-slate-900 rounded-2xl p-6 space-y-2 max-h-64 overflow-y-auto">
 <div className="flex items-center gap-2 mb-3">
 <FileText className="h-4 w-4 text-slate-400" />
 <h4 className="text-[10px] font-semibold text-slate-400">
                                        Migration Log
                                    </h4>
                                </div>
 <div className="text-[9px] font-mono text-slate-300 space-y-1">
                                    {migrationLog.map((log, index) => (
                                        <p key={index}>{log}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Feature Migration Cards Grid */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <MigrationCard
                                featureName="Tasks"
                                collectionName="tasks"
                                description="Migrate task records to use entityId for contact references"
                                status={featureMigrationStatus.tasks.status}
                                totalRecords={featureMigrationStatus.tasks.totalRecords}
                                migratedRecords={featureMigrationStatus.tasks.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.tasks.unmigratedRecords}
                                failedRecords={featureMigrationStatus.tasks.failedRecords}
                                {...createFeatureMigrationHandlers('tasks')}
                            />
                            
                            <MigrationCard
                                featureName="Activities"
                                collectionName="activities"
                                description="Migrate activity logs to use entityId for contact references"
                                status={featureMigrationStatus.activities.status}
                                totalRecords={featureMigrationStatus.activities.totalRecords}
                                migratedRecords={featureMigrationStatus.activities.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.activities.unmigratedRecords}
                                failedRecords={featureMigrationStatus.activities.failedRecords}
                                {...createFeatureMigrationHandlers('activities')}
                            />
                            
                            <MigrationCard
                                featureName="Forms"
                                collectionName="forms"
                                description="Migrate form records to use entityId for contact references"
                                status={featureMigrationStatus.forms.status}
                                totalRecords={featureMigrationStatus.forms.totalRecords}
                                migratedRecords={featureMigrationStatus.forms.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.forms.unmigratedRecords}
                                failedRecords={featureMigrationStatus.forms.failedRecords}
                                {...createFeatureMigrationHandlers('forms')}
                            />
                            
                            <MigrationCard
                                featureName="Invoices"
                                collectionName="invoices"
                                description="Migrate invoice records to use entityId for contact references"
                                status={featureMigrationStatus.invoices.status}
                                totalRecords={featureMigrationStatus.invoices.totalRecords}
                                migratedRecords={featureMigrationStatus.invoices.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.invoices.unmigratedRecords}
                                failedRecords={featureMigrationStatus.invoices.failedRecords}
                                {...createFeatureMigrationHandlers('invoices')}
                            />
                            
                            <MigrationCard
                                featureName="Meetings"
                                collectionName="meetings"
                                description="Migrate meeting records to use entityId for contact references"
                                status={featureMigrationStatus.meetings.status}
                                totalRecords={featureMigrationStatus.meetings.totalRecords}
                                migratedRecords={featureMigrationStatus.meetings.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.meetings.unmigratedRecords}
                                failedRecords={featureMigrationStatus.meetings.failedRecords}
                                {...createFeatureMigrationHandlers('meetings')}
                            />
                            

                            <MigrationCard
                                featureName="Message Logs"
                                collectionName="message_logs"
                                description="Migrate message log records to use entityId for contact references"
                                status={featureMigrationStatus.message_logs.status}
                                totalRecords={featureMigrationStatus.message_logs.totalRecords}
                                migratedRecords={featureMigrationStatus.message_logs.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.message_logs.unmigratedRecords}
                                failedRecords={featureMigrationStatus.message_logs.failedRecords}
                                {...createFeatureMigrationHandlers('message_logs')}
                            />
                            
                            <MigrationCard
                                featureName="PDFs"
                                collectionName="pdfs"
                                description="Migrate PDF records to use entityId for contact references"
                                status={featureMigrationStatus.pdfs.status}
                                totalRecords={featureMigrationStatus.pdfs.totalRecords}
                                migratedRecords={featureMigrationStatus.pdfs.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.pdfs.unmigratedRecords}
                                failedRecords={featureMigrationStatus.pdfs.failedRecords}
                                {...createFeatureMigrationHandlers('pdfs')}
                            />
                            
                            <MigrationCard
                                featureName="Automation Logs"
                                collectionName="automation_logs"
                                description="Migrate automation log records to use entityId for contact references"
                                status={featureMigrationStatus.automation_logs.status}
                                totalRecords={featureMigrationStatus.automation_logs.totalRecords}
                                migratedRecords={featureMigrationStatus.automation_logs.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.automation_logs.unmigratedRecords}
                                failedRecords={featureMigrationStatus.automation_logs.failedRecords}
                                {...createFeatureMigrationHandlers('automation_logs')}
                            />
                            
                            <MigrationCard
                                featureName="Form Submissions"
                                collectionName="form_submissions"
                                description="Migrate form submission records to use entityId for contact references"
                                status={featureMigrationStatus.form_submissions.status}
                                totalRecords={featureMigrationStatus.form_submissions.totalRecords}
                                migratedRecords={featureMigrationStatus.form_submissions.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.form_submissions.unmigratedRecords}
                                failedRecords={featureMigrationStatus.form_submissions.failedRecords}
                                {...createFeatureMigrationHandlers('form_submissions')}
                            />
                            

                            <MigrationCard
                                featureName="Signups"
                                collectionName="signups"
                                description="Migrate signup records to use entityId for contact references"
                                status={featureMigrationStatus.signups.status}
                                totalRecords={featureMigrationStatus.signups.totalRecords}
                                migratedRecords={featureMigrationStatus.signups.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.signups.unmigratedRecords}
                                failedRecords={featureMigrationStatus.signups.failedRecords}
                                {...createFeatureMigrationHandlers('signups')}
                            />
                            
                            <MigrationCard
                                featureName="Profiles"
                                collectionName="profiles"
                                description="Migrate profile records to use entityId for contact references"
                                status={featureMigrationStatus.profiles.status}
                                totalRecords={featureMigrationStatus.profiles.totalRecords}
                                migratedRecords={featureMigrationStatus.profiles.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.profiles.unmigratedRecords}
                                failedRecords={featureMigrationStatus.profiles.failedRecords}
                                {...createFeatureMigrationHandlers('profiles')}
                            />
                            
                            <MigrationCard
                                featureName="Settings"
                                collectionName="settings"
                                description="Migrate settings records to use entityId for contact references"
                                status={featureMigrationStatus.settings.status}
                                totalRecords={featureMigrationStatus.settings.totalRecords}
                                migratedRecords={featureMigrationStatus.settings.migratedRecords}
                                unmigratedRecords={featureMigrationStatus.settings.unmigratedRecords}
                                failedRecords={featureMigrationStatus.settings.failedRecords}
                                {...createFeatureMigrationHandlers('settings')}
                            />
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Specialized Domain Sync Section */}
 <section className="space-y-6">
 <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-background font-semibold text-[10px] uppercase  px-3 py-1 border-border text-muted-foreground">Domain Enrichment</Badge>
 <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ProtocolButton label="User Identity Sync" icon={Users} status={seedingStatus.users} onClick={() => handleAction('users', enrichUsers)} />
                    <ProtocolButton label="CRM Task Sync" icon={CheckSquare} status={seedingStatus.tasks} onClick={() => handleAction('tasks', enrichTasksWithWorkspace)} />
                    <ProtocolButton label="Roles & Governance" icon={ShieldCheck} status={seedingStatus.roles} onClick={() => handleAction('roles', enrichRolesWithWorkspaces)} />
                    <ProtocolButton label="Workspaces" icon={Layout} status={seedingStatus.workspaces} onClick={() => handleAction('workspaces', seedWorkspaces)} />
                    <ProtocolButton label="Billing Profiles" icon={Banknote} status={seedingStatus.billing} onClick={() => handleAction('billing', seedBillingData)} />
                    <ProtocolButton label="Page Templates" icon={FileText} status={seedingStatus.templates} onClick={() => handleAction('templates', seedPageTemplates)} />
                </div>
            </section>

            {/* Diagnostic / Rollback Section */}
 <section className="pt-8">
 <Card className="bg-rose-50 border-rose-100 rounded-[2.5rem] overflow-hidden shadow-sm">
 <CardHeader className="p-8 pb-4"><CardTitle className="text-[10px] font-semibold text-rose-600 flex items-center gap-2"><TriangleAlert className="h-4 w-4" /> Emergency Rollback</CardTitle></CardHeader>
 <CardContent className="p-8 pt-0 flex flex-wrap gap-4">
 <Button variant="outline" onClick={() => handleAction('rollback_schools', rollbackSchoolsMigration)} className="rounded-xl font-bold border-rose-200 text-rose-600 bg-card">Restore Schools Snapshot</Button>
 <Button variant="outline" onClick={() => handleAction('rollback_tasks', rollbackTasksMigration)} className="rounded-xl font-bold border-rose-200 text-rose-600 bg-card">Restore Tasks Snapshot</Button>
                    </CardContent>
                </Card>
            </section>
        </main>
    </div>
  );
}

// Simple migration card for basic seed operations
function SimpleMigrationCard({ title, description, onSync, onRollback, status, icon: Icon }: {
  title: string;
  description: string;
  onSync: () => void;
  onRollback?: () => void;
  status: SeedingState;
  icon: any;
}) {
    return (
 <div className="p-6 rounded-3xl bg-muted/10 border-2 border-dashed border-slate-200 flex flex-col justify-between gap-6 group hover:border-primary/20 transition-all">
 <div className="space-y-3">
 <div className="p-2.5 bg-card rounded-xl w-fit shadow-sm text-primary border border-slate-100 group-hover:scale-110 transition-transform"><Icon className="h-5 w-5" /></div>
 <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
 <p className="text-[10px] font-medium text-muted-foreground leading-relaxed tracking-tighter">{description}</p>
            </div>
 <div className="flex gap-2">
 <Button onClick={onSync} disabled={status === 'seeding'} className="flex-1 rounded-xl font-semibold shadow-lg text-[10px] bg-primary text-white h-11">
 {status === 'seeding' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />} Sync domain
                </Button>
                {onRollback && (
 <Button variant="outline" onClick={onRollback} className="rounded-xl font-bold border-rose-200 text-rose-600 h-11 bg-card">
 <RotateCcw className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function ProtocolButton({ label, status, onClick, icon: Icon }: {
  label: string;
  status: SeedingState;
  onClick: () => void;
  icon: any;
}) {
    return (
        <Button 
            variant="outline" 
            onClick={onClick} 
            disabled={status === 'seeding'} 
 className={cn(
                "h-14 w-full rounded-xl border-2 flex items-center justify-between px-6 transition-all",
                status === 'seeding' ? "bg-muted animate-pulse" : "bg-card hover:border-primary hover:bg-primary/5"
            )}
        >
 <div className="flex items-center gap-4">
 <Icon className="h-4 w-4 text-primary" />
 <span className="font-semibold text-[10px] ">{label}</span>
            </div>
 {status === 'seeding' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 opacity-20" />}
        </Button>
    );
}
