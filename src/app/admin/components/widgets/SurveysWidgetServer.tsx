import { LatestSurveys } from '@/components/dashboard/LatestSurveys';
import { getLatestSurveys } from '@/lib/dashboard-server';

export async function SurveysWidgetServer({ workspaceId }: { workspaceId: string }) {
    const surveys = await getLatestSurveys(workspaceId);
    return <LatestSurveys surveys={surveys} />;
}
