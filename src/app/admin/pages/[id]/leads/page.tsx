import { adminDb } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import LeadsClient from './LeadsClient';
import { CampaignPage } from '@/lib/types';
import { getLeadsForPageAction } from '@/lib/lead-actions';

interface LeadsPageProps {
    params: Promise<{ id: string }>;
}

export default async function LeadsPage({ params }: LeadsPageProps) {
    const { id } = await params;

    const pageSnap = await adminDb.collection('campaign_pages').doc(id).get();
    if (!pageSnap.exists) {
        return notFound();
    }

    const page = { id: pageSnap.id, ...pageSnap.data() } as CampaignPage;
    
    // Initial fetch of leads
    const leadsRes = await getLeadsForPageAction(id);
    const initialLeads = leadsRes.success ? leadsRes.data || [] : [];

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <LeadsClient 
                page={page}
                initialLeads={initialLeads}
            />
        </div>
    );
}
