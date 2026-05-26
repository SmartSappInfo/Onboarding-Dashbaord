'use client';

import * as React from 'react';
import { useFirestore, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useCampaigns, createCampaign, archiveCampaign, deleteCampaign, cloneCampaign } from '@/lib/campaign-hooks';
import { useToast } from '@/hooks/use-toast';
import type { MessageCampaign } from '@/lib/types';
import { CampaignList } from './components/campaign-list';
import { Button } from '@/components/ui/button';
import { Plus, Megaphone } from 'lucide-react';
import { PageContainer } from '@/components/ui/page-container';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import dynamic from 'next/dynamic';

// bundle-dynamic-imports: lazy load wizard + analytics (Vercel best practice)
const CampaignWizard = dynamic(
    () => import('./components/campaign-wizard').then(m => ({ default: m.CampaignWizard })),
    { ssr: false, loading: () => <div className="flex items-center justify-center py-32"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> }
);
const CampaignAnalytics = dynamic(
    () => import('./components/campaign-analytics').then(m => ({ default: m.CampaignAnalytics })),
    { ssr: false, loading: () => <div className="flex items-center justify-center py-32"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> }
);

export default function CampaignsPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as any;
    const { toast } = useToast();

    const { campaigns, isLoading } = useCampaigns(activeWorkspaceId);

    const [wizardOpen, setWizardOpen] = React.useState(false);
    const [editingCampaign, setEditingCampaign] = React.useState<MessageCampaign | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<MessageCampaign | null>(null);
    const [analyticsTarget, setAnalyticsTarget] = React.useState<MessageCampaign | null>(null);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleNewCampaign = () => {
        setEditingCampaign(null);
        setWizardOpen(true);
    };

    const handleEdit = (campaign: MessageCampaign) => {
        setEditingCampaign(campaign);
        setWizardOpen(true);
    };

    const handleClone = async (campaign: MessageCampaign) => {
        if (!firestore || !user) return;
        try {
            await cloneCampaign(firestore, campaign, user.uid);
            toast({ title: 'Campaign Cloned', description: `"Copy of ${campaign.internalName}" created as draft.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Clone Failed', description: e.message });
        }
    };

    const handleArchive = async (campaign: MessageCampaign) => {
        if (!firestore) return;
        try {
            await archiveCampaign(firestore, campaign.id);
            toast({ title: 'Campaign Archived' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Archive Failed', description: e.message });
        }
    };

    const handleConfirmDelete = async () => {
        if (!firestore || !deleteTarget) return;
        try {
            await deleteCampaign(firestore, deleteTarget.id);
            toast({ title: 'Draft Deleted' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleWizardClose = () => {
        setWizardOpen(false);
        setEditingCampaign(null);
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    if (analyticsTarget) {
        return (
            <div className="h-full overflow-y-auto">
                <CampaignAnalytics
                    campaign={analyticsTarget}
                    onBack={() => setAnalyticsTarget(null)}
                />
            </div>
        );
    }

    if (wizardOpen) {
        return (
            <div className="h-full overflow-y-auto">
                <CampaignWizard
                    campaign={editingCampaign}
                    onClose={handleWizardClose}
                />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <PageContainer>
                <div className="space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Megaphone className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight">Campaigns</h2>
                            <p className="text-[10px] font-bold text-muted-foreground">
                                Create, schedule, and track targeted outreach
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={handleNewCampaign}
                        className="h-11 px-6 rounded-xl font-bold text-xs shadow-lg gap-2"
                    >
                        <Plus className="h-4 w-4" /> New Campaign
                    </Button>
                </div>

                {/* Campaign list */}
                <CampaignList
                    campaigns={campaigns}
                    isLoading={isLoading}
                    onEdit={handleEdit}
                    onClone={handleClone}
                    onArchive={handleArchive}
                    onDelete={(c) => setDeleteTarget(c)}
                    onViewAnalytics={(c) => setAnalyticsTarget(c)}
                />

                {/* Delete confirmation dialog */}
                <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Draft Campaign?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs font-semibold">
                                This will permanently delete &quot;{deleteTarget?.internalName}&quot;. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl font-bold text-xs">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmDelete} className="rounded-xl font-bold text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
            </PageContainer>
        </div>
    );
}
