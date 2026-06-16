'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarPlus, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { backfillDisplayNameLower } from '@/lib/entities/backfill-display-name-lower';
import { seedEnrichedMeetingTemplatesAction } from '@/app/actions/seed-meeting-invitation-templates-action';
import { seedDefaultStyleBlueprintsAction } from '@/app/actions/seed-default-style-blueprints-action';
import { seedGlobalTemplatesAction } from '@/app/actions/seed-global-templates-action';
import { useTenant } from '@/context/TenantContext';

export default function SeedsClient() {
    const { toast } = useToast();
    const { activeWorkspaceId, activeOrganizationId } = useTenant();
    const [isSeeding, setIsSeeding] = React.useState(false);
    const [isGlobalSeeding, setIsGlobalSeeding] = React.useState(false);

    const handleSeedGlobalTemplates = async () => {
        setIsGlobalSeeding(true);
        try {
            const result = await seedGlobalTemplatesAction();
            if (result.created > 0) {
                toast({
                    title: 'Global Messaging Blueprints Seeded',
                    description: `Successfully seeded/verified ${result.created} global templates.`,
                });
            } else if (result.errors?.length > 0) {
                toast({
                    variant: 'destructive',
                    title: 'Seeding Failed',
                    description: result.errors[0]?.error || 'Failed to seed global messaging blueprints.',
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Execution Error',
                description: error.message || 'An error occurred during global messaging blueprints seeding.',
            });
        }
        setIsGlobalSeeding(false);
    };

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

    // ── Entity search-index backfill (Phase 5.2) ──
    const [isBackfilling, setIsBackfilling] = React.useState(false);
    const [backfillStats, setBackfillStats] = React.useState<{ processed: number; updated: number } | null>(null);

    const handleBackfillSearchIndex = async () => {
        setIsBackfilling(true);
        setBackfillStats({ processed: 0, updated: 0 });
        try {
            let afterId: string | undefined = undefined;
            let processed = 0;
            let updated = 0;
            // Client-driven loop: each call backfills one page (≤400 docs) and
            // returns the next cursor, so no single request runs long.
            do {
                const res = await backfillDisplayNameLower(afterId ? { afterId } : undefined);
                processed += res.processed;
                updated += res.updated;
                setBackfillStats({ processed, updated });
                afterId = res.nextCursor ?? undefined;
            } while (afterId);
            toast({
                title: 'Search index backfilled',
                description: `${processed.toLocaleString()} scanned · ${updated.toLocaleString()} updated.`,
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Backfill failed', description: error.message });
        } finally {
            setIsBackfilling(false);
        }
    };

    const [isStyleSeeding, setIsStyleSeeding] = React.useState(false);

    const handleSeedDefaultStyleBlueprints = async () => {
        setIsStyleSeeding(true);
        try {
            const result = await seedDefaultStyleBlueprintsAction();
            if (result.success) {
                toast({
                    title: 'Blueprints Customized to Default Style',
                    description: `Successfully executed FER protocol. Updated ${result.updatedCount} blueprints out of ${result.totalProcessed} total blueprints to use target-aware default template style.`,
                });
            } else if (result.errors?.length > 0) {
                toast({
                    variant: 'destructive',
                    title: 'Style Seeding Failed',
                    description: result.errors[0]?.error || 'Failed to update blueprint styles.',
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Execution Error',
                description: error.message || 'An error occurred during default style seeding.',
            });
        }
        setIsStyleSeeding(false);
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
                    <Card className="border-blue-100 bg-blue-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Search className="h-24 w-24 text-blue-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Entity Search Index</span>
                            </div>
                            <CardTitle className="text-xl text-blue-950">Backfill Entity Search Index</CardTitle>
                            <CardDescription className="max-w-2xl text-blue-900/70">
                                Adds the searchable <code>displayNameLower</code> field to existing entities so the new paginated entity search (deal picker, audiences, dropdowns) can find them. New and edited entities get it automatically — this one-time pass covers legacy records. Safe to re-run (only touches rows missing the field).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2 items-center">
                                    <Badge variant="outline" className="bg-white/50 border-blue-200 text-blue-700">Cursor-based</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-blue-200 text-blue-700">Idempotent</Badge>
                                    {backfillStats && (
                                        <Badge variant="outline" className="bg-white/50 border-blue-200 text-blue-700 tabular-nums">
                                            {backfillStats.processed.toLocaleString()} scanned · {backfillStats.updated.toLocaleString()} updated
                                        </Badge>
                                    )}
                                </div>
                                <Button
                                    onClick={handleBackfillSearchIndex}
                                    disabled={isBackfilling}
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 border-none min-w-[180px]"
                                >
                                    {isBackfilling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                    {isBackfilling ? 'Backfilling…' : 'Backfill Search Index'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

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

                    <Card className="border-indigo-100 bg-indigo-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <CalendarPlus className="h-24 w-24 text-indigo-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Style Reconciliation</span>
                            </div>
                            <CardTitle className="text-xl text-indigo-950">Target-Aware Blueprint Styling (FER)</CardTitle>
                            <CardDescription className="max-w-2xl text-indigo-900/70">
                                Run the Fetch-Enrich-Restore protocol to migrate all system blueprints and customized templates to use the default target-aware style wrapper.
                                This ensures internal templates render with clean internal layouts and external client messages use professional external layouts.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Fetch-Enrich-Restore</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Internal Wrappers</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">External Wrappers</Badge>
                                </div>
                                <Button 
                                    onClick={handleSeedDefaultStyleBlueprints} 
                                    disabled={isStyleSeeding}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 border-none min-w-[180px]"
                                >
                                    {isStyleSeeding ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <CalendarPlus className="h-4 w-4 mr-2" />
                                    )}
                                    {isStyleSeeding ? 'Processing...' : 'Seed Default Style Wrappers'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-purple-100 bg-purple-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <CalendarPlus className="h-24 w-24 text-purple-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Global Registry</span>
                            </div>
                            <CardTitle className="text-xl text-purple-950">Global Messaging Blueprints</CardTitle>
                            <CardDescription className="max-w-2xl text-purple-900/70">
                                Seed or update the global default messaging templates and triggers in the system registry. This imports and updates the latest definitions for reschedule, cancellation, and registration alerts.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="bg-white/50 border-purple-200 text-purple-700">Triggers & Registry</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-purple-200 text-purple-700">System Blueprints</Badge>
                                </div>
                                <Button 
                                    onClick={handleSeedGlobalTemplates} 
                                    disabled={isGlobalSeeding}
                                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200 border-none min-w-[180px]"
                                >
                                    {isGlobalSeeding ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <CalendarPlus className="h-4 w-4 mr-2" />
                                    )}
                                    {isGlobalSeeding ? 'Processing...' : 'Seed Global Blueprints'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}
