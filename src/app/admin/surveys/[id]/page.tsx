import { SurveySummaryClient } from './components/SurveySummaryClient';
import dynamic from 'next/dynamic';

const SummaryClientDynamic = dynamic(() => import('./components/SurveySummaryClient'), { ssr: false });

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SurveyDetailPage({ params }: Props) {
  const { id } = await params;
  
  return <SummaryClientDynamic id={id} />;
}
