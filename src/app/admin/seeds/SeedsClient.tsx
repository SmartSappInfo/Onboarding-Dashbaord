'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarPlus, ShieldCheck, Layers, Sparkles, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { seedEnrichedMeetingTemplatesAction } from '@/app/actions/seed-meeting-invitation-templates-action';
import { migrateLegacyTemplatesToBlocksAction } from '@/app/actions/migrate-legacy-templates-to-blocks-action';
import { seedGlobalMessagingBlueprint } from '@/lib/seed-messaging-blueprint';
import { runMeetingsFerAction } from '@/app/actions/run-meetings-fer-action';
import { useTenant } from '@/context/TenantContext';

export default function SeedsClient() {
    const { toast } = useToast();
    const { activeWorkspaceId, activeOrganizationId } = useTenant();
    const [isSeeding, setIsSeeding] = React.useState(false);
    const [isMigrating, setIsMigrating] = React.useState(false);
    const [isGlobalSeeding, setIsGlobalSeeding] = React.useState(false);
    const [isMeetingsFerRunning, setIsMeetingsFerRunning] = React.useState(false);

    const handleSeedMeetingTemplates = async () => {
        setIsSeeding(true);
        try {
            const result = await seedEnrichedMeetingTemplatesAction();
            if (result.success) {
                toast({
                    title: 'Meeting Templates Enriched',
                    description: `Successfully seeded/verified ${result.seededCount} templates. Enriched ${result.enrichedCount} existing templates and processed ${result.totalProcessed} total template documents.`,
                });
            } else if (result.errors?.length > 0) {
                toast({
                    variant: 'destructive',
                    title: 'Seeding Failed',
                    description: result.errors[0]?.error || 'Failed to enrich meeting templates.',
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Execution Error',
                description: error.message || 'An error occurred during meeting template seeding.',
            });
        }
        setIsSeeding(false);
    };

    const handleMigrateToVisualBlocks = async () => {
        setIsMigrating(true);
        try {
            const result = await migrateLegacyTemplatesToBlocksAction();
            if (result.success) {
                toast({
                    title: 'Visual Blocks Migration Complete',
                    description: `Successfully migrated ${result.migrated} templates out of ${result.total} total templates to Visual Block style.`,
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Migration Failed',
                    description: result.error || 'Failed to migrate templates to Visual Blocks.',
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Execution Error',
                description: error.message || 'An error occurred during template migration.',
            });
        }
        setIsMigrating(false);
    };

    const handleSeedGlobalBlueprints = async () => {
        setIsGlobalSeeding(true);
        try {
            const result = await seedGlobalMessagingBlueprint();
            if (result.success) {
                toast({
                    title: 'Global Blueprints Synced',
                    description: `Successfully seeded/verified ${result.templates} system templates and ${result.styles} branding styles with visual RSVP builder integrations.`,
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Seeding Failed',
                    description: result.error || 'Failed to seed global messaging blueprints.',
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Execution Error',
                description: error.message || 'An error occurred during global blueprint seeding.',
            });
        }
        setIsGlobalSeeding(false);
    };

    const handleRunMeetingsFer = async () => {
        if (!activeWorkspaceId || !activeOrganizationId) {
            toast({
                variant: 'destructive',
                title: 'Context Missing',
                description: 'Please ensure you have selected a workspace and organization context before running the Meetings FER.',
            });
            return;
        }

        setIsMeetingsFerRunning(true);
        try {
            const result = await runMeetingsFerAction(activeWorkspaceId, activeOrganizationId);
            if (result.success) {
                toast({
                    title: 'Meetings FER Migration Complete',
                    description: `Successfully processed ${result.processedMeetings} meetings. Enriched ${result.enrichedMeetings} meeting configurations, and upgraded ${result.updatedRegistrants} registrants to secure join URLs.`,
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'FER Migration Failed',
                    description: result.error || 'Failed to execute Meetings FER protocol.',
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Execution Error',
                description: error.message || 'An error occurred during Meetings FER execution.',
            });
        }
        setIsMeetingsFerRunning(false);
    };

    return (
        <div className="h-full overflow-y-auto w-full">
            <div className="space-y-12 pb-32 w-full max-w-4xl">
            
                {/* Header */}
                <div className="flex flex-col items-start text-left">
                    <Badge variant="outline" className="mb-4 bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-widest text-[9px] px-3 py-1 ring-1 ring-primary/20">System Governance</Badge>
                    <h1 className="text-3xl font-bold mb-2 text-foreground">Infrastructure Seeding</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Execute template optimizations and unique link enrichments across all workspaces.
                    </p>
                </div>

                {/* Seeding Section */}
                <div className="grid gap-6">
                    <Card className="border-teal-100 bg-teal-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <CalendarPlus className="h-24 w-24 text-teal-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">Meeting Communications</span>
                            </div>
                            <CardTitle className="text-xl text-teal-950">Meeting Templates Enrichment</CardTitle>
                            <CardDescription className="max-w-2xl text-teal-900/70">
                                Run the Fetch-Enrich-Restore protocol on all meeting templates.
                                This imports global templates, searches for raw meeting links, and replaces them with unique registrant registration or joining links to prevent exposure of master URLs.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="bg-white/50 border-teal-200 text-teal-700">Fetch-Enrich-Restore</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-teal-200 text-teal-700">Unique Registration Links</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-teal-200 text-teal-700">Unique Joining Links</Badge>
                                </div>
                                <Button 
                                    onClick={handleSeedMeetingTemplates} 
                                    disabled={isSeeding}
                                    className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-200 border-none min-w-[180px]"
                                >
                                    {isSeeding ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <CalendarPlus className="h-4 w-4 mr-2" />
                                    )}
                                    {isSeeding ? 'Processing...' : 'Enrich & Seed Meeting Templates'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100 bg-amber-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sparkles className="h-24 w-24 text-amber-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Global Blueprint (FER Protocol)</span>
                            </div>
                            <CardTitle className="text-xl text-amber-950">Global Messaging Blueprints Seeding</CardTitle>
                            <CardDescription className="max-w-2xl text-amber-900/70">
                                Run the complete messaging blueprints seeding protocol. This seeds the full suite of 100 global templates and default workspace styles, automatically upgrading all meeting invitation email templates into high-fidelity Visual Block (<code className="text-xs font-mono bg-amber-100/50 px-1 py-0.5 rounded text-amber-800">rich_builder</code>) layouts pre-wired with the interactive one-click RSVP block.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="bg-white/50 border-amber-200 text-amber-700">Global Templates & Styles</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-amber-200 text-amber-700">Rich RSVP Blocks</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-amber-200 text-amber-700">One-Click Response</Badge>
                                </div>
                                <Button 
                                    onClick={handleSeedGlobalBlueprints} 
                                    disabled={isGlobalSeeding}
                                    className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-200 border-none min-w-[180px]"
                                >
                                    {isGlobalSeeding ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Sparkles className="h-4 w-4 mr-2" />
                                    )}
                                    {isGlobalSeeding ? 'Syncing...' : 'Sync Global Blueprints'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-violet-100 bg-violet-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Layers className="h-24 w-24 text-violet-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Visual Blocks Migration</span>
                            </div>
                            <CardTitle className="text-xl text-violet-950">Upgrade to Visual Block Templates</CardTitle>
                            <CardDescription className="max-w-2xl text-violet-900/70">
                                Run the Fetch-Enrich-Restore protocol to convert all legacy text/HTML email templates in the backoffice and administrative sections into Visual Block Style templates.
                                This parses plain text/HTML layouts, structures them into responsive block formats, and shifts their content mode to visual blocks so they can be edited using the drag-and-drop designer.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="bg-white/50 border-violet-200 text-violet-700">Visual Block Format</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-violet-200 text-violet-700">Drag-and-Drop Editor</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-violet-200 text-violet-700">HTML Parity</Badge>
                                </div>
                                <Button 
                                    onClick={handleMigrateToVisualBlocks} 
                                    disabled={isMigrating}
                                    className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-200 border-none min-w-[180px]"
                                >
                                    {isMigrating ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Layers className="h-4 w-4 mr-2" />
                                    )}
                                    {isMigrating ? 'Migrating...' : 'Migrate to Visual Blocks'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-rose-100 bg-rose-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Zap className="h-24 w-24 text-rose-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Meetings Infrastructure FER</span>
                            </div>
                            <CardTitle className="text-xl text-rose-950">Meetings & Registrants Upgrade</CardTitle>
                            <CardDescription className="max-w-2xl text-rose-900/70">
                                Run the Meetings FER migration protocol for the active workspace. This enriches all scoped meeting configurations, ensures event reminder time slots exist, and upgrades active registrants' personalized join URLs to the secure token-based routing system.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="bg-white/50 border-rose-200 text-rose-700">Enriched Configs</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-rose-200 text-rose-700">Secure Join URLs</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-rose-200 text-rose-700">Reminder Slots</Badge>
                                </div>
                                <Button 
                                    onClick={handleRunMeetingsFer} 
                                    disabled={isMeetingsFerRunning || !activeWorkspaceId || !activeOrganizationId}
                                    className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 border-none min-w-[180px]"
                                >
                                    {isMeetingsFerRunning ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Zap className="h-4 w-4 mr-2" />
                                    )}
                                    {isMeetingsFerRunning ? 'Executing...' : 'Run Meetings FER'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}
