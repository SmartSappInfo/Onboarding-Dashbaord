import { Metadata } from 'next';
import { ProductsClient } from './ProductsClient';

export const metadata: Metadata = {
  title: 'Product Catalogue | SmartSapp Finance',
  description: 'Manage institutional products, service tiers, SKUs, and default tax configurations.',
};

export default function FinanceProductsPage() {
  return <ProductsClient />;
}
