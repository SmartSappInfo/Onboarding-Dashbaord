import { AnalyticsClient } from './AnalyticsClient';

export const metadata = {
  title: 'Page Analytics | SmartSapp',
};

export default function PageAnalyticsRoute({ params }: { params: Promise<{ id: string }> }) {
  return <AnalyticsClient params={params} />;
}
