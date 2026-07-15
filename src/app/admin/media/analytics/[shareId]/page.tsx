import { Metadata } from 'next';
import ShareAnalyticsDrilldown from './ShareAnalyticsDrilldown';

export const metadata: Metadata = {
  title: 'Media Page Engagement Drilldown | SmartSapp',
  description: 'Detailed analytics and contact view records for shared media pages.',
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ shareId: string }>;
}

export default async function MediaShareDrilldownPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <ShareAnalyticsDrilldown shareId={resolvedParams.shareId} />;
}
