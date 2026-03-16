'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { 
    seedMedia, seedSchools, seedMeetings, seedSurveys, seedUserAvatars, 
    seedOnboardingStages, seedModules, seedActivities, seedPdfForms, 
    seedMessaging, seedZones, seedMessageLogs, seedTasks, seedBillingData, 
    seedRolesAndPermissions, seedPipelines, seedOnboardingPipelineFromCurrentData, 
    enrichAndRestoreSchools, rollbackSchoolsMigration, enrichTasksWithWorkspace, rollbackTasksMigration 
} from '@/lib/seed';
import { 
    Loader2, 
    RefreshCw, 
    Database, 
    ShieldCheck, 
    ClipboardList, 
    Film, 
    School as SchoolIcon, 
    History, 
    MessageSquareText, 
    MapPin, 
    CheckSquare, 
    Banknote, 
    ShieldAlert, 
    Lock, 
    Key, 
    ArrowRight, 
    Zap, 
    Layout,
    Info,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Check,
    Layers,
    Globe,
    Workflow,
    ArrowRightLeft,
    RotateCcw
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmartSappLogo, SmartSappIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';
type Seeder = 'media' | 'schools' | 'meetings' | 'surveys' | 'users' | 'stages' | 'layout' | 'modules' | 'activities' | 'pdfs' | 'messaging' | 'zones' | 'logs' | 'tasks' | 'billing' | 'roles' | 'pipelines' | 'harvest' | 'enrich' | 'rollback' | 'enrich_tasks' | 'rollback_tasks';

const DEFAULT_LAYOUT = [
    'userAssignments', 'taskWidget', 'messagingWidget', 'pipelinePieChart', 
    'upcomingMeetings', 'recentActivity', 'zoneDistribution', 
    'moduleRadarChart', 'latestSurveys', 'monthlySchoolsChart',
];

export default function SeedsClient() {
  const firestore = useFirestore();
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [seedingStatus, setSeedingStatus] = useState<Record<Seeder, SeedingState>>({
    media: 'idle', schools: 'idle', meetings: 'idle', surveys: 'idle', 
    users: 'idle', stages: 'idle', layout: 'idle', modules: 'idle', 
    activities: 'idle', pdfs: 'idle', messaging: 'idle', zones: 'idle', 
    logs: 'idle', tasks: 'idle', billing: 'idle', roles: 'idle', pipelines: 'idle',
    harvest: 'idle', enrich: 'idle', rollback: 'idle', enrich_tasks: 'idle', rollback_tasks: 'idle'
  });

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'mijay2123') {
        setIsUnlocked(true);
        toast({ title: 'Access Granted', description: 'System Seeding Hub unlocked.' });
    } else {
        toast({ variant: 'destructive', title: 'Invalid Password' });
        setPassword('');
    }
  };

  const handleSeed = async (seeder: Seeder) => {
    if (!firestore) return;
    setSeedingStatus(prev => ({ ...prev, [seeder]: 'seeding' }));

    try {
      if (seeder === 'layout') {
          if (!user) {
              toast({ variant: 'destructive', title: 'Context Missing', description: 'You must be logged into admin in another tab to reset layout.' });
              setSeedingStatus(prev => ({ ...prev, [seeder]: 'error' }));
              return;
          }
          await setDoc(doc(firestore, 'dashboardLayouts', user.uid), { componentIds: DEFAULT_LAYOUT });
          toast({ title: 'Layout Reset', description: 'Dashboard layout has been reset to default.' });
      } else if (seeder === 'harvest') {
          const count = await seedOnboardingPipelineFromCurrentData(firestore);
          toast({ title: 'Harvest Complete', description: `Initialized pipeline with ${count} unique stages.` });
      } else if (seeder === 'enrich') {
          const count = await enrichAndRestoreSchools(firestore);
          toast({ title: 'Migration Complete', description: `Enriched ${count} schools with pipeline context.` });
      } else if (seeder === 'rollback') {
          const count = await rollbackSchoolsMigration(firestore);
          toast({ title: 'Rollback Successful', description: `Restored ${count} schools from backup.` });
      } else if (seeder === 'enrich_tasks') {
          const count = await enrichTasksWithWorkspace(firestore);
          toast({ title: 'CRM Sync Complete', description: `Enriched ${count} tasks with workspace context.` });
      } else if (seeder === 'rollback_tasks') {
          const count = await rollbackTasksMigration(firestore);
          toast({ title: 'CRM Rollback Success', description: `Restored ${count} tasks from backup.` });
      } else {
        let count = 0;
        let name = '';
        
        if (seeder === 'media') { count = await seedMedia(firestore); name = 'Media Assets'; }
        else if (seeder === 'schools') { count = await seedSchools(firestore); name = 'Schools'; }
        else if (seeder === 'meetings') { count = await seedMeetings(firestore); name = 'Meetings'; }
        else if (seeder === 'surveys') { count = await seedSurveys(firestore); name = 'Surveys'; }
        else if (seeder === 'activities') { count = await seedActivities(firestore); name = 'Activities'; }
        else if (seeder === 'users') { count = await seedUserAvatars(firestore); name = 'User Avatars'; }
        else if (seeder === 'modules') { count = await seedModules(firestore); name = 'Modules'; }
        else if (seeder === 'pdfs') { count = await seedPdfForms(firestore); name = 'Doc Signing Forms'; }
        else if (seeder === 'messaging') { count = await seedMessaging(firestore); name = 'Messaging Assets'; }
        else if (seeder === 'zones') { count = await seedZones(firestore); name = 'Organizational Zones'; }
        else if (seeder === 'logs') { count = await seedMessageLogs(firestore); name = 'Communication Logs'; }
        else if (seeder === 'tasks') { count = await seedTasks(firestore); name = 'CRM Tasks'; }
        else if (seeder === 'billing') { count = await seedBillingData(firestore); name = 'Billing Hubs'; }
        else if (seeder === 'roles') { count = await seedRolesAndPermissions(firestore); name = 'Roles & Permissions'; }
        else if (seeder === 'pipelines') { count = await seedPipelines(firestore); name = 'Workflows'; }
        else if (seeder === 'stages') {
          const { stagesCreated } = await seedOnboardingStages(firestore);
          count = stagesCreated;
          name = 'Pipeline Stages';
        }

        toast({ title: 'Success', description: `${count} ${name} processed.` });
      }
      setSeedingStatus(prev => ({ ...prev, [seeder]: 'success' }));
      setTimeout(() => setSeedingStatus(prev => ({ ...prev, [seeder]: 'idle' })), 2000);
    } catch (error: any) {
      console.error(error);
      setSeedingStatus(prev => ({ ...prev, [seeder]: 'error' }));
      toast({ variant: 'destructive', title: 'Error', description: error.message || `Could not process ${seeder}.` });
    }
  };

  if (!isUnlocked) {
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="mb-12 text-center space-y-4">
                <SmartSappLogo variant="white" className="h-10 mx-auto" />
                <h1 className="text-white text-3xl font-black uppercase tracking-tighter">Dev Seeding Hub</h1>
            </div>
            
            <Card className="w-full max-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
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
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Master Key</Label>
                            <div className="relative group">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40 group-focus-within:text-primary transition-colors" />
                                <Input 
                                    type="password" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    placeholder="••••••••" 
                                    className="h-12 pl-11 rounded-xl bg-muted/20 border-none shadow-inner font-black text-xl" 
                                    autoFocus
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="p-6 bg-muted/30 border-t">
                        <Button type="submit" className="w-full h-12 rounded-xl font-black uppercase tracking-widest gap-2 shadow-xl active:scale-95 transition-all">
                            Unlock Seeding engine <ArrowRight size={16} />
                        </Button>
                    </CardFooter>
                </form>
            </Card>
            <p className="mt-8 text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">SmartSapp Institutional Logic · 2026</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/10 pb-32">
        <header className="bg-white border-b h-20 flex items-center px-8 shadow-sm">
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Database className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">Seeding Console</h1>
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[8px] h-4 uppercase font-black px-1.5">Unlocked</Badge>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={() => setIsUnlocked(false)} className="rounded-xl font-bold gap-2">
                        <Lock size={16} /> Lock Console
                    </Button>
                    <Button variant="outline" onClick={() => router.push('/admin')} className="rounded-xl font-bold border-primary/20 text-primary">
                        Open Admin Dashboard
                    </Button>
                </div>
            </div>
        </header>

        <main className="max-w-7xl mx-auto p-8 space-y-12 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Advanced Migration Protocols */}
                <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-white md:col-span-2">
                    <CardHeader className="bg-primary/5 border-b p-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-primary">
                                <div className="p-2 bg-white rounded-xl shadow-sm"><ArrowRightLeft className="h-5 w-5" /></div>
                                <CardTitle className="text-lg font-black uppercase tracking-tight">Institutional Migration Protocols</CardTitle>
                            </div>
                            <Badge variant="outline" className="border-primary/20 text-primary font-black uppercase text-[10px]">Non-Destructive</Badge>
                        </div>
                        <CardDescription className="text-xs font-medium uppercase tracking-widest mt-1 opacity-60">Surgical enrichment of existing data for multi-pipeline support.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="p-6 rounded-3xl bg-muted/20 border-2 border-dashed border-border flex flex-col justify-between gap-6 transition-all hover:bg-muted/30">
                            <div className="space-y-3">
                                <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-primary"><Zap className="h-5 w-5" /></div>
                                <h4 className="text-sm font-black uppercase tracking-tight">1. CRM Sync</h4>
                                <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase tracking-tighter">Enriches all tasks with 'onboarding' workspace context to fix permission gaps.</p>
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    onClick={() => handleSeed('enrich_tasks')} 
                                    disabled={seedingStatus.enrich_tasks === 'seeding'} 
                                    className="flex-1 rounded-xl font-bold border-primary/20 hover:bg-primary/5 text-primary h-11"
                                >
                                    {seedingStatus.enrich_tasks === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                                    Enrich CRM
                                </Button>
                                <Button variant="outline" size="icon" onClick={() => handleSeed('rollback_tasks')} disabled={seedingStatus.rollback_tasks === 'seeding'} className="h-11 w-11 rounded-xl border-rose-200 text-rose-600">
                                    <RotateCcw size={16} />
                                </Button>
                            </div>
                        </div>

                        <div className="p-6 rounded-3xl bg-muted/20 border-2 border-dashed border-border flex flex-col justify-between gap-6 transition-all hover:bg-muted/30">
                            <div className="space-y-3">
                                <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-primary"><Workflow className="h-5 w-5" /></div>
                                <h4 className="text-sm font-black uppercase tracking-tight">2. Architect</h4>
                                <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase tracking-tighter">Harvests unique stages from schools to build the primary pipeline blueprint.</p>
                            </div>
                            <Button 
                                variant="outline" 
                                onClick={() => handleSeed('harvest')} 
                                disabled={seedingStatus.harvest === 'seeding'} 
                                className="w-full rounded-xl font-bold border-primary/20 hover:bg-primary/5 text-primary h-11"
                            >
                                {seedingStatus.harvest === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers className="mr-2 h-4 w-4" />}
                                Initialize Hub
                            </Button>
                        </div>

                        <div className="p-6 rounded-3xl bg-primary/[0.03] border-2 border-primary/10 flex flex-col justify-between gap-6 transition-all hover:bg-primary/[0.05]">
                            <div className="space-y-3">
                                <div className="p-2.5 bg-primary text-white rounded-xl w-fit shadow-lg shadow-primary/20"><ShieldCheck className="h-5 w-5" /></div>
                                <h4 className="text-sm font-black uppercase tracking-tight">3. Hub Migration</h4>
                                <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase tracking-tighter">Enriches schools with workspace context and syncs stage logic.</p>
                            </div>
                            <Button 
                                onClick={() => handleSeed('enrich')} 
                                disabled={seedingStatus.enrich === 'seeding'} 
                                className="w-full rounded-xl font-black shadow-xl uppercase text-[10px] tracking-widest h-11"
                            >
                                {seedingStatus.enrich === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                                Sync Hubs
                            </Button>
                        </div>

                        <div className="p-6 rounded-3xl bg-rose-50 border-2 border-dashed border-rose-100 flex flex-col justify-between gap-6 transition-all hover:bg-rose-100/50">
                            <div className="space-y-3">
                                <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-rose-600 border border-rose-100"><RotateCcw className="h-5 w-5" /></div>
                                <h4 className="text-sm font-black uppercase tracking-tight text-rose-900">4. Hub Rollback</h4>
                                <p className="text-[10px] font-medium text-rose-700 leading-relaxed uppercase tracking-tighter opacity-70">Restores the school directory from the last pre-migration snapshot.</p>
                            </div>
                            <Button 
                                variant="ghost" 
                                onClick={() => handleSeed('rollback')} 
                                disabled={seedingStatus.rollback === 'seeding'} 
                                className="w-full rounded-xl font-bold text-rose-600 hover:bg-rose-100/50 h-11"
                            >
                                {seedingStatus.rollback === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                                Restore Hubs
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Structural Infrastructure */}
                <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 border-b p-8">
                        <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
                            <Zap className="h-5 w-5 text-primary" /> System Architecture
                        </CardTitle>
                        <CardDescription className="text-xs font-medium uppercase tracking-widest text-primary/60">Initialize foundational collections and logical hubs.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 grid grid-cols-1 gap-4">
                        <SeedButton label="Workspaces" seeder="workspaces" status={seedingStatus.workspaces} onClick={() => handleSeed('workspaces')} icon={Layout} />
                        <SeedButton label="Workflows & Pipelines" seeder="pipelines" status={seedingStatus.pipelines} onClick={() => handleSeed('pipelines')} icon={Workflow} />
                        <SeedButton label="Roles & Permissions" seeder="roles" status={seedingStatus.roles} onClick={() => handleSeed('roles')} icon={ShieldAlert} />
                        <SeedButton label="Onboarding Stages" seeder="stages" status={seedingStatus.stages} onClick={() => handleSeed('stages')} icon={RefreshCw} />
                        <SeedButton label="Functional Modules" seeder="modules" status={seedingStatus.modules} onClick={() => handleSeed('modules')} icon={RefreshCw} />
                        <SeedButton label="Regional Zones" seeder="zones" status={seedingStatus.zones} onClick={() => handleSeed('zones')} icon={MapPin} />
                        <SeedButton label="Dashboard Layout" seeder="layout" status={seedingStatus.layout} onClick={() => handleSeed('layout')} icon={Layout} />
                    </CardContent>
                </Card>

                {/* Operations & Media */}
                <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-white">
                    <CardHeader className="bg-orange-50 border-b p-8">
                        <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
                            <Layers className="h-5 w-5 text-orange-600" /> Operational Data
                        </CardTitle>
                        <CardDescription className="text-xs font-medium uppercase tracking-widest text-orange-600/60">Populate the directory with sample records.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 grid grid-cols-1 gap-4">
                        <SeedButton label="Schools Directory" seeder="schools" status={seedingStatus.schools} onClick={() => handleSeed('schools')} icon={SchoolIcon} />
                        <SeedButton label="Session Registry" seeder="meetings" status={seedingStatus.meetings} onClick={() => handleSeed('meetings')} icon={RefreshCw} />
                        <SeedButton label="Digital Media Hub" seeder="media" status={seedingStatus.media} onClick={() => handleSeed('media')} icon={Film} />
                        <SeedButton label="Survey Intelligence" seeder="surveys" status={seedingStatus.surveys} onClick={() => handleSeed('surveys')} icon={ClipboardList} />
                        <SeedButton label="Doc Signing Studio" seeder="pdfs" status={seedingStatus.pdfs} onClick={() => handleSeed('pdfs')} icon={ShieldCheck} />
                        <SeedButton label="CRM Tasks & Protocols" seeder="tasks" status={seedingStatus.tasks} onClick={() => handleSeed('tasks')} icon={CheckSquare} />
                    </CardContent>
                </Card>
            </div>
        </main>
    </div>
  );
}

function SeedButton({ label, seeder, status, onClick, icon: Icon }: { label: string, seeder: string, status: SeedingState, onClick: () => void, icon: any }) {
    return (
        <Button 
            variant="outline" 
            onClick={onClick} 
            disabled={status === 'seeding'} 
            className={cn(
                "h-14 w-full rounded-2xl border-2 flex items-center justify-between px-6 transition-all duration-300",
                status === 'seeding' ? "bg-muted/50 border-border animate-pulse" :
                status === 'success' ? "bg-emerald-50 border-emerald-500 text-emerald-700" :
                status === 'error' ? "bg-rose-50 border-rose-500 text-rose-700" :
                "bg-background border-border/50 hover:border-primary hover:bg-primary/5 hover:scale-[1.02]"
            )}
        >
            <div className="flex items-center gap-4">
                <div className={cn(
                    "p-2 rounded-xl transition-colors",
                    status === 'success' ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground group-hover:text-primary"
                )}>
                    {status === 'seeding' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className="font-black uppercase text-[10px] tracking-widest">{label}</span>
            </div>
            {status === 'success' ? <CheckCircle2 className="h-5 w-5" /> : status === 'error' ? <AlertCircle className="h-5 w-5" /> : <ChevronRight className="h-4 w-4 opacity-20" />}
        </Button>
    );
}
