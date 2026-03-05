import SurveysClient from './SurveysClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Survey Intelligence',
  description: 'Manage intelligent, logic-driven feedback forms and behavioral assessments across the SmartSapp network.',
};

export default function SurveysPage() {
  return <SurveysClient />;
}
