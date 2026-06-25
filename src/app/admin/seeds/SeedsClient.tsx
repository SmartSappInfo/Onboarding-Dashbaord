'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarPlus, Search, Fingerprint } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { backfillDisplayNameLower } from '@/lib/entities/backfill-display-name-lower';
import { backfillWorkspaceContacts } from '@/lib/contacts/backfill-workspace-contacts';
import { reconcileWorkspaceContacts } from '@/lib/contacts/contact-projection-writer';
import { seedEnrichedMeetingTemplatesAction } from '@/app/actions/seed-meeting-invitation-templates-action';
import { seedDefaultStyleBlueprintsAction } from '@/app/actions/seed-default-style-blueprints-action';
import { seedGlobalTemplatesAction } from '@/app/actions/seed-global-templates-action';
import { backfillSenderOrgAction } from '@/app/actions/backfill-sender-org-action';
import type { BackfillReport } from '@/lib/migrations/backfill-sender-org';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';

export default function SeedsClient() {
    const { toast } = useToast();
    const { activeWorkspaceId, activeOrganizationId } = useTenant();
    const { user } = useUser();
    const [isSeeding, setIsSeeding] = React.useState(false);
    const [isGlobalSeeding, setIsGlobalSeeding] = React.useState(false);

    // ── Sender organization backfill (org-sender-isolation, Phase 1) ──
    const [isSenderOrgBackfilling, setIsSenderOrgBackfilling] = React.useState(false);
    const [senderOrgReport, setSenderOrgReport] = React.useState<BackfillReport | null>(null);
    // Apply is gated on a clean dry-run: no profile may be left ambiguous/orphan.
    const senderOrgClean = !!senderOrgReport && senderOrgReport.ambiguous.length === 0 && senderOrgReport.orphan.length === 0;

    const handleSenderOrgBackfill = async (mode: 'dry-run' | 'apply') => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Not signed in', description: 'Sign in as a system admin to run this migration.' });
            return;
        }
        if (mode === 'apply' && !window.confirm('Apply the sender backfill? This writes organizationId onto sender_profiles and seeds organization default senders.')) {
            return;
        }
        setIsSenderOrgBackfilling(true);
        try {
            const idToken = await user.getIdToken();
            const result = await backfillSenderOrgAction(idToken, mode);
            if (result.success && result.report) {
                setSenderOrgReport(result.report);
                const r = result.report;
                toast({
                    title: mode === 'dry-run' ? 'Dry run complete' : 'Backfill applied',
                    description: `${r.scanned} scanned · ${r.assigned} assigned · ${r.alreadyTagged} already tagged · ${r.ambiguous.length} ambiguous · ${r.orphan.length} orphan · ${r.orgDefaultsSeeded.length} defaults seeded · ${r.orgsMissingDefault.length} orgs missing default`,
                });
            } else {
                toast({ variant: 'destructive', title: 'Backfill failed', description: result.error || 'Unknown error.' });
            }
        } catch (error: unknown) {
            toast({ variant: 'destructive', title: 'Execution error', description: error instanceof Error ? error.message : 'Failed to run sender backfill.' });
        } finally {
            setIsSenderOrgBackfilling(false);
        }
    };

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

    // ── Contact projection backfill (Phase 6.0) ──
    const [isContactsBackfilling, setIsContactsBackfilling] = React.useState(false);
    const [contactsBackfillStats, setContactsBackfillStats] = React.useState<{ processed: number; written: number } | null>(null);

    const handleBackfillContacts = async () => {
        setIsContactsBackfilling(true);
        setContactsBackfillStats({ processed: 0, written: 0 });
        try {
            let afterId: string | undefined = undefined;
            let processed = 0;
            let written = 0;
            // Client-driven loop: each call projects one page of entities (≤100)
            // into workspace_contacts and returns the next cursor.
            do {
                const res = await backfillWorkspaceContacts(afterId ? { afterId } : undefined);
                processed += res.processed;
                written += res.written;
                setContactsBackfillStats({ processed, written });
                afterId = res.nextCursor ?? undefined;
            } while (afterId);
            toast({
                title: 'Contact projection backfilled',
                description: `${processed.toLocaleString()} entities scanned · ${written.toLocaleString()} contacts projected.`,
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Backfill failed', description: error.message });
        } finally {
            setIsContactsBackfilling(false);
        }
    };

    // ── Contact projection reconcile (Phase 6.1) — heals drift (upsert + delete) ──
    const [isReconciling, setIsReconciling] = React.useState(false);
    const [reconcileStats, setReconcileStats] = React.useState<{ processed: number; upserts: number; deletes: number } | null>(null);

    const handleReconcileContacts = async () => {
        setIsReconciling(true);
        setReconcileStats({ processed: 0, upserts: 0, deletes: 0 });
        try {
            let afterId: string | undefined = undefined;
            let processed = 0;
            let upserts = 0;
            let deletes = 0;
            do {
                const res = await reconcileWorkspaceContacts(afterId ? { afterId } : undefined);
                processed += res.processed;
                upserts += res.upserts;
                deletes += res.deletes;
                setReconcileStats({ processed, upserts, deletes });
                afterId = res.nextCursor ?? undefined;
            } while (afterId);
            toast({
                title: 'Contact projection reconciled',
                description: `${processed.toLocaleString()} entities · ${upserts.toLocaleString()} upserts · ${deletes.toLocaleString()} deletes.`,
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Reconcile failed', description: error.message });
        } finally {
            setIsReconciling(false);
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
                    <Card className="border-rose-100 bg-rose-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Fingerprint className="h-24 w-24 text-rose-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Sender Tenant Isolation · run before deploy</span>
                            </div>
                            <CardTitle className="text-xl text-rose-950">Backfill Sender Organization</CardTitle>
                            <CardDescription className="max-w-2xl text-rose-900/70">
                                Stamps <code>organizationId</code> onto every <code>sender_profiles</code> record (derived from its workspaces) and seeds each organization&apos;s default sender per channel. The messaging engine now resolves senders strictly within an organization with <strong>no global fallback</strong>, so this must run <strong>before</strong> the new engine ships. Always <strong>Dry Run first</strong> — Apply unlocks only when zero profiles are ambiguous or orphaned. Idempotent &amp; safe to re-run.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-4">
                                {senderOrgReport && (
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <Badge variant="outline" className="bg-white/50 border-rose-200 text-rose-700 tabular-nums">{senderOrgReport.scanned.toLocaleString()} scanned</Badge>
                                        <Badge variant="outline" className="bg-white/50 border-rose-200 text-rose-700 tabular-nums">{senderOrgReport.assigned.toLocaleString()} assigned</Badge>
                                        <Badge variant="outline" className="bg-white/50 border-rose-200 text-rose-700 tabular-nums">{senderOrgReport.alreadyTagged.toLocaleString()} already tagged</Badge>
                                        <Badge variant="outline" className="bg-white/50 border-emerald-200 text-emerald-700 tabular-nums">{senderOrgReport.orgDefaultsSeeded.length} defaults seeded</Badge>
                                        {senderOrgReport.ambiguous.length > 0 && <Badge variant="outline" className="bg-rose-100 border-rose-300 text-rose-800 tabular-nums">{senderOrgReport.ambiguous.length} ambiguous</Badge>}
                                        {senderOrgReport.orphan.length > 0 && <Badge variant="outline" className="bg-rose-100 border-rose-300 text-rose-800 tabular-nums">{senderOrgReport.orphan.length} orphan</Badge>}
                                        {senderOrgReport.orgsMissingDefault.length > 0 && <Badge variant="outline" className="bg-amber-100 border-amber-300 text-amber-800 tabular-nums">{senderOrgReport.orgsMissingDefault.length} orgs missing default</Badge>}
                                        <Badge variant="outline" className={`tabular-nums ${senderOrgReport.mode === 'apply' ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-white/50 border-rose-200 text-rose-700'}`}>{senderOrgReport.mode === 'apply' ? 'APPLIED' : 'dry-run'}</Badge>
                                    </div>
                                )}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <Badge variant="outline" className="bg-white/50 border-rose-200 text-rose-700">Idempotent</Badge>
                                        <Badge variant="outline" className="bg-white/50 border-rose-200 text-rose-700">System admin only</Badge>
                                        <Badge variant="outline" className="bg-white/50 border-rose-200 text-rose-700">Dry-run gated</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => handleSenderOrgBackfill('dry-run')}
                                            disabled={isSenderOrgBackfilling}
                                            className="border-rose-200 text-rose-700 hover:bg-rose-100/50 min-w-[120px]"
                                        >
                                            {isSenderOrgBackfilling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                            Dry Run
                                        </Button>
                                        <Button
                                            onClick={() => handleSenderOrgBackfill('apply')}
                                            disabled={isSenderOrgBackfilling || !senderOrgClean}
                                            title={!senderOrgClean ? 'Run a clean dry-run first (no ambiguous/orphan profiles)' : 'Apply the backfill'}
                                            className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 border-none min-w-[120px]"
                                        >
                                            {isSenderOrgBackfilling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Fingerprint className="h-4 w-4 mr-2" />}
                                            Apply
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

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

                    <Card className="border-blue-100 bg-blue-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Search className="h-24 w-24 text-blue-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Contact Projection</span>
                            </div>
                            <CardTitle className="text-xl text-blue-950">Backfill Contact Projection</CardTitle>
                            <CardDescription className="max-w-2xl text-blue-900/70">
                                Flattens each entity's <code>entityContacts</code> into the new <code>workspace_contacts</code> collection — one row per contact — so audience builders (composer, campaigns, manual selector, tag assignment) can search and segment contacts server-side instead of loading every entity. New and edited contacts get projected automatically; this one-time pass covers existing records. Idempotent (deterministic ids), so safe to re-run.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2 items-center">
                                    <Badge variant="outline" className="bg-white/50 border-blue-200 text-blue-700">Cursor-based</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-blue-200 text-blue-700">Idempotent</Badge>
                                    {contactsBackfillStats && (
                                        <Badge variant="outline" className="bg-white/50 border-blue-200 text-blue-700 tabular-nums">
                                            {contactsBackfillStats.processed.toLocaleString()} entities · {contactsBackfillStats.written.toLocaleString()} contacts
                                        </Badge>
                                    )}
                                    {reconcileStats && (
                                        <Badge variant="outline" className="bg-white/50 border-amber-200 text-amber-700 tabular-nums">
                                            {reconcileStats.upserts.toLocaleString()} upserts · {reconcileStats.deletes.toLocaleString()} deletes
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={handleReconcileContacts}
                                        disabled={isReconciling || isContactsBackfilling}
                                        className="border-blue-200 text-blue-700 hover:bg-blue-100/50"
                                        title="Heal drift: re-derive every entity's contact rows and delete removed ones"
                                    >
                                        {isReconciling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                        {isReconciling ? 'Reconciling…' : 'Reconcile'}
                                    </Button>
                                    <Button
                                        onClick={handleBackfillContacts}
                                        disabled={isContactsBackfilling || isReconciling}
                                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 border-none min-w-[180px]"
                                    >
                                        {isContactsBackfilling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                        {isContactsBackfilling ? 'Backfilling…' : 'Backfill Contacts'}
                                    </Button>
                                </div>
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
