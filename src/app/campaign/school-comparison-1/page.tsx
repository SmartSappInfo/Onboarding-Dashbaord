import { Metadata } from 'next';
import SchoolComparisonClientV1 from './components/SchoolComparisonClientV1';

export const metadata: Metadata = {
  title: 'Is Your School Operating Like School A or School B? (V1)',
  description: 'Every parent brings a dream to your gate. Daily processes either protect that dream…Or slowly wear it down. Find out which side your school is on',
};

export default function SchoolComparisonV1Page() {
  return <SchoolComparisonClientV1 />;
}
