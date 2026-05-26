import { Metadata } from 'next';
import StylesClient from '@/app/admin/backoffice/messaging/styles/StylesClient';

export const metadata: Metadata = {
  title: 'Global Style Wrapper Management | Back Office',
  description: 'Manage system-wide email layouts, branding wrappers, and presets.',
};

export default async function BackOfficeStylesPage() {
  return <StylesClient />;
}
