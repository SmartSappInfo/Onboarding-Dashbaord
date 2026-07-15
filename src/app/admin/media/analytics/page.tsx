import { Metadata } from 'next';
import MediaAnalyticsClient from './MediaAnalyticsClient';

export const metadata: Metadata = {
  title: 'Media Share Analytics | SmartSapp',
  description: 'Track views, plays, completions, and conversions for shared media pages.',
};

export const dynamic = 'force-dynamic';

export default function MediaAnalyticsHubPage() {
  return <MediaAnalyticsClient />;
}
