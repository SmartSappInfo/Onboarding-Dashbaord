
import PackagesClient from './PackagesClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Commercial & Pricing Hub',
  description: 'Manage standard products, subscription packages, price books, categories, and commercial analytics.',
};

export default function PackagesPage() {
  return <PackagesClient />;
}
