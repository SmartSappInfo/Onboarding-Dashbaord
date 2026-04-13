import FormsClient from './FormsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Form Builder',
  description: 'Design, publish, and manage workspace-scoped data capture forms.',
};

export default function FormsPage() {
  return <FormsClient />;
}
