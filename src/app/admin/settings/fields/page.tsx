import { Metadata } from 'next';
import FieldsClient from './FieldsClient';

export const metadata: Metadata = {
  title: 'Fields & Variables',
  description: 'Manage workspace-scoped data fields, custom variables, and messaging template tags.',
};

export default function FieldsPage() {
  return <FieldsClient />;
}
