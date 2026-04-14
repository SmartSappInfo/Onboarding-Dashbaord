import { MessagingWidget } from '@/components/dashboard/MessagingWidget';
import { getMessagingMetrics } from '@/lib/dashboard-server';

export async function MessagingWidgetServer({ workspaceId }: { workspaceId: string }) {
    const metrics = await getMessagingMetrics(workspaceId);
    return <MessagingWidget {...metrics} />;
}
