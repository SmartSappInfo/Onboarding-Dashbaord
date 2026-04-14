import { UpcomingMeetings } from '@/components/dashboard/UpcomingMeetings';
import { getUpcomingMeetings } from '@/lib/dashboard-server';

export async function MeetingsWidgetServer({ workspaceId }: { workspaceId: string }) {
    const meetings = await getUpcomingMeetings(workspaceId);
    return <UpcomingMeetings meetings={meetings} />;
}
