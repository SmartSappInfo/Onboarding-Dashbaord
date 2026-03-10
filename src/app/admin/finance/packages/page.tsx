
import PackagesClient from './PackagesClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing Hub',
  description: 'Manage institutional subscription packages, student-based rates, and billing terms.',
};

export default function PackagesPage() {
  return <PackagesClient />;
}
