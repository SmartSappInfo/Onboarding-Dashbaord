'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Loader2, ShieldCheck, Mail, CalendarDays } from 'lucide-react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { seedNativeFieldsAction } from '@/lib/fields-actions';
import { seedGlobalTemplatesAction } from '@/app/actions/seed-global-templates-action';
import { useTenant } from '@/context/TenantContext';
import { runMeetingsFerAction } from '@/app/actions/run-meetings-fer-action';

export default function SeedsClient() {
    const { user } = useUser();
    const { toast } = useToast();
    const { activeWorkspaceId, activeOrganizationId } = useTenant();
    const [isSeeding, setIsSeeding] = React.useState(false);
    const [isSeedingTemplates, setIsSeedingTemplates] = React.useState(false);
    const [isSeedingMeetings, setIsSeedingMeetings] = React.useState(false);

    const handleSeedMeetings = async () => {
        if (!activeWorkspaceId || !activeOrganizationId) return;
        setIsSeedingMeetings(true);
        try {
            const result = await runMeetingsFerAction(activeWorkspaceId, activeOrganizationId);
            if (result.success) {
                toast({
                    title: 'Meetings Migration Completed',
                    description: `Processed ${result.processedMeetings} meetings. Enriched ${result.enrichedMeetings} metadata configs, and synchronized ${result.updatedRegistrants} registrants.`,
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Migration Failed',
                    description: result.error || 'Failed to execute Meetings FER.',
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Execution Error',
                description: error.message || 'An error occurred during Meetings FER.',
            });
        }
        setIsSeedingMeetings(false);
    };

    const handleSeed = async () => {
        if (!activeWorkspaceId || !activeOrganizationId || !user?.uid) return;
        setIsSeeding(true);
        const result = await seedNativeFieldsAction(activeWorkspaceId, activeOrganizationId, user.uid);
        if (result.success) {
            toast({ title: 'Registry Seeded', description: `Added ${result.seededGroups} groups and ${result.seededFields} fields.` });
        } else {
            toast({ variant: 'destructive', title: 'Seeding Failed', description: result.error });
        }
        setIsSeeding(false);
    };

    const handleSeedTemplates = async () => {
        setIsSeedingTemplates(true);
        try {
            const result = await seedGlobalTemplatesAction();
            if (result.created > 0) {
                toast({
                    title: 'Blueprints Seeded',
                    description: `Successfully initialized ${result.created} global messaging templates.`,
                });
            } else if (result.failed > 0) {
                toast({
                    variant: 'destructive',
                    title: 'Seeding Failed',
                    description: result.errors?.[0]?.error || 'Failed to seed messaging templates.',
                });
            } else {
                toast({
                    title: 'Blueprints Synchronized',
                    description: 'Global messaging templates are already up-to-date.',
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Execution Error',
                description: error.message || 'An error occurred during template seeding.',
            });
        }
        setIsSeedingTemplates(false);
    };

    return (
        <div className="h-full overflow-y-auto w-full">
            <div className="space-y-12 pb-32 w-full max-w-4xl">
            
                {/* Header */}
                <div className="flex flex-col items-start text-left">
                    <Badge variant="outline" className="mb-4 bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-widest text-[9px] px-3 py-1 ring-1 ring-primary/20">System Governance</Badge>
                    <h1 className="text-3xl font-bold mb-2 text-foreground">Infrastructure Seeding</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Execute core schema enrichments and cross-workspace mappings
                    </p>
                </div>

                {/* Seeding Sections */}
                <div className="grid gap-6">
                    <Card className="border-indigo-100 bg-indigo-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <ShieldCheck className="h-24 w-24 text-indigo-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">System Registry</span>
                            </div>
                            <CardTitle className="text-xl text-indigo-950">Native Registry Sync</CardTitle>
                            <CardDescription className="max-w-2xl text-indigo-900/70">
                                Keep your workspace synchronized with the global SmartSapp variable registry. 
                                Seeding adds all platform-standard fields (meetings, surveys, forms) and industry-specific 
                                attributes without affecting your existing custom fields.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Platform Identity</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Meetings & Forms</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Industry Pack</Badge>
                                </div>
                                <Button 
                                    onClick={handleSeed} 
                                    disabled={isSeeding}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 border-none min-w-[160px]"
                                >
                                    {isSeeding ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Zap className="h-4 w-4 mr-2 fill-white" />
                                    )}
                                    {isSeeding ? 'Syncing...' : 'Seed Registry'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Messaging Blueprints Card */}
                    <Card className="border-rose-100 bg-rose-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Mail className="h-24 w-24 text-rose-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Communication Hub</span>
                            </div>
                            <CardTitle className="text-xl text-rose-950">Messaging Blueprints & Defaults</CardTitle>
                            <CardDescription className="max-w-2xl text-rose-900/70">
                                Initialize global default blueprints for transactional communications including emails, SMS, push notifications, and in-app alerts.
                                This populates templates for all meetings, forms, surveys, and agreements triggers.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="bg-white/50 border-rose-200 text-rose-700">Email & SMS Blueprints</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-rose-200 text-rose-700">Trigger Auto-Mapping</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-rose-200 text-rose-700">Global Fallbacks</Badge>
                                </div>
                                <Button 
                                    onClick={handleSeedTemplates} 
                                    disabled={isSeedingTemplates}
                                    className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 border-none min-w-[160px]"
                                >
                                    {isSeedingTemplates ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Mail className="h-4 w-4 mr-2" />
                                    )}
                                    {isSeedingTemplates ? 'Seeding...' : 'Seed Blueprints'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Meetings Infrastructure - FER Card */}
                    <Card className="border-indigo-100 bg-indigo-50/10 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <CalendarDays className="h-24 w-24 text-indigo-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Meeting Operations</span>
                            </div>
                            <CardTitle className="text-xl text-indigo-950">Meetings Infrastructure — FER</CardTitle>
                            <CardDescription className="max-w-2xl text-indigo-900/70">
                                Run Fire-and-Forget background migration protocols for meeting sessions and registrants.
                                This ensures all upcoming sessions have absolute link structures, modernized slug formats, and standard timeup alerts.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Link Normalization</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">V3 Router Alignment</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Time-Up Scheduler</Badge>
                                </div>
                                <Button 
                                    onClick={handleSeedMeetings} 
                                    disabled={isSeedingMeetings}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 border-none min-w-[160px]"
                                >
                                    {isSeedingMeetings ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <CalendarDays className="h-4 w-4 mr-2" />
                                    )}
                                    {isSeedingMeetings ? 'Migrating...' : 'Run FER Migration'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}

