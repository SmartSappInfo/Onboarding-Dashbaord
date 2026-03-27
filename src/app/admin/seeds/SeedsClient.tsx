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
    rollbackActivitiesMigration
} from '@/lib/seed';
import {
    migrateSchoolsToEntities,
    rollbackEntitiesMigration,
    verifyEntitiesMigration
} from '@/lib/entity-migrations';
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
    TriangleAlert
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
    verify_entities: 'idle'
  });

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

  if (!isUnlocked) {
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="mb-12 text-center space-y-4">
                <SmartSappLogo variant="white" className="h-10 mx-auto" />
                <h1 className="text-white text-3xl font-black uppercase tracking-tighter">System Seeding Hub</h1>
            </div>
            <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                <CardHeader className="bg-muted/30 p-8 border-b text-center">
                    <div className="mx-auto bg-primary/10 w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-4">
                        <Lock className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-xl font-black uppercase">Protected Area</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Authorized development access only</CardDescription>
                </CardHeader>
                <form onSubmit={handleUnlock}>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 text-left block">Master Key</Label>
                            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-black text-xl" autoFocus />
                        </div>
                    </CardContent>
                    <CardFooter className="p-6 bg-muted/30 border-t">
                        <Button type="submit" className="w-full h-12 rounded-xl font-black uppercase tracking-widest gap-2 shadow-xl active:scale-95 transition-all">Unlock Engine <ArrowRight size={16} /></Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/10 pb-32 text-left">
        <header className="bg-white border-b h-20 flex items-center px-8 shadow-sm">
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-xl"><Database className="h-6 w-6 text-primary" /></div>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">Institutional Sync Console</h1>
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[8px] h-4 uppercase font-black px-1.5">Active Session</Badge>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={() => setIsUnlocked(false)} className="rounded-xl font-bold gap-2"><Lock size={16} /> Lock</Button>
                    <Button variant="outline" onClick={() => router.push('/admin')} className="rounded-xl font-bold border-primary/20 text-primary">Dashboard</Button>
                </div>
            </div>
        </header>

        <main className="max-w-7xl mx-auto p-8 space-y-12">
            {/* Operational Integrity Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-background font-black text-[10px] uppercase tracking-widest px-3 py-1 border-primary/20 text-primary">Architectural Restoration</Badge>
                    <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                </div>
                <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-white">
                    <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <MigrationCard 
                            title="Blueprint Reconstruction" 
                            description="Harvests pipeline and stage snapshots from schools to rebuild missing operational logic."
                            onSync={() => handleAction('sync_arch', syncOperationalArchitecture)}
                            status={seedingStatus.sync_arch}
                            icon={Workflow}
                        />
                        <MigrationCard 
                            title="Shared Registry Sync" 
                            description="Migrates Schools, Meetings, Surveys, and PDFs to shared workspace arrays."
                            onSync={() => handleAction('enrich_op', enrichOperationalData)}
                            status={seedingStatus.enrich_op}
                            icon={Layers}
                        />
                        <MigrationCard 
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

            {/* Entity Architecture Migration Section - NEW */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-emerald-50 font-black text-[10px] uppercase tracking-widest px-3 py-1 border-emerald-200 text-emerald-600">Entity Architecture Migration</Badge>
                    <div className="h-px flex-1 bg-gradient-to-r from-emerald-200 to-transparent" />
                </div>
                <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-emerald-100 overflow-hidden bg-gradient-to-br from-emerald-50/50 to-white">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                            <Database className="h-5 w-5 text-emerald-600" />
                            Schools → Entities + Workspace_Entities
                        </CardTitle>
                        <CardDescription className="text-[10px] font-medium uppercase tracking-tighter text-muted-foreground">
                            Core migration to multi-scope entity architecture. Creates entities collection and workspace_entities link collection.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Button 
                                onClick={() => handleAction('migrate_entities', migrateSchoolsToEntities)} 
                                disabled={seedingStatus.migrate_entities === 'seeding'}
                                className="h-14 rounded-xl font-black shadow-lg uppercase text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-between px-6"
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
                                className="h-14 rounded-xl font-black border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 uppercase text-[10px] flex items-center justify-between px-6"
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
                                className="h-14 rounded-xl font-black border-2 border-rose-200 text-rose-600 hover:bg-rose-50 uppercase text-[10px] flex items-center justify-between px-6"
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
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Migration Details</h4>
                                    <ul className="text-[9px] font-medium text-emerald-700 space-y-1 uppercase tracking-tighter">
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

            {/* Specialized Domain Sync Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-background font-black text-[10px] uppercase tracking-widest px-3 py-1 border-border text-muted-foreground">Domain Enrichment</Badge>
                    <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ProtocolButton label="User Identity Sync" icon={Users} status={seedingStatus.users} onClick={() => handleAction('users', enrichUsers)} />
                    <ProtocolButton label="CRM Task Sync" icon={CheckSquare} status={seedingStatus.tasks} onClick={() => handleAction('tasks', enrichTasksWithWorkspace)} />
                    <ProtocolButton label="Roles & Governance" icon={ShieldCheck} status={seedingStatus.roles} onClick={() => handleAction('roles', enrichRolesWithWorkspaces)} />
                    <ProtocolButton label="Workspaces" icon={Layout} status={seedingStatus.workspaces} onClick={() => handleAction('workspaces', seedWorkspaces)} />
                    <ProtocolButton label="Billing Profiles" icon={Banknote} status={seedingStatus.billing} onClick={() => handleAction('billing', seedBillingData)} />
                </div>
            </section>

            {/* Diagnostic / Rollback Section */}
            <section className="pt-8">
                <Card className="bg-rose-50 border-rose-100 rounded-[2.5rem] overflow-hidden shadow-sm">
                    <CardHeader className="p-8 pb-4"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-rose-600 flex items-center gap-2"><TriangleAlert className="h-4 w-4" /> Emergency Rollback</CardTitle></CardHeader>
                    <CardContent className="p-8 pt-0 flex flex-wrap gap-4">
                        <Button variant="outline" onClick={() => handleAction('rollback_schools', rollbackSchoolsMigration)} className="rounded-xl font-bold border-rose-200 text-rose-600 bg-white">Restore Schools Snapshot</Button>
                        <Button variant="outline" onClick={() => handleAction('rollback_tasks', rollbackTasksMigration)} className="rounded-xl font-bold border-rose-200 text-rose-600 bg-white">Restore Tasks Snapshot</Button>
                    </CardContent>
                </Card>
            </section>
        </main>
    </div>
  );
}

function MigrationCard({ title, description, onSync, onRollback, status, icon: Icon }: any) {
    return (
        <div className="p-6 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col justify-between gap-6 group hover:border-primary/20 transition-all">
            <div className="space-y-3">
                <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-primary border border-slate-100 group-hover:scale-110 transition-transform"><Icon className="h-5 w-5" /></div>
                <h4 className="text-sm font-black uppercase tracking-tight">{title}</h4>
                <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase tracking-tighter">{description}</p>
            </div>
            <div className="flex gap-2">
                <Button onClick={onSync} disabled={status === 'seeding'} className="flex-1 rounded-xl font-black shadow-lg uppercase text-[10px] bg-primary text-white h-11">
                    {status === 'seeding' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />} Sync domain
                </Button>
                {onRollback && (
                    <Button variant="outline" onClick={onRollback} className="rounded-xl font-bold border-rose-200 text-rose-600 h-11 bg-white">
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function ProtocolButton({ label, status, onClick, icon: Icon }: any) {
    return (
        <Button 
            variant="outline" 
            onClick={onClick} 
            disabled={status === 'seeding'} 
            className={cn(
                "h-14 w-full rounded-xl border-2 flex items-center justify-between px-6 transition-all",
                status === 'seeding' ? "bg-muted animate-pulse" : "bg-white hover:border-primary hover:bg-primary/5"
            )}
        >
            <div className="flex items-center gap-4">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-black uppercase text-[10px] tracking-widest">{label}</span>
            </div>
            {status === 'seeding' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 opacity-20" />}
        </Button>
    );
}
